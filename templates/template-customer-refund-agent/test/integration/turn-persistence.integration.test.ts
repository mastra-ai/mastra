import { afterEach, describe, expect, it } from "vitest";
import { rm } from "node:fs/promises";
import { CaseStore } from "../../src/mastra/lib/case-store";
import { defaultLocalBinding } from "../../src/mastra/runtime/local-runtime";
import type { SupportCase } from "../../src/mastra/domain/support-case";
import { withDispatchLeaseScope } from "../../src/mastra/lib/dispatch-lease-scope";
import { temporaryDatabasePath } from "../support/temp-path";

const files: string[] = [];
const stores: CaseStore[] = [];

afterEach(async () => {
  await Promise.all(stores.splice(0).map((store) => store.close()));
  await Promise.all(files.splice(0).map((file) => rm(file, { force: true })));
});

async function createConversation() {
  const path = temporaryDatabasePath("phase003-turn");
  files.push(path, `${path}-shm`, `${path}-wal`);
  const store = new CaseStore({ url: `file:${path}` });
  stores.push(store);
  const binding = defaultLocalBinding("conversation-turns");
  const supportCase: SupportCase = {
    id: "case-turns",
    externalId: "event-initial",
    source: "mock-email",
    customer: { email: "alex@example.com" },
    subject: "Refund",
    messages: [
      {
        id: "message-initial",
        author: "customer",
        body: "I need a refund",
        createdAt: new Date().toISOString(),
      },
    ],
    status: "new",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    metadata: { providerBinding: binding, ownerId: "customer-alex" },
  };
  await store.acceptInbound(supportCase, "event-initial", "run-initial");
  return { store, binding, path };
}

