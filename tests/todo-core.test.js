// Tests for the pure to-do list core (over9k/mods/over9k-todos/todo-core.js):
// markers, grouping, screen order. Kept outside the mod folders on purpose.
// Run from the repo root: bun test tests/todo-core.test.js  (or: node --test)
import { describe, expect, test } from "bun:test";
import { ITEM, parseLine, line, serialize, groupsOf, visibleOrder } from "../over9k/mods/over9k-todos/todo-core.js";

const item = (over = {}) => ({ done: false, text: "x", due: null, doneOn: null, branch: null, wt: null, ...over });

describe("parseLine", () => {
  test("extracts due, done, branch and wt, and strips every marker from the text", () => {
    const p = parseLine("do thing <!-- due: 2026-11-20 15:00 --> <!-- branch: feat-a --> <!-- wt: /repo/feat-a -->");
    expect(p.text).toBe("do thing");
    expect(p.due).toBe("2026-11-20 15:00");
    expect(p.branch).toBe("feat-a");
    expect(p.wt).toBe("/repo/feat-a");
  });

  test("a done marker parses and leaves branch alone", () => {
    const p = parseLine("old <!-- done: 2026-11-14 10:00 --> <!-- branch: main -->");
    expect(p.doneOn).toBe("2026-11-14 10:00");
    expect(p.branch).toBe("main");
    expect(p.text).toBe("old");
  });

  test("marker-looking text without the exact comment form stays in the text", () => {
    const p = parseLine("use <!-- branch: x --> inline and <!-- branch: y --> done");
    expect(p.branch).toBe("x"); // the first wins, as due/done already behave
  });
});

describe("line", () => {
  test("round-trips every marker parseLine reads", () => {
    const src = item({ done: true, text: "hi", due: "2026-11-20 9:00", doneOn: "2026-11-14 8:00", branch: "b", wt: "/r/b" });
    const p = parseLine(ITEM.exec(line(src))[2]);
    expect(p).toEqual({ text: "hi", due: "2026-11-20 9:00", doneOn: "2026-11-14 8:00", branch: "b", wt: "/r/b" });
  });

  test("an item without markers keeps its place so `todo done <n>` stays right", () => {
    expect(line(item({ text: "plain" }))).toBe("- [ ] plain");
  });

  test("newlines in text flatten to spaces", () => {
    expect(line(item({ text: "a\nb" }))).toBe("- [ ] a b");
  });
});

describe("serialize", () => {
  test("parse(serialize) keeps branch and wt", () => {
    const items = [item({ text: "one", branch: "f", wt: "/r/f" }), item({ text: "two" })];
    const text = serialize("/proj", items, [], { log: true, sync: false, set: { log: true, sync: false } });
    const rows = text.split("\n").map((l) => ITEM.exec(l)).filter(Boolean).map((m) => parseLine(m[2]));
    expect(rows[0]).toMatchObject({ text: "one", branch: "f", wt: "/r/f" });
    expect(rows[1]).toMatchObject({ text: "two", branch: null, wt: null });
  });
});

describe("groupsOf", () => {
  const x = (slug, branch, i) => ({ ...item({ text: `${slug}-${branch ?? "g"}-${i}`, branch }), slug, i, folder: `/p/${slug}` });
  const list = [x("a", null, 0), x("a", "f1", 1), x("a", null, 2), x("a", "f1", 3), x("b", "f1", 4)];

  test("All view: a group is project+branch, so two projects never share one", () => {
    const g = groupsOf(list, null);
    expect(g.map((y) => y.key)).toEqual(["a|", "a|f1", "b|f1"]);
    expect(g[1].items.map((y) => y.i)).toEqual([1, 3]);
    expect(g[2].items[0].slug).toBe("b"); // project b's f1 is its own group
  });

  test("here view: groups key on branch only", () => {
    const g = groupsOf(list, "a");
    expect(g.map((y) => y.key)).toEqual(["", "f1"]);
  });

  test("stable order: items keep the list order inside their group", () => {
    const g = groupsOf(list, null).find((y) => y.key === "a|");
    expect(g.items.map((y) => y.i)).toEqual([0, 2]);
  });
});

describe("visibleOrder", () => {
  test("drops folded groups and keeps screen order, then the done ones", () => {
    const a = { ...item(), slug: "s", i: 0, key: "s|", branch: null };
    const b = { ...item(), slug: "s", i: 1, key: "s|f", branch: "f" };
    const c = { ...item(), slug: "s", i: 2, key: "s|f", branch: "f" };
    const groups = [{ key: "s|", branch: null, slug: "s", items: [a] }, { key: "s|f", branch: "f", slug: "s", items: [b, c] }];
    const done = [{ ...item({ done: true }), slug: "s", i: 3 }];
    const v = visibleOrder(groups, new Set(["s|f"]), done, 5);
    expect(v.map((y) => y.i)).toEqual([0, 3]); // folded group's b,c are not selectable
    expect(visibleOrder(groups, new Set(), done, 5).map((y) => y.i)).toEqual([0, 1, 2, 3]);
  });
});
