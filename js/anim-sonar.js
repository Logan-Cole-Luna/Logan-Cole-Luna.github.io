/* Signal-Centric Remote Sensing: one sonar sweep, cleaned two ways (data/sonar.js).
   The subject is the paper's own gate waterfalls, drawn full width on the card paper: the unfiltered
   sweep (Fig. 7a), the signal route's output (Fig. 7b, median filter and background subtraction on the
   CSV rows) and the image route's output (Fig. 7c, OpenCV filtering after rendering each scan as an image).
   The two routes run side by side on one millisecond scale from Table III: the signal route finishes in
   3.1 ms; the image route first renders every scan to a frame (shown as the faint raw sweep being redrawn)
   and only then filters, finishing at 37.419 ms. One quiet bar each compares the two totals; the numbers
   are static text that appears when each route finishes. The gate echo at return 800, distance points
   21 to 35, is marked on each waterfall: kept by the signal route, removed by the image route (as in the
   paper's Fig. 8 difference maps and the scan-800 traces in data/sonar.js).
   Nothing here is synthetic. Waterfalls are read back from the published plots, so values are
   approximate. The only liberty, and the reason the caption says "illustrative" timing, is speed: the
   measured milliseconds are played 300 times slower.
   The SVG is laid out at one unit per CSS pixel of the container width, so text keeps its size from
   phone to desktop. The height is fixed at a given width for the whole loop.
   Markup: .anim-sonar > .sonar-svg. #t=<s> jumps to a moment. */
