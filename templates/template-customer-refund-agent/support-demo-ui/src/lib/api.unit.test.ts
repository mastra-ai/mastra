import { describe, expect, it } from "vitest";
import { isCaseActive } from "./api";

describe("case activity", () => {
  it("polls only the case states that can still change", () => {
    expect(isCaseActive("new")).toBe(true);
    expect(isCaseActive("processing")).toBe(true);
    expect(isCaseActive("waiting_approval")).toBe(true);
    expect(isCaseActive("resolved")).toBe(false);
    expect(isCaseActive("escalated")).toBe(false);
    expect(isCaseActive("failed")).toBe(false);
  });
});
