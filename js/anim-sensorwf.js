/* SensorWF: one analytical core, three domains (data/sensorwf.js).
   One path: a domain's real signal is read by its own M1 adapter, then runs down the same four core
   modules. M2 marks its quality findings back on the trace, M3 computes the nine feature families,
   M4 links the channel to its ontology class, and M5 records a SHA-256 digest that repeats exactly.
   Signals, counts and digests are real repo outputs. The only illustrative motion is the hex
   "scramble" shown before each digest settles to its real value.
   The SVG is laid out at one unit per CSS pixel for the container width, so text keeps its size from
   phone to desktop. Markup: .anim-sensorwf > .swf-svg + .swf-note. #t=<s> jumps to a moment. */
(function () {
  const root = document.querySelector(".anim-sensorwf");
  const D = window.SENSORWF_DATA;
  if (!root || !D) return;
  const host = root.querySelector(".swf-svg"), note = root.querySelector(".swf-note");
  const NS = "http://www.w3.org/2000/svg";
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const C = { deep: "#173f35", green: "#1f6b57", rust: "#a8461f", ochre: "#c08a2b", sand2: "#e6dbc3",
    cream: "#fbf8f1", rule: "#d6c8a9", line: "#c9bb98", soft: "#67615a", ink: "#1c1a17" };
  const MONO = "'IBM Plex Mono',ui-monospace,monospace", SANS = "'Source Sans 3','Segoe UI',sans-serif";
  const clamp = x => x < 0 ? 0 : x > 1 ? 1 : x;
  const ease = x => { x = clamp(x); return x * x * (3 - 2 * x); };
  const ramp = (t, a, b) => ease((t - a) / (b - a));
  const lerp = (a, b, u) => a + (b - a) * u;
  const fmt = n => n.toLocaleString("en-US");

  /* ---------- schedule (seconds within one domain) ---------- */
  const SW = 0.6;                                                            // domain switch
  const ST = [[0.6, 2.0], [2.0, 3.3], [3.3, 4.6], [4.6, 5.7], [5.7, 7.2]];   // M1..M5
  const DOM = 8.8, LOOP = DOM * D.domains.length;
  const NAMES = ["", "Quality assessment", "Feature engineering", "Semantic annotation", "Provenance export"];

  let G = null;

  function build(W) {
    const wide = W >= 440;
    const svg = document.createElementNS(NS, "svg");
    const el = (t, a, p) => { const e = document.createElementNS(NS, t); for (const k in a) e.setAttribute(k, a[k]); (p || svg).appendChild(e); return e; };
    const txt = (s, a, p) => { const e = el("text", a, p); e.textContent = s; return e; };
    const span = (parent, s, a) => { const e = el("tspan", a || {}, parent); e.textContent = s; return e; };
    const label = (s, x, y, extra, p) => txt(s, Object.assign({ x, y, "font-family": SANS, "font-size": 13, fill: C.ink }, extra || {}), p);
    const value = (s, x, y, extra, p) => txt(s, Object.assign({ x, y, "font-family": MONO, "font-size": 12, fill: C.ink }, extra || {}), p);
    const soft = (s, x, y, extra, p) => txt(s, Object.assign({ x, y, "font-family": SANS, "font-size": 12, "font-style": "italic", fill: C.soft }, extra || {}), p);
    const rule = (y, x1, x2, extra) => el("path", Object.assign({ d: `M${x1},${y} H${x2}`, stroke: C.rule, "stroke-width": .8, fill: "none" }, extra || {}));
    const uid = "swf" + Math.random().toString(36).slice(2, 7);
    const defs = el("defs", {});

    const SX = 8, L = 26, R = W - 4, LX = L + 30;   // spine, left edge, right edge, label column

    /* domain row */
    const tabs = []; let tx = L;
    D.domains.forEach((d, i) => {
      const t = label(wide ? d.name : d.tab, tx, 14, { fill: C.soft });
      tabs.push({ t, x: tx, w: (wide ? d.name : d.tab).length * (wide ? 6.3 : 6.9) });
      tx += tabs[i].w + (wide ? 22 : 20);
    });
    rule(22, L, R);
    const tabLine = el("path", { d: "", stroke: C.deep, "stroke-width": 1.4, fill: "none" });

    /* signal plot */
    const PL = { x0: L, x1: R, y0: 74, y1: 146 };
    const clipIn = el("clipPath", { id: uid + "a" }, defs), clipInR = el("rect", { x: 0, y: 0, width: 0, height: 400 }, clipIn);
    const clipM2 = el("clipPath", { id: uid + "b" }, defs), clipM2R = el("rect", { x: 0, y: 0, width: 0, height: 400 }, clipM2);
    rule(PL.y1 + 7, L, R);
    const sigs = D.domains.map(d => {
      const g = el("g", { opacity: 0 });
      const s = d.sig, n = s.y.length;
      const ys = s.lo ? s.lo.concat(s.hi) : s.y;
      let ymin = Math.min(...ys), ymax = Math.max(...ys);
      const tAt = k => s.t ? s.t[k] : k * s.dt, tA = tAt(0), tB = tAt(n - 1);
      if (d.mark.kind === "trend") {
        const f0 = s.fit[0] + s.fit[1] * tA, f1 = s.fit[0] + s.fit[1] * tB;
        ymin = Math.min(ymin, f0, f1); ymax = Math.max(ymax, f0, f1);
      }
      const pad = (ymax - ymin) * .08; ymin -= pad; ymax += pad;
      const X = t => PL.x0 + (PL.x1 - PL.x0) * (t - tA) / (tB - tA);
      const Y = v => PL.y1 - (PL.y1 - PL.y0) * (v - ymin) / (ymax - ymin);
      // header: channel and unit, source on the right
      const h = value("", L, 44, {}, g); span(h, d.channel);
      span(h, d.unit === "z" ? "z-score" : d.unit, { dx: 7, fill: C.soft, "font-family": SANS, "font-size": 12 });
      soft(d.file, R, 44, { "text-anchor": "end" }, g);
      value(d.x0, L, PL.y1 + 22, { "font-size": 11, fill: C.soft }, g);
      value(d.x1, R, PL.y1 + 22, { "font-size": 11, fill: C.soft, "text-anchor": "end" }, g);
      // trace
      const tr = el("g", { "clip-path": `url(#${uid}a)` }, g);
      const pt = k => X(tAt(k)).toFixed(1) + "," ;
      if (s.lo) {
        let dd = "";
        for (let k = 0; k < n; k++) dd += (k ? "L" : "M") + pt(k) + Y(s.hi[k]).toFixed(1);
        for (let k = n - 1; k >= 0; k--) dd += "L" + pt(k) + Y(s.lo[k]).toFixed(1);
        el("path", { d: dd + "Z", fill: C.sand2 }, tr);
      }
      let dp = "";
      for (let k = 0; k < n; k++) dp += (k ? "L" : "M") + pt(k) + Y(s.y[k]).toFixed(1);
      el("path", { d: dp, fill: "none", stroke: C.deep, "stroke-width": 1.2, "stroke-linejoin": "round" }, tr);
      // M2 findings drawn back on the trace
      const mk = el("g", { "clip-path": `url(#${uid}b)` }, g);
      if (d.mark.kind === "trend")
        el("line", { x1: X(tA), x2: X(tB), y1: Y(s.fit[0] + s.fit[1] * tA), y2: Y(s.fit[0] + s.fit[1] * tB),
          stroke: C.rust, "stroke-width": 1.3, "stroke-dasharray": "4 3" }, mk);
      else s.flags.forEach(k => el("circle", { cx: X(tAt(k)), cy: Y(s.y[k]), r: 2.5, fill: C.rust }, mk));
      const markNote = soft(d.mark.label, L, 62, { fill: C.rust }, g);
      // M4 ontology class
      const cls = value(d.cls, R, 62, { "text-anchor": "end", "font-size": 11.5, fill: C.green }, g);
      return { g, markNote, cls };
    });
    const cursor = el("line", { y1: PL.y0 - 4, y2: PL.y1 + 7, stroke: C.rust, "stroke-width": .8, opacity: 0 });

    /* the pipeline: one spine with a node per module */
    const rowH = wide ? 27 : 42;
    const Y0 = 196;                                   // M1
    const ys = [Y0];
    const YCORE = Y0 + rowH - 2;                      // rule + note between adapter and core
    ys.push(YCORE + 38);                              // M2
    ys.push(ys[1] + rowH);                            // M3
    const famY = ys[2] + (wide ? 18 : 33);
    ys.push(famY + (wide ? 25 : 26));                 // M4
    ys.push(ys[3] + rowH);                            // M5
    const digY = [ys[4] + 22, ys[4] + 40];
    const H = digY[1] + 10;

    const spine = el("path", { d: `M${SX},${PL.y1 + 7} V${ys[4]}`, stroke: C.line, "stroke-width": 1, fill: "none" });
    el("path", { d: `M${SX},${PL.y1 + 7} H${L}`, stroke: C.line, "stroke-width": 1, fill: "none" });
    rule(YCORE, LX, R, { "stroke-dasharray": "2 3" });
    soft(wide ? "M2 to M5 below are the same code for every domain" : "M2 to M5: same code for every domain", LX, YCORE + 16, { "font-size": 11.5 });

    const nodes = ys.map(y => el("circle", { cx: SX, cy: y - 4, r: 4, fill: C.cream, stroke: C.deep, "stroke-width": 1.2 }));
    const ids = ys.map((y, i) => value("M" + (i + 1), L, y, { "font-size": 11.5, fill: C.soft }));
    const vy = i => wide ? ys[i] : ys[i] + 17;
    const vx = wide ? R : LX, va = wide ? "end" : "start";

    // M1: the adapter swaps per domain
    const ad = D.domains.map(d => {
      const g = el("g", { opacity: 0 });
      const t = value(d.adapter, LX, ys[0], { "font-size": 12.5 }, g);
      span(t, d.lines + " lines", { dx: 7, "font-family": SANS, "font-size": 12, "font-style": "italic", fill: C.soft });
      return g;
    });
    // M2..M5 labels (fixed) with per-domain parts
    const labs = [null];
    for (let i = 1; i < 5; i++) {
      const t = label("", LX, ys[i]); span(t, NAMES[i]);
      labs.push({ t, sub: span(t, "", { dx: 6, "font-size": 12, "font-style": "italic", fill: C.soft }) });
    }
    const vals = ys.map((y, i) => value("", vx, vy(i), { "text-anchor": va }));
    const famT = value("", LX, famY, { "font-size": 11.5, fill: C.soft });
    const famSp = D.families.map((f, i) => span(famT, (i ? " " : "") + f));
    const dig = [0, 1].map(i => {
      const t = value("", LX, digY[i], { "font-size": 11.5 });
      return { lab: span(t, "", { fill: C.soft, "font-size": 11 }), hex: span(t, "", { x: LX + (wide ? 64 : 58) }) };
    });
    let nHex = 32;
    while (nHex > 16 && (nHex + nHex / 8 + 1) * 6.95 > R - LX - (wide ? 64 : 58)) nHex -= 8;
    const tok = el("circle", { cx: SX, r: 3.4, fill: C.rust, opacity: 0 });

    svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
    svg.setAttribute("role", "img");
    svg.setAttribute("aria-label", "Spacecraft telemetry, ECG and climate signals are each read by their own small adapter, then pass the same four core modules: quality assessment, feature engineering, semantic annotation and provenance export. A second run gives an identical SHA-256 digest.");
    host.replaceChildren(svg);
    return { W, wide, tabs, tabLine, clipInR, clipM2R, PL, sigs, cursor, nodes, ids, ad, labs, vals, famT, famSp, dig, nHex, tok, ys };
  }

  /* ---------- digest: settles left to right (the scramble before it is illustrative) ---------- */
  const HEX = "0123456789abcdef";
  function digest(h, n, u, salt) {
    let s = "";
    for (let i = 0; i < n; i++) {
      s += i < Math.floor(u * n) ? h[i] : HEX[(Math.floor(salt * 23) + i * 7 + i * i) % 16];
      if (i % 8 === 7 && i < n - 1) s += " ";
    }
    return s + "…";
  }

  /* ---------- render at loop time t (stateless) ---------- */
  function render(t) {
    if (!G) return;
    t = ((t % LOOP) + LOOP) % LOOP;
    const nd = D.domains.length, di = Math.floor(t / DOM), lt = t - di * DOM, d = D.domains[di];
    const prev = (di + nd - 1) % nd, leaving = lt < SW, sw = ramp(lt, 0, SW);

    // domain row
    G.tabs.forEach((tb, i) => tb.t.setAttribute("fill", i === di ? C.ink : C.soft));
    const a = G.tabs[prev], b = G.tabs[di];
    const x0 = lerp(a.x, b.x, sw), w = lerp(a.w, b.w, sw);
    G.tabLine.setAttribute("d", `M${x0},22 H${x0 + w}`);

    // signal: crossfade, ingest sweep, M2 sweep
    G.sigs.forEach((s, i) => {
      const op = i === di ? ramp(lt, SW, SW + .3) : (i === prev && leaving ? 1 - ramp(lt, 0, SW) : 0);
      s.g.setAttribute("opacity", op); s.g.style.display = op > 0 ? "" : "none";
      const own = i === di;
      s.markNote.setAttribute("opacity", own ? ramp(lt, ST[1][1] - .5, ST[1][1] - .1) : 1);
      s.cls.setAttribute("opacity", own ? ramp(lt, ST[3][0] + .2, ST[3][0] + .5) : 1);
    });
    const PL = G.PL, inU = ramp(lt, ST[0][0], ST[0][1] - .1);
    const inX = leaving ? G.W : lerp(PL.x0, PL.x1 + 2, inU);
    G.clipInR.setAttribute("width", inX);
    G.clipM2R.setAttribute("width", leaving ? G.W : lerp(PL.x0 - 4, PL.x1 + 6, ramp(lt, ST[1][0] + .1, ST[1][1] - .2)));
    G.cursor.setAttribute("x1", inX); G.cursor.setAttribute("x2", inX);
    G.cursor.setAttribute("opacity", !leaving && inU > 0 && inU < 1 ? .9 : 0);

    // stage reached
    let k = -1;
    for (let i = 0; i < ST.length; i++) if (lt >= ST[i][0]) k = i;
    const fadeOut = leaving ? 1 - sw : 1;
    const shown = i => !leaving && k >= i;

    G.nodes.forEach((n, i) => n.setAttribute("fill", shown(i) ? C.deep : C.cream));
    G.ids.forEach((e, i) => e.setAttribute("fill", shown(i) && k === i && lt < ST[4][1] ? C.rust : C.soft));
    G.ad.forEach((g, i) => g.setAttribute("opacity", i === di ? sw : (i === prev && leaving ? 1 - sw : 0)));

    // token runs down the spine from the trace to the active module
    let ty = null;
    if (!leaving) {
      if (lt < ST[0][1] - .3) ty = lerp(PL.y1 + 7, G.ys[0] - 4, ramp(lt, ST[0][0] + .6, ST[0][0] + 1));
      for (let i = 1; i < 5; i++) if (lt >= ST[i][0] - .35 && lt < ST[i][0] + .05) ty = lerp(G.ys[i - 1] - 4, G.ys[i] - 4, ramp(lt, ST[i][0] - .35, ST[i][0]));
    }
    G.tok.setAttribute("opacity", ty === null ? 0 : 1);
    if (ty !== null) G.tok.setAttribute("cy", ty);

    // values (use the leaving domain's values while it fades)
    const vd = leaving ? D.domains[prev] : d, op = i => leaving ? fadeOut : ramp(lt, ST[i][0] + .15, ST[i][0] + .45);
    const v = [vd.m1, vd.m2, fmt(vd.nfeat) + " features", vd.m4, ""];
    G.vals.forEach((e, i) => { e.textContent = v[i]; e.setAttribute("opacity", leaving ? fadeOut : (k >= i ? op(i) : 0)); });
    const subs = [null, "", "window " + vd.window, vd.sess, "seed " + D.seed];
    for (let i = 1; i < 5; i++) {
      G.labs[i].sub.textContent = subs[i];
      G.labs[i].sub.setAttribute("opacity", leaving ? fadeOut : (k >= i ? op(i) : 0));
      G.labs[i].t.firstChild.setAttribute("fill", C.ink);
    }
    // M3 families light in order
    G.famSp.forEach((s, i) => {
      const on = leaving || (k >= 2 && lt >= ST[2][0] + .15 + i * .1);
      s.setAttribute("fill", on ? C.ink : C.soft);
    });
    G.famT.setAttribute("opacity", leaving ? .6 * fadeOut + .4 : (k >= 2 ? 1 : .4));

    // M5 digests
    const h = vd.hashes, n = G.nHex;
    const u1 = leaving ? 1 : ramp(lt, ST[4][0] + .15, ST[4][0] + .75), u2 = leaving ? 1 : ramp(lt, ST[4][0] + .6, ST[4][0] + 1.2);
    const live = leaving || k >= 4;
    G.dig[0].lab.textContent = h.a; G.dig[1].lab.textContent = h.b;
    G.dig[0].hex.textContent = live ? digest(h.h, n, u1, lt) : "";
    G.dig[1].hex.textContent = live && (leaving || lt >= ST[4][0] + .6) ? digest(h.h, n, u2, lt + 3) : "";
    G.dig.forEach(x => x.lab.parentNode.setAttribute("opacity", live ? fadeOut : .45));
    const ok = !leaving && lt >= ST[4][0] + 1.25;
    G.vals[4].textContent = ok ? h.verdict : "";
    G.vals[4].setAttribute("font-family", SANS); G.vals[4].setAttribute("font-style", "italic");
    G.vals[4].setAttribute("font-size", 12.5); G.vals[4].setAttribute("fill", C.green);
    G.vals[4].setAttribute("opacity", ok ? ramp(lt, ST[4][0] + 1.25, ST[4][0] + 1.5) : 0);
    if (!G.wide) G.vals[4].setAttribute("y", G.ys[4]), G.vals[4].setAttribute("x", G.W - 4), G.vals[4].setAttribute("text-anchor", "end");

    // one quiet line of text
    let line;
    if (leaving || k <= 0) line = d.n1;
    else if (k === 1) line = d.n2;
    else if (k === 2) line = "The same nine feature families are computed for every channel.";
    else if (k === 3) line = `Each feature is linked to its class in ${d.owl}.`;
    else line = ok ? h.note : "M5 records every output file with its SHA-256 digest.";
    if (note && note.textContent !== line) note.textContent = line;
  }

  /* ---------- layout and loop ---------- */
  const m = /#t=([\d.]+)/.exec(location.hash);
  let tl = m ? parseFloat(m[1]) : 0, last = null, running = !reduce;
  const STATIC_T = DOM * 1 + 8.0;   // reduced motion: ECG with every module complete
  const draw = () => render(reduce ? STATIC_T : tl);
  // every sentence the note line can show, so its height can be reserved for the longest one
  const NOTE_LINES = ["The same nine feature families are computed for every channel.", "M5 records every output file with its SHA-256 digest."]
    .concat(...D.domains.map(d => [d.n1, d.n2, `Each feature is linked to its class in ${d.owl}.`, d.hashes.note]));
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
