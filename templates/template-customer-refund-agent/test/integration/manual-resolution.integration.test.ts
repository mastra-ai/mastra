import { rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { CaseStore } from "../../src/mastra/lib/case-store";
import { IntercomClient } from "../../src/mastra/providers/intercom/client";
import type { IntercomDevelopmentConfig } from "../../src/mastra/providers/intercom/config";
import { IntercomSupportProvider } from "../../src/mastra/providers/intercom/support";
import { deliverOutbox } from "../../src/mastra/runtime/outbox";
import type { ProviderRegistry } from "../../src/mastra/providers/contracts";

const files: string[] = [];
async function fixture() {
  const path = join(tmpdir(), `manual-resolution-${crypto.randomUUID()}.db`);
  files.push(path, `${path}-wal`, `${path}-shm`);
  const store = new CaseStore({ url: `file:${path}` });
  const timestamp = "2026-09-11T12:00:00.000Z";
  const binding = {
    tenantId: "local-demo",
    providerKind: "intercom" as const,
    providerAccountId: "app-test",
    externalConversationId: "conversation-test",
  };
  await store.create({
    id: "case-manual",
    externalId: "event-manual",
    source: "intercom-conversation",
    customer: { email: "jordan@example.test", name: "Jordan Kim" },
    subject: "Escalated fixture",
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
      ownerId: "customer-jordan",
      activeTurnId: "turn-manual",
      providerBinding: binding,
    },
  });
  await store.getClient().execute({
    sql: "INSERT INTO support_turns(id, case_id, event_id, sequence, state, created_at, updated_at, message_data, outcome_data) VALUES (?, ?, ?, 1, 'escalated', ?, ?, ?, ?)",
    args: [
      "turn-manual",
      "case-manual",
      "event-manual",
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
  return store;
}
function intercomConfig(): IntercomDevelopmentConfig {
  return {
    enabled: true,
    tenantId: "local-demo",
    accountId: "app-test",
    accessToken: "synthetic-token",
    clientSecret: "synthetic-secret",
    adminId: "admin-test",
    apiBaseUrl: "http://intercom.test",
    knowledgeEnabled: false,
  };
}
function conversation(
  state: "open" | "closed",
  parts: Array<Record<string, unknown>> = [],
) {
  return Response.json({
    type: "conversation",
    id: "conversation-test",
    state,
    conversation_parts: {
      conversation_parts: parts,
      total_count: parts.length,
    },
  });
}
function registryFor(fetchImpl: typeof fetch): ProviderRegistry {
  const config = intercomConfig();
  const support = new IntercomSupportProvider(
    config,
    new IntercomClient(config, fetchImpl),
  );
  return {
    support: () => support,
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
}
async function acceptManualResolution(store: CaseStore, key: string) {
  await store.resolveManually({
    caseId: "case-manual",
    tenantId: "local-demo",
    actorId: "support-agent-demo",
    expectedVersion: 1,
    expectedTurnId: "turn-manual",
    idempotencyKey: key,
    internalNote: "Close only if this customer turn is still current.",
  });
}
async function appendRacingFollowUp(store: CaseStore, eventId: string) {
  return store.appendFollowUp({
    caseId: "case-manual",
    eventId,
    runId: `run-${eventId}`,
    message: {
      id: `message-${eventId}`,
      author: "customer",
      body: "A newer customer question arrived.",
      createdAt: new Date().toISOString(),
    },
  });
}
afterEach(async () => {
  await Promise.all(files.splice(0).map((file) => rm(file, { force: true })));
});

describe("manual resolution", () => {
  it("creates one internal message and ordered note/close intents, then replays exactly once", async () => {
    const store = await fixture();
    const command = {
      caseId: "case-manual",
      tenantId: "local-demo",
      actorId: "support-agent-demo",
      expectedVersion: 1,
      expectedTurnId: "turn-manual",
      idempotencyKey: "manual-resolution-key-001",
      internalNote: "Reviewed with the customer; close the conversation.",
    };
    const [left, right] = await Promise.all([
      store.resolveManually(command),
      store.resolveManually(command),
    ]);
    expect([left.state, right.state].sort()).toEqual(["accepted", "replayed"]);
    expect((await store.get("case-manual"))?.status).toBe("resolved");
    const outbox = await store
      .getClient()
      .execute(
        "SELECT id, operation, state FROM support_outbox WHERE case_id = 'case-manual' ORDER BY id",
      );
    expect(outbox.rows).toMatchObject([
      { operation: "note", state: "pending" },
      { operation: "status", state: "pending" },
    ]);
    const [note] = await store.claimOutbox(1);
    expect(note).toMatchObject({ operation: "note" });
    await store.completeOutbox(
      note!.id,
      { receipt: "fixture" },
      note!.leaseToken,
    );
    expect(await store.claimOutbox(1)).toMatchObject([{ operation: "status" }]);
    const conflict = await store.resolveManually({
      ...command,
      internalNote: "Different note",
    });
    expect(conflict).toMatchObject({ state: "conflict" });
    await store.close();
  });

  it("does not resolve while a dispatch is active", async () => {
    const store = await fixture();
    await store.getClient().execute({
      sql: "INSERT INTO support_dispatch(id, case_id, turn_id, run_id, state, attempts, created_at, updated_at) VALUES ('dispatch-active', 'case-manual', 'turn-other', 'run-other', 'pending', 0, ?, ?)",
      args: [new Date().toISOString(), new Date().toISOString()],
    });
    const result = await store.resolveManually({
      caseId: "case-manual",
      tenantId: "local-demo",
      actorId: "support-agent-demo",
      expectedVersion: 1,
      expectedTurnId: "turn-manual",
      idempotencyKey: "manual-resolution-key-002",
      internalNote: "Do not apply",
    });
    expect(result).toMatchObject({ state: "conflict" });
    expect((await store.get("case-manual"))?.status).toBe("escalated");
    await store.close();
  });

  it("supersedes queued manual note and close after a customer follow-up", async () => {
    const store = await fixture();
    await store.resolveManually({
      caseId: "case-manual",
      tenantId: "local-demo",
      actorId: "support-agent-demo",
      expectedVersion: 1,
      expectedTurnId: "turn-manual",
      idempotencyKey: "manual-resolution-key-003",
      internalNote: "This must not reach a later customer turn.",
    });
    await store.appendFollowUp({
      caseId: "case-manual",
      eventId: "customer-follow-up",
      runId: "run-follow-up",
      message: {
        id: "customer-follow-up-message",
        author: "customer",
        body: "One more question",
        createdAt: new Date().toISOString(),
      },
    });
    let effects = 0;
    const registry: ProviderRegistry = {
      support: () => ({
        kind: "intercom",
        normalizeInbound: async () => {
          throw new Error("not used");
        },
        deliver: async () => {
          effects += 1;
          return { receiptId: "reply", deliveredAt: new Date().toISOString() };
        },
        addInternalNote: async () => {
          effects += 1;
          return { receiptId: "note", deliveredAt: new Date().toISOString() };
        },
        updateStatus: async () => {
          effects += 1;
          return { receiptId: "close", deliveredAt: new Date().toISOString() };
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
    await deliverOutbox(registry, 10, store);
    expect(effects).toBe(0);
    expect(
      await store
        .getClient()
        .execute(
          "SELECT state FROM support_outbox WHERE case_id = 'case-manual' ORDER BY id",
        ),
    ).toMatchObject({
      rows: [{ state: "superseded" }, { state: "superseded" }],
    });
    await store.close();
  });

  it("uses the real Intercom adapter fence after its delayed note GET", async () => {
    const store = await fixture();
    await acceptManualResolution(store, "manual-resolution-key-delayed-note");
    let noteGetReached: (() => void) | undefined;
    const noteGetReachedPromise = new Promise<void>((resolve) => {
      noteGetReached = resolve;
    });
    let releaseGet: (() => void) | undefined;
    const releaseGetPromise = new Promise<void>((resolve) => {
      releaseGet = resolve;
    });
    let posts = 0;
    const registry = registryFor(async (_input, init) => {
      if (init?.method === "GET") {
        noteGetReached?.();
        await releaseGetPromise;
        return conversation("open");
      }
      posts += 1;
      return conversation("open", [
        {
          id: "note-part",
          part_type: "note",
          author: { type: "admin", id: "admin-test" },
          body: "Close only if this customer turn is still current.",
        },
      ]);
    });
    const delivery = deliverOutbox(registry, 1, store);
    await noteGetReachedPromise;
    await appendRacingFollowUp(store, "delayed-note-follow-up");
    releaseGet?.();
    await delivery;
    expect(posts).toBe(0);
    expect(
      await store
        .getClient()
        .execute(
          "SELECT operation, state FROM support_outbox WHERE case_id = 'case-manual' ORDER BY id",
        ),
    ).toMatchObject({
      rows: [
        { operation: "note", state: "superseded" },
        { operation: "status", state: "superseded" },
      ],
    });
    await store.close();
  });

  it("suppresses the close POST when a follow-up wins during the real adapter GET", async () => {
    const store = await fixture();
    await acceptManualResolution(store, "manual-resolution-key-delayed-close");
    let phase: "note" | "close" = "note";
    let closeGetReached: (() => void) | undefined;
    const closeGetReachedPromise = new Promise<void>((resolve) => {
      closeGetReached = resolve;
    });
    let releaseCloseGet: (() => void) | undefined;
    const releaseCloseGetPromise = new Promise<void>((resolve) => {
      releaseCloseGet = resolve;
    });
    const posts: string[] = [];
    const registry = registryFor(async (_input, init) => {
      if (init?.method === "GET") {
        if (phase === "close") {
          closeGetReached?.();
          await releaseCloseGetPromise;
        }
        return conversation("open");
      }
      const body = JSON.parse(String(init?.body)) as { message_type: string };
      posts.push(body.message_type);
      return conversation(body.message_type === "close" ? "closed" : "open", [
        {
          id: `${body.message_type}-part`,
          part_type: body.message_type === "note" ? "note" : "close",
          author: { type: "admin", id: "admin-test" },
          body:
            body.message_type === "note"
              ? "Close only if this customer turn is still current."
              : "",
        },
      ]);
    });
    await deliverOutbox(registry, 1, store);
    phase = "close";
    const delivery = deliverOutbox(registry, 1, store);
    await closeGetReachedPromise;
    await appendRacingFollowUp(store, "delayed-close-follow-up");
    releaseCloseGet?.();
    await delivery;
    expect(posts).toEqual(["note"]);
    expect(
      await store
        .getClient()
        .execute("SELECT state FROM support_outbox WHERE operation = 'status'"),
    ).toMatchObject({ rows: [{ state: "superseded" }] });
    await store.close();
  });

  it("reopens only the exact Intercom conversation after an already-sent stale close", async () => {
    const store = await fixture();
    await acceptManualResolution(store, "manual-resolution-key-inflight-close");
    let remoteState: "open" | "closed" = "open";
    const posts: string[] = [];
    const registry = registryFor(async (_input, init) => {
      if (init?.method === "GET") return conversation(remoteState);
      const body = JSON.parse(String(init?.body)) as { message_type: string };
      posts.push(body.message_type);
      if (body.message_type === "note")
        return conversation("open", [
          {
            id: "note-part",
            part_type: "note",
            author: { type: "admin", id: "admin-test" },
            body: "Close only if this customer turn is still current.",
          },
        ]);
      if (body.message_type === "close") {
        // The adapter fence has passed: this is the unavoidable remote POST
        // window. The accepted follow-up must trigger exact-ID reconciliation.
        await appendRacingFollowUp(store, "inflight-close-follow-up");
        remoteState = "closed";
        return conversation("closed", [
          {
            id: "close-part",
            part_type: "close",
            author: { type: "admin", id: "admin-test" },
            body: "",
          },
        ]);
      }
      remoteState = "open";
      return conversation("open", [
        {
          id: "open-part",
          part_type: "open",
          author: { type: "admin", id: "admin-test" },
          body: "",
        },
      ]);
    });
    await deliverOutbox(registry, 1, store);
    await deliverOutbox(registry, 1, store);
    expect(posts).toEqual(["note", "close", "open"]);
    expect(remoteState).toBe("open");
    expect((await store.get("case-manual"))?.status).toBe("new");
    expect(
      await store
        .getClient()
        .execute("SELECT state FROM support_outbox WHERE operation = 'status'"),
    ).toMatchObject({ rows: [{ state: "superseded" }] });
    await store.close();
  });

  it("keeps an interrupted stale close uncertain across restart instead of blindly reopening or retrying", async () => {
    const path = join(
      tmpdir(),
      `manual-resolution-restart-${crypto.randomUUID()}.db`,
    );
    files.push(path, `${path}-wal`, `${path}-shm`);
    const store = new CaseStore({ url: `file:${path}` });
    const timestamp = "2026-09-11T12:00:00.000Z";
    const binding = {
      tenantId: "local-demo",
      providerKind: "intercom" as const,
      providerAccountId: "app-test",
      externalConversationId: "conversation-test",
    };
    await store.create({
      id: "case-manual",
      externalId: "event-manual",
      source: "intercom-conversation",
      customer: { email: "jordan@example.test", name: "Jordan Kim" },
      subject: "Escalated fixture",
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
        ownerId: "customer-jordan",
        activeTurnId: "turn-manual",
        providerBinding: binding,
      },
    });
    await store.getClient().execute({
      sql: "INSERT INTO support_turns(id, case_id, event_id, sequence, state, created_at, updated_at, message_data, outcome_data) VALUES ('turn-manual', 'case-manual', 'event-manual', 1, 'escalated', ?, ?, ?, ?)",
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
    await acceptManualResolution(store, "manual-resolution-key-restart-close");
    let posts = 0;
    const registry = registryFor(async (_input, init) => {
      if (init?.method === "GET") return conversation("open");
      const body = JSON.parse(String(init?.body)) as { message_type: string };
      posts += 1;
      if (body.message_type === "note")
        return conversation("open", [
          {
            id: "note-part",
            part_type: "note",
            author: { type: "admin", id: "admin-test" },
            body: "Close only if this customer turn is still current.",
          },
        ]);
      await appendRacingFollowUp(store, "interrupted-close-follow-up");
      throw new TypeError("connection dropped after the close POST began");
    });
    await deliverOutbox(registry, 1, store);
    await deliverOutbox(registry, 1, store);
    expect(posts).toBe(2);
    expect(
      await store
        .getClient()
        .execute("SELECT state FROM support_outbox WHERE operation = 'status'"),
    ).toMatchObject({ rows: [{ state: "uncertain" }] });
    await store.close();

    const restarted = new CaseStore({ url: `file:${path}` });
    await deliverOutbox(registry, 10, restarted);
    expect(posts).toBe(2);
    expect(
      await restarted
        .getClient()
        .execute("SELECT state FROM support_outbox WHERE operation = 'status'"),
    ).toMatchObject({ rows: [{ state: "uncertain" }] });
    await restarted.close();
  });

  it("allows a distinct manually resolved escalated follow-up while preserving exact retry semantics", async () => {
    const store = await fixture();
    const first = {
      caseId: "case-manual",
      tenantId: "local-demo",
      actorId: "support-agent-demo",
      expectedVersion: 1,
      expectedTurnId: "turn-manual",
      idempotencyKey: "manual-resolution-key-first",
      internalNote: "First committed escalation was reviewed.",
    };
    expect((await store.resolveManually(first)).state).toBe("accepted");
    const followUp = await store.appendFollowUp({
      caseId: "case-manual",
      eventId: "customer-follow-up-second-resolution",
      runId: "run-follow-up-second-resolution",
      message: {
        id: "customer-follow-up-second-resolution-message",
        author: "customer",
        body: "A new question needs another review.",
        createdAt: new Date().toISOString(),
      },
    });
    const afterFollowUp = await store.get("case-manual");
    if (!afterFollowUp) throw new Error("Expected follow-up case.");
    await store.update("case-manual", {
      status: "escalated",
      metadata: {
        ...afterFollowUp.metadata,
        activeTurnId: followUp.turnId,
      },
    });
    await store.getClient().execute({
      sql: "UPDATE support_turns SET state = 'escalated' WHERE id = ?",
      args: [followUp.turnId],
    });
    await store.getClient().execute({
      sql: "UPDATE support_dispatch SET state = 'completed' WHERE case_id = ? AND turn_id = ?",
      args: ["case-manual", followUp.turnId],
    });
    const context = await store.manualResolutionContext("case-manual");
    expect(context).toMatchObject({
      activeTurnId: followUp.turnId,
      receipt: { turnId: "turn-manual" },
    });
    const second = {
      ...first,
      expectedVersion: context!.version,
      expectedTurnId: followUp.turnId,
      idempotencyKey: "manual-resolution-key-second",
      internalNote: "Second committed escalation was reviewed.",
    };
    const [left, right] = await Promise.all([
      store.resolveManually(second),
      store.resolveManually(second),
    ]);
    expect([left.state, right.state].sort()).toEqual(["accepted", "replayed"]);
    expect((await store.get("case-manual"))?.status).toBe("resolved");
    expect(
      await store
        .getClient()
        .execute(
          "SELECT turn_id FROM support_manual_resolutions WHERE case_id = ? ORDER BY created_at, id",
          ["case-manual"],
        ),
    ).toMatchObject({
      rows: [{ turn_id: "turn-manual" }, { turn_id: followUp.turnId }],
    });
    await store.close();
  });
});
