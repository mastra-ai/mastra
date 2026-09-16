import { describe, expect, it } from "vitest";
import {
  publicSupportCaseSchema,
  supportCaseSchema,
} from "../../src/mastra/domain/support-case";

describe("support case schema", () => {
  it("rejects an invalid customer email at the domain boundary", () => {
    const result = supportCaseSchema.safeParse({
      id: "case-1",
      externalId: "external-1",
      source: "mock-email",
      customer: { email: "not-an-email" },
      subject: "Help",
      messages: [],
      status: "new",
      createdAt: "2026-09-04T00:00:00.000Z",
      updatedAt: "2026-09-04T00:00:00.000Z",
    });

    expect(result.success).toBe(false);
  });

  it("accepts a partial refund command only on a marked retention tombstone", () => {
    const base = {
      id: "case-metadata",
      externalId: "external-metadata",
      source: "mock-email" as const,
      customer: { email: "customer@example.test" },
      subject: "Help",
      messages: [],
      status: "failed" as const,
      createdAt: "2026-09-04T00:00:00.000Z",
      updatedAt: "2026-09-04T00:00:00.000Z",
    };
    expect(
      supportCaseSchema.safeParse({
        ...base,
        metadata: { refundCommand: { fingerprint: "retained" } },
      }).success,
    ).toBe(false);
    expect(
      supportCaseSchema.safeParse({
        ...base,
        metadata: {
          retentionRedactedAt: "2026-09-05T00:00:00.000Z",
          refundCommand: { fingerprint: "retained" },
        },
      }).success,
    ).toBe(true);
  });

  it("makes the public metadata projection fingerprint-only", () => {
    const result = publicSupportCaseSchema.safeParse({
      id: "case-public",
      externalId: "external-public",
      source: "mock-email",
      customer: { email: "customer@example.test" },
      subject: "Help",
      messages: [],
      status: "waiting_approval",
      createdAt: "2026-09-04T00:00:00.000Z",
      updatedAt: "2026-09-04T00:00:00.000Z",
      metadata: { refundCommand: { fingerprint: "fingerprint" } },
    });
    expect(result.success).toBe(true);
    expect(
      publicSupportCaseSchema.safeParse({
        ...result.data,
        metadata: { refundCommand: { fingerprint: "x", orderId: "ORD-1" } },
      }).success,
    ).toBe(true);
    expect(result.data?.metadata).toEqual({
      refundCommand: { fingerprint: "fingerprint" },
    });
  });
});
