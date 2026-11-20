/* Hero: replay of a real AIProver orchestration run (data/run011.js + js/aimath-layout.js).
   The lemma DAG is the picture: each lemma is a dot that fills as Lean accepts it. Timing is
   compressed and illustrative; the order of events, the tree and the lemma names are the real trace.
   Markup: .proof-hero containing .ph-graph. */
(function () {
  const root = document.querySelector(".proof-hero");
  if (!root || !window.RUN || !window.layoutDag) return;
  const RUN = window.RUN, NS = "http://www.w3.org/2000/svg";
  const host = root.querySelector(".ph-graph");
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const C = { deep: "#173f35", green: "#1f6b57", rust: "#a8461f", ochre: "#c08a2b", ochreInk: "#8a6418",
    hollow: "#a99c80", edge: "#cdbf9f", paper: "#f7f2e7", ink: "#1c1a17", soft: "#67615a" };
  // lemmas and the theorem only; the three definitions (and their dotted uses) are left out of the picture
  const NODES = RUN.nodes.filter(n => n.kind !== "def"), keep = new Set(NODES.map(n => n.name));
  const EDGES = RUN.edges.filter(([a, b]) => keep.has(a) && keep.has(b));

  // a few real lemma names, set beside their nodes; the rest of the tree stays unlabelled
  const LABELS = { totient_fiber_finite: "above", smooth_count: "below", asymp_main: "right",
    exists_good_n_large: "right", solution: "right" };

  // unit layout once (rows and order), scaled to the container width on every (re)build
  const unit = layoutDag({ nodes: NODES, edges: EDGES }, { colW: 1, rowH: 1, pad: 0 });
  const nCols = Math.max(...unit.rows.map(r => r.length)), nRows = unit.rows.length;

  let svg, N = {}, edges = [], W = 0;
  const st = {};
  const el = (t, a, p) => { const e = document.createElementNS(NS, t); for (const k in a) e.setAttribute(k, a[k]); p.appendChild(e); return e; };

  function build(w) {
    W = w;
    const padX = w < 420 ? 12 : 22, top = 34, bottom = 16, rowH = Math.max(40, Math.min(48, w * .1));
    const H = top + (nRows - 1) * rowH + bottom;
    const X = x => padX + (x - .5) / (nCols - 1) * (w - 2 * padX);
    const xy = {};
    for (const n in unit.xy) xy[n] = { x: X(unit.xy[n].x), y: top + unit.xy[n].y * rowH };

    host.textContent = "";
    svg = el("svg", { width: w, height: H, viewBox: `0 0 ${w} ${H}`, "aria-hidden": "true" }, host);
    // measure label widths first, so no style flush happens between drawing the tree and setting its state
    // (a flush there would make fresh nodes transition in from black)
    const tw = {};
    for (const n in LABELS) {
      const t = el("text", { class: n === "solution" ? "ph-thm" : "ph-lemma" }, svg);
      t.textContent = n === "solution" ? "Theorem" : n;
      tw[n] = t.getComputedTextLength() || t.textContent.length * 7.8; t.remove();
    }
    const eG = el("g", {}, svg), nG = el("g", {}, svg), lG = el("g", {}, svg);

    edges = EDGES.map(([a, b]) => {
      const p = xy[a], q = xy[b], y1 = q.y + 6, y2 = p.y - 7, my = (y1 + y2) / 2;
      return { a, b, e: el("path", { d: `M${q.x},${y1} C${q.x},${my} ${p.x},${my} ${p.x},${y2}`, fill: "none", "stroke-width": 1.3 }, eG) };
    });

    N = {};
    NODES.forEach(n => {
      const { x, y } = xy[n.name], g = el("g", { transform: `translate(${x},${y})` }, nG);
      const shape = el("circle", { r: n.kind === "main" ? 7.5 : 5 }, g);
      let label = null;
      const side = LABELS[n.name];
      if (side) {
        const main = n.kind === "main", text = main ? "Theorem" : n.name;
        label = el("text", { class: main ? "ph-thm" : "ph-lemma" }, lG);
        label.textContent = text;
        const w0 = tw[n.name];
        let lx = x, ly = y, anchor = "middle";
        if (side === "right") {
          const gap = main ? 14 : 12; ly = y + 4.5;
          if (x + gap + w0 > w - 3) { lx = x - gap; anchor = "end"; } else { lx = x + gap; anchor = "start"; }   // flip left when it would clip
        } else {
          ly = side === "above" ? y - 13 : y + 26;
          if (lx - w0 / 2 < 3) { lx = 3; anchor = "start"; } else if (lx + w0 / 2 > w - 3) { lx = w - 3; anchor = "end"; }
        }
        if (anchor === "end" && lx - w0 < 3) { label.remove(); label = null; }   // fits neither side (narrow screens): leave it unlabelled
        else { label.setAttribute("x", lx); label.setAttribute("y", ly); label.setAttribute("text-anchor", anchor); }
      }
      N[n.name] = { g, shape, label, kind: n.kind };
    });
  }

  // dot fill, dot stroke, label colour
  const STY = { sketch: [C.paper, C.hollow, C.soft], run: [C.paper, C.rust, C.rust],
    fail: [C.rust, C.rust, C.rust], esc: [C.ochre, C.ochre, C.ochreInk], ok: [C.green, C.green, C.deep],
    main: [C.paper, C.deep, C.deep], done: [C.deep, C.deep, C.deep] };
  function set(n, s) {
    const o = N[n]; if (!o) return; st[n] = s; o.g.style.opacity = 1;
    const [f, k, l] = STY[s];
    o.shape.setAttribute("fill", f); o.shape.setAttribute("stroke", k);
    o.shape.setAttribute("stroke-width", o.kind === "main" ? 1.8 : s === "run" ? 2 : 1.4);
    o.shape.setAttribute("stroke-dasharray", s === "main" ? "3 2.5" : "");
    if (o.label) { o.label.style.opacity = 1; o.label.setAttribute("fill", l); }
  }
  function apply([, ty, l]) {
    switch (ty) {
      case "formalized": set("solution", "main"); break;
      case "sketch": NODES.forEach(n => { if (n.kind === "lemma" && !n.added && !st[n.name]) set(n.name, "sketch"); }); break;
      case "job": if (N[l] && st[l] !== "ok") set(l, "run"); break;
      case "check_fail": if (N[l]) set(l, "fail"); break;
      case "handback": case "captain": if (N[l] && st[l] !== "ok") set(l, "esc"); break;
      case "proved": if (N[l] && st[l] !== "ok") set(l, "ok"); break;
      case "verified": set("solution", "done"); break;
    }
  }
  function syncEdges() {
    edges.forEach(x => {
      const vis = N[x.a].g.style.opacity === "1" && N[x.b].g.style.opacity === "1";
      x.e.style.opacity = vis ? 1 : 0;
      x.e.setAttribute("stroke", (st[x.a] === "ok" || st[x.a] === "done") && st[x.b] === "ok" ? C.green : C.edge);
    });
  }
  function reset() {
    NODES.forEach(n => {
      st[n.name] = undefined; const o = N[n.name];
      o.g.style.opacity = 0; if (o.label) o.label.style.opacity = 0;
    });
  }

  // pacing: front-load the setup so the tree is never empty for long
  const DT = { formalized: .25, audit: .5, sketch: .9, job: .14, budget: .04, grown: .03, check_fail: .5, check_ok: .12, proved: .4, handback: .8, captain: .4, verified: 1.6, review: 1.2 };
  const sched = []; let T = 0;
  RUN.events.forEach(e => { if (e[1] in DT) { sched.push({ t: T, e }); T += DT[e[1]]; } });
  const END = T + 4;

  let tl = 0, idx = 0, last = null, running = !reduce;
  function replayTo(i) { reset(); for (let k = 0; k < i; k++) apply(sched[k].e); syncEdges(); }
  function frame(now) {
    const dt = last === null ? 0 : Math.min(.1, (now - last) / 1000); last = now;
    if (running) {
      tl += dt;
      let moved = false;
      while (idx < sched.length && sched[idx].t <= tl) { apply(sched[idx++].e); moved = true; }
      if (tl > END) { tl = 0; idx = 0; reset(); moved = true; }
      if (moved) syncEdges();
    }
    requestAnimationFrame(frame);
  }

  // Height depends only on width: rebuilt on resize, then the current moment is replayed.
  function fit() {
    const w = Math.floor(host.clientWidth);
    if (!w || w === W) return;
    build(w); replayTo(idx);
  }
  build(Math.floor(host.clientWidth) || 460);
  const ht = /#t=([\d.]+)/.exec(location.hash);   // #t=<s> jumps to a moment, for testing
  if (reduce) idx = sched.length;                  // still frame: the finished, verified tree
  else if (ht) { tl = parseFloat(ht[1]) % END; while (idx < sched.length && sched[idx].t <= tl) idx++; }
  else { idx = 3; tl = sched[3].t; }               // start already sketched
  replayTo(idx);

  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { W = 0; fit(); });   // re-measure labels in the web font
  let fitRaf = 0;
  addEventListener("resize", () => { if (!fitRaf) fitRaf = requestAnimationFrame(() => { fitRaf = 0; fit(); }); });
  if ("IntersectionObserver" in window) new IntersectionObserver(es => { running = es[0].isIntersecting && !reduce; last = null; }).observe(root);
  requestAnimationFrame(frame);
})();
