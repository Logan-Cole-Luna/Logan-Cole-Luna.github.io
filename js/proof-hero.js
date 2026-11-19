/* Hero: compact replay of a real AIProver run (data/run011.js + js/aimath-layout.js).
   Markup: .proof-hero containing .ph-graph, .ph-status, .ph-clock, .ph-msg, [data-stat] counters. */
(function () {
  const root = document.querySelector(".proof-hero");
  if (!root || !window.RUN || !window.layoutDag) return;
  const RUN = window.RUN, NS = "http://www.w3.org/2000/svg";
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const C = { deep: "#173f35", green: "#1f6b57", rust: "#a8461f", ochre: "#c08a2b", sketch: "#b9ab8c", def: "#e6dbc3", defLine: "#cfc2a7", edge: "#c9bb98", cream: "#fbf8f1" };

  const lay = layoutDag(RUN, { colW: 120, rowH: 64, pad: 46 });
  const svg = document.createElementNS(NS, "svg");
  svg.setAttribute("viewBox", `0 0 ${lay.width} ${lay.height}`);
  svg.setAttribute("aria-hidden", "true");
  const el = (t, a, p) => { const e = document.createElementNS(NS, t); for (const k in a) e.setAttribute(k, a[k]); (p || svg).appendChild(e); return e; };
  const byName = {}; RUN.nodes.forEach(n => (byName[n.name] = n));

  const eG = el("g", {}), nG = el("g", {}), cG = el("g", { class: "ph-callout" });
  const edges = RUN.edges.map(([a, b]) => {
    const p = lay.xy[a], q = lay.xy[b], y1 = q.y + 13, y2 = p.y - 13, my = (y1 + y2) / 2, def = byName[b].kind === "def";
    return { a, b, e: el("path", { d: `M${q.x},${y1} C${q.x},${my} ${p.x},${my} ${p.x},${y2}`, fill: "none", stroke: C.edge,
      "stroke-width": def ? .9 : 1.4, "stroke-dasharray": def ? "2 3" : "", opacity: def ? .5 : 1 }, eG) };
  });
  const N = {};
  RUN.nodes.forEach(n => {
    const { x, y } = lay.xy[n.name], main = n.kind === "main";
    const g = el("g", { transform: `translate(${x},${y})` }, nG);
    const ring = el("rect", { x: -50, y: -18, width: 100, height: 36, rx: 9, fill: "none", stroke: C.rust, "stroke-width": 2, opacity: 0 }, g);
    const shape = el("rect", { x: main ? -56 : -44, y: main ? -17 : -12, width: main ? 112 : 88, height: main ? 34 : 24, rx: 6 }, g);
    let t = null;
    if (main) { t = el("text", { "text-anchor": "middle", y: 5, style: "font-family:'DM Serif Display',serif;font-size:14px" }, g); t.textContent = "Theorem"; }
    N[n.name] = { g, shape, ring, t };
  });
  // callout label above the node of the latest event
  const cRect = el("rect", { rx: 4, height: 26, fill: "#fbf8f1", stroke: C.deep, "stroke-width": 1 }, cG);
  const cText = el("text", { y: 0, "text-anchor": "middle", style: "font-family:'IBM Plex Mono',monospace;font-size:14px;font-weight:500" }, cG);
  cG.setAttribute("opacity", 0);
  root.querySelector(".ph-graph").appendChild(svg);

  const $ = s => root.querySelector(s);
  const clock = $(".ph-clock"), msg = $(".ph-msg"), status = $(".ph-status");
  const stats = {}; root.querySelectorAll("[data-stat]").forEach(e => (stats[e.dataset.stat] = e));
  const S = { proved: 0, fail: 0, esc: 0 };
  const fmt = h => `${Math.floor(h)}:${String(Math.floor((h % 1) * 60)).padStart(2, "0")} h`;

  const st = {};
  const STY = { def: [C.def, C.defLine, ""], sketch: [C.cream, C.sketch, "4 3"], run: [C.cream, C.rust, ""], fail: ["#f3dccd", C.rust, ""],
    esc: ["#f6e7c8", C.ochre, ""], ok: [C.green, C.green, ""], main: [C.cream, C.deep, "4 3"], done: [C.deep, C.deep, ""] };
  function set(n, s) {
    const o = N[n]; if (!o) return; st[n] = s; o.g.style.opacity = 1;
    const [f, k, d] = STY[s];
    o.shape.setAttribute("fill", f); o.shape.setAttribute("stroke", k); o.shape.setAttribute("stroke-width", 1.6); o.shape.setAttribute("stroke-dasharray", d);
    if (o.t) o.t.setAttribute("fill", s === "done" ? "#f6f0e3" : C.deep);
    o.ring.setAttribute("opacity", s === "run" ? .45 : 0);
  }
  function callout(name, color) {
    const p = lay.xy[name]; if (!p) return;
    cText.textContent = name; cText.setAttribute("fill", color);
    const w = Math.min(name.length * 8.5 + 18, lay.width - 12);
    let x = Math.max(w / 2 + 6, Math.min(lay.width - w / 2 - 6, p.x));
    const y = p.y - 33;
    cRect.setAttribute("x", x - w / 2); cRect.setAttribute("y", y - 18); cRect.setAttribute("width", w); cRect.setAttribute("stroke", color);
    cText.setAttribute("x", x); cText.setAttribute("y", y);
    cG.setAttribute("opacity", 1);
    nG.appendChild(cG);   // keep on top
  }
  const code = n => `<code>${n}</code>`;
  function stat() { for (const k in stats) stats[k].textContent = S[k]; }

  function apply([h, ty, l]) {
    clock.textContent = fmt(h);
    switch (ty) {
      case "formalized": RUN.nodes.forEach(n => { if (n.kind === "def") set(n.name, "def"); }); set("solution", "main"); status.textContent = "Formalizing"; msg.innerHTML = "Theorem statement formalized in Lean"; break;
      case "audit": msg.innerHTML = "Back-translation judged faithful to the source"; break;
      case "sketch": RUN.nodes.forEach(n => { if (n.kind === "lemma" && !n.added && !st[n.name]) set(n.name, "sketch"); }); status.textContent = "Proving lemmas"; msg.innerHTML = "Proof sketched into 20 lemmas, each stated with <code>sorry</code>"; break;
      case "job": if (N[l] && st[l] !== "ok") { set(l, "run"); callout(l, C.rust); msg.innerHTML = `AIProver attempts ${code(l)}`; } break;
      case "check_fail": if (N[l]) { S.fail++; set(l, "fail"); callout(l, C.rust); msg.innerHTML = `Lean rejects ${code(l)}`; } break;
      case "handback": case "captain":
        if (N[l] && st[l] !== "ok") { if (ty === "handback") S.esc++; set(l, "esc"); callout(l, "#8a6418"); msg.innerHTML = `${code(l)} escalated to the orchestrator`; } break;
      case "proved": if (N[l] && st[l] !== "ok") { S.proved++; set(l, "ok"); callout(l, C.green); msg.innerHTML = `${code(l)} proved in Lean`; } break;
      case "verified": set("solution", "done"); cG.setAttribute("opacity", 0); status.textContent = "Verified"; status.classList.add("done"); msg.innerHTML = "Full proof checks: no <code>sorry</code>, standard axioms only"; break;
      case "review": status.textContent = "Proved, verified, reviewed"; msg.innerHTML = "Independent review: faithful to the source"; break;
    }
    stat();
  }
  function syncEdges() {
    edges.forEach(x => {
      const vis = N[x.a].g.style.opacity === "1" && N[x.b].g.style.opacity === "1";
      x.e.style.opacity = vis ? "" : 0;
      x.e.setAttribute("stroke", st[x.a] === "ok" && st[x.b] === "ok" ? C.green : C.edge);
    });
  }
  function reset() {
    RUN.nodes.forEach(n => { st[n.name] = undefined; N[n.name].g.style.opacity = 0; N[n.name].ring.setAttribute("opacity", 0); });
    for (const k in S) S[k] = 0; stat(); cG.setAttribute("opacity", 0); status.classList.remove("done");
  }

  // pacing: front-load the setup so the tree is never empty for long
  const DT = { formalized: .25, audit: .5, sketch: .9, job: .14, budget: .04, grown: .03, check_fail: .5, check_ok: .12, proved: .4, handback: .8, captain: .4, verified: 1.6, review: 1.2 };
  const sched = []; let T = 0;
  RUN.events.forEach(e => { if (e[1] in DT) { sched.push({ t: T, e }); T += DT[e[1]]; } });
  const END = T + 4;

  let tl = 0, idx = 0, last = null, running = true;
  function frame(now) {
    const dt = last === null ? 0 : Math.min(.1, (now - last) / 1000); last = now;
    if (running) {
      tl += dt;
      while (idx < sched.length && sched[idx].t <= tl) apply(sched[idx++].e);
      if (tl > END) { reset(); tl = 0; idx = 0; }
      syncEdges();
    }
    requestAnimationFrame(frame);
  }
  reset();
  if (reduce) { sched.forEach(s => apply(s.e)); syncEdges(); running = false; }
  else { apply(sched[0].e); apply(sched[1].e); apply(sched[2].e); idx = 3; tl = sched[3].t; syncEdges(); }   // start already sketched
  if ("IntersectionObserver" in window) new IntersectionObserver(es => { running = es[0].isIntersecting && !reduce; last = null; }).observe(root);
  requestAnimationFrame(frame);
})();
