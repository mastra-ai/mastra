import { describe, expect, it } from "vitest";
import { renderGroundedSupportResponse } from "../../src/mastra/domain/customer-response";
import { triageEscalationReason } from "../../src/mastra/domain/resolution-decision";
import type { SupportCase } from "../../src/mastra/domain/support-case";

const supportCase = (overrides: Partial<SupportCase> = {}): SupportCase => ({
  id: "case_1",
  externalId: "event_1",
  source: "chat",
  customer: { email: "alex@example.com" },
  subject: "Duplicate charge",
  messages: [],
  status: "processing",
  createdAt: "2026-09-01T00:00:00.000Z",
  updatedAt: "2026-09-01T00:00:00.000Z",
  metadata: {},
  policyMatches: [
    {
      title: "Duplicate Charge Policy",
      source: "duplicate-charge-policy",
      text: "# Duplicate Charge Policy\n\nDuplicate charges happen after a retry.\n\n- Always confirm the charge count on the order record before recommending a refund.\n- The extra charge is eligible for review.",
      score: 1,
    },
  ],
  orderLookup: {
    found: true,
    order: {
      orderId: "ORD-1001",
      customerEmail: "alex@example.com",
      product: "Pro Plan",
      amount: 49,
      currency: "USD",
      status: "fulfilled",
      chargeCount: 2,
      placedAt: "2026-09-01T00:00:00.000Z",
    },
  },
  ...overrides,
});

describe("resolution decision safety", () => {
  it("gives triage review precedence and retains the triage rationale", () => {
    expect(
      triageEscalationReason({
        intent: "other",
        urgency: "critical",
        sentiment: "angry",
        requiresHumanReview: true,
        confidence: 0.1,
        rationale: "The customer reports possible fraud.",
      }),
    ).toBe(
      "Triage requires human review: The customer reports possible fraud.",
    );
  });

  it("renders an applicable cited policy clause and verified order status", () => {
    expect(
      renderGroundedSupportResponse(supportCase(), [
        {
          source: "duplicate-charge-policy",
          excerpt:
            "Always confirm the charge count on the order record before recommending a refund.",
        },
      ]),
    ).toContain("Always confirm the charge count");
    expect(
      renderGroundedSupportResponse(supportCase(), [
        {
          source: "duplicate-charge-policy",
          excerpt:
            "Always confirm the charge count on the order record before recommending a refund.",
        },
      ]),
    ).toContain("ORD-1001");
  });

  it("does not claim a refund from an order status without a durable receipt", () => {
    const response = renderGroundedSupportResponse(
      supportCase({
        orderLookup: {
          found: true,
          order: {
            ...supportCase().orderLookup!.order!,
            status: "refunded",
          },
        },
      }),
      [
        {
          source: "duplicate-charge-policy",
          excerpt:
            "Always confirm the charge count on the order record before recommending a refund.",
        },
      ],
    );
    expect(response).not.toContain("currently recorded as refunded");
    expect(response).not.toMatch(/refund.*issued/i);
  });
});
