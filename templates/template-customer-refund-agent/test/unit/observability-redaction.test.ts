import { describe, expect, it } from "vitest";
import {
  redactObservabilityMessage,
  redactObservabilityValue,
} from "../../src/mastra/lib/observability-redaction";

describe("observability redaction", () => {
  it("keeps allowlisted operational codes and correlation identifiers", () => {
    expect(
      redactObservabilityMessage("Local runtime recovery sweep failed."),
    ).toBe("runtime.recovery.sweep.failed");
    expect(
      redactObservabilityValue({
        caseId: "case-123",
        runId: "run-123",
        error: new TypeError("customer alex@example.com said secret=abc"),
      }),
    ).toEqual({
      caseId: "case-123",
      runId: "run-123",
      error: { category: "TypeError", message: "[REDACTED:CONTENT]" },
    });
  });

  it("does not turn arbitrary customer prose into an event code", () => {
    expect(redactObservabilityMessage("alex@example.com needs a refund")).toBe(
      "[REDACTED:CONTENT]",
    );
    expect(
      redactObservabilityValue({
        body: "my card number is 4111 1111 1111 1111",
        cause: "Bearer private-token",
      }),
    ).toEqual({ body: "[REDACTED:CONTENT]", cause: "[REDACTED:CONTENT]" });
  });

  it("keeps only allowlisted storage failure codes", () => {
    const error = Object.assign(new Error("cannot open customer path"), {
      code: "SQLITE_CANTOPEN",
    });
    expect(
      redactObservabilityMessage("Mastra storage initialization failed."),
    ).toBe("storage.initialization.failed");
    expect(redactObservabilityValue({ error })).toEqual({
      error: {
        category: "Error",
        code: "SQLITE_CANTOPEN",
        message: "[REDACTED:CONTENT]",
      },
    });
  });
});
