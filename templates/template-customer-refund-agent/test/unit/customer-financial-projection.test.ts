import { rm } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { customerReceiptState } from "../../src/mastra/lib/case-store-actions";
import { CaseStore } from "../../src/mastra/lib/case-store";
import { temporaryDatabasePath } from "../support/temp-path";

const command = {
  binding: { providerKind: "stripe" },
  orderId: "ord_1",
  amount: { minor: 500, currency: "USD" },
  idempotencyKey: "credit_1",
};

describe("customer financial receipt projection", () => {
  it("marks only a matching settled Stripe receipt as executed", () => {
    expect(
      customerReceiptState("refund-command", command, {
        status: "succeeded",
        orderId: "ord_1",
        amount: { minor: 500, currency: "USD" },
        idempotencyKey: "credit_1",
      }),
    ).toBe("executed");
  });

  it("does not present pending, unknown, failed, retained, or mismatched receipts as successful", () => {
    for (const receipt of [
      { status: "pending" },
      { status: "unknown" },
      { status: "failed" },
      { retention: "terminal-financial-effect" },
      {
        status: "succeeded",
        orderId: "ord_other",
        amount: { minor: 500, currency: "USD" },
        idempotencyKey: "credit_1",
      },
    ])
      expect(customerReceiptState("refund-command", command, receipt)).not.toBe(
        "executed",
      );
  });

  it("accepts the matching synchronous local receipt without a provider status", () => {
    expect(
      customerReceiptState(
        "refund-command",
        { ...command, binding: { providerKind: "local" } },
        {
          orderId: "ord_1",
          amount: { minor: 500, currency: "USD" },
          idempotencyKey: "credit_1",
        },
      ),
    ).toBe("executed");
  });

  it("uses the supported currency exponent for legacy JPY and KWD receipts", () => {
    expect(
      customerReceiptState(
        "refund-command",
        {
          binding: { providerKind: "local" },
          orderId: "ord_jpy",
          amount: 5000,
          currency: "JPY",
          idempotencyKey: "jpy_1",
        },
        {
          orderId: "ord_jpy",
          amount: { minor: 5000, currency: "JPY" },
          idempotencyKey: "jpy_1",
        },
      ),
    ).toBe("executed");
    expect(
      customerReceiptState(
        "subscription-credit-command",
        {
          binding: { providerKind: "local" },
          customerId: "cus_kwd",
          subscriptionId: "sub_kwd",
          amount: 1.23,
          currency: "KWD",
          idempotencyKey: "kwd_1",
        },
        {
          customerId: "cus_kwd",
          subscriptionId: "sub_kwd",
          amount: { minor: 1230, currency: "KWD" },
          idempotencyKey: "kwd_1",
        },
      ),
    ).toBe("executed");
  });

  it("returns legacy JPY and KWD amounts from the durable customer read model", async () => {
    const path = temporaryDatabasePath("customer-financial-projection");
    const store = new CaseStore({ url: `file:${path}` });
    const createdAt = "2026-09-10T00:00:00.000Z";
    const binding = {
      tenantId: "local-demo",
      providerKind: "local" as const,
      providerAccountId: "local-demo",
      externalConversationId: "projection",
    };
    try {
      for (const input of [
        {
          caseId: "case-jpy",
          turnId: "turn-jpy",
          fingerprint: "fingerprint-jpy",
          kind: "refund-command",
          command: {
            binding: { providerKind: "local" },
            orderId: "ord_jpy",
            amount: 5000,
            currency: "JPY",
            idempotencyKey: "jpy_1",
          },
        },
        {
          caseId: "case-kwd",
          turnId: "turn-kwd",
          fingerprint: "fingerprint-kwd",
          kind: "subscription-credit-command",
          command: {
            binding: { providerKind: "local" },
            customerId: "cus_kwd",
            subscriptionId: "sub_kwd",
            amount: 1.23,
            currency: "KWD",
            idempotencyKey: "kwd_1",
          },
        },
      ]) {
        await store.create({
          id: input.caseId,
          externalId: input.caseId,
          source: "mock-email",
          customer: { email: "alex@example.com" },
          subject: "Financial request",
          messages: [
            {
              id: `message-${input.caseId}`,
              author: "customer",
              body: "Please help.",
              createdAt,
            },
          ],
          status: "waiting_approval",
          createdAt,
          updatedAt: createdAt,
          metadata: { providerBinding: binding },
        });
        await store.saveAction(
          input.caseId,
          input.kind,
          input.fingerprint,
          input.command,
        );
        await store.getClient().execute({
          sql: "INSERT INTO support_turns(id, case_id, event_id, sequence, state, created_at, updated_at, command_fingerprint, message_data) VALUES (?, ?, ?, 1, 'waiting_approval', ?, ?, ?, ?)",
          args: [
            input.turnId,
            input.caseId,
            `event-${input.caseId}`,
            createdAt,
            createdAt,
            input.fingerprint,
            JSON.stringify({}),
          ],
        });
      }

      await expect(
        store.customerFinancialRequests(["case-jpy", "case-kwd"]),
      ).resolves.toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            caseId: "case-jpy",
            amount: 5000,
            currency: "JPY",
          }),
          expect.objectContaining({
            caseId: "case-kwd",
            amount: 1.23,
            currency: "KWD",
          }),
        ]),
      );
    } finally {
      await store.close();
      await Promise.all([
        rm(path, { force: true }),
        rm(`${path}-shm`, { force: true }),
        rm(`${path}-wal`, { force: true }),
      ]);
    }
  });
});
