import { describe, expect, it } from "vitest";
import { isCaseActive } from "./api";

describe("local UI evaluation compatibility", () => {
  it("stops polling a completed or escalated local case", () => {
    expect(isCaseActive("resolved")).toBe(false);
    expect(isCaseActive("escalated")).toBe(false);
  });
});
