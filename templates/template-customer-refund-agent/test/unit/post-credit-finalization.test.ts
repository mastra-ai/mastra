import { describe, expect, it, vi } from "vitest";
import type { SupportCase } from "../../src/mastra/domain/support-case";

const store = {
  turns: vi.fn(),
  getAction: vi.fn(),
  approvalDecision: vi.fn(),
  idempotency: vi.fn(),
  finalizeCaseAndEnqueue: vi.fn(),
};
const getActiveCaseOrThrow = vi.fn();
const deliverOutbox = vi.fn();

vi.mock("../../src/mastra/lib/case-store", () => ({ caseStore: store }));
vi.mock("../../src/mastra/workflows/resolve-support-case-context", () => ({
  getActiveCaseOrThrow,
}));
vi.mock("../../src/mastra/runtime/outbox", () => ({ deliverOutbox }));
vi.mock("../../src/mastra/providers/registry", () => ({
  resolveConfiguredBinding: vi.fn(() => ({
    tenantId: "tenant-synthetic",
    providerKind: "local",
    providerAccountId: "local-synthetic",
    externalConversationId: "conversation-synthetic",
  })),
  providerRegistry: vi.fn(() => ({
    support: () => ({ planFinalizationOutbox: () => undefined }),
  })),
}));

const { priorSubscriptionCreditStatusResponse } =
  await import("../../src/mastra/workflows/resolve-support-case-finalize");
const { resolveCaseStep } =
  await import("../../src/mastra/workflows/resolve-support-case-finalize");

const command = {
  approvalCaseId: "case-credit-status",
  customerId: "customer-synthetic",
  subscriptionId: "sub-synthetic",
  amount: 49,
  currency: "USD",
  reason: "Verified service problem",
  idempotencyKey: "credit-status-key",
  fingerprint: "credit-status-fingerprint",
};
const result = {
  creditId: "credit-synthetic",
  customerId: command.customerId,
  subscriptionId: command.subscriptionId,
  amount: command.amount,
  currency: command.currency,
  status: "executed" as const,
  idempotencyKey: command.idempotencyKey,
  executedAt: "2026-09-11T12:00:00.000Z",
};
const supportCase = {
  id: command.approvalCaseId,
  subscriptionLookup: {
    found: true,
    subscription: { subscriptionId: command.subscriptionId, status: "active" },
  },
} as SupportCase;

const informationalCase = {
  ...supportCase,
  draft: {
    draftResponse: "The model must not decide what the customer sees.",
    citedSources: [],
    selectedPolicyExcerpts: [],
    recommendRefund: false,
    requiresEscalation: false,
    resolutionAction: "none",
  },
  triage: {
    intent: "account_issue",
    accountIssueSubtype: "informational_credit_status",
    urgency: "low",
    sentiment: "neutral",
    requiresHumanReview: false,
    confidence: 1,
    rationale: "Synthetic informational status request.",
  },
  metadata: {
    activeTurnId: "turn-credit",
    providerBindings: {
      support: {
        tenantId: "tenant-synthetic",
        providerKind: "local",
        providerAccountId: "local-synthetic",
        externalConversationId: "conversation-synthetic",
      },
      transactions: {
        tenantId: "tenant-synthetic",
        providerKind: "local",
        providerAccountId: "local-synthetic",
        externalConversationId: "conversation-synthetic",
      },
      commerce: {
        tenantId: "tenant-synthetic",
        providerKind: "local",
        providerAccountId: "local-synthetic",
        externalConversationId: "conversation-synthetic",
      },
      knowledge: {
        tenantId: "tenant-synthetic",
        providerKind: "local",
        providerAccountId: "local-synthetic",
        externalConversationId: "conversation-synthetic",
      },
    },
  },
} as SupportCase;

