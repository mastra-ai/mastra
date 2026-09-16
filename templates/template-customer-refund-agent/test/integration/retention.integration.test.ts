import { rm } from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { LibSQLStore } from "@mastra/libsql";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CaseStore } from "../../src/mastra/lib/case-store";
import { purgeExpiredWorkflowSnapshots } from "../../src/mastra/runtime/local-runtime";
import { temporaryDatabasePath } from "../support/temp-path";

const files: string[] = [];
const execFileAsync = promisify(execFile);

async function storeForTest() {
  const path = temporaryDatabasePath("phase003-retention");
  files.push(path, `${path}-shm`, `${path}-wal`);
  const store = new CaseStore({ url: `file:${path}` });
  await store.list();
  return store;
}

afterEach(async () => {
  await Promise.all(files.splice(0).map((file) => rm(file, { force: true })));
});

describe("DEC-015 retention", () => {
  it("removes terminal reverse-close identifiers and expired manual replay metadata", async () => {
    const store = await storeForTest();
    const client = store.getClient();
    const expired = "2025-01-01T00:00:00.000Z";
    await client.execute({
      sql: "INSERT INTO support_intercom_close_intents(id, tenant_id, provider_account_id, event_id, external_conversation_id, state, created_at, updated_at) VALUES ('old-close', 'tenant', 'account', 'event', 'conversation', 'applied', ?, ?)",
      args: [expired, expired],
    });
    await client.execute({
      sql: "INSERT INTO support_manual_resolutions(id, case_id, tenant_id, actor_id, turn_id, expected_version, idempotency_key, payload_hash, note_message_id, note_outbox_id, close_outbox_id, created_at) VALUES ('old-manual', 'case', 'tenant', 'actor', 'turn', 1, 'old-manual-key', 'hash', 'message', 'note', 'close', ?)",
      args: [expired],
    });
    await store.enforceRetention(() => new Date("2026-09-11T12:00:00.000Z"));
    expect(
      await client.execute(
        "SELECT id FROM support_intercom_close_intents WHERE id = 'old-close'",
      ),
    ).toMatchObject({ rows: [] });
    expect(
      await client.execute(
        "SELECT id FROM support_manual_resolutions WHERE id = 'old-manual'",
      ),
    ).toMatchObject({ rows: [] });
    await store.close();
  });

  it("does not let reconciliation claim a prepared refund while its approval dispatch is live, then recovers it after lease expiry", async () => {
    const store = await storeForTest();
    const client = store.getClient();
    const createdAt = new Date().toISOString();
    const liveUntil = new Date(Date.now() + 60_000).toISOString();
    await store.create({
      id: "lease-race-case",
      externalId: "lease-race-event",
      source: "mock-email",
      customer: { email: "lease-race@example.test" },
      subject: "Reconciliation lease race",
      messages: [],
      status: "resolved",
      createdAt,
      updatedAt: createdAt,
      metadata: {
        providerBinding: {
          tenantId: "local-demo",
          providerKind: "local",
          providerAccountId: "acct",
          externalConversationId: "lease-race",
        },
      },
    });
    await client.execute({
      sql: "INSERT INTO support_turns(id, case_id, event_id, sequence, state, created_at, updated_at) VALUES (?, ?, ?, 1, 'resolved', ?, ?)",
      args: [
        "lease-race-turn",
        "lease-race-case",
        "lease-race-event",
        createdAt,
        createdAt,
      ],
    });
    await client.execute({
      sql: "INSERT INTO support_dispatch(id, case_id, turn_id, run_id, state, attempts, lease_until, lease_token, created_at, updated_at) VALUES (?, ?, ?, ?, 'started', 1, ?, ?, ?, ?)",
      args: [
        "dispatch-live-refund",
        "lease-race-case",
        "lease-race-turn",
        "lease-race-run",
        liveUntil,
        "dispatch-lease-token",
        createdAt,
        createdAt,
      ],
    });
    await client.execute({
      sql: "INSERT INTO support_stripe_refund_attempts(id, case_id, tenant_id, provider_account_id, command_fingerprint, idempotency_key, dispatch_id, lease_token, turn_id, command_data, status, created_at, updated_at, next_attempt_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'prepared', ?, ?, ?)",
      args: [
        "attempt-live-refund",
        "lease-race-case",
        "local-demo",
        "acct",
        "lease-race-fingerprint",
        "lease-race-key",
        "dispatch-live-refund",
        "dispatch-lease-token",
        "lease-race-turn",
        "{}",
        createdAt,
        createdAt,
        new Date(0).toISOString(),
      ],
    });
    // This is the production interleaving: preparation completed, a
    // reconciler polls before the dispatcher persists its Stripe request.
    expect(await store.claimableStripeRefundAttempts()).toEqual([]);
    await client.execute({
      sql: "UPDATE support_dispatch SET state = 'claimed', lease_until = ? WHERE id = ?",
      args: [new Date(0).toISOString(), "dispatch-live-refund"],
    });
    const reacquired = await store.claimDispatchForResume(
      "lease-race-case",
      "lease-race-run",
      "lease-race-turn",
    );
    expect(reacquired).toMatchObject({ id: "dispatch-live-refund" });
    expect(reacquired!.leaseToken).not.toBe("dispatch-lease-token");
    // The attempt retains its original lease token. A fresh active dispatch
    // generation for the same durable dispatch must still fence reconciliation.
    expect(await store.claimableStripeRefundAttempts()).toEqual([]);
    await client.execute({
      sql: "UPDATE support_dispatch SET lease_until = ? WHERE id = ?",
      args: [new Date(0).toISOString(), "dispatch-live-refund"],
    });
    const recovered = await store.claimableStripeRefundAttempts();
    expect(recovered).toHaveLength(1);
    expect(recovered[0]).toMatchObject({
      idempotencyKey: "lease-race-key",
      status: "prepared",
    });
    // The generic restart worker uses claimDispatch rather than the native
    // resume helper. Its candidate and CAS must observe the same live
    // reconciliation ownership, then permit reclaim after expiry.
    await client.execute({
      sql: "UPDATE support_dispatch SET state = 'started', attempts = 1, lease_until = ? WHERE id = ?",
      args: [new Date(0).toISOString(), "dispatch-live-refund"],
    });
    expect(await store.claimDispatch()).toEqual([]);
    await client.execute({
      sql: "UPDATE support_stripe_refund_attempts SET reconcile_lease_until = ? WHERE idempotency_key = ?",
      args: [new Date(0).toISOString(), "lease-race-key"],
    });
    await expect(store.claimDispatch()).resolves.toMatchObject([
      { id: "dispatch-live-refund" },
    ]);
    // Reconciliation also blocks the exhausted-dispatch projection. Once it
    // expires, the generic claimant may terminalize the exhausted dispatch.
    await client.execute({
      sql: "UPDATE support_dispatch SET state = 'started', attempts = 3, lease_until = ? WHERE id = ?",
      args: [new Date(0).toISOString(), "dispatch-live-refund"],
    });
    expect(await store.claimableStripeRefundAttempts()).toHaveLength(1);
    expect(await store.claimDispatch()).toEqual([]);
    expect(await store.get("lease-race-case")).toMatchObject({
      status: "resolved",
    });
    await client.execute({
      sql: "UPDATE support_stripe_refund_attempts SET reconcile_lease_until = ? WHERE idempotency_key = ?",
      args: [new Date(0).toISOString(), "lease-race-key"],
    });
    expect(await store.claimDispatch()).toEqual([]);
    expect(await store.get("lease-race-case")).toMatchObject({
      status: "escalated",
      escalationReason:
        "Workflow recovery exhausted its durable lease attempts.",
    });
    // The reverse race is just as important: a recovery resume cannot replace
    // its dispatch token while reconciliation owns the prepared attempt.
    await client.execute({
      sql: "UPDATE support_stripe_refund_attempts SET reconcile_lease_until = ? WHERE idempotency_key = ?",
      args: [new Date(Date.now() + 60_000).toISOString(), "lease-race-key"],
    });
    await client.execute({
      sql: "UPDATE support_dispatch SET state = 'suspended', lease_until = ? WHERE id = ?",
      args: [new Date(0).toISOString(), "dispatch-live-refund"],
    });
    expect(
      await store.claimDispatchForResume(
        "lease-race-case",
        "lease-race-run",
        "lease-race-turn",
      ),
    ).toBeUndefined();
    await client.execute({
      sql: "UPDATE support_stripe_refund_attempts SET reconcile_lease_until = ? WHERE idempotency_key = ?",
      args: [new Date(0).toISOString(), "lease-race-key"],
    });
    expect(
      await client.execute({
        sql: "SELECT state, lease_until, lease_token FROM support_dispatch WHERE id = ?",
        args: ["dispatch-live-refund"],
      }),
    ).toMatchObject({ rows: [{ state: "suspended" }] });
    expect(
      await client.execute({
        sql: "SELECT d.id FROM support_dispatch d WHERE d.case_id = ? AND d.state = 'suspended' AND d.turn_id = ? AND NOT EXISTS (SELECT 1 FROM support_stripe_refund_attempts r WHERE r.dispatch_id = d.id AND r.reconcile_lease_until > ?)",
        args: ["lease-race-case", "lease-race-turn", new Date().toISOString()],
      }),
    ).toMatchObject({ rows: [{ id: "dispatch-live-refund" }] });
    await expect(
      store.claimDispatchForResume(
        "lease-race-case",
        "lease-race-run",
        "lease-race-turn",
      ),
    ).resolves.toMatchObject({ id: "dispatch-live-refund" });
    await store.close();
  });

  it("migrates an existing credit attempt into the target reservation without losing its receipt", async () => {
    const path = temporaryDatabasePath("phase008-credit-migration");
    files.push(path, `${path}-shm`, `${path}-wal`);
    const store = new CaseStore({ url: `file:${path}` });
    await store.migrate(23);
    const client = store.getClient();
    const createdAt = "2026-09-01T00:00:00.000Z";
    await client.execute({
      sql: "INSERT INTO support_stripe_subscription_credit_attempts(id, case_id, tenant_id, provider_account_id, command_fingerprint, idempotency_key, dispatch_id, lease_token, turn_id, command_data, status, credit_id, provider_status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'succeeded', ?, ?, ?, ?)",
      args: [
        "migration-credit-attempt",
        "migration-credit-case",
        "tenant",
        "acct",
        "migration-credit-fingerprint",
        "migration-credit-key",
        "dispatch",
        "lease",
        "turn",
        JSON.stringify({
          customerId: "cus_migration",
          subscriptionId: "sub_migration",
          reason: "synthetic",
        }),
        "cbtxn_migration",
        "created",
        createdAt,
        createdAt,
      ],
    });
    await store.migrate(24);
    expect(
      await store.stripeSubscriptionCreditAttempt("migration-credit-key"),
    ).toMatchObject({
      status: "succeeded",
      creditId: "cbtxn_migration",
      terminalAt: createdAt,
    });
    await expect(
      client.execute(
        "SELECT tenant_id, provider_account_id, customer_id, subscription_id, idempotency_key, status FROM support_stripe_subscription_credit_reservations",
      ),
    ).resolves.toMatchObject({
      rows: [
        {
          tenant_id: "tenant",
          provider_account_id: "acct",
          customer_id: "cus_migration",
          subscription_id: "sub_migration",
          idempotency_key: "migration-credit-key",
          status: "succeeded",
        },
      ],
    });
    await store.close();
  });

  it("redacts and minimizes terminal credit attempts while retaining unknown recovery records", async () => {
    const store = await storeForTest();
    const client = store.getClient();
    const now = new Date("2026-09-05T00:00:00.000Z");
    const old = "2025-05-01T00:00:00.000Z";
    await client.executeMultiple(`
      CREATE TABLE IF NOT EXISTS local_subscription_credits (credit_id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL, provider_account_id TEXT NOT NULL, customer_id TEXT NOT NULL, subscription_id TEXT NOT NULL, amount_minor INTEGER NOT NULL, currency TEXT NOT NULL, reason TEXT NOT NULL, issued_at TEXT NOT NULL);
      INSERT INTO local_subscription_credits VALUES ('local-retention-credit', 'tenant', 'acct', 'cus_local', 'sub_local', 4900, 'USD', 'SYNTHETIC-CREDIT-REASON', '${old}');
    `);
    for (const status of ["succeeded", "unknown"] as const) {
      const key = `${status}-credit-key`;
      const fingerprint = `${status}-credit-fingerprint`;
      await client.execute({
        sql: "INSERT INTO support_stripe_subscription_credit_attempts(id, case_id, tenant_id, provider_account_id, command_fingerprint, idempotency_key, dispatch_id, lease_token, turn_id, command_data, status, credit_id, provider_status, terminal_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        args: [
          `${status}-credit-attempt`,
          `${status}-credit-case`,
          "tenant",
          "acct",
          fingerprint,
          key,
          "dispatch",
          "lease",
          "turn",
          JSON.stringify({
            customerId: `cus_${status}`,
            subscriptionId: `sub_${status}`,
            reason: "SYNTHETIC-CREDIT-REASON",
          }),
          status,
          status === "succeeded" ? "cbtxn_terminal" : null,
          status,
          status === "succeeded" ? old : null,
          old,
          old,
        ],
      });
      await client.execute({
        sql: "INSERT INTO support_stripe_subscription_credit_reservations(tenant_id, provider_account_id, customer_id, subscription_id, case_id, turn_id, command_fingerprint, idempotency_key, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        args: [
          "tenant",
          "acct",
          `cus_${status}`,
          `sub_${status}`,
          `${status}-credit-case`,
          "turn",
          fingerprint,
          key,
          status,
          old,
          old,
        ],
      });
      if (status === "succeeded") {
        await store.recordEffect(key, fingerprint, {
          creditId: "cbtxn_terminal",
        });
        await client.execute({
          sql: "UPDATE support_idempotency SET created_at = ? WHERE idempotency_key = ?",
          args: [old, key],
        });
      }
    }
    await store.enforceRetention(() => now);
    const retained = await client.execute(
      "SELECT status, command_data FROM support_stripe_subscription_credit_attempts ORDER BY idempotency_key",
    );
    expect(retained.rows).toEqual([
      {
        status: "unknown",
        command_data: expect.stringContaining('"reason":"[redacted]"'),
      },
    ]);
    expect(
      await client.execute(
        "SELECT reason FROM local_subscription_credits WHERE credit_id = 'local-retention-credit'",
      ),
    ).toMatchObject({ rows: [{ reason: "[redacted]" }] });
    await expect(store.idempotency("succeeded-credit-key")).rejects.toThrow(
      "tombstone",
    );
    expect(
      await client.execute(
        "SELECT COUNT(*) AS total FROM support_stripe_subscription_credit_reservations",
      ),
    ).toMatchObject({ rows: [{ total: 1 }] });
    await store.close();
  });

  it("holds one durable subscription-credit reservation across concurrent case attempts", async () => {
    const store = await storeForTest();
    const binding = {
      tenantId: "tenant",
      providerKind: "stripe" as const,
      providerAccountId: "acct",
      externalConversationId: "synthetic-credit-reservation",
    };
    const prepare = (
      caseId: string,
      fingerprint: string,
      idempotencyKey: string,
    ) =>
      store.prepareStripeSubscriptionCreditAttempt({
        caseId,
        binding,
        customerId: "cus_shared",
        subscriptionId: "sub_shared",
        fingerprint,
        idempotencyKey,
        dispatchId: `${caseId}-dispatch`,
        leaseToken: `${caseId}-lease`,
        turnId: `${caseId}-turn`,
        command: {
          caseId,
          customerId: "cus_shared",
          subscriptionId: "sub_shared",
        },
      });
    const [first, second] = await Promise.allSettled([
      prepare("credit-case-a", "credit-fingerprint-a", "credit-key-a"),
      prepare("credit-case-b", "credit-fingerprint-b", "credit-key-b"),
    ]);
    expect(
      [first, second].filter((result) => result.status === "fulfilled"),
    ).toHaveLength(1);
    expect(
      [first, second].find((result) => result.status === "rejected"),
    ).toMatchObject({
      reason: expect.objectContaining({
        message: expect.stringContaining("already reserved"),
      }),
    });
    expect(
      await store
        .getClient()
        .execute(
          "SELECT case_id, command_fingerprint FROM support_stripe_subscription_credit_reservations WHERE customer_id = 'cus_shared' AND subscription_id = 'sub_shared'",
        ),
    ).toMatchObject({
      rows: [
        expect.objectContaining({
          case_id: expect.stringMatching(/^credit-case-/),
        }),
      ],
    });
    await store.close();
  });

  it("rejects partial operational refund metadata before it reaches storage", async () => {
    const store = await storeForTest();
    const createdAt = "2026-09-05T00:00:00.000Z";
    const base = {
      id: "metadata-boundary-case",
      externalId: "metadata-boundary-event",
      source: "mock-email" as const,
      customer: { email: "metadata-boundary@example.test" },
      subject: "original subject",
      messages: [],
      status: "new" as const,
      createdAt,
      updatedAt: createdAt,
      metadata: {
        providerBinding: {
          tenantId: "local-demo",
          providerKind: "local" as const,
          providerAccountId: "local-demo",
          externalConversationId: "metadata-boundary",
        },
      },
    };
    await store.create(base);
    await expect(
      store.update(base.id, {
        subject: "must not persist",
        metadata: {
          ...base.metadata,
          refundCommand: { fingerprint: "partial" },
        },
      }),
    ).rejects.toThrow("partial refund command");
    expect((await store.get(base.id))?.subject).toBe("original subject");
    await expect(
      store.create({
        ...base,
        id: "invalid-created-metadata-case",
        externalId: "invalid-created-metadata-event",
        metadata: {
          ...base.metadata,
          refundCommand: { fingerprint: "partial" },
        },
      }),
    ).rejects.toThrow("partial refund command");
    expect(await store.get("invalid-created-metadata-case")).toBeUndefined();
    await store.close();
  });

  it("uses accepted_at, removes terminal approval prose, and repairs a contaminated tombstone", async () => {
    const store = await storeForTest();
    const client = store.getClient();
    const now = new Date("2026-09-05T00:00:00.000Z");
    const old = "2025-05-01T00:00:00.000Z";
    await store.create({
      id: "terminal-retention-case",
      externalId: "terminal-retention-event",
      source: "mock-email",
      customer: { email: "synthetic-terminal@example.test" },
      subject: "terminal note marker",
      messages: [
        {
          id: "terminal-message",
          author: "customer",
          body: "terminal note marker",
          createdAt: old,
        },
      ],
      status: "resolved",
      approval: {
        approved: true,
        approverId: "approver",
        note: "terminal approval marker",
      },
      createdAt: old,
      updatedAt: old,
      metadata: {
        providerBinding: {
          tenantId: "local-demo",
          providerKind: "local",
          providerAccountId: "local-demo",
          externalConversationId: "terminal-retention",
        },
        rawPayload: "terminal raw marker",
      },
    });
    await client.execute({
      sql: "UPDATE support_cases SET accepted_at = ? WHERE id = ?",
      args: [old, "terminal-retention-case"],
    });
    await store.enforceRetention(() => now);
    const redacted = await store.get("terminal-retention-case");
    expect(JSON.stringify(redacted)).not.toContain("terminal approval marker");
    // Simulate an older deployment that wrote only table projections after
    // the tombstone marker. The case JSON remains clean, so this cannot be
    // repaired by inspecting feedback/messages on the projection alone.
    await client.execute({
      sql: "INSERT INTO support_messages(id, case_id, data, created_at) VALUES (?, ?, ?, ?)",
      args: [
        "residual-message",
        "terminal-retention-case",
        JSON.stringify({ body: "residual table marker" }),
        now.toISOString(),
      ],
    });
    await client.execute({
      sql: "INSERT INTO support_turns(id, case_id, event_id, sequence, state, created_at, updated_at, message_data) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
      args: [
        "residual-turn",
        "terminal-retention-case",
        "residual-event",
        1,
        "resolved",
        now.toISOString(),
        now.toISOString(),
        JSON.stringify({ body: "residual turn marker" }),
      ],
    });
    await client.execute({
      sql: "INSERT INTO support_outbox(id, case_id, binding, body, status, state, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
      args: [
        "residual-outbox",
        "terminal-retention-case",
        "{}",
        "residual outbox marker",
        "resolved",
        "delivered",
        now.toISOString(),
        now.toISOString(),
      ],
    });
    await expect(
      store.update("terminal-retention-case", { subject: "blocked" }),
    ).rejects.toThrow("retention tombstone");
    await expect(
      store.appendMessage("terminal-retention-case", {
        id: "blocked-message",
        author: "customer",
        body: "blocked",
        createdAt: now.toISOString(),
      }),
    ).rejects.toThrow("retention tombstone");
    await expect(
      store.appendFollowUp({
        caseId: "terminal-retention-case",
        eventId: "blocked-event",
        runId: "blocked-run",
        message: {
          id: "blocked-follow-up",
          author: "customer",
          body: "blocked",
          createdAt: now.toISOString(),
        },
        expectedOwnerId: "customer-terminal",
      }),
    ).rejects.toThrow("retention tombstone");
    await store.enforceRetention(() => now);
    const repaired = await client.execute({
      sql: "SELECT (SELECT COUNT(*) FROM support_messages WHERE case_id = ?) AS messages, (SELECT message_data FROM support_turns WHERE id = 'residual-turn') AS turn_data, (SELECT body FROM support_outbox WHERE id = 'residual-outbox') AS outbox_body",
      args: ["terminal-retention-case"],
    });
    expect(repaired.rows[0]).toMatchObject({
      messages: 0,
      turn_data: null,
      outbox_body: "[redacted]",
    });
    expect(
      JSON.stringify(await store.get("terminal-retention-case")),
    ).not.toContain("residual");
    expect((await store.enforceRetention(() => now)).casesRedacted).toBe(0);
    await store.close();
  });

  it("uses installed LibSQL retention for persisted Mastra memory and traces, then fails stale pending work closed", async () => {
    const store = await storeForTest();
    const now = new Date("2026-09-05T00:00:00.000Z");
    const old = "2026-05-01T00:00:00.000Z";
    const client = store.getClient();
    const mastraStorage = new LibSQLStore({
      id: `retention-${crypto.randomUUID()}`,
      client,
      retention: {
        memory: {
          messages: { maxAge: "90d" },
          resources: { maxAge: "90d" },
          threads: { maxAge: "90d" },
        },
        observability: { spans: { maxAge: "30d" } },
      },
    });
    await mastraStorage.init();
    await client.execute({
      sql: "INSERT INTO mastra_messages(id, thread_id, content, role, type, createdAt, resourceId) VALUES (?, ?, ?, ?, ?, ?, ?)",
      args: [
        "memory-pii",
        "thread-pii",
        JSON.stringify({ content: "alex@example.com" }),
        "user",
        "text",
        old,
        "resource-pii",
      ],
    });
    await client.execute({
      sql: "INSERT INTO mastra_resources(id, workingMemory, metadata, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?)",
      args: ["resource-pii", "alex@example.com", "{}", old, old],
    });
    await client.execute({
      sql: "INSERT INTO mastra_threads(id, resourceId, title, metadata, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?)",
      args: ["thread-pii", "resource-pii", "alex@example.com", "{}", old, old],
    });
    await client.execute({
      sql: "INSERT INTO mastra_ai_spans(traceId, spanId, name, spanType, isEvent, startedAt, createdAt, input) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
      args: [
        "trace-pii",
        "span-pii",
        "support",
        "agent_run",
        false,
        old,
        old,
        JSON.stringify({ email: "alex@example.com" }),
      ],
    });
    // Memory/telemetry pruning excludes workflow snapshots. The app deletes a
    // snapshot only after its corresponding case has reached terminal
    // retention; an active snapshot remains recoverable.
    await client.execute({
      sql: "INSERT INTO mastra_workflow_snapshot(workflow_name, run_id, resourceId, snapshot, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?)",
      args: [
        "resolveSupportCaseWorkflow",
        "native-approval-still-recoverable",
        "resource-pii",
        JSON.stringify({ status: "suspended", email: "alex@example.com" }),
        old,
        old,
      ],
    });
    await client.execute({
      sql: "INSERT INTO mastra_workflow_snapshot(workflow_name, run_id, resourceId, snapshot, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?)",
      args: [
        "resolveSupportCaseWorkflow",
        "active-native-approval",
        "resource-active",
        JSON.stringify({ status: "suspended", email: "alex@example.com" }),
        now.toISOString(),
        now.toISOString(),
      ],
    });
    await store.create({
      id: "pending-case",
      externalId: "pending-event",
      source: "mock-email",
      customer: { email: "alex@example.com" },
      subject: "Pending private request",
      messages: [
        {
          id: "pending-message",
          author: "customer",
          body: "Do not delete before resolution",
          createdAt: old,
        },
      ],
      status: "waiting_approval",
      createdAt: old,
      updatedAt: old,
      workflowRunId: "native-approval-still-recoverable",
      metadata: {
        providerBinding: {
          tenantId: "local-demo",
          providerKind: "local",
          providerAccountId: "local-demo",
          externalConversationId: "pending",
        },
        rawPayload: { email: "alex@example.com" },
        refundCommand: {
          approvalCaseId: "pending-case",
          orderId: "ORD-1001",
          amount: 25,
          currency: "USD",
          fingerprint: "pending-fingerprint",
          idempotencyKey: "pending-key",
          reason: "alex@example.com",
        },
      },
    });
    vi.useFakeTimers();
    vi.setSystemTime(now);
    const mastraResult = await mastraStorage.prune();
    vi.useRealTimers();
    const result = await store.enforceRetention(() => now);
    const snapshotsDeleted = await purgeExpiredWorkflowSnapshots(
      mastraStorage,
      result,
    );
    expect(result).toMatchObject({
      rawPayloadsRedacted: 1,
      casesRedacted: 1,
      tracesRedacted: 0,
      pendingCasesExpired: 1,
      expiredWorkflowRunIds: ["native-approval-still-recoverable"],
    });
    expect(snapshotsDeleted).toEqual([
      "resolveSupportCaseWorkflow:native-approval-still-recoverable",
    ]);
    expect(mastraResult).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ table: "mastra_messages", deleted: 1 }),
        expect.objectContaining({ table: "mastra_resources", deleted: 1 }),
        expect.objectContaining({ table: "mastra_threads", deleted: 1 }),
        expect.objectContaining({ table: "mastra_ai_spans", deleted: 1 }),
      ]),
    );
    expect(
      (await client.execute("SELECT content FROM mastra_messages")).rows,
    ).toEqual([]);
    expect(
      (await client.execute("SELECT workingMemory FROM mastra_resources")).rows,
    ).toEqual([]);
    expect(
      (await client.execute("SELECT input FROM mastra_ai_spans")).rows,
    ).toEqual([]);
    expect(
      (
        await client.execute(
          "SELECT run_id FROM mastra_workflow_snapshot ORDER BY run_id",
        )
      ).rows,
    ).toEqual([{ run_id: "active-native-approval" }]);
    const pending = await store.get("pending-case");
    expect(pending).toMatchObject({
      status: "failed",
      messages: [],
      customer: { email: "redacted@invalid.local" },
      metadata: {
        pendingRetentionExpiredAt: now.toISOString(),
        refundCommand: {
          fingerprint: "pending-fingerprint",
          idempotencyKey: "pending-key",
        },
      },
    });
    expect(pending?.metadata).not.toHaveProperty("rawPayload");
    expect(pending?.metadata).not.toHaveProperty("refundCommand.reason");
    await store.close();
  });

  it("redacts raw payloads, traces and expired customer content while preserving replay and the audit window", async () => {
    const store = await storeForTest();
    const now = new Date("2026-09-05T00:00:00.000Z");
    const createdAt = new Date("2026-05-01T00:00:00.000Z").toISOString();
    await store.create({
      id: "expired-case",
      externalId: "expired-event",
      source: "mock-email",
      customer: { email: "alex@example.com", name: "Alex" },
      subject: "Private order data",
      messages: [
        {
          id: "expired-message",
          author: "customer",
          body: "My address is secret",
          createdAt,
        },
      ],
      status: "resolved",
      createdAt,
      updatedAt: createdAt,
      traceId: "trace-private",
      metadata: {
        providerBinding: {
          tenantId: "local-demo",
          providerKind: "local",
          providerAccountId: "local-demo",
          externalConversationId: "private-conversation",
        },
        rawPayload: { email: "alex@example.com", secret: "do-not-retain" },
      },
    });
    await store.recordEffect("replay-key", "fingerprint", {
      refundId: "REF-1",
    });
    await store.getClient().execute({
      sql: "INSERT INTO support_audit(id, case_id, kind, data, created_at) VALUES (?, ?, ?, ?, ?)",
      args: [
        "recent-audit",
        "expired-case",
        "financial-effect",
        "{}",
        "2026-01-01T00:00:00.000Z",
      ],
    });
    await store.getClient().execute({
      sql: "INSERT INTO support_audit(id, case_id, kind, data, created_at) VALUES (?, ?, ?, ?, ?)",
      args: [
        "old-audit",
        "expired-case",
        "financial-effect",
        "{}",
        "2025-01-01T00:00:00.000Z",
      ],
    });

    await expect(store.enforceRetention(() => now)).resolves.toMatchObject({
      rawPayloadsRedacted: 1,
      casesRedacted: 1,
      tracesRedacted: 1,
      auditsDeleted: 1,
      messagesDeleted: 1,
      mastraMessagesDeleted: 0,
      mastraSpansDeleted: 0,
      pendingCasesExpired: 0,
      expiredWorkflowRunIds: [],
    });
    const redacted = await store.get("expired-case");
    expect(redacted).toMatchObject({
      customer: { email: "redacted@invalid.local" },
      subject: "Redacted support case",
      messages: [],
      metadata: { retentionRedactedAt: now.toISOString() },
    });
    expect(redacted?.traceId).toBeUndefined();
    const messages = await store
      .getClient()
      .execute("SELECT data FROM support_messages WHERE case_id = ?", [
        "expired-case",
      ]);
    expect(messages.rows).toEqual([]);
    expect(await store.idempotency("replay-key")).toEqual({
      fingerprint: "fingerprint",
      effect: { refundId: "REF-1" },
    });
    const audits = await store
      .getClient()
      .execute("SELECT id FROM support_audit ORDER BY id");
    expect(audits.rows).toEqual([{ id: "recent-audit" }]);
    await store.close();
  });

  it("minimizes 366-day terminal Stripe effects into non-executable tombstones without reopening provider mutations", async () => {
    const store = await storeForTest();
    const client = store.getClient();
    const now = new Date("2026-09-05T00:00:00.000Z");
    const expired = new Date(
      now.getTime() - 366 * 24 * 60 * 60 * 1_000,
    ).toISOString();
    const retained = new Date(
      now.getTime() - 364 * 24 * 60 * 60 * 1_000,
    ).toISOString();
    await client.execute({
      sql: "INSERT INTO support_stripe_refund_attempts(id, case_id, tenant_id, provider_account_id, command_fingerprint, idempotency_key, dispatch_id, lease_token, turn_id, command_data, status, refund_id, provider_status, terminal_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'succeeded', ?, ?, ?, ?, ?)",
      args: [
        "expired-refund-attempt",
        "expired-refund-case",
        "tenant",
        "acct",
        "expired-refund-fingerprint",
        "expired-refund-key",
        "dispatch",
        "lease",
        "turn",
        JSON.stringify({
          orderId: "ord_expired",
          paymentIntentId: "pi_expired",
        }),
        "re_expired",
        "succeeded",
        expired,
        expired,
        expired,
      ],
    });
    await store.recordEffect(
      "expired-refund-key",
      "expired-refund-fingerprint",
      {
        refundId: "re_expired",
        orderId: "ord_expired",
        paymentIntentId: "pi_expired",
      },
    );
    await client.execute({
      sql: "UPDATE support_idempotency SET created_at = ? WHERE idempotency_key = ?",
      args: [expired, "expired-refund-key"],
    });
    await client.execute({
      sql: "INSERT INTO support_subscription_cancellation_attempts(idempotency_key, case_id, turn_id, tenant_id, provider_account_id, subscription_id, fingerprint, command_data, status, cancels_at, terminal_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'scheduled', ?, ?, ?, ?)",
      args: [
        "expired-cancellation-key",
        "expired-cancellation-case",
        "turn",
        "tenant",
        "acct",
        "sub_expired",
        "expired-cancellation-fingerprint",
        JSON.stringify({
          subscriptionId: "sub_expired",
          providerRef: "sub_expired",
        }),
        "2025-10-01T00:00:00.000Z",
        expired,
        expired,
        expired,
      ],
    });
    await store.recordEffect(
      "expired-cancellation-key",
      "expired-cancellation-fingerprint",
      {
        subscriptionId: "sub_expired",
        cancelsAt: "2025-10-01T00:00:00.000Z",
      },
    );
    await client.execute({
      sql: "UPDATE support_idempotency SET created_at = ? WHERE idempotency_key = ?",
      args: [expired, "expired-cancellation-key"],
    });
    // A late failed terminal row has no success effect, but it still needs a
    // durable barrier before its provider identifiers can be removed.
    await client.execute({
      sql: "INSERT INTO support_stripe_refund_attempts(id, case_id, tenant_id, provider_account_id, command_fingerprint, idempotency_key, dispatch_id, lease_token, turn_id, command_data, status, terminal_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'failed', ?, ?, ?)",
      args: [
        "expired-failed-attempt",
        "expired-failed-case",
        "tenant",
        "acct",
        "expired-failed-fingerprint",
        "expired-failed-key",
        "dispatch",
        "lease",
        "turn",
        JSON.stringify({ orderId: "ord_failed", paymentIntentId: "pi_failed" }),
        expired,
        expired,
        expired,
      ],
    });
    await client.execute({
      sql: "INSERT INTO support_stripe_refund_attempts(id, case_id, tenant_id, provider_account_id, command_fingerprint, idempotency_key, dispatch_id, lease_token, turn_id, command_data, status, refund_id, provider_status, terminal_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'succeeded', ?, ?, ?, ?, ?)",
      args: [
        "retained-poll-attempt",
        "retained-poll-case",
        "tenant",
        "acct",
        "retained-poll-fingerprint",
        "retained-poll-key",
        "dispatch",
        "lease",
        "turn",
        JSON.stringify({
          orderId: "ord_retained",
          paymentIntentId: "pi_retained",
        }),
        "re_retained",
        "succeeded",
        retained,
        expired,
        now.toISOString(),
      ],
    });
    await store.recordEffect("retained-poll-key", "retained-poll-fingerprint", {
      refundId: "re_retained",
      orderId: "ord_retained",
    });

    await store.enforceRetention(() => now);
    const payloads = await client.execute(
      "SELECT idempotency_key, fingerprint, effect, created_at FROM support_idempotency WHERE idempotency_key IN ('expired-refund-key', 'expired-cancellation-key', 'expired-failed-key', 'retained-poll-key') ORDER BY idempotency_key",
    );
    expect(payloads.rows).toEqual([
      {
        idempotency_key: "expired-cancellation-key",
        fingerprint: "expired-cancellation-fingerprint",
        effect: '{"retention":"terminal-financial-effect"}',
        created_at: expired,
      },
      {
        idempotency_key: "expired-failed-key",
        fingerprint: "expired-failed-fingerprint",
        effect: '{"retention":"terminal-financial-effect"}',
        created_at: expired,
      },
      {
        idempotency_key: "expired-refund-key",
        fingerprint: "expired-refund-fingerprint",
        effect: '{"retention":"terminal-financial-effect"}',
        created_at: expired,
      },
      {
        idempotency_key: "retained-poll-key",
        fingerprint: "retained-poll-fingerprint",
        effect: '{"refundId":"re_retained","orderId":"ord_retained"}',
        created_at: expect.any(String),
      },
    ]);
    expect(JSON.stringify(payloads.rows)).not.toContain("pi_expired");
    expect(JSON.stringify(payloads.rows)).not.toContain("sub_expired");
    expect(await store.stripeRefundAttempt("retained-poll-key")).toMatchObject({
      status: "succeeded",
      refundId: "re_retained",
    });
    expect(await store.idempotency("retained-poll-key")).toMatchObject({
      effect: { refundId: "re_retained" },
    });
    await expect(store.idempotency("expired-refund-key")).rejects.toThrow(
      "tombstone",
    );
    await expect(
      store.prepareStripeRefundAttempt({
        caseId: "new-case",
        binding: {
          tenantId: "tenant",
          providerKind: "stripe",
          providerAccountId: "acct",
          externalConversationId: "conversation",
        },
        fingerprint: "expired-refund-fingerprint",
        idempotencyKey: "expired-refund-key",
        dispatchId: "new-dispatch",
        leaseToken: "new-lease",
        turnId: "new-turn",
        command: {},
      }),
    ).rejects.toThrow("tombstone");
    await expect(
      store.prepareSubscriptionCancellationAttempt({
        caseId: "new-case",
        turnId: "new-turn",
        binding: {
          tenantId: "tenant",
          providerKind: "stripe",
          providerAccountId: "acct",
          externalConversationId: "conversation",
        },
        subscriptionId: "sub_new",
        idempotencyKey: "expired-cancellation-key",
        fingerprint: "expired-cancellation-fingerprint",
        command: {},
      }),
    ).rejects.toThrow("tombstone");
    const recreated = await client.execute(
      "SELECT COUNT(*) AS total FROM support_stripe_refund_attempts WHERE idempotency_key = 'expired-refund-key' UNION ALL SELECT COUNT(*) AS total FROM support_subscription_cancellation_attempts WHERE idempotency_key = 'expired-cancellation-key'",
    );
    expect(recreated.rows).toEqual([{ total: 0 }, { total: 0 }]);
    await store.close();
  });

  it("minimizes every expired durable customer copy and removes the enumerated snapshot families", async () => {
    const store = await storeForTest();
    const now = new Date("2026-09-05T00:00:00.000Z");
    const old = "2026-05-01T00:00:00.000Z";
    const client = store.getClient();
    await store.create({
      id: "all-copies-case",
      externalId: "all-copies-event",
      source: "mock-email",
      customer: { email: "SYNTHETIC-COPY-003@example.test" },
      subject: "SYNTHETIC-COPY-003",
      messages: [
        {
          id: "all-copies-message",
          author: "customer",
          body: "SYNTHETIC-COPY-003",
          createdAt: old,
        },
      ],
      status: "waiting_approval",
      createdAt: old,
      updatedAt: old,
      workflowRunId: "inbound-run",
      metadata: {
        providerBinding: {
          tenantId: "local-demo",
          providerKind: "local",
          providerAccountId: "local-demo",
          externalConversationId: "all-copies",
        },
        rawPayload: "SYNTHETIC-COPY-003",
        refundCommand: {
          approvalCaseId: "all-copies-case",
          orderId: "ORD-1001",
          amount: 25,
          currency: "USD",
          fingerprint: "replay-fingerprint",
          idempotencyKey: "replay-key-003",
          reason: "SYNTHETIC-COPY-003",
        },
      },
    });
    await client.executeMultiple(`
      INSERT INTO support_turns(id, case_id, event_id, sequence, state, created_at, updated_at, run_id, message_data, outcome_data) VALUES ('turn-inbound', 'all-copies-case', 'all-copies-event', 1, 'pending', '${old}', '${old}', 'inbound-run', '{"body":"SYNTHETIC-COPY-003"}', '{"draft":"SYNTHETIC-COPY-003"}');
      INSERT INTO support_turns(id, case_id, event_id, sequence, state, created_at, updated_at, run_id, message_data, outcome_data) VALUES ('turn-native', 'all-copies-case', 'all-copies-native-event', 2, 'waiting_approval', '${old}', '${old}', 'durable-native-run', '{"body":"SYNTHETIC-COPY-003"}', '{"approval":"SYNTHETIC-COPY-003"}');
      INSERT INTO support_dispatch(id, case_id, turn_id, run_id, state, attempts, lease_until, lease_token, last_error, created_at, updated_at) VALUES ('dispatch-copies', 'all-copies-case', 'turn-inbound', 'resolution-run', 'suspended', 1, '${old}', 'SYNTHETIC-COPY-003', 'SYNTHETIC-COPY-003', '${old}', '${old}');
      INSERT INTO support_outbox(id, case_id, binding, body, status, state, attempts, receipt, last_error, created_at, updated_at) VALUES ('outbox-copies', 'all-copies-case', '{}', 'SYNTHETIC-COPY-003', 'failed', 'failed', 1, 'SYNTHETIC-COPY-003', 'SYNTHETIC-COPY-003', '${old}', '${old}');
      INSERT INTO support_decisions(id, case_id, turn_id, command_fingerprint, native_run_id, native_tool_call_id, principal_id, approved, note, created_at) VALUES ('decision-agentic', 'all-copies-case', 'turn-inbound', 'fingerprint-agentic', 'native-agentic-run', 'tool-call', 'approver-demo', 1, 'SYNTHETIC-COPY-003', '${old}');
      INSERT INTO support_decisions(id, case_id, turn_id, command_fingerprint, native_run_id, native_tool_call_id, principal_id, approved, note, created_at) VALUES ('decision-durable', 'all-copies-case', 'turn-native', 'fingerprint-durable', 'durable-native-run', 'tool-call-2', 'approver-demo', 1, 'SYNTHETIC-COPY-003', '${old}');
      INSERT INTO support_actions(id, case_id, kind, fingerprint, data, created_at) VALUES ('action-copies', 'all-copies-case', 'refund', 'action-fingerprint', '{"reason":"SYNTHETIC-COPY-003"}', '${old}');
      INSERT INTO support_audit(id, case_id, kind, data, created_at) VALUES ('audit-financial-window', 'all-copies-case', 'financial-effect', '{"reason":"SYNTHETIC-COPY-003"}', '${old}');
      CREATE TABLE IF NOT EXISTS local_refunds (refund_id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL, provider_account_id TEXT NOT NULL, order_id TEXT NOT NULL, amount_minor INTEGER NOT NULL, currency TEXT NOT NULL, reason TEXT NOT NULL, issued_at TEXT NOT NULL);
      INSERT INTO local_refunds(refund_id, tenant_id, provider_account_id, order_id, amount_minor, currency, reason, issued_at) VALUES ('refund-copies', 'local-demo', 'local-demo', 'order-1', 100, 'USD', 'SYNTHETIC-COPY-003', '${old}');
    `);
    await store.recordEffect("replay-key-003", "replay-fingerprint", {
      refundId: "refund-copies",
    });
    const mastraStorage = new LibSQLStore({
      id: `retention-copies-${crypto.randomUUID()}`,
      client,
    });
    await mastraStorage.init();
    for (const [workflowName, runId] of [
      ["ingest-support-case", "ingress-storage-uuid"],
      ["resolve-support-case", "resolution-storage-uuid"],
      ["agentic-loop", "native-agentic-storage-uuid"],
      ["durable-agentic-loop", "durable-native-storage-uuid"],
      ["agentic-loop", "active-native-run"],
    ])
      await client.execute({
        sql: "INSERT INTO mastra_workflow_snapshot(workflow_name, run_id, snapshot, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?)",
        args: [
          workflowName,
          runId,
          runId === "active-native-run"
            ? '{"input":{"caseId":"active-case"},"content":"active recovery"}'
            : '{"input":{"caseId":"all-copies-case"},"content":"SYNTHETIC-COPY-003"}',
          old,
          old,
        ],
      });

    const result = await store.enforceRetention(() => now);
    const deleted = await purgeExpiredWorkflowSnapshots(mastraStorage, result);
    expect(result).toMatchObject({
      turnsRedacted: 2,
      outboxRecordsRedacted: 1,
      dispatchesExpired: 1,
      decisionsRedacted: 2,
      actionsRedacted: 1,
      financialReasonsRedacted: 1,
    });
    expect(deleted.sort()).toEqual([
      "agentic-loop:native-agentic-storage-uuid",
      "durable-agentic-loop:durable-native-storage-uuid",
      "ingest-support-case:ingress-storage-uuid",
      "resolve-support-case:resolution-storage-uuid",
    ]);
    const retained = await client.execute(
      "SELECT run_id FROM mastra_workflow_snapshot ORDER BY run_id",
    );
    expect(retained.rows).toEqual([{ run_id: "active-native-run" }]);
    await client.execute({
      sql: "INSERT INTO mastra_workflow_snapshot(workflow_name, run_id, snapshot, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?)",
      args: [
        "agentic-loop",
        "retry-native-storage-uuid",
        '{"input":{"caseId":"all-copies-case"}}',
        old,
        old,
      ],
    });
    const workflowStore = await mastraStorage.getStore("workflows");
    const failingStorage = {
      getStore: async () => ({
        ...workflowStore,
        listWorkflowRuns: workflowStore!.listWorkflowRuns.bind(workflowStore),
        deleteWorkflowRunById: async () => {
          throw new Error("injected supported-delete failure");
        },
      }),
    } as never;
    await expect(
      purgeExpiredWorkflowSnapshots(failingStorage, result),
    ).rejects.toThrow("injected supported-delete failure");
    const retryRetention = await store.enforceRetention(() => now);
    expect(retryRetention.expiredCaseIds).toEqual(["all-copies-case"]);
    expect(
      await purgeExpiredWorkflowSnapshots(mastraStorage, retryRetention),
    ).toEqual(["agentic-loop:retry-native-storage-uuid"]);
    const copies = await client.execute(`
      SELECT data FROM support_cases WHERE id = 'all-copies-case'
      UNION ALL SELECT data FROM support_messages WHERE case_id = 'all-copies-case'
      UNION ALL SELECT COALESCE(message_data, '') || COALESCE(outcome_data, '') FROM support_turns WHERE case_id = 'all-copies-case'
      UNION ALL SELECT body || COALESCE(receipt, '') || COALESCE(last_error, '') FROM support_outbox WHERE case_id = 'all-copies-case'
      UNION ALL SELECT COALESCE(last_error, '') FROM support_dispatch WHERE case_id = 'all-copies-case'
      UNION ALL SELECT COALESCE(note, '') FROM support_decisions WHERE case_id = 'all-copies-case'
      UNION ALL SELECT data FROM support_actions WHERE case_id = 'all-copies-case'
      UNION ALL SELECT reason FROM local_refunds WHERE refund_id = 'refund-copies'
    `);
    expect(JSON.stringify(copies.rows)).not.toContain("SYNTHETIC-COPY-003");
    // Financial audit content keeps its 365-day retention window; identifiers
    // and the idempotency row remain so cleanup cannot authorize a new effect.
    expect(
      await client.execute(
        "SELECT data FROM support_audit WHERE id = 'audit-financial-window'",
      ),
    ).toMatchObject({ rows: [{ data: '{"reason":"SYNTHETIC-COPY-003"}' }] });
    await expect(
      store.recordEffect("replay-key-003", "different-fingerprint", {}),
    ).rejects.toThrow();
    await store.close();
  });

  it("runs the local-only CLI against the same bounded durable cleanup contract", async () => {
    const path = temporaryDatabasePath("phase003-retention-cli");
    files.push(path, `${path}-shm`, `${path}-wal`);
    const store = new CaseStore({ url: `file:${path}` });
    const old = "2025-05-01T00:00:00.000Z";
    await store.acceptInbound(
      {
        id: "cli-retention-case",
        externalId: "cli-retention-event",
        source: "mock-email",
        customer: { email: "SYNTHETIC-CLI-003@example.test" },
        subject: "SYNTHETIC-CLI-003",
        messages: [
          {
            id: "cli-retention-message",
            author: "customer",
            body: "SYNTHETIC-CLI-003",
            createdAt: old,
          },
        ],
        status: "escalated",
        approval: {
          approved: false,
          approverId: "cli-approver",
          note: "cli terminal approval marker",
        },
        createdAt: old,
        updatedAt: old,
        metadata: {
          providerBinding: {
            tenantId: "local-demo",
            providerKind: "local",
            providerAccountId: "local-demo",
            externalConversationId: "cli-retention",
          },
          rawPayload: "SYNTHETIC-CLI-003",
        },
      },
      "cli-retention-event",
      "cli-inbound-run",
    );
    const client = store.getClient();
    const storage = new LibSQLStore({
      id: `retention-cli-${crypto.randomUUID()}`,
      client,
    });
    await storage.init();
    await client.execute({
      sql: "INSERT INTO mastra_workflow_snapshot(workflow_name, run_id, snapshot, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?)",
      args: [
        "ingest-support-case",
        "cli-ingress-storage-uuid",
        '{"body":"SYNTHETIC-CLI-003"}',
        old,
        old,
      ],
    });
    await client.execute({
      sql: "INSERT INTO support_feedback(id, case_id, turn_id, actor_id, data, created_at, dedupe_key, attribution_state) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
      args: [
        "cli-retention-feedback",
        "cli-retention-case",
        "cli-retention-turn",
        "synthetic-retention-actor",
        JSON.stringify({
          rating: "down",
          comment: "SYNTHETIC-DURABLE-FEEDBACK-003",
          actorId: "synthetic-retention-actor",
          turnId: "cli-retention-turn",
          runId: "cli-retention-run",
          traceId: "cli-retention-trace",
          submittedAt: old,
        }),
        old,
        "down",
        "known",
      ],
    });
    await store.close();
    const { stdout } = await execFileAsync(
      process.execPath,
      ["scripts/retention.mjs"],
      {
        cwd: process.cwd(),
        env: {
          ...process.env,
          APP_MODE: "local",
          DATABASE_URL: `file:${path}`,
          LOCAL_DEMO_DATABASE_URL: `file:${path}`,
          ORIGINAL_DATABASE_URL: `file:${path}.external`,
          NODE_ENV: "test",
          SUPPORT_TEST_RETENTION_NOW: "2026-09-05T00:00:00.000Z",
        },
      },
    );
    const output = JSON.parse(stdout) as {
      cases: { casesRedacted: number; feedbackDeleted: number };
      snapshotsDeleted: string[];
    };
    expect(output.cases.casesRedacted).toBe(1);
    expect(output.cases.feedbackDeleted).toBe(1);
    expect(output.snapshotsDeleted).toEqual([
      "ingest-support-case:cli-ingress-storage-uuid",
    ]);
    const reopened = new CaseStore({ url: `file:${path}` });
    expect(
      JSON.stringify(await reopened.get("cli-retention-case")),
    ).not.toContain("cli terminal approval marker");
    expect(
      await reopened.getClient().execute({
        sql: "SELECT COUNT(*) AS count FROM support_feedback WHERE case_id = ?",
        args: ["cli-retention-case"],
      }),
    ).toMatchObject({ rows: [{ count: 0 }] });
    await reopened.close();
    const repeated = await execFileAsync(
      process.execPath,
      ["scripts/retention.mjs"],
      {
        cwd: process.cwd(),
        env: {
          ...process.env,
          APP_MODE: "local",
          DATABASE_URL: `file:${path}`,
          LOCAL_DEMO_DATABASE_URL: `file:${path}`,
          ORIGINAL_DATABASE_URL: `file:${path}.external`,
          NODE_ENV: "test",
          SUPPORT_TEST_RETENTION_NOW: "2027-09-05T00:00:00.000Z",
        },
      },
    );
    expect(JSON.parse(repeated.stdout).cases).toMatchObject({
      casesRedacted: 0,
      feedbackDeleted: 0,
    });
  });

  it("upgrades populated v6/v7 turn history through v9 and refuses every unsupported downgrade without mutation", async () => {
    const path = temporaryDatabasePath("phase003-migration");
    files.push(path, `${path}-shm`, `${path}-wal`);
    const store = new CaseStore({ url: `file:${path}` });
    await store.migrate(6);
    await expect(store.migrate(5)).rejects.toThrow(
      "Refusing unsupported downgrade from support schema v6 to v5.",
    );
    await store.migrate(7);
    await expect(store.migrate(6)).rejects.toThrow(
      "Refusing unsupported downgrade from support schema v7 to v6.",
    );
    const client = store.getClient();
    const createdAt = "2026-09-05T00:00:00.000Z";
    const caseData = JSON.stringify({
      id: "migration-case",
      externalId: "migration-event",
      source: "mock-email",
      customer: { email: "migration@example.test" },
      subject: "migration",
      messages: [
        {
          id: "migration-message-one",
          author: "customer",
          body: "first immutable turn",
          createdAt,
        },
        {
          id: "migration-message-two",
          author: "customer",
          body: "second immutable turn",
          createdAt,
        },
      ],
      status: "resolved",
      createdAt,
      updatedAt: createdAt,
      metadata: {
        providerBinding: {
          tenantId: "local-demo",
          providerKind: "local",
          providerAccountId: "local-demo",
          externalConversationId: "migration",
        },
      },
    });
    await client.execute({
      sql: "INSERT INTO support_cases(id, source, external_id, data, created_at, updated_at, version, tenant_id, provider_account_id, provider_binding) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
      args: [
        "migration-case",
        "mock-email",
        "migration-event",
        caseData,
        createdAt,
        createdAt,
        1,
        "local-demo",
        "local-demo",
        JSON.stringify({
          tenantId: "local-demo",
          providerKind: "local",
          providerAccountId: "local-demo",
          externalConversationId: "migration",
        }),
      ],
    });
    await client.executeMultiple(`
      INSERT INTO support_turns(id, case_id, event_id, sequence, state, created_at, updated_at, run_id) VALUES ('migration-turn-one', 'migration-case', 'migration-event', 1, 'resolved', '${createdAt}', '${createdAt}', 'migration-run-one');
      INSERT INTO support_turns(id, case_id, event_id, sequence, state, created_at, updated_at, run_id) VALUES ('migration-turn-two', 'migration-case', 'migration-event-two', 2, 'resolved', '${createdAt}', '${createdAt}', 'migration-run-two');
    `);
    await store.migrate(9);
    await store.migrate(9);
    const beforeRefusal = await client.execute(`
      SELECT
        (SELECT group_concat(version, ',') FROM support_schema_migrations) AS versions,
        (SELECT group_concat(id, ',') FROM support_turns WHERE case_id = 'migration-case' ORDER BY id) AS turns,
        (SELECT group_concat(message_data, '|') FROM support_turns WHERE case_id = 'migration-case' ORDER BY id) AS messages
    `);
    await expect(store.migrate(8)).rejects.toThrow(
      "Refusing unsupported downgrade from support schema v9 to v8.",
    );
    const afterRefusal = await client.execute(`
      SELECT
        (SELECT group_concat(version, ',') FROM support_schema_migrations) AS versions,
        (SELECT group_concat(id, ',') FROM support_turns WHERE case_id = 'migration-case' ORDER BY id) AS turns,
        (SELECT group_concat(message_data, '|') FROM support_turns WHERE case_id = 'migration-case' ORDER BY id) AS messages
    `);
    expect(afterRefusal.rows).toEqual(beforeRefusal.rows);
    expect(afterRefusal.rows[0]).toMatchObject({
      versions: "1,2,3,4,5,6,7,8,9",
      turns: "migration-turn-one,migration-turn-two",
    });
    await store.close();
    const reopened = new CaseStore({ url: `file:${path}` });
    expect(await reopened.get("migration-case")).toMatchObject({
      id: "migration-case",
      externalId: "migration-event",
    });
    await reopened.close();
  });

  it("rolls back an ambiguous v9 canonical migration before markers or data change, then backfills trusted acceptance evidence", async () => {
    const path = temporaryDatabasePath("phase003-v9-conflict");
    files.push(path, `${path}-shm`, `${path}-wal`);
    const store = new CaseStore({ url: `file:${path}` });
    await store.migrate(8);
    const client = store.getClient();
    const caseData = (id: string, conversation: string, createdAt: string) =>
      JSON.stringify({
        id,
        externalId: `${id}-event`,
        source: "mock-email",
        customer: { email: `${id}@example.test` },
        subject: `migration ${id}`,
        messages: [],
        status: "resolved",
        createdAt,
        updatedAt: createdAt,
        metadata: {
          providerBinding: {
            tenantId: "local-demo",
            providerKind: "local",
            providerAccountId: "local-demo",
            externalConversationId: conversation,
          },
          ownerId: `owner-${id}`,
        },
      });
    const insert = async (
      id: string,
      conversation: string,
      createdAt: string,
    ) =>
      client.execute({
        sql: "INSERT INTO support_cases(id, source, external_id, data, created_at, updated_at, version, tenant_id, provider_account_id, provider_binding) VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?, ?)",
        args: [
          id,
          "mock-email",
          `${id}-event`,
          caseData(id, conversation, createdAt),
          createdAt,
          createdAt,
          "local-demo",
          "local-demo",
          JSON.stringify({
            tenantId: "local-demo",
            providerKind: "local",
            providerAccountId: "local-demo",
            externalConversationId: conversation,
          }),
        ],
      });
    await insert(
      "canonical-one",
      "ambiguous-conversation",
      "2026-08-01T00:00:00.000Z",
    );
    await insert(
      "canonical-two",
      "ambiguous-conversation",
      "2026-08-02T00:00:00.000Z",
    );
    await insert(
      "future-fallback",
      "future-conversation",
      "2099-01-01T00:00:00.000Z",
    );
    await client.execute({
      sql: "INSERT INTO support_events(id, tenant_id, provider_account_id, source, external_id, case_id, accepted_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
      args: [
        "trusted-acceptance-evidence",
        "local-demo",
        "local-demo",
        "mock-email",
        "canonical-one-event",
        "canonical-one",
        "2026-08-15T12:00:00.000Z",
      ],
    });
    const beforeFailure = await client.execute(
      "SELECT id, data, created_at FROM support_cases ORDER BY id",
    );
    await expect(store.migrate(9)).rejects.toThrow(
      "Refusing canonical conversation migration: ambiguous historical conversation",
    );
    expect(
      (await client.execute("PRAGMA table_info(support_cases)")).rows.map(
        (column) => column.name,
      ),
    ).not.toContain("accepted_at");
    expect(
      (
        await client.execute(
          "SELECT version FROM support_schema_migrations ORDER BY version",
        )
      ).rows.map((row) => row.version),
    ).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    expect(
      (
        await client.execute(
          "SELECT id, data, created_at FROM support_cases ORDER BY id",
        )
      ).rows,
    ).toEqual(beforeFailure.rows);

    await client.execute(
      "DELETE FROM support_cases WHERE id = 'canonical-two'",
    );
    const beforeRepair = new Date();
    await store.migrate(9);
    const afterRepair = new Date();
    const accepted = await client.execute(
      "SELECT id, accepted_at FROM support_cases ORDER BY id",
    );
    expect(accepted.rows).toContainEqual({
      id: "canonical-one",
      accepted_at: "2026-08-15T12:00:00.000Z",
    });
    const future = accepted.rows.find((row) => row.id === "future-fallback");
    expect(
      new Date(String(future?.accepted_at)).getTime(),
    ).toBeGreaterThanOrEqual(beforeRepair.getTime());
    expect(new Date(String(future?.accepted_at)).getTime()).toBeLessThanOrEqual(
      afterRepair.getTime(),
    );
    await store.close();
    const reopened = new CaseStore({ url: `file:${path}` });
    expect(await reopened.get("canonical-one")).toMatchObject({
      id: "canonical-one",
    });
    await reopened.close();
  });
});
