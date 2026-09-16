import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

process.env.VITEST = "true";
process.env.APP_MODE = "local";
process.env.LOCAL_DEMO_CLIENT_DATABASE_URL = "file::memory:?cache=shared";
process.env.DEMO_AUTH_BRIDGE_SIGNING_KEY =
  "local-chat-bridge-signing-key-with-at-least-32-chars";

const server = await import("../../src/server.js");
const db = await import("../../src/db.js");
const localOrigin = "http://127.0.0.1";

beforeAll(async () => {
  await db.initializeDatabase(server.client);
  const password = await db.passwordRecord("test-password");
  await server.client.execute({
    sql: "INSERT INTO demo_customers (id,name,email,password_salt,password_hash,tenant_id,stripe_customer_id,intercom_contact_id,purchase_paid) VALUES (?,?,?,?,?,?,?,?,?)",
    args: [
      "customer-alex",
      "Alex Morgan",
      "alex@example.com",
      password.salt,
      password.hash,
      "local-demo",
      "local-customer-alex",
      "local-contact-alex",
      1,
    ],
  });
  await server.client.execute({
    sql: "UPDATE demo_customers SET subscription_id = ?, purchase_product = ?, purchase_amount_minor = ?, purchase_currency = ?, purchase_purchased_at = ?, subscription_plan = ?, subscription_amount_minor = ?, subscription_currency = ?, subscription_interval = ?, subscription_started_at = ?, subscription_renews_at = ? WHERE id = ?",
    args: [
      "DEMO-WORKSPACE-001",
      "API Credits",
      500,
      "USD",
      "2026-09-14T12:00:00.000Z",
      "Workspace",
      4900,
      "USD",
      "month",
      "2026-09-14T12:00:00.000Z",
      "2026-10-14T12:00:00.000Z",
      "customer-alex",
    ],
  });
});
afterEach(() => vi.unstubAllGlobals());

async function login() {
  return server.app.request(`${localOrigin}/entrar`, {
    method: "POST",
    headers: {
      origin: localOrigin,
      "content-type": "application/x-www-form-urlencoded",
    },
    body: "email=alex%40example.com&password=test-password",
  });
}

