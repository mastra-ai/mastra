import { describe, it, expect } from "vitest";
import type { Element } from "hast";
import { areNodesEqual } from "./memoization";

const createNode = (overrides: Partial<Element> = {}): Element => ({
  type: "element",
  tagName: "p",
  properties: { className: "foo" },
  children: [],
  ...overrides,
});

describe("areNodesEqual", () => {
  it("returns false if either node is undefined", () => {
    expect(areNodesEqual(undefined, createNode())).toBe(false);
    expect(areNodesEqual(createNode(), undefined)).toBe(false);
  });

  it("ignores position when comparing properties", () => {
    const prev = createNode({ properties: { className: "foo", position: 1 } });
    const next = createNode({ properties: { className: "foo", position: 2 } });
    expect(areNodesEqual(prev, next)).toBe(true);
  });

  it("detects differences in children", () => {
    const prev = createNode({
      children: [{ type: "text", value: "a" }] as any,
    });
    const next = createNode({
      children: [{ type: "text", value: "b" }] as any,
    });
    expect(areNodesEqual(prev, next)).toBe(false);
  });
});
