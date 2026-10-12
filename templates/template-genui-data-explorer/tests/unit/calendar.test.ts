import { describe, expect, it } from "vitest";
import { createMetadata } from "../../scripts/generate.ts";
import {
  dateOnly,
  shiftDays,
  shiftMonths,
  coverageReason,
  samplePrompts,
} from "../../data-sources/sales/calendar.ts";

describe("UTC complete-month calendar", () => {
  it("freezes exactly the preceding 24 complete months", () => {
    const metadata = createMetadata(new Date("2026-10-04T12:34:56Z"), 1729);
    expect(metadata.coverage).toEqual({ start: "2024-10-01", end: "2026-10-01" });
    expect(metadata.asOf).toBe("2026-09-30");
    expect(metadata.anchor).toBe("2026-10-04T12:34:56.000Z");
    expect(createMetadata(new Date("2028-03-01T00:00:00Z"), 0).asOf).toBe("2028-02-29");
  });
  it("preserves valid calendar boundaries", () => {
    expect(shiftMonths("2024-02-29", -12)).toBe("2023-02-28");
    expect(shiftMonths("2024-01-31", 1)).toBe("2024-02-29");
    expect(shiftDays("2024-02-29", 1)).toBe("2024-03-01");
    for (const invalid of ["2024-02-30", "2023-02-29", "2025-13-01", "01/01/2025"])
      expect(() => dateOnly(invalid)).toThrow();
    expect(() => createMetadata(new Date("invalid"), 1)).toThrow();
    expect(() => createMetadata(new Date(), -1)).toThrow();
  });
  it("declares missing coverage and derives usable prompts in later years", () => {
    const metadata = createMetadata(new Date("2035-07-10T00:00:00Z"), 1);
    expect(coverageReason(metadata, { start: "2025-01-01", end: "2026-01-01" })).toContain(
      "Insufficient history",
    );
    expect(samplePrompts(metadata)[0]).toContain("2034-07-01");
    expect(samplePrompts(metadata)[0]).toContain("2035-06-30");
    expect(() => coverageReason(metadata, { start: "2034-01-01", end: "2034-01-01" })).toThrow();
  });
});
