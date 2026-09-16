import { Hono } from "hono";
import { createHmac } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";
import { supportCaseSchema } from "../../src/mastra/domain/support-case";
import { caseStore } from "../../src/mastra/lib/case-store";
import { issueLocalSession } from "../../src/mastra/server/auth";
import {
  supportCaseDetailRoute,
  supportCustomerFinancialRequestsRoute,
  supportCasesListRoute,
} from "../../src/mastra/server/routes";

const headers = (id: string) => ({
  authorization: `Bearer ${issueLocalSession({ id })}`,
});

function app() {
  const server = new Hono();
  server.get("/support/cases", supportCasesListRoute.handler);
  server.get(
    "/support/customer/financial-requests",
    supportCustomerFinancialRequestsRoute.handler,
  );
  server.get("/support/cases/:caseId", supportCaseDetailRoute.handler);
  return server;
}

function fixture(id: string, ownerId: string, tenantId = "local-demo") {
  return supportCaseSchema.parse({
    id,
    externalId: `provider-event-${id}`,
    source: "mock-email",
    customer: {
      email:
        ownerId === "customer-jordan"
          ? "jordan@example.com"
          : "alex@example.com",
      name: "Synthetic Customer",
    },
    subject: "Synthetic support request",
    messages: [
      {
        id: `${id}-customer`,
        author: "customer",
        body: "My private request",
        createdAt: "2026-09-05T00:00:00.000Z",
      },
      {
        id: `${id}-internal`,
        author: "internal",
        body: "Internal fraud review",
        createdAt: "2026-09-05T00:01:00.000Z",
      },
    ],
    status: "waiting_approval",
    createdAt: "2026-09-05T00:00:00.000Z",
    updatedAt: "2026-09-05T00:01:00.000Z",
    triage: {
      intent: "duplicate_charge",
      urgency: "normal",
      sentiment: "negative",
      requiresHumanReview: true,
      confidence: 1,
      rationale: "Internal rationale",
    },
    orderLookup: {
      found: true,
      order: {
        orderId: "ORD-private",
        customerEmail: "alex@example.com",
        product: "Private product",
        amount: 49,
        currency: "USD",
        status: "fulfilled",
        chargeCount: 2,
        placedAt: "2026-09-01T00:00:00.000Z",
      },
    },
    draft: {
      draftResponse: "Internal draft",
      citedSources: ["private-policy"],
      recommendRefund: true,
      refundAmount: 49,
      refundCurrency: "USD",
      refundReason: "duplicate",
      requiresEscalation: false,
    },
    workflowRunId: "workflow-private",
    traceId: "trace-private",
    metadata: {
      ownerId,
      providerBinding: {
        tenantId,
        providerKind: "local",
        providerAccountId: "private-account",
        externalConversationId: `private-conversation-${id}`,
      },
      rawPayload: { email: "alex@example.com", card: "not-for-client" },
      nativeApproval: {
        runId: "native-private",
        toolCallId: "tool-private",
        fingerprint: "immutable-command-hash",
        turnId: "turn-private",
      },
      activeTurnId: "turn-private",
      refundCommand: {
        approvalCaseId: id,
        orderId: "ORD-private",
        amount: 49,
        currency: "USD",
        reason: "duplicate",
        fingerprint: "immutable-command-hash",
        idempotencyKey: "private-idempotency-key",
      },
    },
  });
}

function bridgeHeaders(contactId: string) {
  const key = "demo-bridge-signing-key-with-at-least-32-characters";
  process.env.DEMO_AUTH_BRIDGE_SIGNING_KEY = key;
  const payload = Buffer.from(
    JSON.stringify({
      id: `demo:${contactId}`,
      email: "customer@example.test",
      tenantId: "local-demo",
      roles: ["customer"],
      intercomContactId: contactId,
      stripeCustomerId: "cus_demo",
      appMode: "local",
      expiresAt: new Date(Date.now() + 60_000).toISOString(),
    }),
  ).toString("base64url");
  return {
    authorization: `Bearer ${payload}.${createHmac("sha256", key).update(payload).digest("base64url")}`,
  };
}

afterEach(() => vi.restoreAllMocks());