(function () {
  const root = document.querySelector(".anim-sonar");
  const D = window.SONAR_DATA;
  if (!root || !D) return;
  const host = root.querySelector(".sonar-svg");
  const NS = "http://www.w3.org/2000/svg";
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const C = { deep: "#173f35", green: "#1f6b57", rust: "#a8461f", ochre: "#c08a2b", rule: "#d6c8a9",
    soft: "#67615a", ink: "#1c1a17", halo: "#fbf8f1" };
  const MONO = "'IBM Plex Mono',ui-monospace,monospace", SANS = "'Source Sans 3','Segoe UI',sans-serif";
  const clamp = x => x < 0 ? 0 : x > 1 ? 1 : x;
  const ease = x => { x = clamp(x); return x * x * (3 - 2 * x); };
  const ramp = (t, a, b) => ease((t - a) / (b - a));

  /* ---------- schedule (seconds) ---------- */
  const MS = D.ms, SLOW = 0.3;                        // one measured millisecond plays for 0.3 s
  const T_SWEEP = [0.3, 2.1];                         // the raw sweep arrives, newest return on the right
  const T_GATE = 2.3;                                 // gate echo marked on the raw sweep
  const T0 = 3.2;                                     // both routes start
  const csvEnd = T0 + MS.csvTotal * SLOW;
  const cvRender = T0 + (MS.cvTotal - MS.cvFilter) * SLOW, cvEnd = T0 + MS.cvTotal * SLOW;
  const T_HOLD = cvEnd + 7, LOOP = T_HOLD + 1.4;      // about 23 s

  /* ---------- waterfall rasters: palette ramp, paper (quiet) to deep (strong echo) ---------- */
  const STOPS = [[0, [249, 245, 236]], [.28, [230, 219, 195]], [.65, [31, 107, 87]], [1, [23, 63, 53]]];
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
    const label = (s, x, y, extra, p) => txt(s, Object.assign({ x, y, "font-family": SANS, "font-size": 14, fill: C.ink }, extra || {}), p);
    const uid = "snr" + Math.random().toString(36).slice(2, 7);
    const defs = el("defs", {});
    const L = 0, R = W, sx = s => L + (R - L) * s / D.scans;
    const clip = id => { const c = el("clipPath", { id: uid + id }, defs); return el("rect", { x: 0, y: 0, width: 0, height: 2000 }, c); };
    const wf = (key, y, h, extra) => el("image", Object.assign({ href: rasterOf(key), x: L, y, width: R - L, height: h,
      preserveAspectRatio: "none" }, extra || {}));
    const edge = (y, h) => el("rect", { x: L + .4, y: y + .4, width: R - L - .8, height: h - .8, fill: "none", stroke: C.rule, "stroke-width": .8 });
    // the gate echo at return 800: a hairline box on the waterfall, with its word beside it
    const gateMark = (y, h, word, color) => {
      const g = el("g", { opacity: 0 });
      const x0 = sx(D.scan - 55), x1 = sx(D.scan + 55);
      const y0 = y + h * D.gate[0] / D.dist - 3, y1 = y + h * D.gate[1] / D.dist + 3;
      el("rect", { x: x0, y: y0, width: x1 - x0, height: y1 - y0, fill: "none", stroke: color, "stroke-width": 1.3 }, g);
      label(word, x1 + 6, (y0 + y1) / 2 + 5, { fill: color, stroke: C.halo, "stroke-width": 4, "paint-order": "stroke", "stroke-linejoin": "round" }, g);
      return g;
    };

    const RH = wide ? 142 : 112, OH = wide ? 106 : 88;

    /* the raw sweep */
    label("Unfiltered sweep of a gate", L, 14);
    const WY = 24;
    const rawClip = clip("r");
    const rawImg = wf("raw", WY, RH, { "clip-path": `url(#${uid}r)` });
    edge(WY, RH);
    const rawGate = gateMark(WY, RH, "gate", C.rust);

    /* the two routes, one comparison: a label, one quiet bar on a shared millisecond scale, the total */
    const BX = L + (wide ? 104 : 92), BR = R - (wide ? 66 : 62);    // bar track, leaving room for "37.4 ms"
    const msx = ms => BX + (BR - BX) * ms / MS.cvTotal;
    const lanes = [];
    let y = WY + RH + 32;
    [["Signal route", "csv", MS.csvTotal, C.green, "kept"], ["Image route", "cv", MS.cvTotal, C.rust, "removed"]].forEach(([name, key, total, col, word], li) => {
      label(name, L, y);
      const bar = el("rect", { x: BX, y: y - 6, width: 0, height: 3, fill: col, opacity: .75 });
      const num = txt(total.toFixed(1) + " ms", { x: msx(total) + 7, y, "font-family": MONO, "font-size": 13, fill: C.ink, opacity: 0 });
      const oy = y + 10;
      const pre = key === "cv" ? clip("p" + li) : null;            // image route: frames rendered one by one
      const preImg = pre ? wf("raw", oy, OH, { "clip-path": `url(#${uid}p${li})`, opacity: .4 }) : null;
      const outClip = clip("o" + li);
      const outImg = wf(key, oy, OH, { "clip-path": `url(#${uid}o${li})` });
      edge(oy, OH);
      const gate = gateMark(oy, OH, word, col);
      lanes.push({ total, bar, num, pre, preImg, outClip, outImg, gate });
      y = oy + OH + 32;
    });
    const H = y - 32 + 2;

    svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
    svg.setAttribute("height", H);
    svg.setAttribute("role", "img");
    svg.setAttribute("aria-label", "A sonar waterfall of a gate is cleaned two ways. Filtering the CSV rows directly takes 3.1 milliseconds and keeps the gate echo at return 800. Rendering each scan to an image and then filtering takes 37.4 milliseconds and removes the gate echo.");
    host.replaceChildren(svg);
    return { W, rawImg, rawClip, rawGate, lanes, L, R, BX, msx };
  }

  /* ---------- render at loop time t (stateless) ---------- */
  function render(t) {
    if (!G) return;
    t = ((t % LOOP) + LOOP) % LOOP;
    const fade = 1 - ramp(t, T_HOLD, T_HOLD + 1.1);
    const span = G.R - G.L;

    G.rawClip.setAttribute("width", G.L + span * ramp(t, T_SWEEP[0], T_SWEEP[1]));
    G.rawImg.setAttribute("opacity", fade);
    G.rawGate.setAttribute("opacity", ramp(t, T_GATE, T_GATE + .5) * fade);

    const e = t < T0 ? 0 : clamp((t - T0) / SLOW / MS.cvTotal) * MS.cvTotal;   // measured ms elapsed
    G.lanes.forEach(l => {
      const done = e >= l.total;
      l.bar.setAttribute("width", Math.max(0, G.msx(Math.min(e, l.total)) - G.BX));
      l.bar.setAttribute("opacity", .75 * fade);
      l.num.setAttribute("opacity", done ? fade : 0);
      if (l.pre) {
        const rend = MS.cvTotal - MS.cvFilter;
        l.pre.setAttribute("width", G.L + span * clamp(e / rend));
        l.preImg.setAttribute("opacity", .4 * fade);
        l.outClip.setAttribute("width", G.L + span * clamp((e - rend) / MS.cvFilter));
      } else l.outClip.setAttribute("width", G.L + span * clamp(e / l.total));
      l.outImg.setAttribute("opacity", fade);
      const tEnd = T0 + l.total * SLOW;
      l.gate.setAttribute("opacity", ramp(t, tEnd + .2, tEnd + .7) * fade);
    });
  }

  /* ---------- layout and loop ---------- */
  const m = /#t=([\d.]+)/.exec(location.hash);
  let tl = m ? parseFloat(m[1]) : 0, last = null, running = !reduce;
  const STATIC_T = cvEnd + 3;   // reduced motion: both routes finished, both gate marks drawn
  const draw = () => render(reduce ? STATIC_T : tl);
  function layout() {
    const w = Math.round(host.getBoundingClientRect().width) || 340;
    const W = Math.max(270, Math.min(640, w));
    if (G && Math.abs(G.W - W) < 6) return;
    G = build(W); draw();
  }
  layout();
  if ("ResizeObserver" in window) new ResizeObserver(layout).observe(host);
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
