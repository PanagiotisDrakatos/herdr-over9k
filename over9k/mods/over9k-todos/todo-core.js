// The pure core of the To-do list format and its on-screen grouping, kept free of
// Herdr calls so it can be tested headlessly (bun test todo-core.test.js). The mod
// (main.js) imports these; todo.sh writes the same lines.
//
// An item is one line: "- [ ] text <!-- due: ... --> <!-- branch: ... --> <!-- wt: ... -->".
// `branch` is the git branch todo.sh ran on, `wt` the worktree's own folder (a worktree
// resolves to its main checkout's list, so without these the list mixes branches).
// `wt` is what "Send all" and the repo lookup use, so two projects on the same branch
// never reach each other's agents.

export const ITEM = /^- \[( |x)\] (.*)$/;

export function parseLine(text) {
  const due = /<!-- due: ([^>]*?) -->/.exec(text)?.[1] ?? null;
  const done = /<!-- done: ([^>]*?) -->/.exec(text)?.[1] ?? null;
  const branch = /<!-- branch: ([^>]*?) -->/.exec(text)?.[1] ?? null;
  const wt = /<!-- wt: ([^>]*?) -->/.exec(text)?.[1] ?? null;
  return { text: text.replace(/\s*<!--[^>]*-->/g, "").trim(), due, doneOn: done, branch, wt };
}

export const line = (i) => `- [${i.done ? "x" : " "}] ${i.text.replace(/\n/g, " ")}${i.due ? ` <!-- due: ${i.due} -->` : ""}${i.branch ? ` <!-- branch: ${i.branch} -->` : ""}${i.wt ? ` <!-- wt: ${i.wt} -->` : ""}${i.done && i.doneOn ? ` <!-- done: ${i.doneOn} -->` : ""}`;

export const serialize = (folder, items, skipped = [], opts = {}) => `<!-- folder: ${folder} -->\n${opts.set?.log ? `<!-- log: ${opts.log ? "on" : "off"} -->\n` : ""}${opts.set?.sync ? `<!-- sync: ${opts.sync ? "on" : "off"} -->\n` : ""}${skipped.map((x) => `<!-- skip: ${x.replace(/-->/g, "")} -->\n`).join("")}${items.map(line).join("\n")}${items.length ? "\n" : ""}`;

// Open items as shown: foldable branch groups. In All a group is a project+branch, so
// two projects on the same branch never share one. Display only — the file's order and
// the `#n` numbers (the item's index in its file) are untouched, `todo done <n>` holds.
export function groupsOf(list, filter) {
  const gkey = (x) => (filter ? x.branch ?? "" : `${x.slug}|${x.branch ?? ""}`);
  const groups = [];
  for (const x of list) {
    const k = gkey(x);
    let g = groups.find((y) => y.key === k);
    if (!g) groups.push((g = { key: k, branch: x.branch ?? null, slug: x.slug, items: [] }));
    g.items.push(x);
  }
  return groups;
}

// What the screen shows and shift+click ranges follow: open groups in screen order
// (folded ones drop out), then the done ones (not while their section is folded).
export const visibleOrder = (groups, folded, done, doneShown = 5, doneFolded = false) => [
  ...groups.filter((g) => !folded.has(g.key)).flatMap((g) => g.items),
  ...(doneFolded ? [] : done.slice(0, doneShown)),
];

// Agents already running in `folder` (an agent's pane cwd is the folder or under
// it), the exact folder first so a checkout never absorbs a nested worktree's
// agent; the one you were last in first. Pure (agents/panes are passed in) so
// bun test can drive it; main.js's runningIn delegates here.
export function runningInAgents(folder, agents, panes, lastAgent = null) {
  if (!folder) return [];
  const cwdOf = (a) => (panes.find((p) => p.terminal === a.address)?.cwd ?? "").replace(/\/+$/, "");
  const inFolder = agents.filter((a) => {
    const c = cwdOf(a);
    return c === folder || c.startsWith(folder + "/");
  });
  const exact = inFolder.filter((a) => cwdOf(a) === folder);
  return (exact.length ? exact : inFolder).sort((a, b) => (b.address === lastAgent) - (a.address === lastAgent));
}
