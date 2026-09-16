import { Hono } from "hono";
import { describe, expect, it } from "vitest";
import { caseStore } from "../../src/mastra/lib/case-store";
import { issueLocalSession } from "../../src/mastra/server/auth";
import {
  supportCaseManualResolutionContextRoute,
  supportCaseManualResolutionRoute,
} from "../../src/mastra/server/routes";

function app() {
  const value = new Hono();
  value.get(
    "/support/cases/:caseId/manual-resolution",
    supportCaseManualResolutionContextRoute.handler,
  );
  value.post(
    "/support/cases/:caseId/manual-resolution",
    supportCaseManualResolutionRoute.handler,
  );
  return value;
}

async function createEscalatedCase() {
  const id = `manual-http-${crypto.randomUUID()}`;
  const turnId = `turn-${id}`;
  const timestamp = "2026-09-11T12:00:00.000Z";
  const binding = {
    tenantId: "local-demo",
    providerKind: "intercom" as const,
    providerAccountId: "synthetic-intercom-app",
    externalConversationId: `conversation-${id}`,
  };
  await caseStore.create({
    id,
    externalId: `event-${id}`,
    source: "intercom-conversation",
    customer: { email: "alex@example.com" },
    subject: "Synthetic escalated case",
    messages: [
      {
        id: `message-${id}`,
        author: "customer",
        body: "I need help.",
        createdAt: timestamp,
      },
    ],
    status: "escalated",
    createdAt: timestamp,
    updatedAt: timestamp,
    metadata: {
      ownerId: "customer-alex",
      activeTurnId: turnId,
      providerBinding: binding,
    },
  });
  await caseStore.getClient().execute({
    sql: "INSERT INTO support_turns(id, case_id, event_id, sequence, state, created_at, updated_at, message_data, outcome_data) VALUES (?, ?, ?, 1, 'escalated', ?, ?, ?, ?)",
    args: [
      turnId,
      id,
      `event-${id}`,
      timestamp,
      timestamp,
      JSON.stringify({
        id: `message-${id}`,
        author: "customer",
        body: "I need help.",
        createdAt: timestamp,
      }),
      JSON.stringify({ status: "escalated" }),
    ],
  });
  return { id, turnId };
}

const token = (id: string) => ({
  authorization: `Bearer ${issueLocalSession({ id })}`,
});

describe("manual-resolution HTTP authorization", () => {
  it("denies anonymous, customer, and cross-tenant callers before a command can write", async () => {
    const { id } = await createEscalatedCase();
    const value = app();
    const body = JSON.stringify({
      expectedVersion: 1,
      expectedTurnId: "any-turn",
      idempotencyKey: "manual-http-denial-key",
      internalNote: "This must not persist.",
    });
    const anonymous = await value.request(
      `http://support.test/support/cases/${id}/manual-resolution`,
      { method: "POST", headers: { "content-type": "application/json" }, body },
    );
    const customer = await value.request(
      `http://support.test/support/cases/${id}/manual-resolution`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          ...token("customer-alex"),
        },
        body,
      },
    );
    const foreign = await value.request(
      `http://support.test/support/cases/${id}/manual-resolution`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          ...token("other-tenant-agent"),
        },
        body,
      },
    );
    expect([anonymous.status, customer.status, foreign.status]).toEqual([
      401, 403, 403,
    ]);
    expect((await caseStore.get(id))?.status).toBe("escalated");
    expect(
      await caseStore
        .getClient()
        .execute(
          "SELECT COUNT(*) AS count FROM support_manual_resolutions WHERE case_id = ?",
          [id],
        ),
    ).toMatchObject({ rows: [{ count: 0 }] });
  });

  it("allows each staff role and writes no financial approval or receipt", async () => {
    for (const role of ["support-agent-demo", "approver-demo", "admin-demo"]) {
      const { id, turnId } = await createEscalatedCase();
      const value = app();
      const response = await value.request(
        `http://support.test/support/cases/${id}/manual-resolution`,
        {
          method: "POST",
          headers: { "content-type": "application/json", ...token(role) },
          body: JSON.stringify({
            expectedVersion: 1,
            expectedTurnId: turnId,
            idempotencyKey: `manual-http-${role}-${crypto.randomUUID()}`,
            internalNote: "Synthetic staff-only close.",
          }),
        },
      );
      expect(response.status).toBe(200);
      await expect(response.json()).resolves.toMatchObject({
        replayed: false,
        context: { receipt: { noteState: "pending", closeState: "pending" } },
      });
      expect((await caseStore.get(id))?.status).toBe("resolved");
      const financial = await caseStore.getClient().execute({
        sql: "SELECT (SELECT COUNT(*) FROM support_decisions WHERE case_id = ?) AS decisions, (SELECT COUNT(*) FROM support_idempotency) AS receipts",
        args: [id],
      });
      expect(Number(financial.rows[0]?.decisions)).toBe(0);
    }
  });
});
