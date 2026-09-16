import { describe, expect, it } from "vitest";
import { mockSupportAdapter } from "../fixtures/mock-support";

describe("mock support adapter", () => {
  it("normalizes a synthetic inbound email into the useful baseline case shape", async () => {
    const normalized = await mockSupportAdapter.normalizeInbound({
      externalId: "characterization-email-1",
      from: "alex@example.test",
      fromName: "Alex",
      subject: "Duplicate charge",
      body: "I was charged twice.",
      receivedAt: "2026-09-04T00:00:00.000Z",
    });

    expect(normalized).toMatchObject({
      externalId: "characterization-email-1",
      source: "mock-email",
      customer: { email: "alex@example.test", name: "Alex" },
      subject: "Duplicate charge",
    });
    expect(normalized.messages).toHaveLength(1);
    expect(normalized.messages[0]).toMatchObject({
      author: "customer",
      body: "I was charged twice.",
    });
  });

  it("rejects an incomplete mock payload", async () => {
    await expect(
      mockSupportAdapter.normalizeInbound({ from: "alex@example.test" }),
    ).rejects.toThrow("Invalid mock email payload");
  });
});
