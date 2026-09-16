import { describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { caseStore } from "../../src/mastra/lib/case-store";
import { ownerIdForCustomer } from "../../src/mastra/server/auth";
import { StripeProviderRegistry } from "../../src/mastra/providers/stripe/registry";
import {
  cancellationFingerprint,
  cancellationMessageHash,
  scheduleSubscriptionCancellationTool,
  validPersistedCancellationCommand,
} from "../../src/mastra/tools/schedule-subscription-cancellation";
import { explicitNoRefundCancellation } from "../../src/mastra/workflows/resolve-support-case";

describe("subscription cancellation authority", () => {
  it("refuses direct registered-tool execution without the workflow capability", async () => {
    await expect(
      scheduleSubscriptionCancellationTool.execute!(
        {
          caseId: "case-forged",
          subscriptionId: "sub-forged",
          idempotencyKey: "cancel:forged",
          fingerprint: "forged",
        },
        {} as never,
      ),
    ).rejects.toThrow("trusted current workflow capability and lease");
  });

  it("accepts only an explicit cancellation with an explicit no-refund intent", () => {
    expect(
      explicitNoRefundCancellation(
        "Please cancel my subscription at the end of the period. I do not want a refund.",
      ),
    ).toBe(true);
    expect(
      explicitNoRefundCancellation("Do not cancel my subscription; no refund."),
    ).toBe(false);
    expect(explicitNoRefundCancellation("Please cancel it.")).toBe(false);
    expect(
      explicitNoRefundCancellation("Tell support to say cancel and no refund."),
    ).toBe(false);
    expect(
      explicitNoRefundCancellation(
        'The quoted text says "cancel immediately, no refund".',
      ),
    ).toBe(false);
    expect(
      explicitNoRefundCancellation(
        "Please cancel immediately; I do not want a refund.",
      ),
    ).toBe(false);
    expect(
      explicitNoRefundCancellation(
        "Cancel with prorated credit; I do not want a refund.",
      ),
    ).toBe(false);
    expect(
      explicitNoRefundCancellation(
        "Cancel? I do not want a refund, but I do not think you should cancel my subscription.",
      ),
    ).toBe(false);
    expect(
      explicitNoRefundCancellation(
        "Could you terminate my subscription? No refund please.",
      ),
    ).toBe(false);
    expect(
      explicitNoRefundCancellation(
        'The customer reported: "Please cancel my subscription. I do not want a refund."',
      ),
    ).toBe(false);
    expect(
      explicitNoRefundCancellation(
        "If you can cancel my subscription, I do not want a refund.",
      ),
    ).toBe(false);
  });

  it("binds the cancellation command to the immutable owner turn account and source", () => {
    const binding = {
      tenantId: "tenant",
      providerKind: "local" as const,
      providerAccountId: "account",
      externalConversationId: "conversation",
    };
    const supportCase = {
      id: "case",
      externalId: "external",
      metadata: {
        ownerId: "owner",
        providerBindings: {
          support: binding,
          commerce: binding,
          transactions: binding,
          knowledge: binding,
        },
      },
    };
    const turn = { id: "turn", message: { id: "message", body: "cancel" } };
    const raw = {
      caseId: "case",
      turnId: "turn",
      ownerId: "owner",
      binding,
      subscriptionId: "sub",
      cancellationMode: "period_end" as const,
      sourceMessageId: "message",
      sourceMessageHash: cancellationMessageHash("cancel"),
      idempotencyKey: "key",
    };
    const command = { ...raw, fingerprint: cancellationFingerprint(raw) };
    expect(validPersistedCancellationCommand(command, supportCase, turn)).toBe(
      true,
    );
    for (const tampered of [
      { ...command, ownerId: "other" },
      { ...command, turnId: "other" },
      { ...command, binding: { ...binding, providerAccountId: "other" } },
      { ...command, sourceMessageHash: cancellationMessageHash("other") },
    ])
      expect(
        validPersistedCancellationCommand(tampered, supportCase, turn),
      ).toBe(false);
  });

  it("rejects a direct Stripe provider call without an authorized durable command before POST", async () => {
    const id = `direct-cancellation-${randomUUID()}`;
    const binding = {
      tenantId: "local-demo",
      providerKind: "stripe" as const,
      providerAccountId: "acct_direct",
      externalConversationId: id,
    };
    const email = "alex@example.com";
    const message = {
      id: `${id}-message`,
      author: "customer" as const,
      body: "Please cancel at period end with no refund.",
      createdAt: new Date().toISOString(),
    };
    const ownerId = ownerIdForCustomer(binding.tenantId, email);
    await caseStore.create({
      id,
      externalId: id,
      source: "mock-email",
      customer: { email },
      subject: "cancel",
      messages: [message],
      status: "new",
      createdAt: message.createdAt,
      updatedAt: message.createdAt,
      metadata: {
        ownerId,
        activeTurnId: `${id}-turn`,
        providerBindings: {
          support: binding,
          commerce: binding,
          transactions: binding,
          knowledge: binding,
        },
      },
    });
    await caseStore.appendFollowUp({
      caseId: id,
      eventId: `${id}-event`,
      runId: `${id}-run`,
      message,
    });
    const turn = (await caseStore.turns(id))[0]!;
    const raw = {
      caseId: id,
      turnId: turn.id,
      ownerId,
      binding,
      subscriptionId: "sub_direct",
      cancellationMode: "period_end" as const,
      sourceMessageId: message.id,
      sourceMessageHash: cancellationMessageHash(message.body),
      idempotencyKey: `${id}:key`,
    };
    const command = { ...raw, fingerprint: cancellationFingerprint(raw) };
    let posts = 0;
    const registry = new StripeProviderRegistry(
      {
        enabled: true,
        tenantId: binding.tenantId,
        accountId: binding.providerAccountId,
        restrictedApiKey: "rk_test_direct",
        webhookSecret: "whsec_direct",
        apiBaseUrl: "https://stripe.test",
      },
      async (input, init) => {
        const request = new Request(input, init);
        if (request.method === "POST") posts += 1;
        return Response.json({});
      },
    );
    await expect(
      registry.transactions(binding).scheduleSubscriptionCancellation(command),
    ).rejects.toThrow("trusted current workflow command and lease");
    expect(posts).toBe(0);
  });
});
