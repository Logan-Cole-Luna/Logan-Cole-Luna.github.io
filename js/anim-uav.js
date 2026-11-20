/* Direct policy transfer from simulator to firmware: one flight plan, two worlds (data/uav.js).
   Two synchronised 3D views on one canvas. Left: the simulation (Isaac Lab, PhysX), an idealised grid
   world where the drone follows the plan exactly. Right: the Crazyflie running the policy onboard, on
   a lab floor, flying the same plan with the real-world deviations the abstract names (centimeter-scale
   wander of the position estimate; hover height sagging as the battery drains).
   ILLUSTRATIVE: the tracks, plan geometry and timing are not flight records (see data/uav.js). The
   real-minus-sim deviation is exaggerated EXAG times, attitude tilt TILT times, and the drone is drawn
   DRONE times its true size, so they read at figure scale. The figcaption says so.
   Hand-rolled perspective projection, no libraries. Drawn in CSS pixels on a DPR-scaled canvas.
   The panels are unframed, drawn on the card's paper, and labelled directly. A small inset in the
   top-right corner of the real panel plots the real drone's height minus the simulated one over time, in cm at
   TRUE scale (no exaggeration), with a dot at the current moment.
   Layout stability: the canvas height is fixed per width (set only on resize). #t=<s> jumps to a moment. */
