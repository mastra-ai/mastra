import { describe, expect, it } from "vitest";
import { mockEmailPayloadSchema } from "../../../src/mastra/server/contracts";

describe("shared frontend DTO contract", () => {
  it("rejects incomplete input before it can become a valid API request", () => {
    expect(
      mockEmailPayloadSchema.safeParse({ from: "alex@example.test" }).success,
    ).toBe(false);
  });
});
