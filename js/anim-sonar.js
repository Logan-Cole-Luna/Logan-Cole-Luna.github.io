/* Signal-Centric Remote Sensing: one sonar sweep, two processing routes (data/sonar.js).
   One path: the paper's unfiltered gate waterfall (Fig. 7a) is shown with one return, scan 800, picked out
   as an intensity trace. The same data then runs both routes on a shared millisecond scale from Table III:
   the signal route filters the CSV rows directly (3.1 ms); the image route first renders every scan to an
   image frame, then filters (37.419 ms, of which 3.798 ms is filtering). Each route's output waterfall is
   the paper's own (Fig. 7b, 7c), and its scan-800 trace is drawn back over the raw return: the signal route
   keeps the gate echo, the image route removes it (as in the Fig. 8 difference maps).
   Nothing here is synthetic. Waterfalls and traces are read back from the published plots, so values are
   approximate. The only liberty is time: the measured milliseconds are played about 300 times slower.
   The SVG is laid out at one unit per CSS pixel for the container width, so text keeps its size from
   phone to desktop. Markup: .anim-sonar > .sonar-svg + .sonar-note. #t=<s> jumps to a moment. */
(function () {
  const root = document.querySelector(".anim-sonar");
  const D = window.SONAR_DATA;
  if (!root || !D) return;
  const host = root.querySelector(".sonar-svg"), note = root.querySelector(".sonar-note");
  const NS = "http://www.w3.org/2000/svg";
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const C = { deep: "#173f35", green: "#1f6b57", rust: "#a8461f", ochre: "#c08a2b", sand: "#ece2cc", sand2: "#e6dbc3",
    cream: "#fbf8f1", rule: "#d6c8a9", line: "#c9bb98", soft: "#67615a", ink: "#1c1a17" };
  const MONO = "'IBM Plex Mono',ui-monospace,monospace", SANS = "'Source Sans 3','Segoe UI',sans-serif";
  const clamp = x => x < 0 ? 0 : x > 1 ? 1 : x;
  const ease = x => { x = clamp(x); return x * x * (3 - 2 * x); };
  const ramp = (t, a, b) => ease((t - a) / (b - a));
  const lerp = (a, b, u) => a + (b - a) * u;

  /* ---------- schedule (seconds) ---------- */
  const MS = D.ms, SLOW = 0.3;                        // one measured millisecond plays for 0.3 s
  const T_SWEEP = [0.3, 2.0], T_TRACE = [1.4, 2.4];   // raw waterfall arrives, return picked out
  const T0 = 3.4;                                     // both routes start
  const csvEnd = T0 + MS.csvTotal * SLOW;
  const cvRender = T0 + (MS.cvTotal - MS.cvFilter) * SLOW, cvEnd = T0 + MS.cvTotal * SLOW;
  const T_HOLD = cvEnd + 7.2, LOOP = T_HOLD + 1.4;    // about 25 s

  /* ---------- waterfall rasters: palette ramp, cream (quiet) to deep (strong echo) ---------- */
  const STOPS = [[0, [251, 248, 241]], [.28, [230, 219, 195]], [.65, [31, 107, 87]], [1, [23, 63, 53]]];
  function shade(v) {
    for (let i = 1; i < STOPS.length; i++) if (v <= STOPS[i][0]) {
      const [a, ca] = STOPS[i - 1], [b, cb] = STOPS[i], u = (v - a) / (b - a);
      return ca.map((c, k) => Math.round(c + (cb[k] - c) * u));
    }
    return STOPS[STOPS.length - 1][1];
  }
  const raster = {};
  function rasterOf(key) {
    if (raster[key]) return raster[key];
    const bin = atob(D[key]), cv = document.createElement("canvas");
    cv.width = D.cols; cv.height = D.rows;
    const cx = cv.getContext("2d"), im = cx.createImageData(D.cols, D.rows);
    for (let i = 0; i < bin.length; i++) {
      const c = shade(bin.charCodeAt(i) / 255);
      im.data[4 * i] = c[0]; im.data[4 * i + 1] = c[1]; im.data[4 * i + 2] = c[2]; im.data[4 * i + 3] = 255;
    }
    cx.putImageData(im, 0, 0);
    return (raster[key] = cv.toDataURL());
  }

  let G = null;

  function build(W) {
    const wide = W >= 440;
    const svg = document.createElementNS(NS, "svg");
    const el = (t, a, p) => { const e = document.createElementNS(NS, t); for (const k in a) e.setAttribute(k, a[k]); (p || svg).appendChild(e); return e; };
    const txt = (s, a, p) => { const e = el("text", a, p); e.textContent = s; return e; };
    const span = (parent, s, a) => { const e = el("tspan", a || {}, parent); e.textContent = s; return e; };
    const label = (s, x, y, extra, p) => txt(s, Object.assign({ x, y, "font-family": SANS, "font-size": 13, fill: C.ink }, extra || {}), p);
    const value = (s, x, y, extra, p) => txt(s, Object.assign({ x, y, "font-family": MONO, "font-size": 11.5, fill: C.soft }, extra || {}), p);
    const soft = (s, x, y, extra, p) => txt(s, Object.assign({ x, y, "font-family": SANS, "font-size": 12, "font-style": "italic", fill: C.soft }, extra || {}), p);
    const rule = (y, x1, x2, extra) => el("path", Object.assign({ d: `M${x1},${y} H${x2}`, stroke: C.rule, "stroke-width": .8, fill: "none" }, extra || {}));
    const uid = "snr" + Math.random().toString(36).slice(2, 7);
    const defs = el("defs", {});
    const L = 0, R = W, sx = s => L + (R - L) * s / D.scans, scanX = sx(D.scan);
    const clip = id => { const c = el("clipPath", { id: uid + id }, defs); return el("rect", { x: 0, y: 0, width: 0, height: 1000 }, c); };
    const wf = (key, y, h, extra) => el("image", Object.assign({ href: rasterOf(key), x: L, y, width: R - L, height: h,
      preserveAspectRatio: "none" }, extra || {}));

    /* raw waterfall */
    const head = label("", L, 13); span(head, "Gate run, unfiltered");
    span(head, wide ? "1,420 sonar returns, newest on the right" : "1,420 returns", { dx: 7, "font-size": 12, "font-style": "italic", fill: C.soft });
    const WY = 22, WH = wide ? 60 : 56;
    const rawClip = clip("r");
    const rawImg = wf("raw", WY, WH, { "clip-path": `url(#${uid}r)` });
    el("rect", { x: L + .4, y: WY + .4, width: R - L - .8, height: WH - .8, fill: "none", stroke: C.rule, "stroke-width": .8 });
    const cur = el("line", { x1: scanX, x2: scanX, y1: WY - 3, y2: WY + WH + 3, stroke: C.rust, "stroke-width": 1.1, opacity: 0 });
    value("scan 0", L, WY + WH + 15);
    value("1,420", R, WY + WH + 15, { "text-anchor": "end" });
    const curLab = value("scan " + D.scan, scanX, WY + WH + 15, { "text-anchor": "middle", fill: C.rust, opacity: 0 });

    /* the one return as a trace: intensity against distance point */
    const TY = WY + WH + 46, TH = 56, TB = TY + TH;
    const dx = k => L + (R - L) * k / (D.dist - 1), iy = v => TB - TH * v / 300;   // headroom for the gate label
    const tHead = label("", L, TY - 8, { opacity: 0 }); span(tHead, "Return " + D.scan);
    span(tHead, wide ? "intensity against distance from the sonar" : "intensity by distance", { dx: 7, "font-size": 12, "font-style": "italic", fill: C.soft });
    const tGrp = el("g", { opacity: 0 });
    const gx0 = dx(D.gate[0]), gx1 = dx(D.gate[1]);
    el("rect", { x: gx0, y: TY, width: gx1 - gx0, height: TH, fill: C.sand }, tGrp);
    soft("gate", (gx0 + gx1) / 2, TY + 10, { "text-anchor": "middle", fill: C.rust, stroke: C.sand, "stroke-width": 3, "paint-order": "stroke" }, tGrp);
    el("path", { d: `M${L},${TB + .5} H${R}`, stroke: C.rule, "stroke-width": .8, fill: "none" }, tGrp);
    const path = arr => arr.map((v, k) => (k ? "L" : "M") + dx(k).toFixed(1) + "," + iy(v).toFixed(1)).join("");
    const trClip = clip("t");
    const rawT = el("path", { d: path(D.rawT), fill: "none", stroke: C.deep, "stroke-width": 1.2, "stroke-linejoin": "round", "clip-path": `url(#${uid}t)` }, tGrp);
    const csvClip = clip("cs"), cvClip = clip("cv");
    const csvT = el("path", { d: path(D.csvT), fill: "none", stroke: C.green, "stroke-width": 1.7, "stroke-linejoin": "round", "clip-path": `url(#${uid}cs)` }, tGrp);
    const cvT = el("path", { d: path(D.cvT), fill: "none", stroke: C.rust, "stroke-width": 1.4, "stroke-dasharray": "4 2.5", "stroke-linejoin": "round", "clip-path": `url(#${uid}cv)` }, tGrp);
    value("0", L, TB + 15, {}, tGrp);
    value("127", R, TB + 15, { "text-anchor": "end" }, tGrp);
    // key for the two output traces, centred under the plot
    const key = el("g", {}, tGrp), kx = (L + R) / 2 + (wide ? 0 : 6);
    const kCsv = el("g", { opacity: 0 }, key), kCv = el("g", { opacity: 0 }, key);
    el("path", { d: `M${kx - (wide ? 104 : 86)},${TB + 11} h14`, stroke: C.green, "stroke-width": 1.7 }, kCsv);
    soft(wide ? "signal route" : "signal", kx - (wide ? 86 : 68), TB + 15, {}, kCsv);
    el("path", { d: `M${kx + 6},${TB + 11} h14`, stroke: C.rust, "stroke-width": 1.4, "stroke-dasharray": "4 2.5" }, kCv);
    soft(wide ? "image route" : "image", kx + 24, TB + 15, {}, kCv);

    /* the two routes on one millisecond scale */
    const msx = ms => L + (R - L) * ms / MS.cvTotal;
    const lanes = [];
    let y = TB + 42;
    rule(y - 20, L, R);
    [["Signal route", wide ? "filters the CSV rows directly" : "filters the CSV rows", "csv"],
     ["Image route", wide ? "renders each scan as an image first" : "renders images first", "cv"]].forEach(([name, sub, key2], li) => {
      const t = label("", L, y); span(t, name); span(t, sub, { dx: 7, "font-size": 12, "font-style": "italic", fill: C.soft });
      const clock = value("0.0 ms", R, y, { "text-anchor": "end", fill: C.ink, "font-size": 12 });
      const by = y + 10, bh = 5;
      el("rect", { x: L, y: by, width: R - L, height: bh, fill: "none", stroke: C.rule, "stroke-width": .7 });
      const segs = [];
      if (key2 === "cv") {
        segs.push({ a: 0, b: MS.cvTotal - MS.cvFilter, fill: C.ochre, lab: "render frames" });
        segs.push({ a: MS.cvTotal - MS.cvFilter, b: MS.cvTotal, fill: C.green, lab: "filter" });
      } else segs.push({ a: 0, b: MS.csvTotal, fill: C.green, lab: "filter" });
      segs.forEach(s => {
        s.r = el("rect", { x: msx(s.a), y: by, width: 0, height: bh, fill: s.fill });
        // label under its segment: centred if it fits, else from the segment start, or ending at the right edge
        const mid = (msx(s.a) + msx(s.b)) / 2, narrow = msx(s.b) - msx(s.a) < 120, atEnd = msx(s.a) > (L + R) / 2;
        const x = !narrow ? mid : atEnd ? R : msx(s.a), anchor = !narrow ? "middle" : atEnd ? "end" : "start";
        s.t = soft(s.lab, x, by + bh + 14, { "text-anchor": anchor, opacity: 0 });
        s.ms = span(s.t, (s.b - s.a).toFixed(1) + " ms", { dx: 5, "font-family": MONO, "font-style": "normal", "font-size": 11, "fill-opacity": 0 });
      });
      const oy = by + bh + 21, oh = wide ? 34 : 32;
      el("rect", { x: L + .4, y: oy + .4, width: R - L - .8, height: oh - .8, fill: C.cream, stroke: C.rule, "stroke-width": .8 });
      const pre = key2 === "cv" ? clip("p" + li) : null;
      const preImg = pre ? wf("raw", oy, oh, { "clip-path": `url(#${uid}p${li})`, opacity: .55 }) : null;
      const outClip = clip("o" + li);
      const outImg = wf(key2, oy, oh, { "clip-path": `url(#${uid}o${li})` });
      el("line", { x1: scanX, x2: scanX, y1: oy - 2, y2: oy + oh + 2, stroke: C.rust, "stroke-width": .9, opacity: .8 });
      lanes.push({ clock, segs, pre, preImg, outClip, outImg });
      y = oy + oh + 32;
    });
    const H = y - 32 + 4;

    svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
    svg.setAttribute("role", "img");
    svg.setAttribute("aria-label", "A sonar waterfall of a gate is processed two ways. Filtering the CSV rows directly takes 3.1 milliseconds and keeps the gate echo in return 800. Rendering each scan to an image and then filtering takes 37.4 milliseconds and removes the gate echo.");
    host.replaceChildren(svg);
    return { W, wide, rawImg, rawClip, cur, curLab, tHead, tGrp, rawT, trClip, csvT, cvT, csvClip, cvClip, kCsv, kCv, lanes, L, R, scanX };
  }

  // the note line's sentences, in order; its height is reserved for the longest one
  const NOTE_LINES = [
    "A sonar sweeps past a gate; each column of the waterfall is one return.",
    "Return 800 crosses the gate, a strong echo about 22 to 34 distance points out.",
    "Both routes run the same median filter and background subtraction.",
    "The signal route is done in 3.1 ms, and the gate echo is still there.",
    "The image route is still rendering every scan as an image frame.",
    "Only now does the image route start filtering, which itself takes 3.8 ms.",
    "Done at 37.4 ms, the image route has filtered the gate echo away with the noise."];

  /* ---------- render at loop time t (stateless) ---------- */
  function render(t) {
    if (!G) return;
    t = ((t % LOOP) + LOOP) % LOOP;
    const fade = 1 - ramp(t, T_HOLD, T_HOLD + 1.1);
    const span = G.R - G.L;

    // raw sweep arrives left to right, then the return is picked out
    G.rawClip.setAttribute("width", G.L + span * ramp(t, T_SWEEP[0], T_SWEEP[1]));
    G.rawImg.setAttribute("opacity", fade);
    const pick = ramp(t, T_TRACE[0], T_TRACE[0] + .4) * fade;
    G.cur.setAttribute("opacity", pick); G.curLab.setAttribute("opacity", pick);
    G.tHead.setAttribute("opacity", ramp(t, T_TRACE[0], T_TRACE[1]) * fade);
    G.tGrp.setAttribute("opacity", ramp(t, T_TRACE[0], T_TRACE[0] + .3) * fade);
    const ut = ramp(t, T_TRACE[0] + .1, T_TRACE[1]);
    G.trClip.setAttribute("width", ut > 0 ? G.L + span * ut + 2 : 0);

    // the routes: elapsed measured milliseconds
    const el = clamp((t - T0) / SLOW / MS.cvTotal) * MS.cvTotal;     // ms since start, capped at the CV total
    const msx = ms => G.L + span * ms / MS.cvTotal;
    G.lanes.forEach((l, li) => {
      const total = li === 0 ? MS.csvTotal : MS.cvTotal, e = Math.min(el, total);
      l.clock.textContent = (t < T0 ? 0 : e).toFixed(1) + " ms";
      l.clock.setAttribute("fill", t >= T0 && e >= total ? C.ink : C.soft);
      l.clock.setAttribute("opacity", fade);
      l.segs.forEach(s => {
        const u = clamp((e - s.a) / (s.b - s.a));
        s.r.setAttribute("width", t < T0 ? 0 : Math.max(0, (msx(s.b) - msx(s.a)) * u));
        s.r.setAttribute("opacity", fade);
        const on = t >= T0 && e > s.a ? fade : 0;
        s.t.setAttribute("opacity", on); s.ms.setAttribute("fill-opacity", t >= T0 && u >= 1 ? 1 : 0);
      });
      if (l.pre) {
        // frames are produced one by one while the image route renders, then filtering replaces them
        const ur = clamp(e / (MS.cvTotal - MS.cvFilter));
        l.pre.setAttribute("width", t < T0 ? 0 : G.L + span * ur);
        l.preImg.setAttribute("opacity", .55 * fade);
        const uf = clamp((e - (MS.cvTotal - MS.cvFilter)) / MS.cvFilter);
        l.outClip.setAttribute("width", t < T0 ? 0 : G.L + span * uf);
      } else l.outClip.setAttribute("width", t < T0 ? 0 : G.L + span * clamp(e / total));
      l.outImg.setAttribute("opacity", fade);
    });

    // outputs drawn back over return 800
    const csvIn = ramp(t, csvEnd + .1, csvEnd + .9), cvIn = ramp(t, cvEnd + .1, cvEnd + .9);
    G.csvClip.setAttribute("width", csvIn > 0 ? G.L + span * csvIn + 2 : 0);
    G.cvClip.setAttribute("width", cvIn > 0 ? G.L + span * cvIn + 2 : 0);
    G.kCsv.setAttribute("opacity", csvIn); G.kCv.setAttribute("opacity", cvIn);
    G.rawT.setAttribute("stroke", csvIn > .5 ? C.line : C.deep);

    // one quiet line of text
    const NL = NOTE_LINES;
    const line = t < T_TRACE[0] ? NL[0] : t < T0 ? NL[1] : t < csvEnd + .1 ? NL[2] : t < csvEnd + 1.6 ? NL[3]
      : t < cvRender ? NL[4] : t < cvEnd + .2 ? NL[5] : NL[6];
    if (note && note.textContent !== line) note.textContent = line;
  }

  /* ---------- layout and loop ---------- */
  const m = /#t=([\d.]+)/.exec(location.hash);
  let tl = m ? parseFloat(m[1]) : 0, last = null, running = !reduce;
  const STATIC_T = cvEnd + 3;   // reduced motion: both routes finished, both traces drawn
  const draw = () => render(reduce ? STATIC_T : tl);
  let noteW = -1;
  function fitNote() {               // fixed height at a given width: measure every sentence, keep the tallest
    if (!note) return;
    const w = note.getBoundingClientRect().width;
    if (!w || Math.abs(w - noteW) < .5) return;
    noteW = w;
    const keep = note.textContent; let h = 0;
    note.style.minHeight = "0px";
    for (const s of NOTE_LINES) { note.textContent = s; h = Math.max(h, note.getBoundingClientRect().height); }
    note.textContent = keep; note.style.minHeight = Math.ceil(h) + "px";
  }
  function layout() {
    fitNote();
    const w = Math.round(host.getBoundingClientRect().width) || 340;
    const W = Math.max(270, Math.min(620, w));
    if (G && Math.abs(G.W - W) < 6) return;
    G = build(W); draw();
  }
  layout();
  if ("ResizeObserver" in window) new ResizeObserver(layout).observe(host);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { noteW = -1; fitNote(); });
  if (reduce) return;
  function frame(now) {
    const dt = last === null ? 0 : Math.min(.1, (now - last) / 1000); last = now;
    if (running) { tl += dt; render(tl); }
    requestAnimationFrame(frame);
  }
  if ("IntersectionObserver" in window) new IntersectionObserver(es => { running = es[0].isIntersecting; last = null; }).observe(root);
  document.addEventListener("visibilitychange", () => { last = null; });
  requestAnimationFrame(frame);
})();
