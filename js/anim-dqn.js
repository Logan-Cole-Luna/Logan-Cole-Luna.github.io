/* Hierarchical dueling DQN for intrusion detection (data/dqn.js).
   One path: an example flow (illustrative) reaches the high-level XGBoost agent; benign flows
   branch off, malicious ones run left to right through the low-level dueling Q-network: a shared
   trunk (40 -> 128 -> 64) splits into value and advantage streams that rejoin as Q(s,a), which
   feeds the class table of real per-class flow counts and recall.
   The SVG is laid out at about one unit per CSS pixel for the container width, so text keeps its
   size from phone to desktop. Markup: .anim-dqn > .dqn-svg + .dqn-note. #t=<s> jumps to a moment. */
(function () {
  const root = document.querySelector(".anim-dqn");
  const D = window.DQN_DATA;
  if (!root || !D) return;
  const host = root.querySelector(".dqn-svg"), note = root.querySelector(".dqn-note");
  const NS = "http://www.w3.org/2000/svg";
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const C = { deep: "#173f35", green: "#1f6b57", rust: "#a8461f", ochre: "#c08a2b", sand2: "#e6dbc3",
    cream: "#fbf8f1", rule: "#d6c8a9", line: "#c9bb98", soft: "#67615a", ink: "#1c1a17", missInk: "#8a6418" };
  const MONO = "'IBM Plex Mono',ui-monospace,monospace", SANS = "'Source Sans 3','Segoe UI',sans-serif";
  const fmt = n => Math.round(n).toLocaleString("en-US");
  const clamp = x => x < 0 ? 0 : x > 1 ? 1 : x;
  const ease = x => { x = clamp(x); return x * x * (3 - 2 * x); };
  const ramp = (t, a, b) => ease((t - a) / (b - a));

  /* ---------- schedule (independent of layout) ---------- */
  const DUR_B = 2.0, DUR_M = 3.6, HOLD = 3.2;
  const sched = []; let T = 0;
  D.flows.forEach(f => { const d = f.pred < 0 ? DUR_B : DUR_M; sched.push({ t: T, d, f }); T += d; });
  const ROUTE_END = T, LOOP = T + HOLD;

  let G = null;                      // current drawing: elements and geometry

  function build(W) {
    const wide = W >= 470;
    const svg = document.createElementNS(NS, "svg");
    const el = (t, a, p) => { const e = document.createElementNS(NS, t); for (const k in a) e.setAttribute(k, a[k]); (p || svg).appendChild(e); return e; };
    const txt = (s, a, p) => { const e = el("text", a, p); e.textContent = s; return e; };
    const span = (parent, s, a) => { const e = el("tspan", a || {}, parent); e.textContent = s; return e; };
    const label = (s, x, y, extra) => txt(s, Object.assign({ x, y, "font-family": SANS, "font-size": 13, fill: C.ink }, extra || {}));
    const value = (s, x, y, extra) => txt(s, Object.assign({ x, y, "text-anchor": "end", "font-family": MONO, "font-size": 12, fill: C.ink }, extra || {}));
    const soft = (s, x, y, extra) => txt(s, Object.assign({ x, y, "font-family": SANS, "font-size": 11.5, "font-style": "italic", fill: C.soft }, extra || {}));
    const hair = (d, extra) => el("path", Object.assign({ d, fill: "none", stroke: C.line, "stroke-width": 1 }, extra || {}));
    const rule = (y, x1, x2) => hair(`M${x1},${y} H${x2}`, { stroke: C.rule, "stroke-width": .8 });

    const SX = 12, L = 26, R = W - 6;
    // wide: name | Q bar | Q line | flows | recall.  narrow: name | flows | recall | Q bar | Q line.
    // Either way the Q line (and the token on it) never crosses the number columns.
    let COL, TX;
    if (wide) { COL = { recall: R, flows: R - 64 }; TX = COL.flows - 58; COL.q = L + 84; COL.qw = TX - 14 - COL.q; }
    else { COL = { flows: L + 130 }; COL.recall = COL.flows + 58; TX = R - 4; COL.q = COL.recall + 9; COL.qw = TX - 9 - COL.q; }

    /* flow record */
    const head = txt("", { x: L, y: 13, "font-family": SANS, "font-size": 12, fill: C.soft });
    span(head, "Flow "); const hId = span(head, "", { "font-family": MONO, "font-size": 11.5, fill: C.ink });
    span(head, ", "); const hProto = span(head, "", { "font-family": MONO, "font-size": 11.5, fill: C.ink });
    span(head, ", Dst Port "); const hPort = span(head, "", { "font-family": MONO, "font-size": 11.5, fill: C.ink });
    soft("attribution", R, 13, { "text-anchor": "end", "font-size": 11 });
    rule(20, L, R);
    const colW = wide ? (R - L) / 2 + 6 : R - L;
    const fRows = D.features.map((f, i) => {
      const c = wide ? (i < 2 ? 0 : 1) : 0, r = wide ? i % 2 : i;
      const x0 = L + c * colW, y = 36 + r * 15;
      const vx = wide ? x0 + 150 : 208, bx = vx + 10, bw = (wide ? x0 + colW - 18 : R) - bx;
      label(f.name, x0, y, { "font-size": 12.5 });
      return { val: value("", vx, y), bar: el("rect", { x: bx, y: y - 6, width: 0, height: 4, fill: C.ochre }), bw, f };
    });
    const recBottom = wide ? 51 : 81;

    /* stage 1 and the Benign exit */
    const Y1 = recBottom + 22, YB = Y1 + (wide ? 23 : 37), Y2 = YB + 24;
    const s1 = label("", L, Y1 + 4);
    span(s1, "High-level agent"); span(s1, "XGBoost", { dx: 6, fill: C.soft, "font-size": 12 });
    const verdict = txt("", { x: L + 160, y: Y1 + 4, "font-family": SANS, "font-size": 12.5, "font-style": "italic" });
    const YH = wide ? Y1 + 4 : YB - 16;
    soft("flows", COL.flows, YH, { "text-anchor": "end", "font-size": 11 });
    soft("recall", COL.recall, YH, { "text-anchor": "end", "font-size": 11 });
    const s2 = label("", L, Y2 + 4);
    span(s2, "Low-level agent"); span(s2, "dueling Q-network", { dx: 6, fill: C.soft, "font-size": 12 });

    /* dueling network, left to right */
    const NH = wide ? 172 : 132;                      // network band height
    const YC = Y2 + 18 + NH / 2;                       // centre line of the trunk
    const span0 = TX - L - 8;
    const g = span0 * (wide ? .17 : .2);
    // node-link drawing of the shared layers (40 -> 128 -> 64), a few nodes standing for each layer
    const NR = wide ? 4.6 : 3.7, NS_ = wide ? NH * .82 / 10 : NH * .82 / 8;
    const TR = [[40, wide ? 6 : 5], [128, wide ? 11 : 9], [64, wide ? 8 : 6]].map(([n, k], i) => {
      const x = L + 18 + i * g;
      return { n, x, ys: Array.from({ length: k }, (_, j) => YC + (j - (k - 1) / 2) * NS_) };
    });
    const XE = TR[2].x;
    const YV = YC - NH * .36, YA = YC + NH * .33;
    const XS = XE + span0 * (wide ? .13 : .11);        // where the heads' streams start
    const XBAR = XS + (wide ? 92 : 30);                // first bar on each stream
    const AW = wide ? 9 : 6, AG = wide ? 13 : 8;
    const XM = XBAR + 4 * AG + AW + (wide ? 14 : 6);   // where the streams turn to rejoin

    const P = {};
    P.in = hair(`M${SX},12 V${Y1}`);
    P.benign = hair(`M${SX},${Y1} V${YB - 9} Q${SX},${YB - 4} ${SX + 7},${YB - 4}`);
    P.down = hair(`M${SX},${Y1} V${YC - 8} Q${SX},${YC} ${SX + 8},${YC} H${TR[0].x - NR}`);
    P.trunk = hair(`M${TR[0].x},${YC} H${XE}`, { stroke: "none" });
    P.v = hair(`M${XE},${YC} L${XS},${YV} H${XM}`, { stroke: "none" });   // token paths; drawn lines below
    P.a = hair(`M${XE},${YC} L${XS},${YA} H${XM}`, { stroke: "none" });
    hair(`M${XS},${YV} H${XM}`); hair(`M${XS},${YA} H${XM}`);
    const k = (TX - 5 - XM);
    P.v2 = hair(`M${XM},${YV} C${XM + k * .6},${YV} ${TX - 5 - k * .3},${YC} ${TX - 5},${YC}`);
    P.a2 = hair(`M${XM},${YA} C${XM + k * .6},${YA} ${TX - 5 - k * .3},${YC} ${TX - 5},${YC}`);

    el("circle", { cx: SX, cy: 12, r: 2.5, fill: C.line });
    const node1 = el("circle", { cx: SX, cy: Y1, r: 4, fill: C.cream, stroke: C.deep, "stroke-width": 1.2 });
    const node2 = el("circle", { cx: SX, cy: Y2, r: 4, fill: C.cream, stroke: C.deep, "stroke-width": 1.2 });

    // shared layers: fully connected hairline edges, then the nodes on top
    const edgeG = [0, 1, 2].map(() => el("g", { stroke: C.line, "stroke-width": .6, opacity: .8 }));
    for (let i = 0; i < 2; i++) for (const y1 of TR[i].ys) for (const y2 of TR[i + 1].ys)
      el("line", { x1: TR[i].x, y1, x2: TR[i + 1].x, y2 }, edgeG[i]);
    for (const y1 of TR[2].ys) for (const y2 of [YV, YA]) el("line", { x1: XE, y1, x2: XS, y2 }, edgeG[2]);
    // activation overlay: each edge draws in from its source node; per-edge weight is a fixed
    // pseudo-random value (stable from flow to flow), so the wave reads as uneven weights
    const hash = (a, b, c) => { const v = Math.sin(a * 12.9898 + b * 78.233 + c * 37.719) * 43758.5453; return v - Math.floor(v); };
    const litG = el("g", { stroke: C.green, "stroke-width": wide ? 1 : .9, "stroke-linecap": "round", fill: "none" });
    const lit = [];
    const addLit = (pair, j, k, x1, y1, x2, y2) => {
      const len = Math.hypot(x2 - x1, y2 - y1), w = hash(pair + 1, j + 1, k + 1);
      const e = el("line", { x1, y1, x2, y2, "stroke-dasharray": `${len} ${len}`, "stroke-dashoffset": len, opacity: 0 }, litG);
      lit.push({ e, len, pair, w: .15 + .85 * w * w, j: hash(k + 3, j + 5, pair + 7) });
    };
    for (let i = 0; i < 2; i++) TR[i].ys.forEach((y1, j) => TR[i + 1].ys.forEach((y2, k) => addLit(i, j, k, TR[i].x, y1, TR[i + 1].x, y2)));
    TR[2].ys.forEach((y1, j) => [YV, YA].forEach((y2, k) => addLit(2, j, k, XE, y1, XS, y2)));
    const yBot = YC + (TR[1].ys.length - 1) / 2 * NS_;
    TR.forEach(c => {
      c.nodes = c.ys.map(y => el("circle", { cx: c.x, cy: y, r: NR, fill: C.sand2, stroke: C.line, "stroke-width": .9 }));
      txt(String(c.n), { x: c.x, y: yBot + NR + 15, "text-anchor": "middle", "font-family": MONO, "font-size": 10.5, fill: C.soft });
    });
    if (wide) soft("shared layers", TR[1].x, YC - (TR[1].ys.length - 1) / 2 * NS_ - NR - 8, { "text-anchor": "middle", "font-size": 11 });

    // value stream (top) and advantage stream (bottom)
    const vBar = el("rect", { x: XBAR, y: YV, width: AW, height: 0, fill: C.deep });
    const aBars = D.classes.map((_, i) => el("rect", { x: XBAR + i * AG, y: YA, width: AW, height: 0, fill: C.green }));
    const vl = txt("", { x: XS + 2, y: YV - 7, "font-family": SANS, "font-size": 12.5, "font-style": "italic", fill: C.ink });
    span(vl, "V(s)"); if (wide) span(vl, "value", { dx: 5, fill: C.soft, "font-size": 11.5 });
    const al = txt("", { x: XS + 2, y: YA + 17 });
    al.setAttribute("font-family", SANS); al.setAttribute("font-size", 12.5); al.setAttribute("font-style", "italic"); al.setAttribute("fill", C.ink);
    span(al, "A(s,a)"); if (wide) span(al, "advantage", { dx: 5, fill: C.soft, "font-size": 11.5 });
    if (wide) soft("one per class", XBAR + 2 * AG + AW / 2, YA + 30, { "text-anchor": "middle", "font-size": 11 });

    // rejoin at Q
    const qNode = el("circle", { cx: TX, cy: YC, r: 5.5, fill: C.cream, stroke: C.deep, "stroke-width": 1.2 });
    el("path", { d: `M${TX - 2.8},${YC} H${TX + 2.8} M${TX},${YC - 2.8} V${YC + 2.8}`, stroke: C.deep, "stroke-width": 1.1 });
    txt("Q(s,a)", Object.assign(wide ? { x: TX + 10, y: YC + 4.5 } : { x: TX - 11, y: YC + 4.5, "text-anchor": "end" },
      { "font-family": SANS, "font-size": 12.5, "font-style": "italic", fill: C.ink }));

    // formula and class table
    const YF = YC + (NH * .41) + (wide ? 4.6 : 3.7) + 37;   // below the layer-size labels
    const eq = txt("", { x: L, y: YF, "font-family": SANS, "font-size": 12.5, "font-style": "italic", fill: C.soft });
    span(eq, "Q(s,a)", { fill: C.ink }); span(eq, " = V(s) + A(s,a) − mean A");
    const TY = YF + 18, RH = 19;
    rule(TY - 6, L, R);
    const rowsData = [D.benign].concat(D.classes);
    const rowY = i => i === 0 ? YB : TY + 8 + (i - 1) * RH;
    P.q = hair(`M${TX},${YC + 5.5} V${rowY(5) - 4}`);
    const rows = rowsData.map((r, i) => {
      const y = rowY(i);
      const name = label(r.name, L, y);
      let q = null, nt = null;
      if (i === 0) { if (wide) soft("exits at stage 1", COL.q, y); }
      else {
        q = el("rect", { x: COL.q, y: y - 6, width: 0, height: 4, fill: C.line });
        nt = soft("", COL.q, y, { fill: C.rust, opacity: 0 });
      }
      const n = value("0", COL.flows, y, { fill: C.deep });
      value((Math.floor(r.recall * 10000) / 100).toFixed(2) + "%", COL.recall, y, { fill: r.recall < .5 ? C.rust : C.soft });
      return { name, q, nt, n, r, y };
    });
    rule(rowY(5) + 7, L, R);
    const H = rowY(5) + 12;

    const tokA = el("circle", { r: 3.4, fill: C.deep, opacity: 0 });
    const tokB = el("circle", { r: 3.4, fill: C.deep, opacity: 0 });

    svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
    svg.setAttribute("role", "img");
    svg.setAttribute("aria-label", "A network flow passes a high-level XGBoost agent. Benign flows leave there; malicious flows run through a dueling Q-network whose shared layers split into value and advantage streams that rejoin to score five attack classes.");
    host.replaceChildren(svg);
    const len = {}; for (const key in P) len[key] = P[key].getTotalLength();
    return { W, wide, P, len, head: { hId, hProto, hPort, el: head }, fRows, node1, node2, verdict, TR, lit, vBar, aBars, YV, YA,
      qNode, rows, rowY, tokA, tokB, COL, NH };
  }

  /* ---------- render at loop time t (stateless) ---------- */
  function render(t, finalCounts) {
    if (!G) return;
    t = ((t % LOOP) + LOOP) % LOOP;
    const p = finalCounts ? 1 : ease(t / ROUTE_END);
    G.rows.forEach(r => (r.n.textContent = fmt(r.r.support * p)));

    let s = null;
    for (const x of sched) if (t >= x.t && t < x.t + x.d) s = x;
    const hold = !s;
    if (hold) s = sched[sched.length - 1];
    const f = s.f, lt = hold ? 0 : t - s.t, mal = f.pred >= 0, miss = mal && f.label !== f.pred;
    const out = hold ? 0 : 1 - ramp(lt, s.d - .25, s.d);

    // record
    G.head.hId.textContent = f.id; G.head.hProto.textContent = f.proto; G.head.hPort.textContent = f.port;
    const recOp = hold ? .35 : .35 + .65 * ramp(lt, 0, .3);
    G.head.el.setAttribute("opacity", recOp);
    G.fRows.forEach((r, i) => {
      r.val.textContent = f.v[i].toLocaleString("en-US"); r.val.setAttribute("opacity", recOp);
      const max = r.f.stage === 1 ? D.features[0].shap : D.features[2].shap;
      const g = hold ? 0 : r.f.stage === 1 ? ramp(lt, .6, .95) : (mal ? ramp(lt, 1.75, 2.1) : 0);
      r.bar.setAttribute("width", Math.max(0, r.bw * (r.f.shap / max) * f.k[i] * g * out));
    });

    // stage 1
    G.node1.setAttribute("fill", !hold && lt >= .62 ? C.deep : C.cream);
    const showV = !hold && lt >= .95;
    G.verdict.textContent = showV ? (mal ? "malicious" : "benign") : "";
    G.verdict.setAttribute("fill", mal ? C.rust : C.green);
    G.verdict.setAttribute("opacity", out);

    // stage 2: trunk lights as the token passes each layer
    G.node2.setAttribute("fill", !hold && mal && lt >= 1.2 ? C.deep : C.cream);
    const trunkU = ramp(lt, 1.45, 1.8);
    const lit = i => mal && !hold && out > .5 && lt >= 1.45 && trunkU >= i / 2.2;
    G.TR.forEach((c, i) => c.nodes.forEach(n => { const on = lit(i); n.setAttribute("fill", on ? C.deep : C.sand2); n.setAttribute("stroke", on ? C.deep : C.line); }));
    // edges: wave 40->128, 128->64, then 64->heads as the token splits; each fades soon after
    const WAVE = [[1.45, 1.63], [1.62, 1.8], [1.8, 2.02]];
    for (const L of G.lit) {
      let u = 0, op = 0;
      if (mal && !hold) {
        const [a0, a1] = WAVE[L.pair], st = a0 + L.j * .06;
        u = ramp(lt, st, a1 + L.j * .06);
        op = L.w * u * (1 - ramp(lt, a1 + .25, a1 + .75));
      }
      if (op < .01) { if (L.on) { L.e.setAttribute("opacity", 0); L.on = false; } continue; }
      L.on = true;
      L.e.setAttribute("stroke-dashoffset", L.len * (1 - u));
      L.e.setAttribute("opacity", op.toFixed(3));
    }
    const heads = mal && !hold ? ramp(lt, 1.95, 2.3) * out : 0;
    const vh = (mal ? f.V : 0) * (G.NH * .09) * heads;
    G.vBar.setAttribute("height", vh); G.vBar.setAttribute("y", G.YV - vh);
    G.aBars.forEach((b, i) => {
      const a = mal ? f.A[i] * (G.NH * .07) * heads : 0;
      b.setAttribute("y", a >= 0 ? G.YA - a : G.YA); b.setAttribute("height", Math.abs(a));
      b.setAttribute("fill", mal && i === f.pred ? C.rust : C.green);
    });
    G.qNode.setAttribute("fill", mal && !hold && lt >= 2.6 && out > .5 ? C.sand2 : C.cream);

    // tokens (one flow; it splits along the two streams and rejoins)
    const at = (key, u) => G.P[key].getPointAtLength(clamp(u) * G.len[key]);
    const col = !showV ? C.deep : mal ? C.rust : C.green;
    let a = null, b = null, op = 0;
    if (!hold) {
      if (lt >= .3 && lt < .95) { a = at("in", ramp(lt, .3, .7)); op = 1; }
      else if (!mal && lt >= .95) { a = at("benign", ramp(lt, .95, 1.35)); op = 1 - ramp(lt, 1.6, 1.8); }
      else if (mal && lt < 1.45) { a = at("down", ramp(lt, .95, 1.45)); op = 1; }
      else if (mal && lt < 1.8) { a = at("trunk", trunkU); op = 1; }
      else if (mal && lt < 2.3) { a = at("v", ramp(lt, 1.8, 2.3)); b = at("a", ramp(lt, 1.8, 2.3)); op = 1; }
      else if (mal && lt < 2.6) { a = at("v2", ramp(lt, 2.3, 2.6)); b = at("a2", ramp(lt, 2.3, 2.6)); op = 1; }
      else if (mal) {
        a = at("q", ramp(lt, 2.6, 2.95) * (G.len.q - (G.rowY(5) - G.rowY(f.pred + 1))) / G.len.q); op = 1 - ramp(lt, 3.25, 3.45);
      }
    }
    for (const [tok, pt] of [[G.tokA, a], [G.tokB, b]]) {
      if (pt) { tok.setAttribute("cx", pt.x); tok.setAttribute("cy", pt.y); tok.setAttribute("fill", col); tok.setAttribute("opacity", op); }
      else tok.setAttribute("opacity", 0);
    }

    // Q bars and the chosen row
    const qG = mal && !hold ? ramp(lt, 2.6, 2.9) * out : 0;
    const Q = mal ? f.A.map(x => f.V + x - f.A.reduce((m, y) => m + y, 0) / f.A.length) : null;
    const qMin = Q ? Math.min(...Q) : 0, qMax = Q ? Math.max(...Q) : 1;
    G.rows.forEach((r, i) => {
      const chosen = !hold && out > .5 && (mal ? i - 1 === f.pred && lt >= 2.95 : i === 0 && lt >= 1.35);
      r.name.setAttribute("fill", chosen ? (i === 0 ? C.green : miss ? C.missInk : C.rust) : C.ink);
      if (!r.q) return;
      const isTrue = miss && i - 1 === f.label;
      const w = Q && !isTrue ? 5 + (G.COL.qw - 5) * (Q[i - 1] - qMin) / (qMax - qMin || 1) : 0;
      r.q.setAttribute("width", Math.max(0, w * qG));
      r.q.setAttribute("fill", chosen ? (miss ? C.ochre : C.rust) : C.line);
      r.nt.textContent = isTrue && G.wide ? `read as ${D.classes[f.pred].name}` : "";
      r.nt.setAttribute("opacity", isTrue ? ramp(lt, 2.95, 3.1) * out : 0);
    });

    // one quiet line of text
    let line;
    if (hold) line = `Totals over all ${fmt(D.total)} flows.`;
    else if (lt < .62) line = "A flow arrives.";
    else if (lt < .95) line = "The high-level agent screens it.";
    else if (!mal) line = "Benign, so it leaves at stage 1.";
    else if (lt < 1.8) line = "Malicious, so it enters the Q-network.";
    else if (lt < 2.95) line = "Value and advantage streams rejoin as Q.";
    else if (miss) line = `A ${D.classes[f.label].name} flow read as ${D.classes[f.pred].name}, as most were.`;
    else line = `Highest Q: ${D.classes[f.pred].name}.`;
    if (note && note.textContent !== line) note.textContent = line;
  }

  /* ---------- layout and loop ---------- */
  const m = /#t=([\d.]+)/.exec(location.hash);
  let tl = m ? parseFloat(m[1]) : 0, last = null, running = !reduce;
  const sb = sched.find(x => x.f.pred === 0) || sched[1];
  const draw = () => reduce ? render(sb.t + 3.1, true) : render(tl);   // reduced motion: Botnet just chosen, final tallies
  // every sentence the note line can show, so its height can be reserved for the longest one
  const NOTE_LINES = [`Totals over all ${fmt(D.total)} flows.`, "A flow arrives.", "The high-level agent screens it.",
    "Benign, so it leaves at stage 1.", "Malicious, so it enters the Q-network.", "Value and advantage streams rejoin as Q."]
    .concat(D.flows.filter(f => f.pred >= 0 && f.label !== f.pred).map(f => `A ${D.classes[f.label].name} flow read as ${D.classes[f.pred].name}, as most were.`))
    .concat(D.classes.map(c => `Highest Q: ${c.name}.`));
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
