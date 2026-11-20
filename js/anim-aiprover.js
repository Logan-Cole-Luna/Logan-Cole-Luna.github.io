/* AIProver paper card: one formalization session, with the training stage behind each step,
   and a training panel that shows what happens inside that stage.
   ILLUSTRATIVE SESSION: the theorem (sum of the first n odd numbers is n^2), the first attempt,
   the Lean error and the Mathlib search are constructed for this figure; they are not a logged run.
   The Lean is real Lean 4 / Mathlib: `Finset.sum_range_succ` is the Mathlib lemma
   sum_{x in range (n+1)} f x = sum_{x in range n} f x + f n, and "linarith failed to find a
   contradiction" is linarith's failure message (it cannot see inside the Finset sum).
   Strip and training panel (public facts, project site sections 03 and 04): Leanstral-1.5 in a seed
   harness adapted from Mistral's Vibe with lean-lsp-mcp; SAM aligns the English and Lean views at a
   reserved [PRED] token (matched cosine 0.11 -> 0.75); Agentic RLSF scores rollouts with the Lean
   kernel and BEq+ on the reward ladder and optimizes with GRPO; HarnessEvolve keeps a tree of
   harnesses, a coding agent mutates a parent, children are accepted only if fitness beats the best,
   rejected ones are kept; the gate keeps a round only if held-out fitness improves.
   ILLUSTRATIVE in the panel: the rollout outcomes (rewards computed from the public ladder), the
   harness fitness values, the gate fitness values, and the unmatched SAM pairs.
   DOM text at real CSS size. Markup: .anim-aiprover > .aip-strip, .aip-main (.aip-eng, .aip-code),
   .aip-train, svg.aip-wires. No narrating note line: the stage line, the Lean file and the panel carry it. Hash: #t=<s> jumps to a moment; #stage=<id>&p=<s> shows a
   clicked stage's panel at time p (ids: base, sam, rlsf, hevo, gate). */