describe("scoped support case DTOs", () => {
  it("redacts customer responses and enforces owner and tenant scope", async () => {
    const owned = fixture("case-alex", "customer-alex");
    vi.spyOn(caseStore, "list").mockResolvedValue([
      owned,
      fixture("case-jordan", "customer-jordan"),
      fixture("case-other-tenant", "customer-alex", "other-tenant"),
    ]);
    vi.spyOn(caseStore, "get").mockImplementation(async (id) =>
      id === owned.id ? owned : fixture("case-jordan", "customer-jordan"),
    );

    const server = app();
    const listed = await server.request("http://support.test/support/cases", {
      headers: headers("customer-alex"),
    });
    expect(listed.status).toBe(200);
    const body = (await listed.json()) as {
      cases: Array<Record<string, unknown>>;
    };
    expect(body.cases).toHaveLength(1);
    expect(body.cases[0]).toMatchObject({ id: owned.id, metadata: {} });
    expect(body.cases[0]).not.toHaveProperty("triage");
    expect(body.cases[0]).not.toHaveProperty("orderLookup");
    expect(body.cases[0]).not.toHaveProperty("draft");
    expect(body.cases[0]).not.toHaveProperty("workflowRunId");
    expect(body.cases[0]).not.toHaveProperty("traceId");
    expect(JSON.stringify(body.cases[0])).not.toContain(
      "Internal fraud review",
    );
    expect(JSON.stringify(body.cases[0])).not.toContain(
      "private-idempotency-key",
    );

    const denied = await server.request(
      "http://support.test/support/cases/case-jordan",
      { headers: headers("customer-alex") },
    );
    expect(denied.status).toBe(403);
  });

  it("gives approvers the displayed command hash without native or provider handles", async () => {
    const supportCase = fixture("case-review", "customer-alex");
    vi.spyOn(caseStore, "get").mockResolvedValue(supportCase);
    const response = await app().request(
      "http://support.test/support/cases/case-review",
      { headers: headers("approver-demo") },
    );
    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      metadata: Record<string, unknown>;
    };
    expect(body.metadata).toEqual({
      refundCommand: { fingerprint: "immutable-command-hash" },
    });
  });

  it("returns only an owned customer's safe durable financial history", async () => {
    const owned = fixture("case-financial", "customer-alex");
    vi.spyOn(caseStore, "list").mockResolvedValue([
      owned,
      fixture("case-financial-foreign", "customer-jordan"),
    ]);
    vi.spyOn(caseStore, "customerFinancialRequests").mockResolvedValue([
      {
        caseId: owned.id,
        turnId: "turn-credit",
        type: "subscription_credit",
        amount: 5,
        currency: "USD",
        status: "executed",
        requestedAt: "2026-09-05T00:00:00.000Z",
      },
    ]);

    const response = await app().request(
      "http://support.test/support/customer/financial-requests",
      { headers: headers("customer-alex") },
    );
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toEqual({
      requests: [
        {
          caseId: owned.id,
          turnId: "turn-credit",
          type: "subscription_credit",
          amount: 5,
          currency: "USD",
          status: "executed",
          requestedAt: "2026-09-05T00:00:00.000Z",
        },
      ],
    });
    expect(caseStore.customerFinancialRequests).toHaveBeenCalledWith([
      owned.id,
    ]);
    expect(JSON.stringify(body)).not.toContain("private-idempotency-key");
  });

  it("accepts the signed demo bridge only for its exact Intercom contact", async () => {
    const owned = fixture(
      "case-bridge-owned",
      "intercom:local-demo:contact:contact-owned",
    );
    const foreign = fixture(
      "case-bridge-foreign",
      "intercom:local-demo:contact:contact-foreign",
    );
    vi.spyOn(caseStore, "list").mockResolvedValue([owned, foreign]);
    vi.spyOn(caseStore, "customerFinancialRequests").mockResolvedValue([]);

    const response = await app().request(
      "http://support.test/support/customer/financial-requests",
      { headers: bridgeHeaders("contact-owned") },
    );
    expect(response.status).toBe(200);
    expect(caseStore.customerFinancialRequests).toHaveBeenCalledWith([
      owned.id,
    ]);
  });
});
