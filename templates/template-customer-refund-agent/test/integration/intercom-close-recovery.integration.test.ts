import { rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { CaseStore } from "../../src/mastra/lib/case-store";
import type { ProviderRegistry } from "../../src/mastra/providers/contracts";
import { registerProviderRegistry } from "../../src/mastra/providers/registry";
import { recoverIntercomCloseIntents } from "../../src/mastra/runtime/intercom-close-recovery";

const files: string[] = [];

async function fixture(state: "open" | "closed", onRead?: () => Promise<void>) {
  const path = join(tmpdir(), `intercom-close-${crypto.randomUUID()}.db`);
  files.push(path, `${path}-wal`, `${path}-shm`);
  const store = new CaseStore({ url: `file:${path}` });
  const binding = {
    tenantId: `tenant-${crypto.randomUUID()}`,
    providerKind: "intercom" as const,
    providerAccountId: `app-${crypto.randomUUID()}`,
    externalConversationId: "conversation-synthetic",
  };
  const timestamp = "2026-09-11T12:00:00.000Z";
  await store.create({
    id: "case-close",
    externalId: "event-close",
    source: "intercom-conversation",
    customer: { email: "customer@example.test" },
    subject: "Synthetic close fixture",
    messages: [
      {
        id: "customer-message",
        author: "customer",
        body: "Please help",
        createdAt: timestamp,
      },
    ],
    status: "escalated",
    createdAt: timestamp,
    updatedAt: timestamp,
    metadata: {
      ownerId: "customer-synthetic",
      activeTurnId: "turn-close",
      providerBinding: binding,
    },
  });
  await store.getClient().execute({
    sql: "INSERT INTO support_turns(id, case_id, event_id, sequence, state, created_at, updated_at, message_data, outcome_data) VALUES ('turn-close', 'case-close', 'event-close', 1, 'escalated', ?, ?, ?, ?)",
    args: [
      timestamp,
      timestamp,
      JSON.stringify({
        id: "customer-message",
        author: "customer",
        body: "Please help",
        createdAt: timestamp,
      }),
      JSON.stringify({ status: "escalated" }),
    ],
  });
  const registry: ProviderRegistry = {
    support: () => ({
      kind: "intercom",
      normalizeInbound: async () => {
        throw new Error("not used");
      },
      deliver: async () => {
        throw new Error("a reverse close never replies");
      },
      addInternalNote: async () => {
        throw new Error("a reverse close never adds a note");
      },
      updateStatus: async () => {
        throw new Error("a reverse close never writes a status");
      },
      currentConversationState: async () => {
        await onRead?.();
        return { id: binding.externalConversationId, state };
      },
    }),
    commerce: () => {
      throw new Error("not used");
    },
    transactions: () => {
      throw new Error("not used");
    },
    knowledge: () => {
      throw new Error("not used");
    },
  };
  registerProviderRegistry(registry, [binding]);
  await store.recordIntercomCloseIntent({
    tenantId: binding.tenantId,
    providerAccountId: binding.providerAccountId,
    eventId: "event-admin-closed",
    externalConversationId: binding.externalConversationId,
  });
  return { store, binding, path };
}

afterEach(async () => {
  await Promise.all(files.splice(0).map((file) => rm(file, { force: true })));
});

describe("Intercom reverse close recovery", () => {
  it("fresh-GETs a closed conversation, resolves once, and enqueues no outbound loop", async () => {
    const { store } = await fixture("closed");
    expect(await recoverIntercomCloseIntents(store)).toBe(1);
    expect((await store.get("case-close"))?.status).toBe("resolved");
    expect(
      await store
        .getClient()
        .execute(
          "SELECT operation FROM support_outbox WHERE case_id = 'case-close'",
        ),
    ).toMatchObject({ rows: [] });
    expect(
      await store
        .getClient()
        .execute("SELECT state FROM support_intercom_close_intents"),
    ).toMatchObject({ rows: [{ state: "applied" }] });
    await store.close();
  });

  it("supersedes an open provider conversation without changing the case", async () => {
    const { store } = await fixture("open");
    await recoverIntercomCloseIntents(store);
    expect((await store.get("case-close"))?.status).toBe("escalated");
    expect(
      await store
        .getClient()
        .execute("SELECT state FROM support_intercom_close_intents"),
    ).toMatchObject({ rows: [{ state: "superseded" }] });
    await store.close();
  });

  it("defers the close when a customer follow-up wins the version race", async () => {
    let store: CaseStore | undefined;
    const fixtureValue = await fixture("closed", async () => {
      await store!.appendFollowUp({
        caseId: "case-close",
        eventId: "customer-follow-up",
        runId: "run-follow-up",
        message: {
          id: "customer-follow-up-message",
          author: "customer",
          body: "A newer question",
          createdAt: "2026-09-11T12:01:00.000Z",
        },
      });
    });
    store = fixtureValue.store;
    await recoverIntercomCloseIntents(store);
    expect((await store.get("case-close"))?.status).toBe("new");
    expect(
      await store
        .getClient()
        .execute("SELECT state FROM support_intercom_close_intents"),
    ).toMatchObject({ rows: [{ state: "deferred" }] });
    await store.close();
  });

  it("defers pending and unknown financial states, then applies exactly once after restart", async () => {
    const { store, binding, path } = await fixture("closed");
    const pending = {
      creditId: "credit-pending",
      customerId: "customer-synthetic",
      subscriptionId: "sub-synthetic",
      amount: 49,
      currency: "USD",
      status: "pending" as const,
      idempotencyKey: "credit-pending-key",
      executedAt: "2026-09-11T12:00:00.000Z",
    };
    await store.update("case-close", { subscriptionCreditResult: pending });
    await recoverIntercomCloseIntents(store);
    expect((await store.get("case-close"))?.status).toBe("escalated");
    expect(
      await store
        .getClient()
        .execute("SELECT state FROM support_intercom_close_intents"),
    ).toMatchObject({ rows: [{ state: "deferred" }] });
    await store.update("case-close", { subscriptionCreditResult: undefined });
    await store.getClient().execute({
      sql: "INSERT INTO support_stripe_subscription_credit_attempts(id, case_id, tenant_id, provider_account_id, command_fingerprint, idempotency_key, dispatch_id, lease_token, turn_id, command_data, status, created_at, updated_at) VALUES ('unknown-credit', 'case-close', ?, ?, 'fingerprint', 'unknown-credit-key', 'dispatch', 'lease', 'turn-close', '{}', 'unknown', ?, ?)",
      args: [
        binding.tenantId,
        binding.providerAccountId,
        new Date().toISOString(),
        new Date().toISOString(),
      ],
    });
    await recoverIntercomCloseIntents(store);
    expect((await store.get("case-close"))?.status).toBe("escalated");
    await store
      .getClient()
      .execute(
        "DELETE FROM support_stripe_subscription_credit_attempts WHERE id = 'unknown-credit'",
      );
    await store.close();

    const restarted = new CaseStore({ url: `file:${path}` });
    expect(await recoverIntercomCloseIntents(restarted)).toBe(1);
    expect((await restarted.get("case-close"))?.status).toBe("resolved");
    expect(
      await restarted
        .getClient()
        .execute(
          "SELECT COUNT(*) AS count FROM support_outbox WHERE case_id = 'case-close'",
        ),
    ).toMatchObject({ rows: [{ count: 0 }] });
    await restarted.close();
  });

  it("supersedes a close hint for a retention-redacted case without restoring content", async () => {
    const { store } = await fixture("closed");
    const current = (await store.get("case-close"))!;
    await store.update("case-close", {
      metadata: {
        ...current.metadata,
        retentionRedactedAt: "2026-09-11T12:00:00.000Z",
      },
    });
    await recoverIntercomCloseIntents(store);
    expect((await store.get("case-close"))?.status).toBe("escalated");
    expect((await store.get("case-close"))?.messages).toHaveLength(1);
    expect(
      await store
        .getClient()
        .execute("SELECT state FROM support_intercom_close_intents"),
    ).toMatchObject({ rows: [{ state: "superseded" }] });
    await store.close();
  });
});
