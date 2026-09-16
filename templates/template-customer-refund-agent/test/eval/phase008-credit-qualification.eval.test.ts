import { describe, expect, it } from "vitest";
import { renderGroundedSupportResponse } from "../../src/mastra/domain/customer-response";
import type { SupportCase } from "../../src/mastra/domain/support-case";

const serviceProblemPolicy = {
  title: "Service Problem Credit Policy",
  source: "service-problem-credit-policy",
  text: "For a verified service problem on one active monthly subscription, support may propose one credit equal to that subscription's single monthly charge.",
  score: 1,
  version: "local-v1",
  documentHash: "phase008-credit-policy",
  generationId: "phase008-credit-generation",
  effectiveAt: "2026-01-01T00:00:00.000Z",
  indexedAt: "2026-01-01T00:00:00.000Z",
  providerKind: "local" as const,
  providerAccountId: "local-demo",
};

function creditCase(policyMatches: SupportCase["policyMatches"]): SupportCase {
  return {
    id: "phase008-credit-case",
    externalId: "phase008-credit-event",
    source: "mock-email",
    customer: { email: "alex@example.com" },
    subject: "Service outage",
    messages: [],
    status: "processing",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    metadata: {},
    policyMatches,
    subscriptionLookup: {
      found: true,
      subscription: {
        subscriptionId: "SUB-1001",
        customerId: "local:local-demo:alex@example.com",
        customerEmail: "alex@example.com",
        plan: "Pro",
        recurringInterval: "month",
        recurringIntervalCount: 1,
        quantity: 1,
        amount: 49,
        currency: "USD",
        status: "active",
        renewsAt: "2026-02-01T00:00:00.000Z",
      },
    },
  } as SupportCase;
}

describe("Phase 008 subscription-credit deterministic evaluation", () => {
  it("renders only the published credit guidance and current subscription state", () => {
    const response = renderGroundedSupportResponse(
      creditCase([serviceProblemPolicy]),
      [
        {
          source: "service-problem-credit-policy",
          excerpt: serviceProblemPolicy.text,
        },
      ],
    );

    expect(response).toContain("published Service Problem Credit Policy");
    expect(response).toContain(
      "Pro subscription is currently recorded as active",
    );
    expect(response).not.toMatch(/already paid|free month|has been added/i);
  });

  it("does not render an ungrounded credit-policy excerpt as customer guidance", () => {
    const response = renderGroundedSupportResponse(creditCase([]), [
      {
        source: "service-problem-credit-policy",
        excerpt: serviceProblemPolicy.text,
      },
    ]);
    expect(response).toBe(
      "Your Pro subscription is currently recorded as active.",
    );
    expect(response).not.toContain("monthly charge");
  });
});
