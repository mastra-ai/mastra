import { afterEach, describe, expect, it } from "vitest";
import type { SupportCase } from "../../src/mastra/domain/support-case";
import {
  cancellationAuthority,
  cancellationMessageHash,
  explicitNoRefundCancellation,
} from "../../src/mastra/workflows/staging-cancellation-authority";

const originalMode = process.env.APP_MODE;
const originalSupportSource = process.env.SUPPORT_SOURCE;
const originalCommerceSource = process.env.COMMERCE_SOURCE;
const message =
  "Hey, please cancel my subscription when it renews. I don’t want a refund; please keep access until then.";
const binding = {
  tenantId: "local-demo",
  providerKind: "stripe" as const,
  providerAccountId: "acct_test_123",
  externalConversationId: "conversation-1",
};
const turn = { id: "turn-1", message: { id: "message-1", body: message } };

function supportCase(interpretation?: Record<string, unknown>): SupportCase {
  return {
    id: "case-1",
    externalId: "conversation-1",
    source: "intercom-conversation",
    customer: { email: "jordan@example.com" },
    subject: "Cancel",
    messages: [],
    status: "processing",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    metadata: {
      providerBindings: {
        support: {
          ...binding,
          providerKind: "intercom",
          providerAccountId: "app",
        },
        commerce: binding,
        transactions: binding,
        knowledge: binding,
      },
      ...(interpretation
        ? {
            stagingCancellationInterpretation: {
              directCancellationRequested: true,
              atPeriodEnd: true,
              explicitNoRefund: true,
              hasNegationQuoteConflictOrAmbiguity: false,
              evidenceVerbatim: [
                "cancel my subscription when it renews",
                "don’t want a refund",
              ],
              confidence: 0.95,
              turnId: turn.id,
              messageId: turn.message.id,
              messageHash: cancellationMessageHash(turn.message.body),
              binding,
              interpretedAt: "2026-01-01T00:00:00.000Z",
              ...interpretation,
            },
          }
        : {}),
    },
  } as SupportCase;
}

afterEach(() => {
  if (originalMode === undefined) delete process.env.APP_MODE;
  else process.env.APP_MODE = originalMode;
  if (originalSupportSource === undefined) delete process.env.SUPPORT_SOURCE;
  else process.env.SUPPORT_SOURCE = originalSupportSource;
  if (originalCommerceSource === undefined) delete process.env.COMMERCE_SOURCE;
  else process.env.COMMERCE_SOURCE = originalCommerceSource;
});

describe("staging cancellation authority", () => {
  it("accepts Jordan's direct period-end no-refund request only in staging", () => {
    process.env.APP_MODE = "staging";
    expect(cancellationAuthority(supportCase({}), turn)).toBe(true);
    process.env.APP_MODE = "local";
    expect(cancellationAuthority(supportCase({}), turn)).toBe(false);
    expect(explicitNoRefundCancellation(turn.message!.body)).toBe(false);
  });

  it("does not authorize a staging case without an interpretation", () => {
    process.env.APP_MODE = "staging";
    expect(cancellationAuthority(supportCase(), turn)).toBe(false);
  });

  it("keeps legacy inferred staging on the original regex authority", () => {
    delete process.env.APP_MODE;
    process.env.SUPPORT_SOURCE = "intercom";
    process.env.COMMERCE_SOURCE = "stripe";
    expect(cancellationAuthority(supportCase({}), turn)).toBe(false);
  });

  it.each([
    ["cancellation negation", { directCancellationRequested: false }],
    ["immediate cancellation", { atPeriodEnd: false }],
    ["refund request", { explicitNoRefund: false }],
    ["quoted or ambiguous", { hasNegationQuoteConflictOrAmbiguity: true }],
    ["low confidence", { confidence: 0.89 }],
    ["stale turn", { turnId: "turn-old" }],
    ["stale hash", { messageHash: "stale" }],
    ["stale binding", { binding: { ...binding, providerAccountId: "other" } }],
    ["missing evidence", { evidenceVerbatim: [] }],
  ])("rejects %s", (_name, interpretation) => {
    process.env.APP_MODE = "staging";
    expect(cancellationAuthority(supportCase(interpretation), turn)).toBe(
      false,
    );
  });
});
