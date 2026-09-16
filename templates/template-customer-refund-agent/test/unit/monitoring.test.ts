import { afterEach, describe, expect, it, vi } from "vitest";
import {
  computeSubscriptionCreditMetrics,
  computeFeedbackMetrics,
  computeRefundApprovalMetrics,
} from "../../src/mastra/lib/monitoring";
import { caseStore } from "../../src/mastra/lib/case-store";
import type { SupportCase } from "../../src/mastra/domain/support-case";

function fixture(id: string): SupportCase {
  return {
    id,
    externalId: id,
    source: "mock-email",
    customer: { email: `${id}@example.test` },
    subject: `Case ${id}`,
    messages: [],
    status: "resolved",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:01:00.000Z",
    metadata: {},
  };
}

afterEach(() => vi.restoreAllMocks());

describe("monitoring aggregates", () => {
  it("separates pending recommendations, durable refund failures, and later workflow failures", async () => {
    const supportCase = fixture("case-1");
    supportCase.status = "waiting_approval";
    supportCase.draft = {
      draftResponse: "Pending staff approval.",
      citedSources: ["duplicate-charge-policy"],
      recommendRefund: true,
      requiresEscalation: false,
    };
    supportCase.metadata.activeTurnId = "turn-pending";
    vi.spyOn(caseStore, "turns").mockResolvedValue([
      {
        id: "turn-pending",
        eventId: "event-pending",
        sequence: 1,
        state: "waiting_approval",
        outcome: { telemetry: { traceId: "pending-trace" } },
      },
      {
        id: "turn-usd",
        eventId: "event-usd",
        sequence: 2,
        state: "resolved",
        outcome: {
          draft: { recommendRefund: true },
          refundResult: {
            amount: 20.01,
            currency: "USD",
            status: "executed",
            idempotencyKey: "usd-effect",
          },
        },
      },
      {
        id: "turn-eur",
        eventId: "event-eur",
        sequence: 3,
        state: "failed",
        outcome: {
          draft: { recommendRefund: true },
          refundResult: {
            amount: 10.5,
            currency: "EUR",
            status: "executed",
            idempotencyKey: "eur-effect",
          },
        },
      },
      {
        id: "turn-provider-failure",
        eventId: "event-provider-failure",
        sequence: 4,
        state: "failed",
        outcome: {
          draft: { recommendRefund: true },
          refundResult: {
            amount: 12,
            currency: "USD",
            status: "failed",
            idempotencyKey: "failed-provider-effect",
          },
        },
      },
    ]);
    vi.spyOn(caseStore, "monitoringDecisions").mockResolvedValue([
      { caseId: supportCase.id, turnId: "turn-usd", approved: true },
      { caseId: supportCase.id, turnId: "turn-eur", approved: false },
      {
        caseId: supportCase.id,
        turnId: "turn-provider-failure",
        approved: true,
      },
    ]);
    // Financial failure is a durable provider action, rather than a failed
    // workflow/delivery turn. The executed EUR effect above is intentionally
    // on a failed turn and must not add to this count.
    vi.spyOn(caseStore, "monitoringFinancialFailures").mockResolvedValue(1);

    await expect(computeRefundApprovalMetrics([supportCase])).resolves.toEqual({
      recommended: 4,
      approved: 2,
      rejected: 1,
      executed: 2,
      // A successful financial provider effect remains executed even if a
      // later workflow/delivery stage fails.
      failed: 1,
      autoEscalated: 0,
      approvalRate: 2 / 3,
      executedTotals: [
        { currency: "EUR", minor: 1050 },
        { currency: "USD", minor: 2001 },
      ],
    });
  });

  it("returns feedback correlation without exporting a free-form comment", () => {
    const supportCase = fixture("case-feedback");
    supportCase.feedback = {
      rating: "up",
      comment: "private feedback that must not reach monitoring",
      submittedAt: "2026-01-01T00:01:00.000Z",
      actorId: "customer-1",
      turnId: "turn-1",
      runId: "run-1",
      traceId: "trace-1",
    };
    expect(computeFeedbackMetrics([supportCase])).toMatchObject({
      totalResponses: 1,
      satisfactionRate: 1,
      recent: [{ turnId: "turn-1", runId: "run-1", traceId: "trace-1" }],
    });
    expect(JSON.stringify(computeFeedbackMetrics([supportCase]))).not.toContain(
      "private feedback",
    );
  });

  it("keeps mixed credit and refund turns in their own approval and total metrics", async () => {
    const supportCase = fixture("mixed-financial-actions");
    supportCase.metadata.activeTurnId = "credit-turn";
    supportCase.subscriptionCreditResult = {
      creditId: "credit_1",
      customerId: "customer_1",
      subscriptionId: "sub_1",
      amount: 49,
      currency: "USD",
      status: "executed",
      idempotencyKey: "credit-effect",
      executedAt: "2026-01-01T00:01:00.000Z",
    };
    supportCase.metadata.subscriptionCreditEffects = {
      credit: supportCase.subscriptionCreditResult,
    };
    vi.spyOn(caseStore, "turns").mockResolvedValue([
      {
        id: "refund-turn",
        eventId: "refund-event",
        sequence: 1,
        state: "resolved",
        outcome: {
          draft: { recommendRefund: true },
          refundResult: {
            amount: 20,
            currency: "USD",
            status: "executed",
            idempotencyKey: "refund-effect",
          },
        },
      },
      {
        id: "credit-turn",
        eventId: "credit-event",
        sequence: 2,
        state: "resolved",
        outcome: {
          draft: { resolutionAction: "subscription_credit" },
          subscriptionCreditResult: supportCase.subscriptionCreditResult,
        },
      },
    ]);
    const decisions = vi.spyOn(caseStore, "monitoringDecisions");
    decisions.mockImplementation(async (_caseIds, actionKind) =>
      actionKind === "subscription-credit-command"
        ? [{ caseId: supportCase.id, turnId: "credit-turn", approved: true }]
        : [{ caseId: supportCase.id, turnId: "refund-turn", approved: false }],
    );
    vi.spyOn(caseStore, "monitoringFinancialFailures").mockResolvedValue(0);

    await expect(
      computeRefundApprovalMetrics([supportCase]),
    ).resolves.toMatchObject({
      recommended: 1,
      approved: 0,
      rejected: 1,
      executed: 1,
      executedTotals: [{ currency: "USD", minor: 2000 }],
    });
    await expect(
      computeSubscriptionCreditMetrics([supportCase]),
    ).resolves.toMatchObject({
      recommended: 1,
      approved: 1,
      rejected: 0,
      executed: 1,
      executedTotals: [{ currency: "USD", minor: 4900 }],
    });
  });

  it("counts a durable recovered credit receipt once across projections, never arbitrary skipped results", async () => {
    const supportCase = fixture("recovered-credit-metrics");
    const recovered = {
      creditId: "credit_recovered",
      customerId: "customer_1",
      subscriptionId: "sub_1",
      amount: 49,
      currency: "USD",
      status: "skipped" as const,
      idempotencyKey: "recovered-credit-effect",
      executedAt: "2026-01-01T00:01:00.000Z",
    };
    const skippedProjection = (idempotencyKey: string, creditId: string) => ({
      ...recovered,
      creditId,
      idempotencyKey,
    });
    const pending = skippedProjection(
      "pending-credit-effect",
      "credit_pending",
    );
    const failed = skippedProjection("failed-credit-effect", "credit_failed");
    const unknown = skippedProjection(
      "unknown-credit-effect",
      "credit_unknown",
    );
    const amountMismatch = skippedProjection(
      "amount-mismatch-credit-effect",
      "credit_amount_mismatch",
    );
    const customerMismatch = skippedProjection(
      "customer-mismatch-credit-effect",
      "credit_customer_mismatch",
    );
    supportCase.metadata.subscriptionCreditEffects = {
      recovered,
      pending,
      failed,
      unknown,
      amountMismatch,
      customerMismatch,
    };
    vi.spyOn(caseStore, "turns").mockResolvedValue([
      {
        id: "recovered-turn",
        eventId: "recovered-event",
        sequence: 1,
        state: "resolved",
        outcome: {
          draft: { resolutionAction: "subscription_credit" },
          subscriptionCreditResult: recovered,
        },
      },
      {
        id: "duplicate-recovery-turn",
        eventId: "duplicate-recovery-event",
        sequence: 2,
        state: "resolved",
        outcome: {
          draft: { resolutionAction: "subscription_credit" },
          subscriptionCreditResult: recovered,
        },
      },
      ...[pending, failed, unknown, amountMismatch, customerMismatch].map(
        (result, index) => ({
          id: `unconfirmed-turn-${index}`,
          eventId: `unconfirmed-event-${index}`,
          sequence: index + 3,
          state: "escalated" as const,
          outcome: {
            draft: { resolutionAction: "subscription_credit" },
            subscriptionCreditResult: result,
          },
        }),
      ),
    ]);
    const receipt = (
      projection: typeof recovered,
      changes: Record<string, unknown> = {},
    ) => ({
      creditId: projection.creditId,
      customerId: projection.customerId,
      subscriptionId: projection.subscriptionId,
      amount: { currency: "USD", minor: 4900 },
      idempotencyKey: projection.idempotencyKey,
      executedAt: projection.executedAt,
      replayed: true,
      status: "succeeded",
      providerStatus: "recovered",
      providerRefs: [],
      ...changes,
    });
    const receipts = new Map([
      [recovered.idempotencyKey, receipt(recovered)],
      [pending.idempotencyKey, receipt(pending, { status: "pending" })],
      [failed.idempotencyKey, receipt(failed, { status: "failed" })],
      [unknown.idempotencyKey, receipt(unknown, { status: "unknown" })],
      [
        amountMismatch.idempotencyKey,
        receipt(amountMismatch, { amount: { currency: "USD", minor: 4800 } }),
      ],
      [
        customerMismatch.idempotencyKey,
        receipt(customerMismatch, { customerId: "customer_other" }),
      ],
    ]);
    vi.spyOn(caseStore, "idempotency").mockImplementation(async (key) => {
      const effect = receipts.get(key);
      return effect
        ? { fingerprint: "recovered-fingerprint", effect }
        : undefined;
    });
    vi.spyOn(caseStore, "monitoringDecisions").mockResolvedValue([]);
    vi.spyOn(caseStore, "monitoringFinancialFailures").mockResolvedValue(0);

    await expect(
      computeSubscriptionCreditMetrics([supportCase]),
    ).resolves.toMatchObject({
      recommended: 7,
      executed: 1,
      executedTotals: [{ currency: "USD", minor: 4900 }],
    });
  });
});
