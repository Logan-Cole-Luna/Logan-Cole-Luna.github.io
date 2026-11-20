/* Hierarchical dueling DQN for intrusion detection (data/dqn.js).
   A left-to-right story, one flow at a time:
   1. The flow as packets: forward packets on the top lane, backward below, flagged packets marked
      S, P or R. Three real CIC-IDS2018 features are read straight off them: Init Fwd Win Byts from
      the first forward packet (with a hairline), and PSH and RST Flag Cnt, which step up as the
      flagged packets arrive. The packets and their spacing are ILLUSTRATIVE (see data/dqn.js).
   2. The high-level XGBoost agent. Benign flows leave to "Benign" with its real recall.
   3. The low-level dueling Q-network (utils/q_network.py, 40 -> 128 -> 64) as a node-link network
      whose edges carry the activation; its last layer feeds the dueling head.
   4. The dueling decomposition as rows, one per class: a vertical line at V(s), and in each row a
      horizontal arrow from it, right or left by A(s,a) - mean A, so each tip sits at Q(s,a). Class
      names sit in one fixed column; the highest Q wins and its real test recall follows its name.
      The V and A values are ILLUSTRATIVE.
      The illustrative Web attack flow is read as DDoS attack, as 112 of the 173 real ones were.
   Desktop runs left to right; below 470px the same story is stacked top to bottom.
   The SVG is laid out at about one unit per CSS pixel for the container width, and its height
   depends on the width only. Markup: .anim-dqn > .dqn-svg. #t=<s> jumps to a moment. */
