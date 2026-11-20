/* Direct policy transfer from simulator to firmware: one flight plan, two worlds (data/uav.js).
   Two synchronised 3D views on one canvas. Left: the simulation (Isaac Lab, PhysX), an idealised grid
   world where the drone follows the plan exactly. Right: the Crazyflie running the policy onboard, on
   a lab floor, flying the same plan with the real-world deviations the abstract names (centimeter-scale
   wander of the position estimate; hover height sagging as the battery drains).
   ILLUSTRATIVE: the tracks, plan geometry and timing are not flight records (see data/uav.js). The
   real-minus-sim deviation is exaggerated EXAG times, attitude tilt TILT times, and the drone is drawn
   DRONE times its true size, so they read at figure scale. The figcaption says so.
   Hand-rolled perspective projection, no libraries. Drawn in CSS pixels on a DPR-scaled canvas.
   Below the panels, a compact strip plots the same tracks over time (altitude for both, real minus
   sim in cm at true scale, battery voltage) with one cursor at the moment the drones are at.
   Layout stability: the canvas height is fixed per width (set only on resize), and the note's min-height fits its longest sentence. #t=<s> jumps to a moment. */
(function () {
  const root = document.querySelector(".anim-uav");
  const D = window.UAV_DATA;
  if (!root || !D) return;
  const canvas = root.querySelector(".uav-canvas");
  if (!canvas || !canvas.getContext) return;
  const ctx = canvas.getContext("2d");
  const note = root.querySelector(".uav-note");
  const reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const EXAG = 4, TILT = 2.2, DRONE = 4;      // illustrative exaggerations (see caption)
  const D2R = Math.PI / 180;
  const INK = "#1c1a17", DEEP = "#173f35", GREEN = "#1f6b57", RUST = "#a8461f", OCHRE = "#c08a2b";
  const SANS = '"Source Sans 3","Segoe UI",sans-serif';
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

  /* ---------- the note line (fixed set, so its height can be reserved) ---------- */
  const S = [
    "The same checkpoint runs in simulation and on the Crazyflie; the propellers spin up.",
    "Both drones take off and climb to the planned height.",
    "In hover the Crazyflie holds within a few centimeters of the simulated height.",
    "Point navigation: both fly the same plan to the first waypoint.",
    "On the real drone the position estimate wanders, and the hover height sags as the battery drains.",
    "Landing, with the firmware recording flight timing, phase and policy activity.",
    "Motor shutdown. The remaining differences come from sensing and power.",
  ];
  function sentence(t) {
    const nav = phase("navigate");
    if (t >= T_OFF) return S[6];
    if (t >= phase("land").t0) return S[5];
    if (t >= nav.t0) return t < nav.t0 + 3.6 ? S[3] : S[4];
    if (t >= phase("hover").t0) return S[2];
    return t < T_ON + 1.2 ? S[0] : S[1];
  }

  /* ---------- layout ---------- */
  let cssW = 0, cssH = 0, dpr = 1, panels = [], strip = null;
  const STRIP_H = 196;
  function layout() {
    const w = Math.round(canvas.parentNode.getBoundingClientRect().width);
    if (!w || w === cssW) return false;
    cssW = w; dpr = Math.min(window.devicePixelRatio || 1, 2.5);
    const stacked = cssW < 480, gap = 12;
    if (stacked) {
      const ph = Math.round(cssW * .8);
      panels = [{ x: 0, y: 0, w: cssW, h: ph }, { x: 0, y: ph + gap, w: cssW, h: ph }];
      cssH = ph * 2 + gap;
    } else {
      const pw = Math.floor((cssW - gap) / 2), ph = Math.round(pw * 1.0);
      panels = [{ x: 0, y: 0, w: pw, h: ph }, { x: cssW - pw, y: 0, w: pw, h: ph }];
      cssH = ph;
    }
    strip = { y: cssH + 6, w: cssW, h: STRIP_H };
    cssH += 6 + STRIP_H;
    panels[0].kind = "sim"; panels[1].kind = "real";
    canvas.style.height = cssH + "px";
    canvas.width = Math.round(cssW * dpr); canvas.height = Math.round(cssH * dpr);
    fitNote();
    return true;
  }
  function fitNote() {
    if (!note) return;
    note.style.minHeight = "";
    let mh = 0;
    for (const s of S) { note.textContent = s; mh = Math.max(mh, note.getBoundingClientRect().height); }
    note.style.minHeight = Math.ceil(mh) + "px";
    note.textContent = "";
  }

  /* ---------- camera: gentle sway shared by both panels ---------- */
  const CENTER = [-.08, .08, .5], DIST = 4.3;
  function camera(t, P) {
    const ph = 2 * Math.PI * t / LOOP;
    const yaw = (-32 + 11 * Math.sin(ph)) * D2R, pitch = (23 + 3 * Math.sin(ph + 1.3)) * D2R;
    return { cy: Math.cos(yaw), sy: Math.sin(yaw), cp: Math.cos(pitch), sp: Math.sin(pitch),
      f: Math.min(P.w, P.h * 1.2) * 1.9, ox: P.x + P.w * .5, oy: P.y + P.h * .55 };
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
    // fade toward the far edge, identical in both panels
    const top = Math.min(...floor.map(p => proj(c, p)[1]));
    const y0 = Math.max(P.y, top - 2), y1 = top + P.h * .3;
    const gr = ctx.createLinearGradient(0, y0, 0, y1);
    gr.addColorStop(0, bg); gr.addColorStop(1, bg + "00");
    ctx.fillStyle = gr; ctx.fillRect(P.x, P.y, P.w, y1 - P.y);
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

  /* ---------- time strip: the same tracks plotted against time ---------- */
  const VMIN = Math.min(...D.vbat), VMAX = Math.max(...D.vbat);
  const RESID = D.sim.z.map((z, i) => (D.real.z[i] - z) * 100);      // real minus sim, cm, true scale
  function drawStrip(t, fadeAll) {
    const Y0 = strip.y, PX0 = 30, PX1 = strip.w - 4;
    const X = s => PX0 + (PX1 - PX0) * s / TEND;
    const txt = (s, x, y, font, col, align) => { ctx.font = font; ctx.fillStyle = col; ctx.textAlign = align || "left"; ctx.fillText(s, x, y); };
    const IT = `italic 12px ${SANS}`, MONO = `11.5px "IBM Plex Mono",ui-monospace,monospace`, SOFT = "#67615a";
    // phase labels, current one dark and underlined
    const pi = D.phases.findIndex(ph => t >= ph.t0 && t < ph.t1), cur = pi < 0 ? D.phases.length - 1 : pi;
    ctx.font = `12.5px ${SANS}`;
    // centred on each phase, then nudged apart (left to right, then back from the right edge)
    const L = D.phases.map(ph => { const w = ctx.measureText(ph.name).width; return { w, x: (X(ph.t0) + X(ph.t1)) / 2 - w / 2 }; });
    for (let k = 0; k < L.length; k++) L[k].x = Math.max(L[k].x, k ? L[k - 1].x + L[k - 1].w + 9 : PX0 - 24);
    for (let k = L.length - 1; k >= 0; k--) L[k].x = Math.min(L[k].x, k < L.length - 1 ? L[k + 1].x - L[k].w - 9 : PX1 - L[k].w);
    D.phases.forEach((ph, k) => {
      txt(ph.name, L[k].x, Y0 + 12, `12.5px ${SANS}`, k === cur ? INK : SOFT);
      if (k === cur) { ctx.fillStyle = RUST; ctx.fillRect(L[k].x, Y0 + 15, L[k].w, 1); }
    });
    // three plots
    const narrow = PX1 - PX0 < 420;
    const plots = [
      { title: "altitude", h: 40, lo: -.08 * D.planHeight, hi: 1.12 * D.planHeight },
      { title: narrow ? "real minus sim, cm" : "real minus simulation, cm", note: narrow ? "estimate wander" : "position-estimate wander", col: RUST, h: 36, lo: -4.5, hi: 4.5 },
      { title: narrow ? "battery voltage" : "battery voltage, Crazyflie", note: "height varies with it", col: OCHRE, h: 22, lo: VMIN - .01, hi: VMAX + .01 },
    ];
    let y = Y0 + 22;
    plots.forEach(P => {
      txt(P.title, PX0, y + 11, IT, SOFT);
      ctx.font = IT;
      if (P.note && ctx.measureText(P.title).width + ctx.measureText(P.note).width + 14 < PX1 - PX0) txt(P.note, PX1, y + 11, IT, P.col, "right");
      P.top = y + 16; P.bot = P.top + P.h; P.Y = v => P.bot - (Math.max(P.lo, Math.min(P.hi, v)) - P.lo) / (P.hi - P.lo) * P.h;
      y = P.bot + 10;
    });
    const [PA, PR, PV] = plots;
    ctx.textAlign = "left";
    ctx.lineWidth = .8; ctx.strokeStyle = "#d6c8a9";
    ctx.beginPath(); ctx.moveTo(PX0, PA.Y(0)); ctx.lineTo(PX1, PA.Y(0)); ctx.moveTo(PX0, PR.Y(0)); ctx.lineTo(PX1, PR.Y(0)); ctx.stroke();
    ctx.setLineDash([4, 3]); ctx.beginPath(); ctx.moveTo(PX0, PA.Y(D.planHeight)); ctx.lineTo(PX1, PA.Y(D.planHeight)); ctx.stroke();
    ctx.setLineDash([1, 3]); ctx.beginPath(); [3, -3].forEach(v => { ctx.moveTo(PX0, PR.Y(v)); ctx.lineTo(PX1, PR.Y(v)); }); ctx.stroke();
    ctx.setLineDash([]);
    txt("plan", PX0 - 5, PA.Y(D.planHeight) + 4, `italic 11.5px ${SANS}`, SOFT, "right");
    txt("0", PX0 - 5, PA.Y(0) + 4, MONO, SOFT, "right");
    txt("+3", PX0 - 5, PR.Y(3) + 4, MONO, SOFT, "right");
    txt("\u22123", PX0 - 5, PR.Y(-3) + 4, MONO, SOFT, "right");
    // phase boundaries
    ctx.strokeStyle = "rgba(214,200,169,.9)"; ctx.setLineDash([2, 3]); ctx.beginPath();
    D.phases.slice(1).forEach(ph => { ctx.moveTo(X(ph.t0), PA.top - 2); ctx.lineTo(X(ph.t0), PV.bot + 2); }); ctx.stroke();
    ctx.setLineDash([]);
    // traces up to the cursor
    const n = Math.min(N - 1, Math.floor(t / D.dt));
    const trace = (arr, Y, col, w) => {
      ctx.strokeStyle = col; ctx.lineWidth = w; ctx.globalAlpha = fadeAll; ctx.beginPath();
      for (let i = 0; i <= n; i++) { const x = X(i * D.dt), yy = Y(arr[i]); i ? ctx.lineTo(x, yy) : ctx.moveTo(x, yy); }
      const z = sampleAt(arr, t); ctx.lineTo(X(t), Y(z)); ctx.stroke(); ctx.globalAlpha = 1;
    };
    trace(D.sim.z, PA.Y, GREEN, 1.6); trace(D.real.z, PA.Y, RUST, 1.2);
    trace(D.sim.z.map(() => 0), PR.Y, GREEN, 1.1); trace(RESID, PR.Y, RUST, 1.2);
    trace(D.vbat, PV.Y, OCHRE, 1.3);
    if (t >= TEND && fadeAll < 1) return;
    // one cursor; its dots take the colours of the drones
    const x = X(t);
    ctx.strokeStyle = "rgba(23,63,53,.5)"; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(x, PA.top - 2); ctx.lineTo(x, PV.bot + 2); ctx.stroke();
    const dot = (y, col, r) => { ctx.fillStyle = col; ctx.strokeStyle = "#fbf8f1"; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(x, y, r, 0, 6.2832); ctx.fill(); ctx.stroke(); };
    dot(PA.Y(sampleAt(D.sim.z, t)), GREEN, 3.4); dot(PA.Y(sampleAt(D.real.z, t)), RUST, 2.8);
    dot(PR.Y(sampleAt(RESID, t)), RUST, 2.6); dot(PV.Y(sampleAt(D.vbat, t)), OCHRE, 2.6);
  }
  function sampleAt(arr, t) {
    const u = Math.max(0, Math.min(TEND, t)) / D.dt, i = Math.min(N - 2, Math.floor(u)), f = u - i;
    return arr[i] + (arr[i + 1] - arr[i]) * f;
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
      const bg = sim ? "#fbf8f1" : "#f3ecdf";
      ctx.fillStyle = bg; ctx.fillRect(P.x, P.y, P.w, P.h);
      ground(c, P.kind, P, bg);
      const f = sim ? simAt : realAt, p = f(t);
      shadow(c, p);
      planAndWaypoints(c);
      trail(c, f, t, sim ? "31,107,87" : "168,70,31", fadeAll);
      drone(c, p, bodyFrame(accel(f, t)), m, ang, t);
      // title, with a swatch matching the trail
      ctx.font = `13px ${SANS}`; ctx.textBaseline = "alphabetic"; ctx.textAlign = "left";
      ctx.fillStyle = sim ? GREEN : RUST; ctx.fillRect(P.x + 10, P.y + 15, 14, 2);
      ctx.fillStyle = INK;
      ctx.fillText(sim ? "Simulation (Isaac Lab, PhysX)" : "Crazyflie, onboard firmware", P.x + 30, P.y + 20);
      if (!sim) {
        ctx.font = `italic 12px ${SANS}`; ctx.fillStyle = "#67615a"; ctx.textAlign = "right";
        ctx.fillText(`deviation from sim ×${EXAG}`, P.x + P.w - 10, P.y + P.h - 10);
        ctx.textAlign = "left";
      }
      ctx.restore();
      ctx.strokeStyle = "#d6c8a9"; ctx.lineWidth = 1; ctx.strokeRect(P.x + .5, P.y + .5, P.w - 1, P.h - 1);
    }
    drawStrip(t, fadeAll);
    const s = sentence(t);
    if (note && note.textContent !== s) note.textContent = s;
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
