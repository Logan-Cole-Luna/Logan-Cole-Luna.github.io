/* SensorWF: one analytical core, three domains (data/sensorwf.js).
   The picture is the three real signals stacked: spacecraft TEMP_OBDH, ECG lead MLII and Jena air
   temperature. One bracket joins them, labelled "same code". Each signal reaches the bracket through
   its own arm, which is its domain adapter (M1, the only domain-specific module); M2 to M5 sit along
   the bracket's back and are the same code for every domain.
   Motion: the core visits one signal at a time. Its arm lights (M1), then M2 to M5 light in turn, and
   when M2 runs its real quality finding is drawn onto that trace (the fitted trend, or the |z| > 4
   flags). Findings stay, and after all three the loop clears and starts again. Signals, fits, flags
   and finding labels are real repo outputs; the visiting order and timing are illustrative.
   The SVG is laid out at one unit per CSS pixel for the container width, so text keeps its size from
   phone to desktop. Markup: .anim-sensorwf > .swf-svg. #t=<s> jumps to a moment. */
(function () {
  const root = document.querySelector(".anim-sensorwf");
  const D = window.SENSORWF_DATA;
  if (!root || !D) return;
  const host = root.querySelector(".swf-svg");
  const NS = "http://www.w3.org/2000/svg";
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const C = { deep: "#173f35", green: "#1f6b57", rust: "#a8461f", sand2: "#e6dbc3",
    rule: "#d6c8a9", line: "#c9bb98", soft: "#5f5a52", ink: "#1c1a17" };
  const MONO = "'IBM Plex Mono',ui-monospace,monospace", SANS = "'Source Sans 3','Segoe UI',sans-serif";
  const clamp = x => x < 0 ? 0 : x > 1 ? 1 : x;
  const ease = x => { x = clamp(x); return x * x * (3 - 2 * x); };
  const ramp = (t, a, b) => ease((t - a) / (b - a));

  /* ---------- schedule ---------- */
  const PASS = 6.4;                                         // one domain's pass through the core
  const MOD = [[0.3, 1.2], [1.2, 3.0], [3.0, 3.7], [3.7, 4.4], [4.4, 5.2]];   // M1..M5 within a pass
  const NDOM = D.domains.length, HOLD = 3.2, CLEAR = 0.8;
  const LOOP = PASS * NDOM + HOLD + CLEAR;
  const UNIT = { "z": "z-score" };

  let G = null;

  function build(W) {
    const wide = W >= 470;
    const svg = document.createElementNS(NS, "svg");
    const el = (t, a, p) => { const e = document.createElementNS(NS, t); for (const k in a) e.setAttribute(k, a[k]); (p || svg).appendChild(e); return e; };
    const txt = (s, a, p) => { const e = el("text", a, p); e.textContent = s; return e; };
    const span = (parent, s, a) => { const e = el("tspan", a || {}, parent); e.textContent = s; return e; };
    const uid = "swf" + Math.random().toString(36).slice(2, 7);
    const defs = el("defs", {});

    /* columns: traces | arms (M1) | bracket back with M2..M5 */
    const L = 0, R = W - 1;
    const BX = R - (wide ? 70 : 66);                 // bracket back
    const ARM = 32;                                   // arm length (adapter)
    const TX1 = BX - ARM - 6;                         // trace right edge
    const LABH = 20, PH = wide ? 96 : 84, FIND = wide ? 0 : 20, GAP = wide ? 26 : 20;
    const rowH = LABH + PH + FIND;

    const rows = D.domains.map((d, i) => {
      const top = i * (rowH + GAP);
      const g = el("g", {});
      // direct label: domain, then channel in mono
      const lab = txt("", { x: L, y: top + 14, "font-family": SANS, "font-size": 13, fill: C.ink }, g);
      span(lab, d.name);
      span(lab, d.channel + (d.unit ? " " + (UNIT[d.unit] || d.unit) : ""), { dx: 8, "font-family": MONO, "font-size": 13, fill: C.soft });

      const s = d.sig, n = s.y.length;
      const tAt = k => s.t ? s.t[k] : k * s.dt, tA = tAt(0), tB = tAt(n - 1);
      const ys = s.lo ? s.lo.concat(s.hi) : s.y;
      let lo = Math.min(...ys), hi = Math.max(...ys);
      if (d.mark.kind === "trend") {
        const f0 = s.fit[0] + s.fit[1] * tA, f1 = s.fit[0] + s.fit[1] * tB;
        lo = Math.min(lo, f0, f1); hi = Math.max(hi, f0, f1);
      }
      const pad = (hi - lo) * .06; lo -= pad; hi += pad;
      const y0 = top + LABH + 6, y1 = top + LABH + PH - 4;
      const X = t => L + (TX1 - L) * (t - tA) / (tB - tA);
      const Y = v => y1 - (y1 - y0) * (v - lo) / (hi - lo);
      const pt = k => X(tAt(k)).toFixed(1) + ",";

      el("path", { d: `M${L},${y1 + 4} H${TX1}`, stroke: C.rule, "stroke-width": .8, fill: "none" }, g);   // baseline
      const tr = el("g", {}, g);
      if (s.lo) {
        let dd = "";
        for (let k = 0; k < n; k++) dd += (k ? "L" : "M") + pt(k) + Y(s.hi[k]).toFixed(1);
        for (let k = n - 1; k >= 0; k--) dd += "L" + pt(k) + Y(s.lo[k]).toFixed(1);
        el("path", { d: dd + "Z", fill: C.sand2 }, tr);
      }
      let dp = "";
      for (let k = 0; k < n; k++) dp += (k ? "L" : "M") + pt(k) + Y(s.y[k]).toFixed(1);
      el("path", { d: dp, fill: "none", stroke: C.deep, "stroke-width": 1.3, "stroke-linejoin": "round" }, tr);

      // M2 finding, drawn on the trace: a clip that opens left to right
      const clip = el("clipPath", { id: uid + "c" + i }, defs);
      const clipR = el("rect", { x: L - 6, y: top - 4, width: 0, height: rowH + 8 }, clip);
      const mk = el("g", { "clip-path": `url(#${uid}c${i})` }, g);
      if (d.mark.kind === "trend")
        el("line", { x1: X(tA), x2: X(tB), y1: Y(s.fit[0] + s.fit[1] * tA), y2: Y(s.fit[0] + s.fit[1] * tB),
          stroke: C.rust, "stroke-width": 1.6, "stroke-dasharray": "5 3" }, mk);
      else s.flags.forEach(k => el("circle", { cx: X(tAt(k)), cy: Y(s.y[k]), r: 3.2, fill: "none", stroke: C.rust, "stroke-width": 1.5 }, mk));
      const find = wide
        ? txt(d.mark.label, { x: TX1, y: top + 14, "text-anchor": "end", "font-family": SANS, "font-size": 13, fill: C.rust }, g)
        : txt(d.mark.label, { x: L, y: top + LABH + PH + 15, "font-family": SANS, "font-size": 13, fill: C.rust }, g);

      // arm to the bracket: this domain's adapter
      const cy = top + LABH + PH / 2;
      const arm = el("path", { d: `M${TX1 + 6},${cy} H${BX}`, stroke: C.line, "stroke-width": 1.4, fill: "none" });
      return { g, tr, clipR, find, arm, cy, x0: L - 6, x1: TX1 + 6 };
    });

    const H = NDOM * rowH + (NDOM - 1) * GAP + 2;
    const cTop = rows[0].cy, cBot = rows[NDOM - 1].cy;
    const back = el("path", { d: `M${BX},${cTop} V${cBot}`, stroke: C.line, "stroke-width": 1.4, fill: "none" });
    const backOn = el("path", { d: `M${BX},${cTop} V${cBot}`, stroke: C.deep, "stroke-width": 1.6, fill: "none", opacity: 0 });
    txt("same code", { x: BX + 10, y: cTop - 6, "font-family": SANS, "font-size": 13, fill: C.ink });

    // five small labels: M1 on the arms, M2..M5 along the back
    const mlab = [txt("M1", { x: TX1 + 6 + ARM / 2, y: cTop - 6, "text-anchor": "middle", "font-family": SANS, "font-size": 13, fill: C.soft })];
    for (let i = 0; i < 4; i++) {
      const y = cTop + (cBot - cTop) * (i + .5) / 4;
      el("path", { d: `M${BX},${y} H${BX + 5}`, stroke: C.line, "stroke-width": 1.2, fill: "none" });
      mlab.push(txt("M" + (i + 2), { x: BX + 10, y: y + 4.5, "font-family": SANS, "font-size": 13, fill: C.soft }));
    }

    svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
    svg.setAttribute("width", W); svg.setAttribute("height", H);
    svg.setAttribute("role", "img");
    svg.setAttribute("aria-label", "Three real recordings stacked: spacecraft board temperature, an ECG lead and Jena air temperature. Each reaches one bracket labelled same code through its own adapter, M1; modules M2 to M5 are shared. The quality findings are marked on each trace: a warming trend of 4.48 degrees on the spacecraft, R-peaks beyond 4 standard deviations on the ECG, and a seasonal warming of 11.9 degrees in the climate record.");
    host.replaceChildren(svg);
    return { W, H, rows, backOn, mlab };
  }

  /* ---------- render at loop time t (stateless) ---------- */
  function render(t) {
    if (!G) return;
    t = ((t % LOOP) + LOOP) % LOOP;
    const passEnd = PASS * NDOM, clearing = t >= passEnd + HOLD;
    const di = t < passEnd ? Math.floor(t / PASS) : -1;      // domain in the core, -1 while holding
    const lt = di >= 0 ? t - di * PASS : 0;
    const clearU = clearing ? ramp(t, passEnd + HOLD, LOOP) : 0;

    G.rows.forEach((r, i) => {
      // emphasis: the visited trace at full ink, the others quieter
      const env = di >= 0 ? ramp(lt, 0, .3) * (1 - ramp(lt, PASS - .4, PASS)) : 0;
      const op = di >= 0 && i !== di ? 1 - .5 * env : 1;
      r.tr.setAttribute("opacity", op.toFixed(3));
      // finding: drawn while M2 runs on this trace; stays until the loop clears
      let u;
      if (di === -1) u = 1;
      else if (i < di) u = 1;
      else if (i > di) u = 0;
      else u = ramp(lt, MOD[1][0] + .1, MOD[1][1] - .2);
      r.clipR.setAttribute("width", ((r.x1 - r.x0 + 12) * u).toFixed(1));
      const fo = (di === -1 || i < di ? 1 : i > di ? 0 : ramp(lt, MOD[1][1] - .5, MOD[1][1] - .1)) * (1 - clearU);
      r.find.setAttribute("opacity", fo.toFixed(3));
      const armOn = i === di && lt >= MOD[0][0] && lt < PASS - .3;
      r.arm.setAttribute("stroke", armOn ? C.deep : C.line);
    });
    // clear the drawn marks with the labels
    if (clearing) G.rows.forEach(r => r.clipR.setAttribute("width", ((r.x1 - r.x0 + 12) * (1 - clearU)).toFixed(1)));

    // modules: the active one in rust, finished ones in ink, the rest quiet
    G.mlab.forEach((e, i) => {
      let c = C.soft;
      if (di >= 0 && lt >= MOD[i][0] && lt < PASS - .3) c = lt < MOD[i][1] ? C.rust : C.ink;
      e.setAttribute("fill", c);
    });
    // M1 is each domain's own adapter, so its label sits on the arm in use
    G.mlab[0].setAttribute("y", G.rows[di >= 0 ? di : 0].cy - 6);
    const backU = di >= 0 && lt >= MOD[1][0] && lt < PASS - .3 ? 1 : 0;
    G.backOn.setAttribute("opacity", backU);
  }

  /* ---------- layout and loop ---------- */
  const m = /#t=([\d.]+)/.exec(location.hash);
  let tl = m ? parseFloat(m[1]) : 0, last = null, running = !reduce;
  const STATIC_T = PASS * NDOM + 1;   // reduced motion: every finding drawn, the core at rest
  const draw = () => render(reduce ? STATIC_T : tl);
  function layout() {
    const w = Math.floor(host.getBoundingClientRect().width) || 340;
    const W = Math.max(270, Math.min(640, w));
    if (G && G.W === W) return;
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
