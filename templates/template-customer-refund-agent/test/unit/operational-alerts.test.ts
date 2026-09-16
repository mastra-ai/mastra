import { describe, expect, it } from "vitest";
import {
  alertReasons,
  classifyFailure,
} from "../../src/mastra/lib/operational-alerts";

describe("operational alert policy", () => {
  it("alerts for any refund failure, >2% errors, and p95 over five seconds", () => {
    const now = new Date("2026-01-01T00:00:00.000Z");
    const signals = Array.from({ length: 100 }, (_, index) => ({
      providerOrTool: "lookup",
      occurredAt: now,
      durationMs: index >= 94 ? 5_001 : 10,
      failed: index === 0,
    }));
    expect(alertReasons(signals, now)).toContain("p95-latency");
    expect(classifyFailure({ ...signals[0]!, refundFailure: true })).toBe(
      "escalate",
    );
    expect(classifyFailure(signals[0]!)).toBe("retry");
    expect(
      alertReasons(
        [
          ...signals,
          {
            providerOrTool: "refund",
            occurredAt: now,
            durationMs: 1,
            failed: true,
            refundFailure: true,
          },
        ],
        now,
      ),
    ).toContain("refund-failure");
  });

  it("keeps exact threshold and 15-minute boundaries deterministic", () => {
    const now = new Date("2026-01-01T00:15:00.000Z");
    const exactlyTwoPercent = Array.from({ length: 100 }, (_, index) => ({
      providerOrTool: "provider",
      occurredAt: new Date("2026-01-01T00:00:00.000Z"),
      durationMs: index >= 95 ? 5_000 : 1,
      failed: index < 2,
    }));
    expect(alertReasons(exactlyTwoPercent, now)).toEqual([]);
    expect(
      alertReasons(
        [
          ...exactlyTwoPercent,
          {
            providerOrTool: "provider",
            occurredAt: new Date("2025-12-31T23:59:59.999Z"),
            durationMs: 9_999,
            failed: true,
          },
        ],
        now,
      ),
    ).toEqual([]);
    expect(
      classifyFailure({ ...exactlyTwoPercent[0]!, durationMs: 5_001 }),
    ).toBe("escalate");
  });
});