(function () {
  const root = document.querySelector(".anim-dqn");
  const D = window.DQN_DATA;
  if (!root || !D) return;
  const host = root.querySelector(".dqn-svg");
  const NS = "http://www.w3.org/2000/svg";
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const C = { deep: "#173f35", green: "#1f6b57", rust: "#a8461f", ochre: "#c08a2b", sand2: "#e6dbc3",
    cream: "#fbf8f1", rule: "#d6c8a9", line: "#c9bb98", soft: "#67615a", ink: "#1c1a17", missInk: "#8a6418" };
  const MONO = "'IBM Plex Mono',ui-monospace,monospace", SANS = "'Source Sans 3','Segoe UI',sans-serif";
  const clamp = x => x < 0 ? 0 : x > 1 ? 1 : x;
  const ease = x => { x = clamp(x); return x * x * (3 - 2 * x); };
  const ramp = (t, a, b) => ease((t - a) / (b - a));
  const pct = r => (Math.floor(r * 10000) / 100).toFixed(2) + "%";
  const num = n => n.toLocaleString("en-US");
  const Qof = f => { const m = f.A.reduce((s, a) => s + a, 0) / f.A.length; return f.A.map(a => f.V + a - m); };
  const argmax = a => a.reduce((b, x, i) => x > a[b] ? i : b, 0);

  /* ---------- schedule (independent of layout) ---------- */
  const DUR_B = 3.2, DUR_M = 4.6, GAP = .6;
  const sched = []; let T = 0;
  D.flows.forEach((f, i) => { const d = f.pred < 0 ? DUR_B : DUR_M; sched.push({ t: T, d, f, i }); T += d; });
  const LOOP = T + GAP;
  const PK0 = .1, PKDT = .08;                       // packet i arrives at PK0 + i * PKDT (illustrative)
  const T_GATE = 1.5;
  const WAVE = [[1.85, 2.0], [2.0, 2.15], [2.15, 2.32]];   // 40->128, 128->64, 64->dueling head
  const T_V = [2.32, 2.7], T_ARR = 2.7, T_WIN = 3.3;
  const MAXPK = Math.max(...D.flows.map(f => f.pk.length));
  // the most recent malicious flow before each flow, shown faintly in the plot until a new one arrives
  const prevMal = sched.map((s, i) => { for (let k = 1; k <= sched.length; k++) { const p = sched[(i - k + sched.length) % sched.length]; if (p.f.pred >= 0) return p; } return null; });

  let G = null;

  function build(W) {
    const wide = W >= 470;
    const svg = document.createElementNS(NS, "svg");
    host.replaceChildren(svg);                      // in the DOM first, so text can be measured
    const el = (t, a, p) => { const e = document.createElementNS(NS, t); for (const k in a) e.setAttribute(k, a[k]); (p || svg).appendChild(e); return e; };
    const txt = (s, a, p) => { const e = el("text", a, p); e.textContent = s; return e; };
    const span = (parent, s, a) => { const e = el("tspan", a || {}, parent); e.textContent = s; return e; };
    const hair = (d, extra) => el("path", Object.assign({ d, fill: "none", stroke: C.line, "stroke-width": 1 }, extra || {}));
    const FS = 13;
    const sans = (s, x, y, extra, p) => txt(s, Object.assign({ x, y, "font-family": SANS, "font-size": FS, fill: C.ink }, extra || {}), p);
    const mono = (s, x, y, extra, p) => txt(s, Object.assign({ x, y, "font-family": MONO, "font-size": 13, fill: C.ink }, extra || {}), p);
    const width = e => { try { return e.getComputedTextLength(); } catch (_) { return 0; } };
    const measure = (s, bold, isMono) => {
      const e = (isMono ? mono : sans)(s, 0, -40, bold ? { "font-weight": 600 } : {});
      const w = width(e) || s.length * (isMono ? 7.8 : 6.6); e.remove(); return w;
    };

    /* ================= geometry ================= */
    const SX = 5;
    const FEAT = [["Init Fwd Win Byts", 0], ["PSH Flag Cnt", 3], ["RST Flag Cnt", 2]];
    const featW = Math.max(...FEAT.map(([n]) => measure(n + " ") + measure("65,535", false, true)));
    const col1 = wide ? Math.max(150, Math.ceil(featW) + 4) : W;
    const LX = 34;                                  // lanes start (after "Fwd"/"Bwd")
    const step = wide ? (W - LX - 10) / (MAXPK - 1) : Math.min(16, (col1 - LX - 4) / (MAXPK - 1));   // desktop: the packet lanes run the full width
    const YL1 = 24, YL2 = 50;                       // forward and backward lanes
    const YR = [96, 115, 134];                      // feature readouts
    const YG = wide ? 178 : 168;                    // XGBoost gate

    // dueling plot as rows: one fixed row per class; a vertical V(s) line; a horizontal arrow per row
    // from V to Q; the class names in one left-aligned column at XLAB, recall right after the name
    const nameW = D.classes.map(c => measure(c.name, true));
    const recW = measure("100.00%", false, true);
    const labCol = Math.max(...nameW) + 8 + recW;
    const XLAB = W - labCol;
    // x encodes A(s,a) - mean A measured from the V(s) line, which stays put; so within a flow each
    // tip is that class's Q = V + A - mean A, and the longest rightward arrow has the highest Q
    const DLO = -1.35, DHI = 2.05;                  // covers every flow's A - mean A
    const K = [6, 11, 8];
    let layers, NR, YNB, rowY, AX0, feedFrom;
    if (wide) {
      const NX0 = col1 - 14, NX1 = W - labCol - 12 - 64 - 36;   // network spans up to the arrows
      const NH = 236, YC = YG;
      NR = 4.2;
      const sp = NH * .84 / 10;
      layers = K.map((k, i) => ({ k, pts: Array.from({ length: k }, (_, j) => [NX0 + i * (NX1 - NX0) / 2, YC + (j - (k - 1) / 2) * sp]) }));
      YNB = YC + 5 * sp + NR + 20;                  // layer-size row
      AX0 = NX1 + 36;
      rowY = [0, 1, 2, 3, 4].map(i => YC + 12 + (i - 2) * 34);
    } else {
      NR = 3.9;
      const NX0 = 44, NX1 = W - 10, rows = [YG + 52, YG + 98, YG + 144];
      const sp = (NX1 - NX0) / 10, XC = (NX0 + NX1) / 2;
      layers = K.map((k, i) => ({ k, pts: Array.from({ length: k }, (_, j) => [XC + (j - (k - 1) / 2) * sp, rows[i]]) }));
      YNB = 0;
      AX0 = 8;
      rowY = [0, 1, 2, 3, 4].map(i => rows[2] + 88 + i * 34);
    }
    const AX1 = XLAB - 12;                          // arrow area (a short fixed span on desktop)
    const dx = d => AX0 + (d - DLO) / (DHI - DLO) * (AX1 - AX0);
    const XV = dx(0);                               // the V(s) line
    const VTOP = rowY[0] - 20, VBOT = rowY[4] + 16;   // the V(s) line

    /* ================= 1. packets ================= */
    sans("Fwd", 0, YL1 + 4.5, { fill: C.soft });
    sans("Bwd", 0, YL2 + 4.5, { fill: C.soft });
    hair(`M${LX - 4},${YL1} H${LX + (MAXPK - 1) * step + 4}`, { stroke: C.rule, "stroke-width": .8 });
    hair(`M${LX - 4},${YL2} H${LX + (MAXPK - 1) * step + 4}`, { stroke: C.rule, "stroke-width": .8 });
    const ticks = Array.from({ length: MAXPK }, () => ({
      line: el("line", { x1: 0, x2: 0, y1: 0, y2: 0, stroke: C.ink, "stroke-width": 1.4, opacity: 0 }),
      flag: txt("", { x: 0, y: 0, "text-anchor": "middle", "font-family": MONO, "font-size": 13, opacity: 0 })
    }));
    const initLine = hair(`M${LX},${YL1 + 6} V${YR[0] - 12}`, { stroke: C.soft, "stroke-width": .8, opacity: 0 });
    const feats = FEAT.map(([name, vi], r) => {
      const t = sans("", 0, YR[r], { fill: C.soft });
      span(t, name + " ");
      return { vi, t, val: span(t, "", { "font-family": MONO, fill: C.ink }) };
    });

    /* ================= 2. XGBoost and the Benign exit ================= */
    const P = {};
    P.in = hair(`M${SX},${YR[2] + 8} V${YG}`);
    const gate = el("circle", { cx: SX, cy: YG, r: 4.2, fill: C.cream, stroke: C.deep, "stroke-width": 1.2 });
    sans("XGBoost", SX + 11, YG - 7, { fill: C.soft });
    let bx, by, bLabel;
    if (wide) { bx = SX; by = YG + 46; P.benign = hair(`M${SX},${YG} V${by - 5}`); bLabel = [SX + 12, by + 4.6]; }
    else { bx = W - measure("Benign 99.99%") - 22; by = YG; P.benign = hair(`M${SX + 6},${YG} H${bx - 5}`); bLabel = [bx + 10, by + 4.6]; }
    const bNode = el("circle", { cx: bx, cy: by, r: 4.4, fill: C.cream, stroke: C.line, "stroke-width": 1 });
    const bName = sans("", bLabel[0], bLabel[1], { fill: C.soft });
    span(bName, "Benign"); const bRec = span(bName, " " + pct(D.benign.recall), { "font-family": MONO, fill: C.ink, opacity: 0 });
    const in0 = layers[0].pts;
    if (wide) P.down = hair(`M${SX},${YG} H${in0[0][0] - NR - 2}`);
    else P.down = hair(`M${SX},${YG} V${in0[0][1] - 24} Q${SX},${in0[0][1] - 18} ${SX + 6},${in0[0][1] - 18} H${(in0[2][0] + in0[3][0]) / 2} V${in0[0][1] - NR - 2}`);

    /* ================= 3. the network ================= */
    const base = el("g", { stroke: C.line, "stroke-width": .6, opacity: .75 });
    const litG = el("g", { stroke: C.green, "stroke-width": 1, "stroke-linecap": "round", fill: "none" });
    const hash = (a, b, c) => { const v = Math.sin(a * 12.9898 + b * 78.233 + c * 37.719) * 43758.5453; return v - Math.floor(v); };
    const lit = [];
    const addEdge = (pair, j, k, x1, y1, x2, y2) => {
      el("line", { x1, y1, x2, y2 }, base);
      const len = Math.hypot(x2 - x1, y2 - y1), w = hash(pair + 1, j + 1, k + 1);
      const e = el("line", { x1, y1, x2, y2, "stroke-dasharray": `${len} ${len}`, "stroke-dashoffset": len, opacity: 0 }, litG);
      lit.push({ e, len, pair, w: .15 + .85 * w * w, j: hash(k + 3, j + 5, pair + 7) });
    };
    for (let i = 0; i < 2; i++) layers[i].pts.forEach((a, j) => layers[i + 1].pts.forEach((b, k) => addEdge(i, j, k, a[0], a[1], b[0], b[1])));
    // a few edges from the last layer into the dueling head, ending at the start of the V line;
    // their end moves with each flow's V, so they are kept apart and updated in render()
    feedFrom = wide ? [0, 2, 4, 5, 7] : [0, 1, 2];
    const feeds = feedFrom.map((n, j) => {
      const [x1, y1] = layers[2].pts[n];
      const b = el("line", { x1, y1, x2: XV, y2: VTOP }, base);
      const e = el("line", { x1, y1, x2: XV, y2: VTOP, opacity: 0 }, litG);
      return { b, e, x1, y1, j: hash(n + 3, j + 5, 9) };
    });
    const nodes = layers.map(L => L.pts.map(([x, y]) => el("circle", { cx: x, cy: y, r: NR, fill: C.sand2, stroke: C.line, "stroke-width": .9 })));
    if (wide) [40, 128, 64].forEach((n, i) => mono(String(n), layers[i].pts[0][0], YNB, { "text-anchor": "middle", fill: C.soft }));
    else [40, 128, 64].forEach((n, i) => mono(String(n), 34, layers[i].pts[0][1] + 4.5, { "text-anchor": "end", fill: C.soft }));

    /* ================= 4. the dueling plot, as rows ================= */
    rowY.forEach(y => hair(`M${AX0},${y} H${XLAB - 8}`, { stroke: C.rule, "stroke-width": .7 }));   // each row's home
    const plot = el("g", {});
    const vLine = el("line", { x1: 0, x2: 0, y1: VTOP, y2: VBOT, stroke: C.deep, "stroke-width": 1.4 }, plot);
    // "V(s)" sits beside the top of its line, on the side away from the incoming edges
    const vLab = txt("V(s)", { x: wide ? XV + 7 : XV - 7, y: VTOP + 5, "text-anchor": wide ? "start" : "end", "font-family": SANS, "font-size": FS, "font-style": "italic", fill: C.ink }, plot);
    const arrows = D.classes.map((c, i) => ({
      shaft: el("line", { x1: 0, x2: 0, y1: rowY[i], y2: rowY[i], stroke: C.deep, "stroke-width": 1.6, "stroke-linecap": "butt" }, plot),
      head: el("path", { d: "", fill: C.deep }, plot),
      rec: mono(pct(c.recall), XLAB + nameW[i] + 8, rowY[i] + 4.6, { opacity: 0 })
    }));
    // the class names never move and stay readable even while the plot is faint
    const names = D.classes.map((c, i) => sans(c.name, XLAB, rowY[i] + 4.6, { fill: C.soft }));
    const layout = {};
    D.flows.forEach((f, fi) => { if (f.pred >= 0) { const Q = Qof(f); layout[fi] = { Q, xV: XV, tips: Q.map(q => dx(q - f.V)), win: argmax(Q) }; } });
    const H = Math.ceil(Math.max(wide ? YNB + 6 : 0, by + 12, VBOT + 6));

    const tok = el("circle", { r: 3.6, fill: C.deep, opacity: 0 });

    svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
    svg.setAttribute("role", "img");
    svg.setAttribute("aria-label", "A network flow arrives as forward and backward packets, from which three features are read. A high-level XGBoost agent lets benign flows leave. Malicious flows run through a dueling Q-network; its value V(s) is drawn as a line and each attack class as an arrow rising or falling from it to its Q-value. The highest arrow names the attack, shown with its test recall.");
    const len = {}; for (const k in P) len[k] = P[k].getTotalLength();
    return { W, H, wide, P, len, LX, step, YL1, YL2, ticks, initLine, feats, gate, bNode, bName, bRec,
      nodes, lit, feeds, plot, vLine, vLab, arrows, names, layout, XV, rowY, VTOP, VBOT, tok };
  }

  /* ---------- render at loop time t (stateless) ---------- */
  function render(t) {
    if (!G) return;
    t = ((t % LOOP) + LOOP) % LOOP;
    let s = null;
    for (const x of sched) if (t >= x.t && t < x.t + x.d) s = x;
    const idle = !s;
    if (idle) s = sched[0];                          // the gap before the loop restarts: nothing in flight
    const f = s.f, lt = idle ? -1 : t - s.t, mal = f.pred >= 0, miss = mal && f.label !== f.pred;
    const out = idle ? 0 : 1 - ramp(lt, s.d - .3, s.d);     // everything fades together at the end of a flow
    const on = x => !idle && out > .5 && x;

    /* 1. packets arrive; the features are read off them */
    let nP = 0, nR = 0;
    G.ticks.forEach((tk, i) => {
      const p = f.pk[i];
      if (!p || idle || lt < PK0 + i * PKDT) { tk.line.setAttribute("opacity", 0); tk.flag.setAttribute("opacity", 0); return; }
      const x = G.LX + i * G.step, fw = p[0] === "f", y = fw ? G.YL1 : G.YL2;
      const a = ramp(lt, PK0 + i * PKDT, PK0 + i * PKDT + .06) * out;
      tk.line.setAttribute("x1", x); tk.line.setAttribute("x2", x);
      tk.line.setAttribute("y1", y - 5.5); tk.line.setAttribute("y2", y + 5.5);
      tk.line.setAttribute("opacity", a);
      const fl = p.slice(1);
      if (fl.includes("P")) nP++;
      if (fl.includes("R")) nR++;
      tk.flag.textContent = fl;
      tk.flag.setAttribute("x", x); tk.flag.setAttribute("y", fw ? y - 9 : y + 19);
      tk.flag.setAttribute("fill", fl.includes("R") ? C.rust : C.soft);
      tk.flag.setAttribute("opacity", fl ? a : 0);
    });
    const firstF = f.pk.findIndex(p => p[0] === "f");
    const initOn = !idle && firstF >= 0 && lt >= PK0 + firstF * PKDT;
    G.initLine.setAttribute("opacity", initOn ? .9 * out : 0);
    G.feats.forEach(r => {
      const v = r.vi === 0 ? (initOn ? num(f.v[0]) : "") : String(r.vi === 3 ? nP : nR);
      r.val.textContent = idle || lt < PK0 ? "" : v;
      r.t.setAttribute("opacity", idle ? .5 : .5 + .5 * out);
    });

    /* 2. XGBoost */
    G.gate.setAttribute("fill", on(lt >= T_GATE) ? (mal ? C.deep : C.green) : C.cream);
    const bOn = on(!mal && lt >= 1.95);
    G.bNode.setAttribute("fill", bOn ? C.green : C.cream); G.bNode.setAttribute("stroke", bOn ? C.green : C.line);
    G.bName.setAttribute("fill", bOn ? C.green : C.soft); G.bName.setAttribute("font-weight", bOn ? 600 : 400);
    G.bRec.setAttribute("opacity", bOn ? ramp(lt, 1.95, 2.2) * out : 0);

    /* 3. the network lights layer by layer */
    G.nodes.forEach((ns, i) => ns.forEach(n => {
      const l = on(mal && lt >= WAVE[i][0]);
      n.setAttribute("fill", l ? C.deep : C.sand2); n.setAttribute("stroke", l ? C.deep : C.line);
    }));
    for (const L of G.lit) {
      let op = 0, u = 0;
      if (mal && !idle) {
        const [a0, a1] = WAVE[L.pair], st = a0 + L.j * .05;
        u = ramp(lt, st, a1 + L.j * .05);
        op = L.w * u * (1 - .55 * ramp(lt, a1 + .2, a1 + .7)) * out;
      }
      if (op < .01) { if (L.on) { L.e.setAttribute("opacity", 0); L.on = false; } continue; }
      L.on = true;
      L.e.setAttribute("stroke-dashoffset", L.len * (1 - u));
      L.e.setAttribute("opacity", op.toFixed(3));
    }

    /* 4. the dueling plot: the current malicious flow, or the last one faintly */
    const showCur = mal && !idle && lt >= T_V[0];
    const ps = showCur ? s : prevMal[idle ? 0 : s.i];
    const pf = ps ? ps.f : null, Lo = pf ? G.layout[ps.i] : null;
    const ghost = !showCur;
    G.plot.setAttribute("opacity", pf ? (ghost ? .2 : out).toFixed(3) : 0);
    const pmiss = pf && pf.label !== pf.pred;
    if (pf) {
      const vU = ghost ? 1 : ramp(lt, T_V[0], T_V[1]);   // V settles: the line draws down from its label
      G.vLine.setAttribute("x1", Lo.xV); G.vLine.setAttribute("x2", Lo.xV);
      G.vLine.setAttribute("y2", G.VTOP + (G.VBOT - G.VTOP) * vU);
      G.vLab.setAttribute("opacity", vU);
      G.arrows.forEach((a, i) => {
        const g = ghost ? 1 : ramp(lt, T_ARR + i * .06, T_ARR + i * .06 + .32);
        const y = G.rowY[i], tipF = Lo.tips[i], tip = Lo.xV + (tipF - Lo.xV) * g;
        const dx = tip - Lo.xV, dir = dx < 0 ? -1 : 1, hl = Math.min(6, Math.abs(dx)), hw = 3.4 * (hl / 6 || 0);
        a.shaft.setAttribute("x1", Lo.xV); a.shaft.setAttribute("x2", tip - dir * hl * .8);
        a.shaft.setAttribute("opacity", Math.abs(dx) > hl ? 1 : 0);
        a.head.setAttribute("d", hl > .5 ? `M${tip},${y} L${tip - dir * hl},${y - hw} L${tip - dir * hl},${y + hw} Z` : "");
        const won = !ghost && i === Lo.win && lt >= T_WIN, trueMiss = !ghost && pmiss && i === pf.label && lt >= T_WIN;
        const col = won ? (pmiss ? C.ochre : C.rust) : trueMiss ? C.rust : C.deep;
        a.shaft.setAttribute("stroke", col); a.head.setAttribute("fill", col);
        a.rec.setAttribute("fill", D.classes[i].recall < .5 ? C.rust : C.ink);
        a.rec.setAttribute("opacity", (pmiss ? trueMiss : won) ? ramp(lt, T_WIN, T_WIN + .25) * out : 0);
      });
    }
    // the names stay put; the winner (and on the miss, the true class) lights up
    G.names.forEach((n, i) => {
      const won = pf && !ghost && i === Lo.win && lt >= T_WIN, trueMiss = pf && !ghost && pmiss && i === pf.label && lt >= T_WIN;
      const a = won || trueMiss ? out : 0;
      n.setAttribute("fill", a > .5 ? (won ? (pmiss ? C.missInk : C.rust) : C.rust) : C.soft);
      n.setAttribute("font-weight", a > .5 ? 600 : 400);
    });
    // feed edges fan into the top of the V line, lit as the last wave arrives
    const fx = G.XV;
    G.feeds.forEach(e => {
      e.b.setAttribute("x2", fx); e.e.setAttribute("x2", fx);
      const u = mal && !idle ? ramp(lt, WAVE[2][0] + e.j * .05, WAVE[2][1] + e.j * .05) : 0;
      const op = .85 * u * (1 - .5 * ramp(lt, WAVE[2][1] + .3, WAVE[2][1] + .8)) * out;
      if (op < .01) { e.e.setAttribute("opacity", 0); return; }
      e.e.setAttribute("x2", e.x1 + (fx - e.x1) * u); e.e.setAttribute("y2", e.y1 + (G.VTOP - e.y1) * u);
      e.e.setAttribute("opacity", op.toFixed(3));
    });

    /* one token: from the features to XGBoost, then to Benign or into the network */
    const at = (key, u) => G.P[key].getPointAtLength(clamp(u) * G.len[key]);
    let p = null, op = 0, col = C.deep;
    if (!idle) {
      if (lt >= 1.2 && lt < T_GATE) { p = at("in", ramp(lt, 1.2, T_GATE)); op = 1; }
      else if (!mal && lt >= T_GATE && lt < 2.0) { p = at("benign", ramp(lt, 1.55, 1.95)); op = 1 - ramp(lt, 1.9, 2.0); col = C.green; }
      else if (mal && lt >= T_GATE && lt < 1.88) { p = at("down", ramp(lt, 1.55, 1.85)); op = 1 - ramp(lt, 1.82, 1.88); }
    }
    if (p) { G.tok.setAttribute("cx", p.x); G.tok.setAttribute("cy", p.y); G.tok.setAttribute("fill", col); G.tok.setAttribute("opacity", op); }
    else G.tok.setAttribute("opacity", 0);
  }

  /* ---------- layout and loop ---------- */
  const m = /#t=([\d.]+)/.exec(location.hash);
  let tl = m ? parseFloat(m[1]) : 0, last = null, running = !reduce;
  const sb = sched.find(x => x.f.pred === 0) || sched[1];
  const draw = () => reduce ? render(sb.t + 3.8) : render(tl);   // reduced motion: Botnet just chosen
  function layout() {
    const w = Math.round(host.getBoundingClientRect().width) || 340;
    const W = Math.max(270, Math.min(640, w));
    if (G && Math.abs(G.W - W) < 6) return;
    G = build(W); draw();
  }
  layout();
  if ("ResizeObserver" in window) new ResizeObserver(layout).observe(host);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { G = null; layout(); });   // re-measure text
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
