import { createHmac } from "node:crypto";
import { afterEach, describe, expect, it } from "vitest";
import {
  bindingsForIntercomConversation,
  intercomDevelopmentConfig,
  type IntercomDevelopmentConfig,
} from "../../src/mastra/providers/intercom/config";
import {
  MAX_INTERCOM_WEBHOOK_BYTES,
  verifyIntercomWebhook,
} from "../../src/mastra/providers/intercom/webhook";
import { readWebhookBody } from "../../src/mastra/server/webhook-routes";

const saved = { ...process.env };
const config: IntercomDevelopmentConfig = {
  enabled: true,
  tenantId: "local-demo",
  accountId: "app_123",
  accessToken: "token",
  clientSecret: "secret",
  adminId: "42",
  apiBaseUrl: "http://intercom.test",
  knowledgeEnabled: false,
};
function event(createdAt = Math.floor(Date.now() / 1000)) {
  return JSON.stringify({
    type: "notification_event",
    id: "evt_1",
    app_id: "app_123",
    topic: "conversation.user.replied",
    created_at: createdAt,
    data: { item: { id: "conversation_1" } },
  });
}
function ping(
  createdAt = Math.floor(Date.now() / 1000),
  appId = "app_123",
  id: string | null = null,
) {
  return JSON.stringify({
    type: "notification_event",
    // Matches Intercom's endpoint-validation envelope: pings have no event ID
    // or delivery references, and are not conversation notifications.
    id,
    app_id: appId,
    topic: "ping",
    created_at: createdAt,
    delivery_status: null,
    self: null,
    data: { item: { type: "ping", message: "Synthetic setup ping." } },
  });
}
function headers(body: string) {
  return new Headers({
    "content-type": "application/json; charset=utf-8",
    "x-hub-signature": `sha1=${createHmac("sha1", config.clientSecret).update(body).digest("hex")}`,
  });
}
afterEach(() => {
  process.env = { ...saved };
});