function durableFixture() {
  store.turns.mockResolvedValue([
    {
      id: "turn-credit",
      commandFingerprint: command.fingerprint,
      outcome: { subscriptionCreditResult: result },
    },
  ]);
  store.getAction.mockResolvedValue(command);
  store.approvalDecision.mockResolvedValue({
    approved: true,
    commandFingerprint: command.fingerprint,
  });
  store.idempotency.mockResolvedValue({
    fingerprint: command.fingerprint,
    effect: {
      creditId: result.creditId,
      customerId: result.customerId,
      subscriptionId: result.subscriptionId,
      amount: { currency: "USD", minor: 4900 },
      idempotencyKey: result.idempotencyKey,
      executedAt: result.executedAt,
      status: "succeeded",
    },
  });
}

describe("post-credit finalization", () => {
  it("uses only the matching durable approval and receipt for an informational credit response", async () => {
    durableFixture();
    const response = await priorSubscriptionCreditStatusResponse(supportCase);
    expect(response).toContain("subscription is active");
    expect(response).toContain("49 USD billing credit was created");
    expect(response).toContain(
      "does not establish whether an invoice has already used it",
    );
    expect(response).not.toContain("available for a future invoice");
  });

  it("rejects a forged historical turn when its durable receipt does not match", async () => {
    durableFixture();
    store.idempotency.mockResolvedValueOnce({
      fingerprint: command.fingerprint,
      effect: {
        creditId: result.creditId,
        customerId: result.customerId,
        subscriptionId: result.subscriptionId,
        amount: { currency: "USD", minor: 4900 },
        idempotencyKey: result.idempotencyKey,
        executedAt: "2026-09-11T12:01:00.000Z",
      },
    });
    await expect(
      priorSubscriptionCreditStatusResponse(supportCase),
    ).resolves.toBeUndefined();
  });

  it("finalizes an informational follow-up from the durable credit receipt, never the model draft", async () => {
    durableFixture();
    getActiveCaseOrThrow.mockResolvedValue({ supportCase: informationalCase });
    store.finalizeCaseAndEnqueue.mockResolvedValue(undefined);
    deliverOutbox.mockResolvedValue(undefined);

    await expect(
      resolveCaseStep.execute({
        inputData: {
          caseId: informationalCase.id,
          turnId: "turn-credit",
          approved: false,
        },
        mastra: { getLogger: () => ({ warn: vi.fn() }) },
      } as never),
    ).resolves.toMatchObject({ status: "resolved" });
    expect(store.finalizeCaseAndEnqueue).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "resolved",
        finalResponse: expect.stringContaining("billing credit was created"),
      }),
    );
    expect(store.finalizeCaseAndEnqueue).not.toHaveBeenCalledWith(
      expect.objectContaining({
        finalResponse: expect.stringContaining("model must"),
      }),
    );
  });

  it("escalates the native finalizer when a historical receipt is forged", async () => {
    durableFixture();
    store.idempotency.mockResolvedValueOnce({
      fingerprint: command.fingerprint,
      effect: {
        creditId: result.creditId,
        customerId: result.customerId,
        subscriptionId: result.subscriptionId,
        amount: { currency: "USD", minor: 4900 },
        idempotencyKey: result.idempotencyKey,
        executedAt: "2026-09-11T12:01:00.000Z",
      },
    });
    getActiveCaseOrThrow.mockResolvedValue({ supportCase: informationalCase });
    store.finalizeCaseAndEnqueue.mockResolvedValue(undefined);
    deliverOutbox.mockResolvedValue(undefined);

    await expect(
      resolveCaseStep.execute({
        inputData: {
          caseId: informationalCase.id,
          turnId: "turn-credit",
          approved: false,
        },
        mastra: { getLogger: () => ({ warn: vi.fn() }) },
      } as never),
    ).resolves.toMatchObject({ status: "escalated" });
    expect(store.finalizeCaseAndEnqueue).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "escalated",
        finalResponse: expect.stringContaining("support specialist"),
        escalationReason: expect.stringContaining("could not be verified"),
      }),
    );
  });
});