(function () {
  const root = document.querySelector(".anim-aiprover");
  if (!root) return;
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const $ = s => root.querySelector(s);
  const strip = $(".aip-strip"), eng = $(".aip-eng"), code = $(".aip-code"), wires = $(".aip-wires");
  let train = (root.closest("li.paper") || root).querySelector(".aip-train");
  if (!train) { train = document.createElement("div"); train.className = "aip-train"; $(".aip-main").after(train); }
  const NS = "http://www.w3.org/2000/svg";
  const clamp = x => x < 0 ? 0 : x > 1 ? 1 : x;
  const ease = x => { x = clamp(x); return x * x * (3 - 2 * x); };
  const ramp = (t, a, b) => ease((t - a) / (b - a));
  const lerp = (a, b, u) => a + (b - a) * u;
  const esc = s => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const C = { deep: "#173f35", green: "#1f6b57", rust: "#a8461f", ochre: "#c08a2b", rule: "#d6c8a9", line: "#c9bb98",
    soft: "#67615a", ink: "#1c1a17", paper: "#efe6d4", bg: "#f7f2e7" };
  const MONO = "'IBM Plex Mono',ui-monospace,monospace", SANS = "'Source Sans 3','Segoe UI',sans-serif";

  /* ---------- stage line: plain clickable text, the active stage changes colour ---------- */
  const STAGES = [["base", "Leanstral-1.5"], ["sam", "SAM"], ["rlsf", "Agentic RLSF"], ["hevo", "HarnessEvolve"], ["gate", "gate"]];
  const ARROWS = ["→", "→", "⇄", "→"];
  strip.setAttribute("role", "group");
  strip.setAttribute("aria-label", "Training stages: choose one to see what it does");
  strip.innerHTML = STAGES.map((s, i) => `<button type="button" class="aip-stage" data-s="${s[0]}" aria-pressed="false">${s[1]}</button>` +
    (i < ARROWS.length ? `<span class="aip-arrow" aria-hidden="true">${ARROWS[i]}</span>` : "")).join("");
  const stageEl = {}; strip.querySelectorAll(".aip-stage").forEach(e => (stageEl[e.dataset.s] = e));

  eng.innerHTML =
    `<p class="aip-thm"><span class="aip-thm-h">Theorem.</span> For <span class="aip-pair" data-p="0">every natural number <i>n</i></span>, ` +
    `the sum of the first <i>n</i> odd numbers is <i>n</i>²:</p>` +
    `<p class="aip-disp"><span class="aip-pair" data-p="1">1 + 3 + ⋯ + (2<i>n</i> − 1)</span> <span class="aip-pair" data-p="2">= <i>n</i>²</span></p>` +
    `<p class="aip-proof"><span class="aip-thm-h">Proof.</span> Induction on <i>n</i>: adding the next odd number 2<i>n</i> + 1 to <i>n</i>² gives (<i>n</i> + 1)².</p>`;
  const engPairs = [...eng.querySelectorAll(".aip-pair")];

  code.innerHTML = `<div class="aip-file"><span>SumOdd.lean</span><span class="aip-status"></span></div><div class="aip-src"></div>`;
  const src = code.querySelector(".aip-src"), status = code.querySelector(".aip-status");
  const fly = document.createElement("div"); fly.className = "aip-fly"; fly.setAttribute("aria-hidden", "true");
  fly.innerHTML = "<span>Finset.sum_range_succ</span>"; root.appendChild(fly);
  const flyIn = fly.firstChild;

  /* ---------- the session (illustrative) ---------- */
  const CPS = 30;
  const LINES = [
    [{ t: "import Mathlib" }],
    [{ t: "open Finset" }],
    [],
    [{ t: "theorem sum_odds " }, { t: "(n : ℕ)", p: 0 }, { t: " :" }],
    [{ t: "    " }, { t: "∑ i ∈ range n, (2 * i + 1)", p: 1 }, { t: " " }, { t: "= n ^ 2", p: 2 }, { t: " := by" }],
    [{ t: "  induction n with" }],
    [{ t: "  | zero => simp" }],
    [{ t: "  | succ n ih =>" }, { t: " " }, { t: "linarith [ih]", err: 1 }]];
  const L9 = [{ t: "    rw [" }, { t: "Finset.sum_range_succ", lemma: 1 }, { t: ", ih]" }];
  const L10 = [{ t: "    ring" }];
  const len = segs => segs.reduce((a, s) => a + s.t.length, 0);

  const T = {}; let c = 0.9;
  T.lines = LINES.map(l => { const a = c; c += len(l) / CPS + 0.18; return [a, a + len(l) / CPS]; });
  T.compile1 = c + 0.3; T.err = T.compile1 + 0.9;
  T.search = T.err + 2.7; T.found = T.search + 1.0;
  T.del = T.found + 1.6; T.delEnd = T.del + 0.5;
  T.l9a = T.delEnd + 0.2; T.fly = T.l9a + 8 / CPS + 0.15; T.flyEnd = T.fly + 0.9; T.l9b = T.flyEnd + 0.05;
  T.l10 = T.l9b + 5 / CPS + 0.25; T.collapse = T.flyEnd + 0.15;
  T.compile2 = T.l10 + 8 / CPS + 0.4; T.ok = T.compile2 + 0.8;
  T.faith = T.ok + 1.6; T.faithEnd = T.faith + 4.6;
  T.reward = T.faithEnd + 0.3; T.gate = T.reward + 5.2; T.hold = T.gate + 4.6; T.loop = T.hold + 1.0;

  // which training stage is lit, and from when (the panel's clock starts there)
  const SEG = [["base", 0], ["hevo", T.err], ["sam", T.faith], ["rlsf", T.reward], ["gate", T.gate]];
  const segAt = t => { let s = SEG[0]; SEG.forEach(x => { if (t >= x[1]) s = x; }); return s; };

  function lineHTML(segs, n, opts) {
    let out = "", left = n;
    for (const s of segs) {
      if (left <= 0) break;
      const part = s.t.slice(0, left); left -= part.length;
      let h = esc(part).replace(/\b(import|open|theorem|by|induction|with)\b/g, '<span class="aip-kw">$1</span>');
      if (s.p != null) h = `<span class="aip-pair" data-p="${s.p}">${h}</span>`;
      if (s.err && opts.err) h = `<span class="aip-err">${h}</span>`;
      if (s.lemma) h = `<span class="aip-lemma${opts.flying ? " aip-hide" : ""}">${h}</span>`;
      out += h;
    }
    return out;
  }
  const typed = (t, a, segs) => Math.floor(clamp((t - a) / (len(segs) / CPS)) * len(segs) + 1e-6);

  let lastHTML = "";
  function renderSession(t, manual) {
    const rows = []; let caretRow = -1;
    const errOn = t >= T.err && t < T.del;
    LINES.forEach((segs, i) => {
      let n = typed(t, T.lines[i][0], segs);
      if (i === 7 && t >= T.del) n = Math.round(len(segs) - (len(segs) - 16) * clamp((t - T.del) / (T.delEnd - T.del)));
      if (t >= T.lines[i][0] && (i === 7 ? t < T.compile1 : n < len(segs))) caretRow = i;
      if (t >= T.lines[i][0]) rows.push({ n: i + 1, html: lineHTML(segs, n, { err: errOn }) });
    });
    if (t >= T.del && t < T.l9a) caretRow = 7;
    const msgs = [];
    const shut = 1 - ramp(t, T.collapse, T.collapse + .4);
    const mOpen = ramp(t, T.err, T.err + .35) * shut;
    if (mOpen > 0) msgs.push(`<div class="aip-msg aip-msg-err" style="max-height:${mOpen * 18}px;opacity:${mOpen}">error: linarith failed to find a contradiction</div>`);
    const sOpen = ramp(t, T.search, T.search + .35) * shut;
    if (sOpen > 0) {
      const q = "sum over range (n + 1)", qn = Math.floor(clamp((t - T.search - .3) / (q.length / 30)) * q.length);
      msgs.push(`<div class="aip-msg aip-msg-search" style="max-height:${sOpen * 18}px;opacity:${sOpen}">search Mathlib: <span class="aip-q">${esc(q.slice(0, qn))}</span></div>`);
      const rOpen = ramp(t, T.found, T.found + .3) * shut;
      if (rOpen > 0) msgs.push(`<div class="aip-msg aip-msg-hit" style="max-height:${rOpen * 20}px;opacity:${rOpen}">→ <span class="aip-hit"${t >= T.fly ? ' style="opacity:.35"' : ""}>Finset.sum_range_succ</span></div>`);
    }
    const extra = [];
    const flying = t >= T.fly && t < T.flyEnd;
    if (t >= T.l9a) {
      let n9;
      if (t < T.fly) n9 = Math.min(8, typed(t, T.l9a, [{ t: "    rw [" }]));
      else if (t < T.l9b) n9 = 29;
      else n9 = Math.min(len(L9), 29 + Math.floor((t - T.l9b) * CPS));
      extra.push({ n: 9, html: lineHTML(L9, n9, { flying }) });
      if (t < T.l10) caretRow = 8;
    }
    if (t >= T.l10) {
      const n10 = typed(t, T.l10, L10), ok = t >= T.ok;
      extra.push({ n: 10, html: lineHTML(L10, n10, {}) + (ok ? `<span class="aip-goals" style="opacity:${ramp(t, T.ok, T.ok + .4)}">  no goals</span>` : ""), tick: ok });
      if (n10 < len(L10)) caretRow = 9;
    }
    const all = rows.concat(extra);
    let html = "";
    all.forEach((r, i) => {
      const caret = i === caretRow && !manual && Math.floor(t * 2.4) % 2 === 0 ? '<span class="aip-caret"></span>' : "";
      html += `<div class="aip-ln${r.n === 8 && errOn ? " is-err" : ""}" data-n="${r.n}"><span class="aip-num">${r.tick ? '<b class="aip-tick">✓</b>' : r.n}</span><span class="aip-tx">${r.html}${caret}</span></div>`;
      if (r.n === 8) html += msgs.join("");
    });
    if (html !== lastHTML) { src.innerHTML = html; lastHTML = html; }

    let st = "";
    if (t >= T.compile1 && t < T.err) st = "compiling…";
    else if (t >= T.err && t < T.search) st = '<span class="aip-bad">1 error</span>';
    else if (t >= T.search && t < T.compile2) st = "repairing";
    else if (t >= T.compile2 && t < T.ok) st = "compiling…";
    else if (t >= T.ok) st = '<span class="aip-good">✓ compiles, no sorry</span>' + (t >= T.reward ? ' <span class="aip-reward">+ reward</span>' : "");
    if (status.innerHTML !== st) status.innerHTML = st;

    const pairOn = p => t >= T.faith + p * 1.1 && t < T.faithEnd;
    const codePairs = [...src.querySelectorAll(".aip-pair")];
    [engPairs, codePairs].forEach(list => list.forEach(e => e.classList.toggle("is-on", pairOn(+e.dataset.p))));

    root.style.setProperty("--aip-fade", 1 - ramp(t, T.hold, T.loop));

    // lemma flight: measured on the inner spans so the glyphs land on the same baseline
    const rr = root.getBoundingClientRect();
    if (flying) {
      const a = src.querySelector(".aip-hit"), b = src.querySelector(".aip-lemma");
      if (a && b) {
        fly.style.opacity = 1; fly.style.left = "0px"; fly.style.top = "0px";
        const f0 = flyIn.getBoundingClientRect(), ra = a.getBoundingClientRect(), rb = b.getBoundingClientRect();
        const u = ease((t - T.fly) / (T.flyEnd - T.fly));
        fly.style.left = (lerp(ra.left, rb.left, u) - f0.left) + "px";
        fly.style.top = (lerp(ra.top, rb.top, u) - f0.top) + "px";
      }
    } else fly.style.opacity = 0;
    return { pairOn, codePairs, rr };
  }

  /* ---------- wires: short, clean, only in the wide layout ---------- */
  function renderWires(t, act, s) {
    const rr = s.rr, narrow = root.clientWidth < 520;
    let paths = "";
    if (act && !narrow) {
      const a = stageEl[act].getBoundingClientRect();
      const tgt = act === "sam" ? eng : act === "hevo" || act === "rlsf" ? code : null;
      const live = (act === "hevo" && t >= T.err && t < T.del) || (act === "sam" && t < T.faithEnd) || (act === "rlsf" && t < T.gate);
      if (tgt && live) {
        const b = tgt.getBoundingClientRect();
        const x = Math.min(Math.max(a.left + a.width / 2, b.left + 8), b.right - 8) - rr.left;
        const x0 = a.left + a.width / 2 - rr.left, y0 = a.bottom - rr.top + 3, y1 = b.top - rr.top - 2;
        paths += Math.abs(x - x0) < 1 ? `<path d="M${x0},${y0} V${y1}" />` : `<path d="M${x0},${y0} C${x0},${y1} ${x},${y0} ${x},${y1}" />`;
      }
      // faithfulness: only the pair currently being checked gets a wire, through the gap
      if (act === "sam") {
        const cur = [2, 1, 0].find(p => s.pairOn(p) && t < T.faith + p * 1.1 + 1.1);
        if (cur != null) {
          const e = engPairs[cur], m = s.codePairs.find(x => +x.dataset.p === cur);
          if (e && m) {
            const er = e.getClientRects(), ae = er[er.length - 1], bm = m.getBoundingClientRect();
            const gx0 = eng.getBoundingClientRect().right - rr.left + 3, gx1 = code.getBoundingClientRect().left - rr.left - 1;
            const y0 = ae.top + ae.height / 2 - rr.top, y1 = bm.top + bm.height / 2 - rr.top;
            paths += `<path class="aip-link" d="M${gx0},${y0} C${gx1},${y0} ${gx0},${y1} ${gx1},${y1}" />`;
          }
        }
      }
    }
    wires.setAttribute("viewBox", `0 0 ${rr.width} ${rr.height}`);
    if (wires.innerHTML !== paths) wires.innerHTML = paths;
  }

  /* ---------- training panel: one small figure per stage ---------- */
  const el = (tag, a, p) => { const e = document.createElementNS(NS, tag); for (const k in a) e.setAttribute(k, a[k]); if (p) p.appendChild(e); return e; };
  const tx = (s, a, p) => { const e = el("text", Object.assign({ "font-family": SANS, "font-size": 13, fill: C.ink }, a), p); e.textContent = s; return e; };
  const mono = (s, a, p) => tx(s, Object.assign({ "font-family": MONO, "font-size": 13 }, a), p);
  const op = (e, v) => e.setAttribute("opacity", v);

  const PANELS = {
    base: {
      name: "Leanstral-1.5", period: 6.6,
      desc: "an open-weight Lean model in a seed harness with Lean tools.",
      build(g, W, N) {
        const tools = [["compile with Lean", "1 error"], ["read the goal", "⊢ n ^ 2 + (2 * n + 1) = (n + 1) ^ 2"], ["search Mathlib", "Finset.sum_range_succ"]];
        const mx = 0, my = 20, tx0 = N ? 18 : 150;
        tx("Leanstral-1.5", { x: mx, y: my, "font-weight": 600, fill: C.deep }, g);
        tx("+ seed harness", { x: mx, y: my + 18, fill: C.soft }, g);
        const rows = tools.map((tl, i) => {
          const y = N ? 62 + i * 22 : 14 + i * 24;
          const path = el("path", { d: N ? `M8,${my + 24} V${y - 4} H${tx0 - 6}` : `M${104},${my - 4} C${126},${my - 4} ${120},${y - 4} ${tx0 - 6},${y - 4}`, fill: "none", stroke: C.line, "stroke-width": 1 }, g);
          const lab = tx(tl[0], { x: tx0, y }, g);
          const out = mono(tl[1], N ? { x: 0, y: 130, fill: C.green } : { x: tx0 + 128, y, fill: C.green }, g);
          return { path, lab, out };
        });
        const dot = el("circle", { r: 3, fill: C.rust }, g);
        return { rows, dot, H: N ? 136 : 70 };
      },
      update(s, p) {
        const k = Math.floor(p / 2.2) % 3, f = (p % 2.2) / 2.2;
        s.rows.forEach((r, i) => {
          r.lab.setAttribute("fill", i === k ? C.ink : C.soft);
          r.path.setAttribute("stroke", i === k ? C.deep : C.line);
          op(r.out, i === k ? ramp(f, .45, .55) : 0);
        });
        const P = s.rows[k].path, L = P.getTotalLength();
        const q = f < .5 ? f * 2 : 2 - f * 2, pt = P.getPointAtLength(L * ease(q));
        s.dot.setAttribute("cx", pt.x); s.dot.setAttribute("cy", pt.y);
      }
    },
    sam: {
      name: "SAM", period: 7,
      desc: "pulls the English and Lean views of one theorem together.",
      build(g, W, N) {
        // each view is marked on its own line (rust circle = English at [PRED], deep triangle = Lean): no legend
        el("circle", { cx: 5, cy: 13.5, r: 4, fill: "none", stroke: C.rust, "stroke-width": 1.5 }, g);
        const e = tx("", { x: 16, y: 18 }, g);
        e.innerHTML = `the sum of the first <tspan font-style="italic">n</tspan> odd numbers is <tspan font-style="italic">n</tspan>² <tspan font-family="${MONO}" fill="${C.rust}">[PRED]</tspan>`;
        el("path", { d: "M5,37.4 L9.2,45 L0.8,45 Z", fill: C.deep }, g);
        mono("∑ i ∈ range n, (2 * i + 1) = n ^ 2", { x: 16, y: 46, fill: C.deep }, g);
        const px = N ? 0 : W - 170, py = N ? 60 : 4, pw = N ? W - 110 : 160, ph = N ? 64 : 70;
        el("rect", { x: px, y: py, width: pw, height: ph, fill: "none", stroke: C.rule }, g);
        const others = [[.2, .25, .75, .8], [.8, .3, .15, .7], [.5, .85, .9, .15]].map(o => ({
          o, c: el("circle", { r: 3.2, fill: "none", stroke: C.line, "stroke-width": 1.2 }, g),
          tr: el("path", { d: "M0,-3.8 L3.4,2.4 L-3.4,2.4 Z", fill: C.line }, g) }));
        const ce = el("circle", { r: 4, fill: "none", stroke: C.rust, "stroke-width": 1.5 }, g);
        const tl = el("path", { d: "M0,-4.6 L4.2,3 L-4.2,3 Z", fill: C.deep }, g);
        const lx = N ? px + pw + 12 : 0, ly = N ? py + 26 : 74;
        tx("matched cosine", { x: lx, y: ly, fill: C.soft }, g);
        const cos = mono("0.11", N ? { x: lx, y: ly + 20, fill: C.ink, "font-weight": 500 } : { x: lx + 98, y: ly, fill: C.ink, "font-weight": 500 }, g);
        return { px, py, pw, ph, others, ce, tl, cos, H: N ? py + ph + 4 : 78 };
      },
      update(s, p) {
        const u = ramp(p, 1, 4.6), at = (fx, fy) => [s.px + s.pw * fx, s.py + s.ph * fy];
        const [ex, ey] = at(lerp(.18, .47, u), lerp(.3, .48, u)), [lx, ly] = at(lerp(.82, .55, u), lerp(.72, .52, u));
        s.ce.setAttribute("cx", ex); s.ce.setAttribute("cy", ey);
        s.tl.setAttribute("transform", `translate(${lx},${ly})`);
        s.others.forEach(({ o, c, tr }) => {
          const [a, b] = at(lerp(o[0], o[0] + (o[0] - .5) * .25, u), o[1]), [x2, y2] = at(lerp(o[2], o[2] + (o[2] - .5) * .25, u), o[3]);
          c.setAttribute("cx", a); c.setAttribute("cy", b); tr.setAttribute("transform", `translate(${x2},${y2})`);
        });
        const v = lerp(.11, .75, u);
        s.cos.textContent = v.toFixed(2); s.cos.setAttribute("fill", u > .99 ? C.green : C.ink);
      }
    },
    rlsf: {
      name: "Agentic RLSF", period: 6.4,
      desc: "Lean and BEq+ grade each attempt; GRPO reinforces the above-average ones.",
      build(g, W, N) {
        const R = [["does not compile", .05], ["compiles, sorry left", .5], ["complete, weaker statement", .6], ["complete and faithful", .97]];
        const lw = N ? 0 : 184, bx = N ? 0 : lw, bw = N ? W - 92 : W - lw - 130, rowH = N ? 32 : 19;
        const rows = R.map(([lab, r], i) => {
          const y = 14 + i * rowH;
          tx(lab, { x: 0, y }, g);
          const by = N ? y + 5 : y - 9;
          el("rect", { x: bx, y: by, width: bw, height: 8, fill: "#ece2cc" }, g);
          const bar = el("rect", { x: bx, y: by, width: 0, height: 8, fill: C.line }, g);
          const val = mono(r.toFixed(2), { x: bx + bw + 8, y: N ? by + 8 : y }, g);
          const mark = tx("", { x: bx + bw + 48, y: N ? by + 8 : y }, g);
          return { r, bar, val, mark, by };
        });
        const mean = R.reduce((a, b) => a + b[1], 0) / R.length;
        const bot = rows[3].by + 12, mx = bx + bw * mean;
        const ml = el("path", { d: rows.map(r => `M${mx},${r.by - 3} V${r.by + 11}`).join(" "), stroke: C.rust, "stroke-width": 1.2 }, g);
        const mt = tx(`group mean ${mean.toFixed(2)}`, { x: mx + 5, y: bot + 13, fill: C.rust }, g);
        return { rows, ml, mt, bw, mean, N, H: bot + 18 };
      },
      update(s, p) {
        s.rows.forEach((r, i) => {
          const g = ramp(p, .3 + i * .45, .8 + i * .45);
          r.bar.setAttribute("width", s.bw * r.r * g); op(r.val, g);
          const judged = p > 3.4, up = r.r > s.mean;
          r.bar.setAttribute("fill", judged ? (up ? C.green : C.rust) : C.line);
          r.mark.textContent = judged ? (up ? (s.N ? "↑" : "↑ reinforced") : "↓") : "";
          r.mark.setAttribute("fill", up ? C.green : C.rust);
        });
        const m = ramp(p, 2.5, 3); op(s.ml, m); op(s.mt, m);
      }
    },
    hevo: {
      name: "HarnessEvolve", period: 8,
      desc: "a coding agent edits harnesses; a child is kept only if it beats the best.",
      build(g, W, N) {
        const sx = N ? 86 : 110, x0 = 14;
        const nodes = [
          { x: x0, y: 40, f: .42, lab: "H₀" },
          { x: x0 + sx, y: 20, f: .47, par: 0, acc: 1 },
          { x: x0 + sx * 2, y: 2, f: .45, par: 1, acc: 0 },
          { x: x0 + sx * 2, y: 38, f: .51, par: 1, acc: 1 },
          { x: x0 + sx, y: 60, f: .39, par: 0, acc: 0 }];
        const G = nodes.map((n, i) => {
          const gg = el("g", {}, g);
          let edge = null;
          if (n.par != null) { const q = nodes[n.par]; edge = el("path", { d: `M${q.x},${q.y + 18} C${q.x + sx * .5},${q.y + 18} ${n.x - sx * .5},${n.y + 18} ${n.x},${n.y + 18}`, fill: "none", stroke: n.acc ? C.deep : C.line, "stroke-width": 1, "stroke-dasharray": n.acc ? "" : "3 3" }, g); }
          const ring = el("circle", { cx: n.x, cy: n.y + 18, r: 9, fill: "none", stroke: C.rust, "stroke-width": 1.2, opacity: 0 }, g);
          const dot = el("circle", { cx: n.x, cy: n.y + 18, r: 4.5, fill: n.acc === 0 ? C.bg : C.green, stroke: n.acc === 0 ? C.line : C.green, "stroke-width": 1.4 }, gg);
          const lbl = mono((n.lab ? n.lab + " " : "") + n.f.toFixed(2), { x: n.x, y: n.y + 7, "text-anchor": i === 0 ? "start" : "middle", fill: n.acc === 0 ? C.soft : C.ink }, gg);
          if (i === 0) lbl.setAttribute("x", n.x - 6);
          return { n, gg, edge, ring };
        });
        // verdict beside the tree in the wide layout, under it in the narrow one
        const vx = N ? 0 : x0 + sx * 2 + 56;
        const verdict = tx("", { x: vx, y: N ? 104 : 38 }, g);
        const best = tx("", { x: vx, y: N ? 124 : 60, fill: C.soft }, g);
        return { G, verdict, best, H: N ? 130 : 84 };
      },
      update(s, p) {
        const step = 1.55, k = Math.min(4, Math.floor(p / step)), f = (p - k * step) / step;
        let bestF = .42, msg = "";
        s.G.forEach((o, i) => {
          if (i === 0) { op(o.gg, 1); return; }
          const shown = i < k || (i === k && f > .55), edgeU = i < k ? 1 : i === k ? ramp(f, .25, .55) : 0;
          op(o.gg, shown ? 1 : 0);
          if (o.edge) { const L = o.edge.getTotalLength(); o.edge.setAttribute("stroke-dasharray", o.n.acc ? `${L * edgeU} ${L}` : (edgeU >= 1 ? "3 3" : `${L * edgeU} ${L}`)); }
          if (shown && o.n.acc) bestF = Math.max(bestF, o.n.f);
          if (i === k && f > .55) msg = o.n.acc ? `accepted, ${o.n.f.toFixed(2)} is the new best` : `rejected, kept in the tree`;
        });
        s.G.forEach((o, i) => op(o.ring, i === (k >= 1 && k <= 4 ? s.G[k].n.par : -1) && f < .45 ? 1 : 0));
        if (k >= 1 && f < .55) msg = "parent picked, an agent edits it";
        s.verdict.textContent = msg; s.verdict.setAttribute("fill", /^rej/.test(msg) ? C.soft : /^acc/.test(msg) ? C.green : C.ink);
        s.best.textContent = `best fitness ${bestF.toFixed(2)}`;
      }
    },
    gate: {
      name: "Gate", period: 8,
      desc: "a round is kept only if held-out fitness improves.",
      build(g, W, N) {
        const lw = N ? 0 : 150, bw = N ? W - 70 : W - lw - 140;
        const row = (lab, y) => {
          tx(lab, { x: 0, y }, g);
          const by = N ? y + 7 : y - 9;
          el("rect", { x: lw, y: by, width: bw, height: 9, fill: "#ece2cc" }, g);
          const bar = el("rect", { x: lw, y: by, width: 0, height: 9, fill: C.deep }, g);
          const v = mono("", { x: lw + bw + 8, y: by + 9 }, g);
          return { bar, v, by };
        };
        const a = row("current round", N ? 20 : 24), b = row("candidate round", N ? 62 : 48);
        const verdict = tx("", { x: N ? 0 : lw, y: N ? 108 : 76, "font-weight": 600 }, g);
        tx("held-out fitness", { x: N ? W : lw + bw, y: N ? 0 : 2, "text-anchor": "end", fill: C.soft }, g);
        return { a, b, bw, verdict, H: N ? 114 : 82 };
      },
      update(s, p) {
        const second = p >= 4, q = second ? p - 4 : p, cur = .53, cand = second ? .5 : .58;
        s.a.bar.setAttribute("width", s.bw * cur); s.a.v.textContent = cur.toFixed(2);
        const g = ramp(q, .4, 1.6);
        s.b.bar.setAttribute("width", s.bw * cand * g); s.b.v.textContent = g > .98 ? cand.toFixed(2) : "";
        const kept = cand > cur, show = q > 2;
        s.b.bar.setAttribute("fill", show ? (kept ? C.green : C.rust) : C.line);
        op(s.b.bar, show && !kept ? 1 - .6 * ramp(q, 2.6, 3.4) : 1);
        s.verdict.textContent = show ? (kept ? "✓ kept" : "↺ rolled back") : "";
        s.verdict.setAttribute("fill", kept ? C.green : C.rust);
      }
    }
  };

  // one line: the stage name, its one-line description, and Resume when a stage was chosen by hand
  train.innerHTML = `<p class="aip-train-head"><button type="button" class="aip-resume" hidden>Resume</button>` +
    `<span class="aip-train-name"></span> <span class="aip-train-desc"></span></p><div class="aip-train-fig"></div>`;
  const tName = train.querySelector(".aip-train-name"), tDesc = train.querySelector(".aip-train-desc"),
    tFig = train.querySelector(".aip-train-fig"), resumeBtn = train.querySelector(".aip-resume");
  let cur = null, curState = null, curW = 0;
  function showPanel(id) {
    const W = Math.max(240, tFig.clientWidth || 300), N = W < 420;
    if (id === cur && W === curW) return;
    cur = id; curW = W;
    const P = PANELS[id];
    tName.textContent = P.name; tDesc.textContent = P.desc;
    const svg = el("svg", { width: W, role: "img", "aria-label": P.name + ": " + P.desc });
    const g = el("g", { transform: "translate(0,2)" }, svg);
    tFig.textContent = ""; tFig.appendChild(svg);
    curState = P.build(g, W, N);
    svg.setAttribute("height", curState.H + 6); svg.setAttribute("viewBox", `0 0 ${W} ${curState.H + 6}`);
  }

  /* ---------- state, clicks and the clock ---------- */
  const hm = location.hash;
  const ht = hm.match(/t=([\d.]+)/), hs = hm.match(/stage=(\w+)/), hp = hm.match(/p=([\d.]+)/);
  let t = ht ? parseFloat(ht[1]) : 0, last = null, raf = 0, visible = true;
  let manual = hs && PANELS[hs[1]] ? hs[1] : null, mp = hp ? parseFloat(hp[1]) : 0;
  const fixed = !!(ht || hs) || reduce;
  if (reduce && !ht) t = T.faith + 3.4;
  if (manual && !ht) t = T.ok + .5;

  function render() {
    const sess = renderSession(t, !!manual);
    const seg = segAt(t), act = manual || seg[0];
    Object.keys(stageEl).forEach(k => {
      stageEl[k].classList.toggle("is-on", k === act);
      stageEl[k].setAttribute("aria-pressed", String(k === manual));
    });
    renderWires(t, manual ? null : act, sess);
    showPanel(act);
    const P = PANELS[act];
    let p = manual ? mp : t - seg[1];
    if (reduce) p = P.period - .01;
    else if (manual) p = p % P.period;
    else p = Math.min(p, P.period - .01) % P.period;
    P.update(curState, p);
    resumeBtn.hidden = !manual;
  }
  /* ---------- fixed height at a given width ----------
     Measure every state once (the code box over the whole session, each stage's panel, the stage line),
     reserve the tallest of each part, then render the current moment again. Redone on resize. */
  const fileEl = code.querySelector(".aip-file");
  let fitW = -1;
  function fit() {
    const w = root.clientWidth;
    if (!w || w === fitW) return;
    fitW = w;
    const parts = [fileEl, src, train, strip], max = parts.map(() => 0);
    const measure = (...ix) => ix.forEach(i => (max[i] = Math.max(max[i], parts[i].getBoundingClientRect().height)));
    parts.forEach(e => (e.style.minHeight = "0px"));
    // the whole session every 0.1 s, with and without the caret, and finely where line 9 finishes
    // typing while the messages above it collapse (the tallest moment lasts only a few frames)
    const ts = [];
    for (let x = T.lines[5][0]; x <= T.reward + .5; x += .1) ts.push(x);
    for (let x = T.l9b; x <= T.collapse + .45; x += .01) ts.push(x);
    ts.forEach(x => [true, false].forEach(m => { renderSession(x, m); measure(0, 1); }));
    // the panel as a whole: its tallest stage, with and without Resume showing; the stage line with any stage pressed
    [true, false].forEach(h => { resumeBtn.hidden = h; Object.keys(PANELS).forEach(id => { cur = null; showPanel(id); measure(2); }); });
    Object.keys(stageEl).forEach(k => { stageEl[k].classList.add("is-on"); measure(3); stageEl[k].classList.remove("is-on"); });
    parts.forEach((e, i) => (e.style.minHeight = Math.ceil(max[i]) + "px"));
    cur = null; render();
  }
  function frame(now) {
    raf = 0;
    const dt = last != null ? Math.min(.1, (now - last) / 1000) : 0; last = now;
    if (manual) mp += dt; else { t += dt; if (t > T.loop) t = 0; }
    render();
    if (visible && !fixed) raf = requestAnimationFrame(frame);
  }
  const kick = () => { if (!raf && visible && !fixed) { last = null; raf = requestAnimationFrame(frame); } };
  strip.addEventListener("click", e => {
    const b = e.target.closest(".aip-stage"); if (!b) return;
    const id = b.dataset.s;
    if (manual === id) manual = null; else { manual = id; mp = 0; }
    render(); kick();
  });
  resumeBtn.addEventListener("click", () => { manual = null; render(); kick(); stageEl[segAt(t)[0]].focus(); });
  function start() {
    fit(); render();
    if (fixed) return;
    new IntersectionObserver(es => { visible = es[0].isIntersecting; kick(); }).observe(root);
  }
  addEventListener("resize", () => { lastHTML = ""; cur = null; fit(); render(); });
  (document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve()).then(start);
})();
