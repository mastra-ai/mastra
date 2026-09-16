import { createHmac } from "node:crypto";
import { Hono } from "hono";
import { afterEach, describe, expect, it, vi } from "vitest";
import { intercomWebhookRoute } from "../../src/mastra/server/routes";

const saved = { ...process.env };
const secret = "synthetic-intercom-webhook-secret";

function configure() {
  process.env.SUPPORT_SOURCE = "intercom";
  process.env.INTERCOM_DEVELOPMENT_ENABLED = "true";
  process.env.INTERCOM_TENANT_ID = "local-demo";
  process.env.INTERCOM_APP_ID = "synthetic-app";
  process.env.INTERCOM_ACCESS_TOKEN = "synthetic-token";
  process.env.INTERCOM_CLIENT_SECRET = secret;
  process.env.INTERCOM_ADMIN_ID = "synthetic-admin";
  process.env.INTERCOM_API_BASE_URL = "http://intercom.test";
}

function event(topic = "conversation.user.replied", id = "event-1") {
  return JSON.stringify({
    type: "notification_event",
    id,
    app_id: "synthetic-app",
    topic,
    created_at: Math.floor(Date.now() / 1_000),
    // The route does not interpret this. It passes the authenticated event to
    // the registered ingest workflow, which owns normalization and ownership.
    data: { item: { id: "conversation-1", email: "attacker@example.test" } },
  });
}

function ping(
  createdAt = Math.floor(Date.now() / 1_000),
  appId = "synthetic-app",
  id: string | null = null,
) {
  return JSON.stringify({
    type: "notification_event",
    // Provider-shaped endpoint-validation ping: no notification or delivery ID.
    id,
    app_id: appId,
    topic: "ping",
    created_at: createdAt,
    delivery_status: null,
    self: null,
    data: { item: { type: "ping", message: "Synthetic setup ping." } },
  });
}

function signedHeaders(body: string) {
  return {
    "content-type": "application/json",
    "x-hub-signature": `sha1=${createHmac("sha1", secret).update(body).digest("hex")}`,
  };
}

function app(start: ReturnType<typeof vi.fn>) {
  const value = new Hono();
  value.use("*", async (c, next) => {
    c.set("mastra", {
      getWorkflow: (id: string) => {
        expect(id).toBe("ingestSupportCaseWorkflow");
        return { createRun: async () => ({ start }) };
      },
    } as never);
    await next();
  });
  value.post("/support/webhooks/intercom", intercomWebhookRoute.handler);
  return value;
}

afterEach(() => {
  process.env = { ...saved };
  vi.restoreAllMocks();
});

describe("Intercom webhook registered HTTP boundary", () => {
  it("acknowledges a signed ping without binding a conversation or starting ingestion", async () => {
    configure();
    const start = vi.fn();
    const body = ping();
    const response = await app(start).request(
      "http://support.test/support/webhooks/intercom",
      { method: "POST", headers: signedHeaders(body), body },
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      accepted: true,
      ignored: true,
    });
    expect(start).not.toHaveBeenCalled();
  });

  it("rejects invalid, cross-account, stale, and malformed-customer pings or events before ingestion", async () => {
    configure();
    const start = vi.fn();
    const nullIdCustomer = JSON.stringify({
      type: "notification_event",
      id: null,
      app_id: "synthetic-app",
      topic: "conversation.user.replied",
      created_at: Math.floor(Date.now() / 1_000),
      data: { item: { id: 42 } },
    });
    const nullConversationIdCustomer = JSON.stringify({
      type: "notification_event",
      id: "customer-with-null-conversation",
      app_id: "synthetic-app",
      topic: "conversation.user.replied",
      created_at: Math.floor(Date.now() / 1_000),
      data: { item: { id: null } },
    });
    const missingNotificationIdCustomer = JSON.stringify({
      type: "notification_event",
      app_id: "synthetic-app",
      topic: "conversation.user.replied",
      created_at: Math.floor(Date.now() / 1_000),
      data: { item: { id: "conversation-1" } },
    });
    const requests = [
      {
        body: ping(),
        headers: {
          "content-type": "application/json",
          "x-hub-signature": "sha1=0000000000000000000000000000000000000000",
        },
      },
      { body: ping(undefined, "other-app") },
      { body: ping(Math.floor((Date.now() - 301_000) / 1_000)) },
      { body: nullIdCustomer },
      { body: nullConversationIdCustomer },
      { body: missingNotificationIdCustomer },
    ];

    for (const request of requests) {
      const body = request.body;
      const response = await app(start).request(
        "http://support.test/support/webhooks/intercom",
        {
          method: "POST",
          headers: request.headers ?? signedHeaders(body),
          body,
        },
      );
      expect(response.status).toBe(401);
    }
    expect(start).not.toHaveBeenCalled();
  });

  it("accepts only a signed customer event and forwards the verified provider binding to the registered workflow", async () => {
    configure();
    const start = vi.fn().mockResolvedValue({
      status: "success",
      result: { caseId: "case-1", workflowRunId: "workflow-1" },
    });
    const body = event();
    const response = await app(start).request(
      "http://support.test/support/webhooks/intercom",
      { method: "POST", headers: signedHeaders(body), body },
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      caseId: "case-1",
      workflowRunId: "workflow-1",
      status: "processing",
    });
    expect(start).toHaveBeenCalledWith(
      expect.objectContaining({
        inputData: expect.objectContaining({
          verifiedProvider: {
            kind: "intercom",
            event: expect.objectContaining({
              id: "event-1",
              binding: {
                tenantId: "local-demo",
                providerKind: "intercom",
                providerAccountId: "synthetic-app",
                externalConversationId: "conversation-1",
              },
            }),
          },
        }),
      }),
    );
  });

  it("does not allow unsigned payloads or self-generated events to start an ingest workflow", async () => {
    configure();
    const start = vi.fn();
    const unsigned = event();
    const rejected = await app(start).request(
      "http://support.test/support/webhooks/intercom",
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: unsigned,
      },
    );
    expect(rejected.status).toBe(401);

    const selfEvent = event("conversation.admin.replied", "self-event");
    const ignored = await app(start).request(
      "http://support.test/support/webhooks/intercom",
      { method: "POST", headers: signedHeaders(selfEvent), body: selfEvent },
    );
    expect(ignored.status).toBe(200);
    await expect(ignored.json()).resolves.toEqual({
      accepted: true,
      ignored: true,
    });
    expect(start).not.toHaveBeenCalled();
  });

  it("records only one signed configured admin-close intent and never starts ingestion", async () => {
    configure();
    const start = vi.fn();
    const body = event("conversation.admin.closed", "admin-close-deduped");
    const first = await app(start).request(
      "http://support.test/support/webhooks/intercom",
      { method: "POST", headers: signedHeaders(body), body },
    );
    expect(first.status).toBe(200);
    await expect(first.json()).resolves.toEqual({
      accepted: true,
      duplicate: false,
    });
    const duplicate = await app(start).request(
      "http://support.test/support/webhooks/intercom",
      { method: "POST", headers: signedHeaders(body), body },
    );
    await expect(duplicate.json()).resolves.toEqual({
      accepted: true,
      duplicate: true,
    });
    expect(start).not.toHaveBeenCalled();
  });
});
