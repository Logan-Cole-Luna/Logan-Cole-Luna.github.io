/* Debris-field globe: live canvas render from TLE mean elements (two-body Kepler).
   Altitudes exaggerated by K for legibility; time compressed so a LEO orbit takes ~14 s. */
(function () {
  const canvas = document.getElementById("debris");
  if (!canvas || !canvas.getContext) return;
  const still = document.querySelector(".fig-still");
  const ctx = canvas.getContext("2d");

  const RE = 6371, K = 3.2, EXTENT = RE * 2.35;
  const TIME_SCALE = 420;                 // simulated seconds per real second
  const EARTH_SPIN = 2 * Math.PI / 86164; // rad per simulated second
  const THEMES = {
    space: {
      bg: ["#152033", "#0a101b"],
      earth: ["rgb(96,152,204)", "rgb(40,86,134)", "rgb(12,32,58)"],
      grid: "rgba(190,215,245,0.22)", limb: "rgba(4,10,22,0.5)",
      colors: [[86, 214, 232], [130, 156, 255], [130, 226, 150]],
      lineBack: 0.09, lineFront: 0.1, dotBack: 0.28, dotFront: 0.78
    },
    paper: {
      bg: null,   // drawn straight on the card paper
      earth: ["rgb(118,160,186)", "rgb(62,108,140)", "rgb(26,56,80)"],
      grid: "rgba(236,226,204,0.30)", limb: "rgba(10,25,40,0.30)",
      colors: [[168, 70, 31], [192, 138, 43], [90, 106, 98]],
      lineBack: 0.13, lineFront: 0.16, dotBack: 0.5, dotFront: 0.92
    }
  };
  const TH = THEMES[canvas.dataset.theme] || THEMES.space;
  const COLORS = TH.colors;
  const D2R = Math.PI / 180;
  const reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  let groups = [], W = 0, scale = 1, cx = 0, cy = 0, ER = 0, dpr = 1;
  let running = false, visible = true, t0 = performance.now(), tPaused = 0;

  function rot(i, O, w) {
    const cO = Math.cos(O), sO = Math.sin(O), ci = Math.cos(i), si = Math.sin(i), cw = Math.cos(w), sw = Math.sin(w);
    return [cO * cw - sO * sw * ci, -cO * sw - sO * cw * ci,
            sO * cw + cO * sw * ci, -sO * sw + cO * cw * ci,
            sw * si, cw * si];
  }
  const vis = r => RE + (r - RE) * K;

  // Illustrative agent satellite: circular 700 km orbit (environment default altitude)
  const MU = 398600.4418;
  const AG_A = RE + 700, AG_N = Math.sqrt(MU / (AG_A * AG_A * AG_A));   // rad per simulated second
  const AG_R = rot(63 * D2R, 40 * D2R, 0), AG_RV = vis(AG_A);
  const AG_PTS = new Float32Array(181 * 3);
  for (let j = 0; j <= 180; j++) {
    const nu = j / 180 * 2 * Math.PI, x = AG_RV * Math.cos(nu), y = AG_RV * Math.sin(nu);
    AG_PTS[j * 3] = AG_R[0] * x + AG_R[1] * y; AG_PTS[j * 3 + 1] = AG_R[2] * x + AG_R[3] * y; AG_PTS[j * 3 + 2] = AG_R[4] * x + AG_R[5] * y;
  }
  const agentPos = nu => {
    const x = AG_RV * Math.cos(nu), y = AG_RV * Math.sin(nu);
    return [AG_R[0] * x + AG_R[1] * y, AG_R[2] * x + AG_R[3] * y, AG_R[4] * x + AG_R[5] * y];
  };
  const WIN = 0.5;                       // encounter window, rad of true anomaly
  let NU_C = 0, NU_0 = 0;                // conjunction anomaly, satellite start anomaly
  const INK = "#173f35", INK_RGB = "23,63,53", RUST = "168,70,31", OCHRE = "#c08a2b", SOFT = "103,97,90";

  function prepare(data) {
    groups = data.groups.map((g, gi) => {
      const objs = g.objs.map(o => {
        const [a, e, inc, raan, argp, M0, n] = o;
        return { a, e, R: rot(inc * D2R, raan * D2R, argp * D2R), M0: M0 * D2R, n: n * 2 * Math.PI / 86400 };
      });
      const lines = g.lines.map(k => {
        const o = objs[k], N = 120, pts = new Float32Array(N * 3);
        for (let j = 0; j < N; j++) {
          const nu = j / (N - 1) * 2 * Math.PI;
          const r = vis(o.a * (1 - o.e * o.e) / (1 + o.e * Math.cos(nu)));
          const x = r * Math.cos(nu), y = r * Math.sin(nu), R = o.R;
          pts[j * 3] = R[0] * x + R[1] * y; pts[j * 3 + 1] = R[2] * x + R[3] * y; pts[j * 3 + 2] = R[4] * x + R[5] * y;
        }
        return pts;
      });
      return { objs, lines, col: COLORS[gi % COLORS.length] };
    });
  }

  // Graticule as unit-sphere polylines in Earth-fixed coords
  const grid = [];
  for (let lat = -75; lat <= 75; lat += 15) {
    const p = []; for (let lo = 0; lo <= 360; lo += 5) p.push([lat * D2R, lo * D2R]); grid.push(p);
  }
  for (let lo = 0; lo < 360; lo += 15) {
    const p = []; for (let la = -90; la <= 90; la += 5) p.push([la * D2R, lo * D2R]); grid.push(p);
  }

  function resize() {
    const rect = canvas.getBoundingClientRect();
    dpr = Math.min(window.devicePixelRatio || 1, 2.5);
    W = Math.max(1, Math.round(rect.width * dpr));
    canvas.width = W; canvas.height = W;
    scale = (W / 2) / EXTENT; cx = cy = W / 2; ER = RE * scale;
  }

  function camera(t) {
    const ph = 2 * Math.PI * t / 26;
    const yaw = (-35 + 14 * Math.sin(ph)) * D2R, pitch = (24 + 4 * Math.sin(ph + 1.1)) * D2R;
    const cz = Math.cos(yaw), sz = Math.sin(yaw), cp = Math.cos(pitch), sp = Math.sin(pitch);
    // C = Rx(pitch) * Rz(yaw)
    return [cz, -sz, 0,
            cp * sz, cp * cz, -sp,
            sp * sz, sp * cz, cp];
  }

  function frame(now) {
    const t = reduce ? 0 : (now - t0) / 1000 + (window.DEBRIS_T_OFFSET || 0);
    const sim = t * TIME_SCALE;
    const C = camera(t);
    if (TH.bg) {
      const bg = ctx.createRadialGradient(W * 0.5, W * 0.42, 0, W * 0.5, W * 0.5, W * 0.75);
      bg.addColorStop(0, TH.bg[0]); bg.addColorStop(1, TH.bg[1]);
      ctx.fillStyle = bg; ctx.fillRect(0, 0, W, W);
    } else ctx.clearRect(0, 0, W, W);
    const u = W / 440;                     // size unit relative to a 440px figure
    const segBack = [], segFront = [], dotBack = [], dotFront = [];
    const R2 = (ER * 1.002) * (ER * 1.002);

    for (const g of groups) {
      // orbit lines
      for (const pts of g.lines) {
        let pb = null, pf = null;
        const back = [], front = [];
        for (let j = 0; j < pts.length; j += 3) {
          const x = pts[j], y = pts[j + 1], z = pts[j + 2];
          const vx = C[0] * x + C[1] * y + C[2] * z, vy = C[3] * x + C[4] * y + C[5] * z, vz = C[6] * x + C[7] * y + C[8] * z;
          const sx = cx + vx * scale, sy = cy - vz * scale, d = -vy;
          const hidden = d < 0 && ((sx - cx) ** 2 + (sy - cy) ** 2) < R2;
          const isFront = d > 0;
          if (!hidden && !isFront) { if (pb) back.push(pb[0], pb[1], sx, sy); pb = [sx, sy]; } else pb = null;
          if (isFront) { if (pf) front.push(pf[0], pf[1], sx, sy); pf = [sx, sy]; } else pf = null;
        }
        segBack.push([g.col, back]); segFront.push([g.col, front]);
      }
      // fragments
      for (const o of g.objs) {
        const M = o.M0 + o.n * sim;
        let E = M;
        for (let k = 0; k < 5; k++) E -= (E - o.e * Math.sin(E) - M) / (1 - o.e * Math.cos(E));
        const nu = 2 * Math.atan2(Math.sqrt(1 + o.e) * Math.sin(E / 2), Math.sqrt(1 - o.e) * Math.cos(E / 2));
        const r = vis(o.a * (1 - o.e * Math.cos(E)));
        const px = r * Math.cos(nu), py = r * Math.sin(nu), R = o.R;
        const x = R[0] * px + R[1] * py, y = R[2] * px + R[3] * py, z = R[4] * px + R[5] * py;
        const vx = C[0] * x + C[1] * y + C[2] * z, vy = C[3] * x + C[4] * y + C[5] * z, vz = C[6] * x + C[7] * y + C[8] * z;
        const sx = cx + vx * scale, sy = cy - vz * scale, d = -vy;
        if (d < 0 && ((sx - cx) ** 2 + (sy - cy) ** 2) < R2) continue;
        (d > 0 ? dotFront : dotBack).push(sx, sy, g.col);
      }
    }

    const strokeSegs = (list, alpha) => {
      ctx.lineWidth = 0.9 * u;
      for (const [col, s] of list) {
        if (!s.length) continue;
        ctx.strokeStyle = `rgba(${col[0]},${col[1]},${col[2]},${alpha})`;
        ctx.beginPath();
        for (let k = 0; k < s.length; k += 4) { ctx.moveTo(s[k], s[k + 1]); ctx.lineTo(s[k + 2], s[k + 3]); }
        ctx.stroke();
      }
    };
    const fillDots = (list, r, alpha) => {
      for (const col of COLORS) {           // one path per color
        ctx.fillStyle = `rgba(${col[0]},${col[1]},${col[2]},${alpha})`;
        ctx.beginPath();
        for (let k = 0; k < list.length; k += 3) {
          if (list[k + 2] !== col) continue;
          ctx.moveTo(list[k] + r, list[k + 1]); ctx.arc(list[k], list[k + 1], r, 0, 6.2832);
        }
        ctx.fill();
      }
    };

    // agent orbit, split into back / front
    const agBack = [], agFront = [], agHid = [];
    let pb = null, pf = null, ph = null;
    for (let j = 0; j < AG_PTS.length; j += 3) {
      const x = AG_PTS[j], y = AG_PTS[j + 1], z = AG_PTS[j + 2];
      const vx = C[0] * x + C[1] * y + C[2] * z, vy = C[3] * x + C[4] * y + C[5] * z, vz = C[6] * x + C[7] * y + C[8] * z;
      const sx = cx + vx * scale, sy = cy - vz * scale, d = -vy;
      const hidden = d < 0 && ((sx - cx) ** 2 + (sy - cy) ** 2) < R2;
      if (!hidden && d <= 0) { if (pb) agBack.push(pb[0], pb[1], sx, sy); pb = [sx, sy]; } else pb = null;
      if (d > 0) { if (pf) agFront.push(pf[0], pf[1], sx, sy); pf = [sx, sy]; } else pf = null;
      if (hidden) { if (ph) agHid.push(ph[0], ph[1], sx, sy); ph = [sx, sy]; } else ph = null;
    }
    const nuSat = NU_0 + AG_N * sim;
    const sp = project1(agentPos(nuSat), C), cp = project1(agentPos(NU_C), C);
    let dnu = ((nuSat - NU_C) % (2 * Math.PI) + 3 * Math.PI) % (2 * Math.PI) - Math.PI;
    const inWin = Math.abs(dnu) < WIN;

    strokeSegs(segBack, TH.lineBack);
    fillDots(dotBack, 1.25 * u, TH.dotBack);
    strokeSet(agBack, `rgba(${INK_RGB},0.75)`, 1.4 * u, null);
    if (sp[2] <= 0 && !sp[3]) diamond(sp[0], sp[1], 3.4 * u, 0.45);
    drawEarth(C, sim);
    // far side of the agent orbit, seen through the globe
    strokeSet(agHid, "rgba(241,236,224,0.75)", 1.1 * u, [3 * u, 3.2 * u]);
    if (sp[3]) {
      const r = 3.4 * u; ctx.beginPath(); ctx.moveTo(sp[0], sp[1] - r); ctx.lineTo(sp[0] + r, sp[1]); ctx.lineTo(sp[0], sp[1] + r); ctx.lineTo(sp[0] - r, sp[1]); ctx.closePath();
      ctx.strokeStyle = "rgba(241,236,224,0.9)"; ctx.lineWidth = 1.2 * u; ctx.stroke();
    }
    strokeSegs(segFront, TH.lineFront);
    fillDots(dotFront, 1.7 * u, TH.dotFront);
    strokeSet(agFront, `rgba(${INK_RGB},0.95)`, 1.8 * u, null);

    // inset geometry
    const ui = Math.max(u, 0.9 * dpr);   // keep the inset legible on narrow screens
    const bw = 152 * ui, bh = 112 * ui, bx = 8 * u, by = W - 8 * u - bh;
    if (cp[2] > 0) {
      // anchor on the inset border nearest the ring
      let lx = Math.min(Math.max(cp[0], bx + 6 * u), bx + bw - 6 * u), ly = Math.min(Math.max(cp[1], by), by + bh);
      if (cp[0] > bx + bw) lx = bx + bw; else if (cp[1] < by) ly = by;
      const ang = Math.atan2(ly - cp[1], lx - cp[0]), r0 = 6.5 * u;
      ctx.strokeStyle = `rgba(${INK_RGB},0.55)`; ctx.lineWidth = 1 * u;
      ctx.beginPath(); ctx.moveTo(cp[0] + Math.cos(ang) * r0, cp[1] + Math.sin(ang) * r0); ctx.lineTo(lx, ly); ctx.stroke();
      ctx.fillStyle = `rgba(${INK_RGB},0.7)`; ctx.beginPath(); ctx.arc(lx, ly, 1.8 * u, 0, 6.2832); ctx.fill();
      const rr = (inWin ? 5.6 : 4.6) * u;
      ctx.strokeStyle = "rgba(251,248,241,0.92)"; ctx.lineWidth = 3.6 * u;
      ctx.beginPath(); ctx.arc(cp[0], cp[1], rr, 0, 6.2832); ctx.stroke();
      ctx.strokeStyle = `rgba(${RUST},1)`; ctx.lineWidth = 1.6 * u;
      ctx.beginPath(); ctx.arc(cp[0], cp[1], rr, 0, 6.2832); ctx.stroke();
    }
    if (sp[2] > 0) {
      ctx.fillStyle = "rgba(251,248,241,0.85)"; ctx.beginPath(); ctx.arc(sp[0], sp[1], 7.2 * u, 0, 6.2832); ctx.fill();
      diamond(sp[0], sp[1], 5 * u, 1);
    }
    drawInset(bx, by, bw, bh, ui, inWin ? dnu / WIN : null);

    if (running) requestAnimationFrame(frame);
  }

  function project1(p, C) {
    const vx = C[0] * p[0] + C[1] * p[1] + C[2] * p[2], vy = C[3] * p[0] + C[4] * p[1] + C[5] * p[2], vz = C[6] * p[0] + C[7] * p[1] + C[8] * p[2];
    const sx = cx + vx * scale, sy = cy - vz * scale, d = -vy;
    return [sx, sy, d, d < 0 && ((sx - cx) ** 2 + (sy - cy) ** 2) < ER * ER];
  }

  function strokeSet(s, style, width, dash) {
    if (!s.length) return;
    ctx.strokeStyle = style; ctx.lineWidth = width; ctx.lineCap = "round"; ctx.setLineDash(dash || []);
    ctx.beginPath();
    for (let k = 0; k < s.length; k += 4) { ctx.moveTo(s[k], s[k + 1]); ctx.lineTo(s[k + 2], s[k + 3]); }
    ctx.stroke(); ctx.lineCap = "butt"; ctx.setLineDash([]);
  }

  function diamond(x, y, r, alpha) {
    ctx.globalAlpha = alpha;
    ctx.beginPath(); ctx.moveTo(x, y - r); ctx.lineTo(x + r, y); ctx.lineTo(x, y + r); ctx.lineTo(x - r, y); ctx.closePath();
    ctx.fillStyle = INK; ctx.fill();
    ctx.strokeStyle = "#f6f0e3"; ctx.lineWidth = r * 0.32; ctx.stroke();
    ctx.globalAlpha = 1;
  }

  const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

  // Magnified encounter: nominal path vs. avoidance path around a crossing fragment (illustrative)
  function drawInset(bx, by, bw, bh, u, x) {
    ctx.fillStyle = "rgba(251,248,241,0.94)"; ctx.fillRect(bx, by, bw, bh);
    ctx.strokeStyle = "#d6c8a9"; ctx.lineWidth = Math.max(1, u * 0.8); ctx.strokeRect(bx + 0.5, by + 0.5, bw - 1, bh - 1);

    const ccx = bx + bw * 0.5, ccy = by + bh * 0.6, hw = bw * 0.42, hh = bh * 0.34, rs = 13 * u;
    const XB = -0.58, DEV = rs + 8 * u;
    const dev = s => DEV * smooth(XB, -0.12, s) * (1 - 0.75 * smooth(0.3, 0.98, s));
    const deb = s => [ccx - s * 0.36 * hw, ccy + s * hh];       // fragment track, crosses nominal at centre

    ctx.font = `500 ${10 * u}px "Source Sans 3", sans-serif`;
    ctx.textBaseline = "top";
    ctx.fillStyle = `rgba(${RUST},1)`; ctx.textAlign = "left";
    ctx.fillText("Encounter, ×200", bx + 7 * u, by + 6 * u);

    // nominal path (would collide)
    ctx.setLineDash([3 * u, 3 * u]); ctx.strokeStyle = `rgba(${SOFT},0.55)`; ctx.lineWidth = 1 * u;
    ctx.beginPath(); ctx.moveTo(ccx - hw * 1.08, ccy); ctx.lineTo(ccx + hw * 1.08, ccy); ctx.stroke();
    // fragment track
    const a0 = deb(-1.15), a1 = deb(1.15);
    ctx.setLineDash([]); ctx.strokeStyle = `rgba(${RUST},0.45)`; ctx.lineWidth = 1 * u;
    ctx.beginPath(); ctx.moveTo(a0[0], a0[1]); ctx.lineTo(a1[0], a1[1]); ctx.stroke();
    // avoidance path
    ctx.strokeStyle = INK; ctx.lineWidth = 1.7 * u; ctx.lineCap = "round";
    ctx.beginPath();
    for (let k = 0; k <= 60; k++) {
      const s = -1.08 + 2.16 * k / 60, px = ccx + s * hw, py = ccy - dev(s);
      k ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
    }
    ctx.stroke(); ctx.lineCap = "butt";
    // burn tick
    const tx = ccx + XB * hw;
    ctx.strokeStyle = OCHRE; ctx.lineWidth = 1.6 * u;
    ctx.beginPath(); ctx.moveTo(tx, ccy - 5 * u); ctx.lineTo(tx, ccy + 5 * u); ctx.stroke();
    ctx.font = `600 ${7.6 * u}px "Source Sans 3", sans-serif`; ctx.fillStyle = OCHRE; ctx.textAlign = "center";
    ctx.fillText("burn", tx, ccy + 7 * u);

    // safety radius around the fragment, fragment, and agent
    const s = x === null ? 0 : x;
    const dp = x === null ? deb(0) : deb(s);
    ctx.setLineDash([2 * u, 2 * u]); ctx.strokeStyle = `rgba(${RUST},${x === null ? 0.35 : 0.7})`; ctx.lineWidth = 0.9 * u;
    ctx.beginPath(); ctx.arc(dp[0], dp[1], rs, 0, 6.2832); ctx.stroke(); ctx.setLineDash([]);
    ctx.font = `${7.6 * u}px "Source Sans 3", sans-serif`; ctx.fillStyle = `rgba(${RUST},0.85)`; ctx.textAlign = "left"; ctx.textBaseline = "middle";
    ctx.fillText("30 km", dp[0] + rs + 3 * u, dp[1] + rs * 0.55);
    if (x !== null) {
      ctx.fillStyle = `rgba(${RUST},1)`; ctx.beginPath(); ctx.arc(dp[0], dp[1], 2.6 * u, 0, 6.2832); ctx.fill();
      // where the satellite would be without the burn
      ctx.strokeStyle = `rgba(${SOFT},0.7)`; ctx.lineWidth = 1 * u;
      ctx.beginPath(); ctx.arc(ccx + s * hw, ccy, 2.6 * u, 0, 6.2832); ctx.stroke();
      diamond(ccx + s * hw, ccy - dev(s), 3.6 * u, 1);
    }
    ctx.textAlign = "left"; ctx.textBaseline = "alphabetic";
  }

  function drawEarth(C, sim) {
    // body: lit from upper left
    const g = ctx.createRadialGradient(cx - ER * 0.38, cy - ER * 0.42, ER * 0.05, cx, cy, ER);
    g.addColorStop(0, TH.earth[0]);
    g.addColorStop(0.55, TH.earth[1]);
    g.addColorStop(1, TH.earth[2]);
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(cx, cy, ER, 0, 6.2832); ctx.fill();

    // graticule, Earth-fixed frame turning with sidereal rotation
    const spin = sim * EARTH_SPIN;
    ctx.lineWidth = 0.7 * (W / 440);
    ctx.strokeStyle = TH.grid;
    ctx.beginPath();
    for (const line of grid) {
      let prev = null;
      for (const [la, lo] of line) {
        const cl = Math.cos(la), x = cl * Math.cos(lo + spin), y = cl * Math.sin(lo + spin), z = Math.sin(la);
        const vx = C[0] * x + C[1] * y + C[2] * z, vy = C[3] * x + C[4] * y + C[5] * z, vz = C[6] * x + C[7] * y + C[8] * z;
        if (-vy > 0) {
          const sx = cx + vx * ER, sy = cy - vz * ER;
          if (prev) { ctx.moveTo(prev[0], prev[1]); ctx.lineTo(sx, sy); }
          prev = [sx, sy];
        } else prev = null;
      }
    }
    ctx.stroke();

    // soft limb shading
    const rim = ctx.createRadialGradient(cx, cy, ER * 0.72, cx, cy, ER);
    rim.addColorStop(0, "rgba(0,0,0,0)");
    rim.addColorStop(1, TH.limb);
    ctx.fillStyle = rim;
    ctx.beginPath(); ctx.arc(cx, cy, ER, 0, 6.2832); ctx.fill();
  }

  function start() {
    if (running || reduce || !visible || document.hidden) return;
    running = true; t0 = performance.now() - tPaused * 1000;
    requestAnimationFrame(frame);
  }
  function stop() {
    if (!running) return;
    running = false; tPaused = (performance.now() - t0) / 1000;
  }

  (window.DEBRIS_DATA ? Promise.resolve(window.DEBRIS_DATA) : fetch(canvas.dataset.src).then(r => r.json()))
    .then(data => {
      prepare(data);
      resize();
      // conjunction: the point on the agent orbit that stays most front-facing through the camera sway
      const cams = []; for (let s = 0; s < 26; s += 1) cams.push(camera(s));
      let best = -1e9;
      for (let k = 0; k < 360; k++) {
        const nu = k / 360 * 2 * Math.PI, p = agentPos(nu);
        let worst = 1e9;
        for (const C0 of cams) worst = Math.min(worst, -(C0[3] * p[0] + C0[4] * p[1] + C0[5] * p[2]));
        if (worst > best) { best = worst; NU_C = nu; }
      }
      NU_0 = NU_C - 1.6;
      canvas.classList.add("ready");
      if (still) still.style.visibility = "hidden";
      frame(performance.now());
      start();
      new ResizeObserver(() => { resize(); if (!running) frame(performance.now()); }).observe(canvas);
      if ("IntersectionObserver" in window) {
        new IntersectionObserver(es => { visible = es[0].isIntersecting; visible ? start() : stop(); }).observe(canvas);
      }
      document.addEventListener("visibilitychange", () => (document.hidden ? stop() : start()));
    })
    .catch(() => { /* keep the still image */ });
})();
