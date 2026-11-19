/* Layered DAG layout shared by the replay and blueprint views.
   Edge [a, b, type] means a uses b; b is drawn above a. */
window.layoutDag = function (run, opt) {
  const names = run.nodes.map(n => n.name);
  const deps = {}, users = {};
  names.forEach(n => { deps[n] = []; users[n] = []; });
  run.edges.forEach(([a, b]) => { deps[a].push(b); users[b].push(a); });

  // longest path from sources, then pull each node down to just above its first user
  const L = {};
  const lay = (n, seen) => {
    if (L[n] !== undefined) return L[n];
    seen = seen || new Set(); seen.add(n);
    let v = 0;
    deps[n].forEach(b => { if (!seen.has(b)) v = Math.max(v, lay(b, seen) + 1); });
    return (L[n] = v);
  };
  names.forEach(n => lay(n));
  const order = names.slice().sort((a, b) => L[b] - L[a]);
  order.forEach(n => { if (users[n].length) L[n] = Math.min(...users[n].map(u => L[u])) - 1; });

  const maxL = Math.max(...names.map(n => L[n]));
  const rows = [];
  for (let i = 0; i <= maxL; i++) rows.push(names.filter(n => L[n] === i));

  // barycenter ordering sweeps
  const pos = {};
  rows.forEach(r => r.forEach((n, i) => (pos[n] = i)));
  const bary = (n, nb) => nb.length ? nb.reduce((s, m) => s + pos[m], 0) / nb.length : pos[n];
  for (let it = 0; it < 12; it++) {
    const down = it % 2 === 0;
    const seq = down ? rows.slice(1) : rows.slice(0, -1).reverse();
    seq.forEach(r => {
      r.sort((a, b) => bary(a, down ? deps[a] : users[a]) - bary(b, down ? deps[b] : users[b]));
      r.forEach((n, i) => (pos[n] = i));
    });
  }

  const W = opt.colW * Math.max(...rows.map(r => r.length));
  const xy = {};
  rows.forEach((r, li) => {
    const span = (r.length - 1) * opt.colW;
    r.forEach((n, i) => { xy[n] = { x: W / 2 - span / 2 + i * opt.colW + opt.pad, y: opt.pad + li * opt.rowH }; });
  });
  return { xy, rows, deps, users, width: W + opt.pad * 2, height: opt.pad * 2 + maxL * opt.rowH };
};

window.splitName = function (name, max) {
  if (name.length <= max) return [name];
  if (!name.includes("_")) {               // camelCase: break at the capital nearest the middle
    let best = -1;
    for (let i = 1; i < name.length; i++) if (/[A-Z]/.test(name[i]) && (best < 0 || Math.abs(i - name.length / 2) < Math.abs(best - name.length / 2))) best = i;
    if (best > 0) return [name.slice(0, best), name.slice(best)];
  }
  const parts = name.split("_");
  let a = "", i = 0;
  while (i < parts.length && (a + (a ? "_" : "") + parts[i]).length <= Math.ceil(name.length / 2) + 2) { a += (a ? "_" : "") + parts[i]; i++; }
  if (!a) { a = parts[0]; i = 1; }
  return [a + "_", parts.slice(i).join("_")];
};