(function () {
  const root = document.querySelector(".anim-uav");
  const D = window.UAV_DATA;
  if (!root || !D) return;
  const canvas = root.querySelector(".uav-canvas");
  if (!canvas || !canvas.getContext) return;
  const ctx = canvas.getContext("2d");
  const reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const EXAG = 4, TILT = 2.2, DRONE = 4;      // illustrative exaggerations (see caption)
  const D2R = Math.PI / 180;
  const INK = "#1c1a17", DEEP = "#173f35", GREEN = "#1f6b57", RUST = "#a8461f", OCHRE = "#c08a2b";
  const SOFT = "#67615a", CARD = "#f9f5ec";   // CARD = the paper card's background (--cream)
  const SANS = '"Source Sans 3","Segoe UI",sans-serif', MONO = '"IBM Plex Mono",ui-monospace,monospace';
  const N = D.sim.x.length, TEND = (N - 1) * D.dt, RESET = 1.2, LOOP = TEND + RESET;
  const clamp = x => x < 0 ? 0 : x > 1 ? 1 : x;
  const ease = x => { x = clamp(x); return x * x * (3 - 2 * x); };
  const phase = name => D.phases.find(p => p.name === name) || { t0: 0, t1: 0 };
  const T_ON = phase("takeoff").t0, T_OFF = phase("motors off").t0;

  /* ---------- tracks ---------- */
  function sampleRaw(tr, t) {
    const u = Math.max(0, Math.min(TEND, t)) / D.dt, i = Math.min(N - 2, Math.floor(u)), f = u - i;
    return [tr.x[i] + (tr.x[i + 1] - tr.x[i]) * f, tr.y[i] + (tr.y[i + 1] - tr.y[i]) * f, tr.z[i] + (tr.z[i + 1] - tr.z[i]) * f];
  }
  const simAt = t => sampleRaw(D.sim, t);
  const realAt = t => {                                    // sim + exaggerated (real - sim)
    const s = sampleRaw(D.sim, t), r = sampleRaw(D.real, t);
    return [s[0] + EXAG * (r[0] - s[0]), s[1] + EXAG * (r[1] - s[1]), Math.max(0, s[2] + EXAG * (r[2] - s[2]))];
  };
  const accel = (f, t) => {
    const h = .3, a = f(t - h), b = f(t), c = f(t + h);
    return [0, 1, 2].map(k => (a[k] - 2 * b[k] + c[k]) / (h * h));
  };
  // motor speed fraction: spin up at the start of takeoff, spin down at motor shutdown
  const motor = t => ease((t - T_ON) / 1.2) * (1 - ease((t - T_OFF) / 1.6));
  function rotorAngle(t) {                                 // integral of motor speed
    let a = 0; const h = .05;
    for (let s = 0; s < t; s += h) a += motor(s) * h * 2 * Math.PI * 9;
    return a;
  }
  // body frame from the thrust direction (tilts toward acceleration); yaw held at zero
  function bodyFrame(acc) {
    let n = [acc[0] * TILT, acc[1] * TILT, 9.81 + acc[2]];
    const l = Math.hypot(n[0], n[1], n[2]); n = n.map(v => v / l);
    let x = [1 - n[0] * n[0], -n[0] * n[1], -n[0] * n[2]];
    const lx = Math.hypot(x[0], x[1], x[2]); x = x.map(v => v / lx);
    const y = [n[1] * x[2] - n[2] * x[1], n[2] * x[0] - n[0] * x[2], n[0] * x[1] - n[1] * x[0]];
    return [x, y, n];
  }

  /* ---------- layout ---------- */
  let cssW = 0, cssH = 0, dpr = 1, panels = [];
  function layout() {
    const w = Math.round(canvas.parentNode.getBoundingClientRect().width);
    if (!w || w === cssW) return false;
    cssW = w; dpr = Math.min(window.devicePixelRatio || 1, 2.5);
    const stacked = cssW < 480, gap = 16;
    if (stacked) {
      const ph = Math.round(cssW * .8);
      panels = [{ x: 0, y: 0, w: cssW, h: ph }, { x: 0, y: ph + gap, w: cssW, h: ph }];
      cssH = ph * 2 + gap;
    } else {
      const pw = Math.floor((cssW - gap) / 2), ph = Math.round(pw * 1.0);
      panels = [{ x: 0, y: 0, w: pw, h: ph }, { x: cssW - pw, y: 0, w: pw, h: ph }];
      cssH = ph;
    }
    panels[0].kind = "sim"; panels[1].kind = "real";
    canvas.style.height = cssH + "px";
    canvas.width = Math.round(cssW * dpr); canvas.height = Math.round(cssH * dpr);
    return true;
  }

  /* ---------- camera: gentle sway shared by both panels ---------- */
  const CENTER = [-.08, .08, .5], DIST = 4.3;
  function camera(t, P) {
    const ph = 2 * Math.PI * t / LOOP;
    const yaw = (-32 + 11 * Math.sin(ph)) * D2R, pitch = (23 + 3 * Math.sin(ph + 1.3)) * D2R;
    return { cy: Math.cos(yaw), sy: Math.sin(yaw), cp: Math.cos(pitch), sp: Math.sin(pitch),
      f: Math.min(P.w, P.h * 1.2) * 1.9, ox: P.x + P.w * .5, oy: P.y + P.h * .61 };
  }
  function proj(c, p) {
    const x = p[0] - CENTER[0], y = p[1] - CENTER[1], z = p[2] - CENTER[2];
    const x1 = c.cy * x - c.sy * y, y1 = c.sy * x + c.cy * y;
    const y2 = c.cp * y1 - c.sp * z, z2 = c.sp * y1 + c.cp * z;
    const d = DIST + y2;
    return [c.ox + c.f * x1 / d, c.oy - c.f * z2 / d, d];
  }

  /* ---------- drawing helpers ---------- */
  const line3 = (c, a, b) => { const p = proj(c, a), q = proj(c, b); ctx.moveTo(p[0], p[1]); ctx.lineTo(q[0], q[1]); };
  function poly3(c, pts, close) {
    pts.forEach((p, i) => { const s = proj(c, p); i ? ctx.lineTo(s[0], s[1]) : ctx.moveTo(s[0], s[1]); });
    if (close) ctx.closePath();
  }
  // near-plane clipping for the large ground plane (depth is affine in world coordinates)
  const DMIN = .6, lerp3 = (a, b, u) => [a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u, a[2] + (b[2] - a[2]) * u];
  function lineClip3(c, a, b) {
    const da = proj(c, a)[2], db = proj(c, b)[2];
    if (da < DMIN && db < DMIN) return;
    if (da < DMIN) a = lerp3(a, b, (DMIN - da) / (db - da));
    else if (db < DMIN) b = lerp3(b, a, (DMIN - db) / (da - db));
    line3(c, a, b);
  }
  function polyClip3(c, pts) {
    const out = [];
    pts.forEach((a, i) => {
      const b = pts[(i + 1) % pts.length], da = proj(c, a)[2], db = proj(c, b)[2];
      if (da >= DMIN) out.push(a);
      if ((da >= DMIN) !== (db >= DMIN)) out.push(lerp3(a, b, (DMIN - da) / (db - da)));
    });
    return out;
  }
  const circlePts = (cx, cy, z, r, n) => Array.from({ length: n }, (_, k) => [cx + r * Math.cos(k / n * 6.2832), cy + r * Math.sin(k / n * 6.2832), z]);

  // Both worlds share one ground plane (same extent, same projection); only the surface differs.
  // It runs off the panel sides and fades into the background toward its far edge.
  function ground(c, kind, P, bg) {
    const G = 4, floor = polyClip3(c, [[-G, -G, 0], [G, -G, 0], [G, G, 0], [-G, G, 0]]);
    if (kind === "sim") {
      ctx.lineWidth = .7;
      for (let k = -20; k <= 20; k++) {
        const v = k * .2, major = k % 5 === 0;
        ctx.strokeStyle = major ? "rgba(23,63,53,.3)" : "rgba(201,187,152,.75)";
        ctx.beginPath(); lineClip3(c, [v, -G, 0], [v, G, 0]); lineClip3(c, [-G, v, 0], [G, v, 0]); ctx.stroke();
      }
    } else {
      // lab floor: plain sand sheet with faint seams
      ctx.fillStyle = "#e9dec4"; ctx.beginPath(); poly3(c, floor, true); ctx.fill();
      ctx.strokeStyle = "rgba(150,128,88,.2)"; ctx.lineWidth = .8; ctx.beginPath();
      for (let k = -6; k <= 6; k++) lineClip3(c, [k * .66, -G, 0], [k * .66, G, 0]);
      ctx.stroke();
    }
    // no frame: the floor fades into the card's paper toward the far edge, the sides and the bottom
    const top = Math.min(...floor.map(p => proj(c, p)[1]));
    const y0 = Math.max(P.y, top - 2), y1 = top + P.h * .3;
    const fade = (x0, ya, x1, yb) => { const g = ctx.createLinearGradient(x0, ya, x1, yb); g.addColorStop(0, bg); g.addColorStop(1, bg + "00"); return g; };
    ctx.fillStyle = fade(0, y0, 0, y1); ctx.fillRect(P.x, P.y, P.w, y1 - P.y);
    const sw = P.w * .16, bh = P.h * .12;
    ctx.fillStyle = fade(P.x, 0, P.x + sw, 0); ctx.fillRect(P.x, P.y, sw, P.h);
    ctx.fillStyle = fade(P.x + P.w, 0, P.x + P.w - sw, 0); ctx.fillRect(P.x + P.w - sw, P.y, sw, P.h);
    ctx.fillStyle = fade(0, P.y + P.h, 0, P.y + P.h - bh); ctx.fillRect(P.x, P.y + P.h - bh, P.w, bh);
    if (kind === "sim") {
      // pads as plain target rings
      ctx.strokeStyle = "rgba(23,63,53,.55)"; ctx.lineWidth = 1;
      D.pads.forEach(p => { ctx.beginPath(); poly3(c, circlePts(p[0], p[1], 0, .13, 28), true); ctx.stroke();
        ctx.beginPath(); line3(c, [p[0] - .07, p[1], 0], [p[0] + .07, p[1], 0]); line3(c, [p[0], p[1] - .07, 0], [p[0], p[1] + .07, 0]); ctx.stroke(); });
    } else {
      // taped arena outline and taped pad crosses
      ctx.strokeStyle = "rgba(192,138,43,.6)"; ctx.lineWidth = 2.2; ctx.lineJoin = "round";
      ctx.beginPath(); poly3(c, [[-.9, -.9, 0], [.9, -.9, 0], [.9, .9, 0], [-.9, .9, 0]], true); ctx.stroke();
      ctx.strokeStyle = "rgba(168,70,31,.55)"; ctx.lineWidth = 2.4;
      D.pads.forEach(p => { ctx.beginPath(); line3(c, [p[0] - .11, p[1] - .11, 0], [p[0] + .11, p[1] + .11, 0]); line3(c, [p[0] - .11, p[1] + .11, 0], [p[0] + .11, p[1] - .11, 0]); ctx.stroke(); });
    }
  }

  function planAndWaypoints(c) {
    ctx.setLineDash([3, 3]); ctx.strokeStyle = "rgba(103,97,90,.6)"; ctx.lineWidth = 1;
    ctx.beginPath();
    for (let i = 0; i < N; i += 2) { const s = proj(c, [D.sim.x[i], D.sim.y[i], D.sim.z[i]]); i ? ctx.lineTo(s[0], s[1]) : ctx.moveTo(s[0], s[1]); }
    ctx.stroke();
    D.waypoints.forEach(w => { ctx.beginPath(); line3(c, [w[0], w[1], 0], w); ctx.stroke(); });
    ctx.setLineDash([]);
    D.waypoints.forEach(w => {
      ctx.strokeStyle = DEEP; ctx.lineWidth = 1.2; ctx.beginPath(); poly3(c, circlePts(w[0], w[1], w[2], .06, 20), true); ctx.stroke();
    });
  }

  function shadow(c, p) {
    const k = clamp(1 - p[2] / 1.6);
    [[.17, .07], [.11, .1]].forEach(([r, a]) => {
      ctx.fillStyle = `rgba(23,63,53,${(a * (.35 + .65 * k)).toFixed(3)})`;
      ctx.beginPath(); poly3(c, circlePts(p[0], p[1], 0, r * (1.25 - .25 * k), 20), true); ctx.fill();
    });
  }

  function trail(c, f, t, col, fadeAll) {
    const SPAN = 5, h = .1, t0 = Math.max(0, t - SPAN);
    let prev = proj(c, f(t0));
    ctx.lineWidth = 1.5; ctx.lineCap = "round";
    for (let s = t0 + h; s <= t + 1e-6; s += h) {
      const q = proj(c, f(Math.min(s, t)));
      ctx.strokeStyle = `rgba(${col},${((1 - (t - s) / SPAN) * .62 * fadeAll).toFixed(3)})`;
      ctx.beginPath(); ctx.moveTo(prev[0], prev[1]); ctx.lineTo(q[0], q[1]); ctx.stroke();
      prev = q;
    }
    ctx.lineCap = "butt";
  }

  // Crazyflie-style nano-quad: X frame, four motor pods, prop discs, battery, PCB and a status LED
  function drone(c, p, R, m, ang, t) {
    const S = DRONE, A = .046 * S / Math.SQRT2, PR = .0235 * S;
    const W = (b) => [p[0] + R[0][0] * b[0] + R[1][0] * b[1] + R[2][0] * b[2],
                      p[1] + R[0][1] * b[0] + R[1][1] * b[1] + R[2][1] * b[2],
                      p[2] + R[0][2] * b[0] + R[1][2] * b[1] + R[2][2] * b[2] + .012 * S];
    const motors = [[A, A], [A, -A], [-A, -A], [-A, A]].map(([x, y], i) => ({ i, b: [x, y, 0], d: proj(c, W([x, y, 0]))[2] }));
    const quad = (hx, hy, z) => [[-hx, -hy, z], [hx, -hy, z], [hx, hy, z], [-hx, hy, z]].map(W);
    const drawMotor = M => {
      const [x, y] = M.b, top = W([x, y, .006 * S]), bot = W([x, y, -.006 * S]);
      ctx.strokeStyle = "#2a2723"; ctx.lineWidth = 3.2; ctx.beginPath(); line3(c, bot, top); ctx.stroke();
      // prop disc: a blur when spinning, a single blade when still
      const disc = Array.from({ length: 22 }, (_, k) => W([x + PR * Math.cos(k / 22 * 6.2832), y + PR * Math.sin(k / 22 * 6.2832), .008 * S]));
      ctx.fillStyle = `rgba(23,63,53,${(.05 + .13 * m).toFixed(3)})`;
      ctx.strokeStyle = `rgba(23,63,53,${(.12 + .3 * m).toFixed(3)})`; ctx.lineWidth = .8;
      ctx.beginPath(); poly3(c, disc, true); ctx.fill(); if (m > .05) ctx.stroke();
      const a = ang * (M.i % 2 ? -1 : 1) + M.i;
      ctx.strokeStyle = `rgba(28,26,23,${(.85 - .65 * m).toFixed(3)})`; ctx.lineWidth = 1.6;
      ctx.beginPath();
      line3(c, W([x - PR * .95 * Math.cos(a), y - PR * .95 * Math.sin(a), .008 * S]), W([x + PR * .95 * Math.cos(a), y + PR * .95 * Math.sin(a), .008 * S]));
      ctx.stroke();
    };
    const far = motors.slice().sort((a, b) => b.d - a.d);
    far.slice(0, 2).forEach(drawMotor);
    // battery under the board, then arms, then the board
    ctx.fillStyle = "#4a4339"; ctx.beginPath(); poly3(c, quad(.011 * S, .018 * S, -.006 * S), true); ctx.fill();
    ctx.strokeStyle = DEEP; ctx.lineWidth = 2.4; ctx.lineCap = "round";
    ctx.beginPath(); motors.forEach(M => line3(c, W([0, 0, 0]), W(M.b))); ctx.stroke(); ctx.lineCap = "butt";
    ctx.fillStyle = "#1f4a3e"; ctx.strokeStyle = "#0f2a22"; ctx.lineWidth = .8;
    ctx.beginPath(); poly3(c, quad(.016 * S, .016 * S, .001 * S), true); ctx.fill(); ctx.stroke();
    // status LED on the front arm: blinks while the policy is flying
    const led = proj(c, W([A * .55, A * .55, .003 * S])), on = m > .5 ? (Math.sin(t * 2 * Math.PI * 1.5) > 0 ? 1 : .35) : .25;
    ctx.fillStyle = `rgba(214,74,40,${on})`; ctx.beginPath(); ctx.arc(led[0], led[1], 2.1, 0, 6.2832); ctx.fill();
    far.slice(2).forEach(drawMotor);
  }

  /* ---------- inset: real minus sim height over time, true scale ---------- */
  const RESID = D.sim.z.map((z, i) => (D.real.z[i] - z) * 100);      // cm, NOT exaggerated
  const RLO = -3.8, RHI = 1.4;
  function sampleAt(arr, t) {
    const u = Math.max(0, Math.min(TEND, t)) / D.dt, i = Math.min(N - 2, Math.floor(u)), f = u - i;
    return arr[i] + (arr[i + 1] - arr[i]) * f;
  }
  function inset(P, t, fadeAll) {
    const w = Math.round(Math.min(184, P.w * .58)), h = 80;
    const bx = P.x + P.w - w - 2, by = P.y + 2;           // top-right corner: the drones never fly there
    ctx.fillStyle = "rgba(251,248,241,0.94)"; ctx.fillRect(bx, by, w, h);
    ctx.strokeStyle = "#d6c8a9"; ctx.lineWidth = 1; ctx.strokeRect(bx + .5, by + .5, w - 1, h - 1);
    ctx.textBaseline = "alphabetic";
    ctx.font = `13px ${SANS}`; ctx.fillStyle = INK; ctx.textAlign = "left";
    ctx.fillText("Real minus sim, cm", bx + 8, by + 18);
    const X0 = bx + 30, X1 = bx + w - 9, T0 = by + 28, B0 = by + h - 9;
    const X = s => X0 + (X1 - X0) * s / TEND, Y = v => B0 - (v - RLO) / (RHI - RLO) * (B0 - T0);
    ctx.lineWidth = 1; ctx.strokeStyle = "#c9bb98";
    ctx.beginPath(); ctx.moveTo(X0, Y(0)); ctx.lineTo(X1, Y(0)); ctx.stroke();
    ctx.setLineDash([1, 3]); ctx.beginPath(); ctx.moveTo(X0, Y(-3)); ctx.lineTo(X1, Y(-3)); ctx.stroke(); ctx.setLineDash([]);
    ctx.font = `13px ${MONO}`; ctx.fillStyle = SOFT; ctx.textAlign = "right";
    ctx.fillText("0", X0 - 5, Y(0) + 4); ctx.fillText("\u22123", X0 - 5, Y(-3) + 4);
    const n = Math.min(N - 1, Math.floor(t / D.dt));
    ctx.globalAlpha = fadeAll; ctx.strokeStyle = RUST; ctx.lineWidth = 1.4; ctx.lineJoin = "round"; ctx.beginPath();
    for (let i = 0; i <= n; i++) { const x = X(i * D.dt), y = Y(RESID[i]); i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }
    ctx.lineTo(X(t), Y(sampleAt(RESID, t))); ctx.stroke();
    ctx.fillStyle = RUST; ctx.beginPath(); ctx.arc(X(t), Y(sampleAt(RESID, t)), 2.8, 0, 6.2832); ctx.fill();
    ctx.globalAlpha = 1; ctx.textAlign = "left";
  }

  /* ---------- one frame ---------- */
  function render(T) {
    const lt = ((T % LOOP) + LOOP) % LOOP, t = Math.min(TEND, lt);
    const fadeAll = 1 - ease((lt - TEND) / RESET);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, cssW, cssH);
    const m = motor(t), ang = rotorAngle(t);
    for (const P of panels) {
      const c = camera(lt, P), sim = P.kind === "sim";
      ctx.save();
      ctx.beginPath(); ctx.rect(P.x, P.y, P.w, P.h); ctx.clip();
      ground(c, P.kind, P, CARD);
      const f = sim ? simAt : realAt, p = f(t);
      shadow(c, p);
      planAndWaypoints(c);
      trail(c, f, t, sim ? "31,107,87" : "168,70,31", fadeAll);
      drone(c, p, bodyFrame(accel(f, t)), m, ang, t);
      // direct label, in the colour of the panel's trail
      ctx.textBaseline = "alphabetic"; ctx.textAlign = "left";
      ctx.font = `14px ${SANS}`; ctx.fillStyle = sim ? GREEN : RUST;
      ctx.fillText(sim ? "Simulation, Isaac Lab" : "Crazyflie, onboard", P.x + 4, P.y + 18);
      if (!sim) {
        ctx.font = `13px ${SANS}`; ctx.fillStyle = SOFT;
        ctx.fillText(`deviation from sim ×${EXAG}`, P.x + 4, P.y + P.h - 8);
        inset(P, t, fadeAll);
      }
      ctx.restore();
    }
  }

  /* ---------- loop ---------- */
  const mh = /#t=([\d.]+)/.exec(location.hash);
  let tl = mh ? parseFloat(mh[1]) : 0, last = null, running = false, visible = true;
  const STILL = phase("navigate").t0 + 5.5;               // reduced motion: mid-navigation
  const draw = () => render(reduce ? STILL : tl);
  layout(); draw();
  new ResizeObserver(() => { if (layout()) draw(); }).observe(canvas.parentNode);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { cssW = 0; layout(); draw(); });
  if (reduce) return;
  function frame(now) {
    if (!running) return;
    const dt = last === null ? 0 : Math.min(.1, (now - last) / 1000); last = now;
    tl += dt; render(tl);
    requestAnimationFrame(frame);
  }
  const start = () => { if (running || !visible || document.hidden) return; running = true; last = null; requestAnimationFrame(frame); };
  const stop = () => { running = false; };
  if ("IntersectionObserver" in window) new IntersectionObserver(es => { visible = es[0].isIntersecting; visible ? start() : stop(); }).observe(root);
  document.addEventListener("visibilitychange", () => (document.hidden ? stop() : start()));
  start();
})();