describe("local authenticated chat routes", () => {
  it("renders persisted backend purchase and subscription facts for the authenticated customer", async () => {
    const signedIn = await login();
    const account = await server.app.request(`${localOrigin}/conta`, {
      headers: { cookie: signedIn.headers.get("set-cookie")! },
    });
    const page = await account.text();
    expect(page).toContain("API Credits");
    expect(page).toContain("$5.00");
    expect(page).toContain("Purchased Sep 14, 2026");
    expect(page).toContain("Workspace");
    expect(page).toContain("$49.00 per month");
    expect(page).toContain("Renews Oct 14, 2026");
  });

  it("rejects rebinding and forwarded requests before every local route", async () => {
    const attacker = "http://attacker.example";
    for (const [path, init] of [
      [
        "/entrar",
        {
          method: "POST",
          headers: {
            origin: attacker,
            "content-type": "application/x-www-form-urlencoded",
          },
          body: "email=alex%40example.com&password=test-password",
        },
      ],
      ["/sessao", {}],
      ["/chat/history", {}],
      [
        "/chat/messages",
        {
          method: "POST",
          headers: { origin: attacker, "content-type": "application/json" },
          body: JSON.stringify({
            body: "hello",
            eventId: "event-123456789012",
          }),
        },
      ],
    ] as const)
      expect(
        await server.app.request(`${attacker}${path}`, init),
      ).toMatchObject({
        status: 403,
      });

    expect(
      await server.app.request(`${localOrigin}/entrar`, {
        method: "POST",
        headers: {
          origin: localOrigin,
          "content-type": "application/x-www-form-urlencoded",
          "x-forwarded-host": "attacker.example",
        },
        body: "email=alex%40example.com&password=test-password",
      }),
    ).toMatchObject({ status: 403 });
    expect(
      await server.app.request(`${localOrigin}/entrar`, {
        method: "POST",
        headers: {
          host: "attacker.example",
          origin: localOrigin,
          "content-type": "application/x-www-form-urlencoded",
        },
        body: "email=alex%40example.com&password=test-password",
      }),
    ).toMatchObject({ status: 403 });
    expect(
      await server.app.request("http://localhost/entrar", {
        method: "POST",
        headers: {
          origin: "http://localhost",
          "content-type": "application/x-www-form-urlencoded",
        },
        body: "email=alex%40example.com&password=test-password",
      }),
    ).toMatchObject({ status: 303 });
    expect(
      await server.app.fetch(new Request(`${localOrigin}/sessao`)),
    ).toMatchObject({ status: 401 });
  });

  it("uses a separate local session cookie without clearing the external session", async () => {
    const signedIn = await login();
    const cookie = signedIn.headers.get("set-cookie")!;
    expect(cookie).toContain("northstar_local_session=");
    expect(cookie).not.toContain("northstar_session=");

    const account = await server.app.request(`${localOrigin}/conta`, {
      headers: { cookie: `northstar_session=external-session; ${cookie}` },
    });
    const csrf = /name="csrf" value="([^"]+)"/.exec(await account.text())![1]!;
    const signedOut = await server.app.request(`${localOrigin}/sair`, {
      method: "POST",
      headers: {
        cookie: `northstar_session=external-session; ${cookie}`,
        origin: localOrigin,
        "content-type": "application/x-www-form-urlencoded",
      },
      body: `csrf=${encodeURIComponent(csrf)}`,
    });

    expect(signedOut.status).toBe(200);
    expect(signedOut.headers.get("set-cookie")).toContain(
      "northstar_local_session=;",
    );
    expect(signedOut.headers.get("set-cookie")).not.toContain(
      "northstar_session=;",
    );
  });

  it("uses a CSRF-protected stable event identity and the existing inbound endpoint", async () => {
    const signedIn = await login();
    const cookie = signedIn.headers.get("set-cookie")!;
    const account = await server.app.request(`${localOrigin}/conta`, {
      headers: { cookie },
    });
    const csrf = /name="csrf" value="([^"]+)"/.exec(await account.text())![1]!;
    const missing = await server.app.request(`${localOrigin}/chat/messages`, {
      method: "POST",
      headers: { cookie, "content-type": "application/json" },
      body: JSON.stringify({
        body: "I was charged twice",
        eventId: "event-123456789012",
      }),
    });
    expect(missing.status).toBe(403);
    const calls: RequestInit[] = [];
    vi.stubGlobal("fetch", async (_url: string, init: RequestInit) => {
      calls.push(init);
      return new Response(
        JSON.stringify({ caseId: "case-1", status: "processing" }),
        { status: 200 },
      );
    });
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const response = await server.app.request(
        `${localOrigin}/chat/messages`,
        {
          method: "POST",
          headers: {
            cookie,
            "content-type": "application/json",
            "x-csrf-token": csrf,
          },
          body: JSON.stringify({
            body: "I was charged twice",
            eventId: "event-123456789012",
          }),
        },
      );
      expect(response.status).toBe(200);
    }
    expect(calls).toHaveLength(2);
    expect(calls.map((call) => String(call.body))).toEqual([
      expect.stringContaining("chat:customer-alex:event-123456789012"),
      expect.stringContaining("chat:customer-alex:event-123456789012"),
    ]);
    expect(String(calls[0]!.body)).toContain(
      '"conversationId":"chat:customer-alex"',
    );
  });

  it("returns only the current chat conversation and omits internal notes", async () => {
    const signedIn = await login();
    vi.stubGlobal(
      "fetch",
      async () =>
        new Response(
          JSON.stringify({
            cases: [
              {
                externalId: "chat:customer-alex:event-1",
                status: "waiting_approval",
                updatedAt: "2026-01-02T00:00:00.000Z",
                messages: [
                  {
                    author: "customer",
                    body: "Safe text <img onerror=1>",
                    createdAt: "2026-01-01T00:00:00.000Z",
                  },
                  {
                    author: "internal",
                    body: "never public",
                    createdAt: "2026-01-01T00:00:01.000Z",
                  },
                  {
                    author: "agent",
                    body: "Awaiting approval",
                    createdAt: "2026-01-01T00:00:02.000Z",
                  },
                ],
              },
              {
                externalId: "chat:other:event-2",
                status: "resolved",
                updatedAt: "2026-01-03T00:00:00.000Z",
                messages: [
                  {
                    author: "agent",
                    body: "other customer",
                    createdAt: "2026-01-03T00:00:00.000Z",
                  },
                ],
              },
            ],
          }),
          { status: 200 },
        ),
    );
    const response = await server.app.request(`${localOrigin}/chat/history`, {
      headers: { cookie: signedIn.headers.get("set-cookie")! },
    });
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      customerId: "customer-alex",
      status: "waiting_approval",
      messages: [
        {
          author: "customer",
          body: "Safe text <img onerror=1>",
          createdAt: "2026-01-01T00:00:00.000Z",
        },
        {
          author: "agent",
          body: "Awaiting approval",
          createdAt: "2026-01-01T00:00:02.000Z",
        },
      ],
    });
  });
});