describe("Intercom webhook verification", () => {
  it("checks raw bytes before parsing and only then validates authenticated freshness", () => {
    const body = event();
    expect(
      verifyIntercomWebhook(Buffer.from(body), headers(body), config).binding,
    ).toMatchObject({
      providerKind: "intercom",
      externalConversationId: "conversation_1",
    });
    expect(() =>
      verifyIntercomWebhook(
        Buffer.from("not json"),
        new Headers({
          "content-type": "application/json",
          "x-hub-signature": "sha1=0000000000000000000000000000000000000000",
        }),
        config,
      ),
    ).toThrow("signature");
    const stale = event(Math.floor((Date.now() - 301_000) / 1000));
    expect(() =>
      verifyIntercomWebhook(Buffer.from(stale), headers(stale), config),
    ).toThrow("timestamp");
    expect(() =>
      verifyIntercomWebhook(
        Buffer.from(body),
        new Headers({ "content-type": "text/plain" }),
        config,
      ),
    ).toThrow("application/json");
  });

  it("accepts only an authenticated, account-matched, fresh ping without fabricating a conversation binding", () => {
    const body = ping();
    const verified = verifyIntercomWebhook(
      Buffer.from(body),
      headers(body),
      config,
    );
    expect(verified).toMatchObject({ kind: "ping", id: null, topic: "ping" });
    expect(verified).not.toHaveProperty("binding");

    const legacyId = ping(undefined, undefined, "evt_ping");
    expect(
      verifyIntercomWebhook(Buffer.from(legacyId), headers(legacyId), config),
    ).toMatchObject({ kind: "ping", id: "evt_ping" });

    expect(() =>
      verifyIntercomWebhook(
        Buffer.from(body),
        new Headers({
          "content-type": "application/json",
          "x-hub-signature": "sha1=0000000000000000000000000000000000000000",
        }),
        config,
      ),
    ).toThrow("signature");

    const wrongAccount = ping(undefined, "other-app");
    expect(() =>
      verifyIntercomWebhook(
        Buffer.from(wrongAccount),
        headers(wrongAccount),
        config,
      ),
    ).toThrow("account");

    const stale = ping(Math.floor((Date.now() - 301_000) / 1_000));
    expect(() =>
      verifyIntercomWebhook(Buffer.from(stale), headers(stale), config),
    ).toThrow("timestamp");
  });

  it("continues to require notification and conversation identities for customer events", () => {
    const nullNotificationId = JSON.stringify({
      type: "notification_event",
      id: null,
      app_id: "app_123",
      topic: "conversation.user.replied",
      created_at: Math.floor(Date.now() / 1_000),
      data: { item: { id: "conversation_1" } },
    });
    expect(() =>
      verifyIntercomWebhook(
        Buffer.from(nullNotificationId),
        headers(nullNotificationId),
        config,
      ),
    ).toThrow();

    const missingNotificationId = JSON.stringify({
      type: "notification_event",
      app_id: "app_123",
      topic: "conversation.user.replied",
      created_at: Math.floor(Date.now() / 1_000),
      data: { item: { id: "conversation_1" } },
    });
    expect(() =>
      verifyIntercomWebhook(
        Buffer.from(missingNotificationId),
        headers(missingNotificationId),
        config,
      ),
    ).toThrow();

    const nullConversationId = JSON.stringify({
      type: "notification_event",
      id: "evt_malformed",
      app_id: "app_123",
      topic: "conversation.user.replied",
      created_at: Math.floor(Date.now() / 1_000),
      data: { item: { id: null } },
    });
    expect(() =>
      verifyIntercomWebhook(
        Buffer.from(nullConversationId),
        headers(nullConversationId),
        config,
      ),
    ).toThrow("conversation identity");
  });

  it("does not permit an enabled Intercom source to fall back to local configuration", () => {
    process.env.SUPPORT_SOURCE = "intercom";
    process.env.INTERCOM_DEVELOPMENT_ENABLED = "true";
    expect(() => intercomDevelopmentConfig()).toThrow("INTERCOM_TENANT_ID");
  });

  it("leaves the default local source untouched when Intercom is not explicitly selected", () => {
    process.env.SUPPORT_SOURCE = "mock";
    process.env.INTERCOM_DEVELOPMENT_ENABLED = "true";
    expect(intercomDevelopmentConfig()).toBeUndefined();
  });

  it("rejects oversize, invalid JSON, and future signed input before it can reach a workflow", () => {
    const body = event();
    const oversized = Buffer.alloc(MAX_INTERCOM_WEBHOOK_BYTES + 1, "x");
    expect(() =>
      verifyIntercomWebhook(oversized, headers(body), config),
    ).toThrow("size");

    const invalidJson = "{not-json";
    expect(() =>
      verifyIntercomWebhook(
        Buffer.from(invalidJson),
        headers(invalidJson),
        config,
      ),
    ).toThrow("invalid JSON");

    const future = event(Math.floor((Date.now() + 301_000) / 1000));
    expect(() =>
      verifyIntercomWebhook(Buffer.from(future), headers(future), config),
    ).toThrow("timestamp");
  });

  it("keeps financial and commerce bindings local while support is Intercom", () => {
    expect(bindingsForIntercomConversation(config, "conversation_1")).toEqual({
      support: {
        tenantId: "local-demo",
        providerKind: "intercom",
        providerAccountId: "app_123",
        externalConversationId: "conversation_1",
      },
      commerce: {
        tenantId: "local-demo",
        providerKind: "local",
        providerAccountId: "local-demo",
        externalConversationId: "conversation_1",
      },
      transactions: {
        tenantId: "local-demo",
        providerKind: "local",
        providerAccountId: "local-demo",
        externalConversationId: "conversation_1",
      },
      knowledge: {
        tenantId: "local-demo",
        providerKind: "local",
        providerAccountId: "local-demo",
        externalConversationId: "conversation_1",
      },
    });
  });

  it("bounds a chunked public body without trusting Content-Length and rejects stream errors", async () => {
    const oversized = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new Uint8Array(MAX_INTERCOM_WEBHOOK_BYTES));
        controller.enqueue(new Uint8Array(1));
        controller.close();
      },
    });
    await expect(
      readWebhookBody(
        new Request("http://support.test/webhook", {
          method: "POST",
          body: oversized,
          duplex: "half",
        }),
        MAX_INTERCOM_WEBHOOK_BYTES,
      ),
    ).rejects.toThrow();
    const broken = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.error(new Error("synthetic read failure"));
      },
    });
    await expect(
      readWebhookBody(
        new Request("http://support.test/webhook", {
          method: "POST",
          body: broken,
          duplex: "half",
        }),
        MAX_INTERCOM_WEBHOOK_BYTES,
      ),
    ).rejects.toThrow("could not be read");
  });
});