describe("per-turn conversation persistence", () => {
  it("deduplicates inbound events, serializes concurrent follow-ups, and survives restart", async () => {
    const { store, path } = await createConversation();
    const first = await store.claimDispatchForStart(
      "case-turns",
      "run-initial",
    );
    expect(first).toBeDefined();
    await store.markDispatchStarted(first!.id, first!.leaseToken);
    await store.update("case-turns", {
      workflowRunId: "run-initial",
      metadata: {
        ...(await store.get("case-turns"))!.metadata,
        activeTurnId: first!.turnId,
      },
    });

    const [a, b, duplicate] = await Promise.all([
      store.appendFollowUp({
        caseId: "case-turns",
        eventId: "event-follow-up-a",
        runId: "run-follow-up-a",
        message: {
          id: "message-a",
          author: "customer",
          body: "Please update me",
          createdAt: new Date().toISOString(),
        },
      }),
      store.appendFollowUp({
        caseId: "case-turns",
        eventId: "event-follow-up-b",
        runId: "run-follow-up-b",
        message: {
          id: "message-b",
          author: "customer",
          body: "This is urgent",
          createdAt: new Date().toISOString(),
        },
      }),
      store.appendFollowUp({
        caseId: "case-turns",
        eventId: "event-initial",
        runId: "ignored-run",
        message: {
          id: "duplicate",
          author: "customer",
          body: "duplicate",
          createdAt: new Date().toISOString(),
        },
      }),
    ]);
    expect(a.appended).toBe(true);
    expect(b.appended).toBe(true);
    expect(duplicate.appended).toBe(false);
    expect(
      (await store.turns("case-turns")).map((turn) => turn.sequence),
    ).toEqual([1, 2, 3]);
    // A running turn fences later pending work; no concurrent workflow may claim it.
    expect(await store.claimDispatch()).toEqual([]);
    await store.completeDispatch(
      first!.id,
      "completed",
      undefined,
      first!.leaseToken,
    );

    const [next] = await store.claimDispatch();
    expect(next).toMatchObject({ caseId: "case-turns", state: "claimed" });
    expect([a.turnId, b.turnId]).toContain(next!.turnId);
    await store.completeDispatch(
      next!.id,
      "completed",
      undefined,
      next!.leaseToken,
    );

    // A reopened store sees the unclaimed remaining turn and continues it.
    await store.close();
    stores.splice(stores.indexOf(store), 1);
    const reopened = new CaseStore({ url: `file:${path}` });
    stores.push(reopened);
    const [recovered] = await reopened.claimDispatch();
    expect(recovered).toMatchObject({ caseId: "case-turns", state: "claimed" });
  });

  it("invalidates only the waiting turn and permits a second immutable command decision", async () => {
    const { store } = await createConversation();
    const [firstTurn] = await store.turns("case-turns");
    const firstFingerprint = "a".repeat(64);
    await store.saveAction("case-turns", "refund-command", firstFingerprint, {
      command: 1,
    });
    await store.update("case-turns", {
      status: "waiting_approval",
      metadata: {
        ...(await store.get("case-turns"))!.metadata,
        activeTurnId: firstTurn.id,
        nativeApproval: {
          runId: "native-run-first",
          toolCallId: "native-call-first",
          turnId: firstTurn.id,
          fingerprint: firstFingerprint,
        },
      },
    });
    await store.recordApprovalDecision({
      caseId: "case-turns",
      turnId: firstTurn.id,
      commandFingerprint: firstFingerprint,
      principalId: "approver-demo",
      approved: false,
    });
    // Restore a pending native decision to model a new inbound message arriving
    // before the prior approval is submitted; its decision record remains audit history.
    await store.update("case-turns", {
      status: "waiting_approval",
      approval: undefined,
    });
    const appended = await store.appendFollowUp({
      caseId: "case-turns",
      eventId: "event-second-command",
      runId: "run-second-command",
      message: {
        id: "message-second-command",
        author: "customer",
        body: "Refund another item",
        createdAt: new Date().toISOString(),
      },
    });
    expect(appended.appended).toBe(true);
    expect((await store.get("case-turns"))?.approval).toBeUndefined();
    const secondTurn = (await store.turns("case-turns")).at(-1)!;
    const secondFingerprint = "b".repeat(64);
    await store.saveAction("case-turns", "refund-command", secondFingerprint, {
      command: 2,
    });
    await store.update("case-turns", {
      status: "waiting_approval",
      metadata: {
        ...(await store.get("case-turns"))!.metadata,
        activeTurnId: secondTurn.id,
        nativeApproval: {
          runId: "native-run-second",
          toolCallId: "native-call-second",
          turnId: secondTurn.id,
          fingerprint: secondFingerprint,
        },
      },
    });
    expect(
      await store.recordApprovalDecision({
        caseId: "case-turns",
        turnId: secondTurn.id,
        commandFingerprint: secondFingerprint,
        principalId: "approver-demo",
        approved: true,
      }),
    ).toMatchObject({ won: true });
    expect(
      (await store.approvalDecision("case-turns", firstTurn.id))?.approved,
    ).toBe(false);
    expect(
      (await store.approvalDecision("case-turns", secondTurn.id))?.approved,
    ).toBe(true);
  });

  it("preserves a terminal turn outcome while a follow-up becomes the only active projection", async () => {
    const { store } = await createConversation();
    const [firstTurn] = await store.turns("case-turns");
    await store.update("case-turns", {
      status: "escalated",
      draft: {
        draftResponse: "Staff must investigate.",
        citedSources: [],
        recommendRefund: false,
        requiresEscalation: true,
      },
      escalationReason: "Policy requires staff review.",
      finalResponse: "We escalated your case.",
      metadata: {
        ...(await store.get("case-turns"))!.metadata,
        activeTurnId: firstTurn.id,
        refundCommand: {
          approvalCaseId: "case-turns",
          orderId: "ORD-terminal",
          amount: 20,
          currency: "USD",
          reason: "duplicate",
          idempotencyKey: "terminal-command",
          fingerprint: "terminal-command",
        },
      },
    });
    const followUp = await store.appendFollowUp({
      caseId: "case-turns",
      eventId: "event-after-escalation",
      runId: "run-after-escalation",
      message: {
        id: "message-after-escalation",
        author: "customer",
        body: "I have another question about this order.",
        createdAt: new Date().toISOString(),
      },
    });
    expect(followUp.appended).toBe(true);
    const turns = await store.turns("case-turns");
    expect(turns[0]).toMatchObject({
      message: { body: "I need a refund" },
      outcome: {
        status: "escalated",
        escalationReason: "Policy requires staff review.",
      },
    });
    expect(turns[1]).toMatchObject({
      message: { body: "I have another question about this order." },
      state: "pending",
    });
    const reopened = await store.get("case-turns");
    expect(reopened?.status).toBe("new");
    expect(reopened?.finalResponse).toBeUndefined();
    expect(reopened?.escalationReason).toBeUndefined();
    expect(reopened?.metadata.refundCommand).toBeUndefined();
  });

  it("allows exactly one worker to atomically claim and activate a queued turn", async () => {
    const { store, path } = await createConversation();
    const competing = new CaseStore({ url: `file:${path}` });
    stores.push(competing);
    const [left, right] = await Promise.all([
      store.claimDispatch(),
      competing.claimDispatch(),
    ]);
    const claims = [...left, ...right];
    expect(claims).toHaveLength(1);
    expect(await store.activateDispatch(claims[0]!)).toBe(true);
    expect(await competing.activateDispatch(claims[0]!)).toBe(false);
    expect(
      await competing.completeDispatch(
        claims[0]!.id,
        "completed",
        undefined,
        "stale-worker-fence",
      ),
    ).toBe(false);
    const active = await store.get("case-turns");
    expect(active).toMatchObject({
      status: "processing",
      metadata: { activeTurnId: claims[0]!.turnId },
    });
    expect((await store.turn("case-turns", claims[0]!.turnId))?.state).toBe(
      "processing",
    );
  });

  it("does not let a follow-up queued during processing inherit the completed turn projection", async () => {
    const { store } = await createConversation();
    const [first] = await store.claimDispatch();
    expect(await store.activateDispatch(first!)).toBe(true);
    await store.update("case-turns", {
      triage: {
        intent: "duplicate_charge",
        urgency: "normal",
        sentiment: "negative",
        requiresHumanReview: true,
        confidence: 1,
        rationale: "First immutable turn.",
      },
      draft: {
        draftResponse: "First result",
        citedSources: [],
        recommendRefund: false,
        requiresEscalation: false,
      },
    });
    const queued = await store.appendFollowUp({
      caseId: "case-turns",
      eventId: "event-queued-while-processing",
      runId: "run-queued-while-processing",
      message: {
        id: "message-queued-while-processing",
        author: "customer",
        body: "This is a distinct second request.",
        createdAt: new Date().toISOString(),
      },
    });
    await store.update("case-turns", {
      status: "resolved",
      finalResponse: "First result is complete.",
    });
    expect(
      await store.completeDispatch(
        first!.id,
        "completed",
        undefined,
        first!.leaseToken,
      ),
    ).toBe(true);
    const [second] = await store.claimDispatch();
    expect(second?.turnId).toBe(queued.turnId);
    expect(await store.activateDispatch(second!)).toBe(true);
    const active = await store.get("case-turns");
    expect(active).toMatchObject({
      status: "processing",
      metadata: { activeTurnId: queued.turnId },
    });
    expect(active?.triage).toBeUndefined();
    expect(active?.draft).toBeUndefined();
    expect(active?.finalResponse).toBeUndefined();
    expect((await store.turns("case-turns"))[0]?.outcome).toMatchObject({
      status: "resolved",
      finalResponse: "First result is complete.",
    });
  });

  it("rejects a stale worker projection after its durable lease token is replaced", async () => {
    const { store } = await createConversation();
    const [claim] = await store.claimDispatch();
    expect(await store.activateDispatch(claim!)).toBe(true);
    await store.getClient().execute({
      sql: "UPDATE support_dispatch SET lease_token = ? WHERE id = ?",
      args: ["new-worker-token", claim!.id],
    });
    await expect(
      withDispatchLeaseScope(
        {
          dispatchId: claim!.id,
          caseId: claim!.caseId,
          turnId: claim!.turnId,
          leaseToken: claim!.leaseToken!,
        },
        () => store.update("case-turns", { status: "failed" }),
      ),
    ).rejects.toThrow("Dispatch lease is no longer current");
    expect((await store.get("case-turns"))?.status).toBe("processing");
  });
});
