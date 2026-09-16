import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

process.env.VITEST = "true";
// Preserve the Messenger regression suite under an explicit external mode.
process.env.APP_MODE = "staging";
process.env.DATABASE_URL = "file:/tmp/src033-external-route-fixture.db";
process.env.DEMO_DATABASE_URL = "file::memory:?cache=shared";
const server = await import("../../src/server.js");
const db = await import("../../src/db.js");

beforeAll(async () => {
  process.env.INTERCOM_APP_ID = "app_example";
  process.env.INTERCOM_MESSENGER_JWT_SECRET = "widget-test-secret";
  await db.initializeDatabase(server.client);
  const password = await db.passwordRecord("test-password");
  await server.client.execute({
    sql: "INSERT INTO demo_customers (id,name,email,password_salt,password_hash,tenant_id,stripe_customer_id,intercom_contact_id,purchase_paid) VALUES (?,?,?,?,?,?,?,?,?)",
    args: [
      "customer-example",
      "Example Customer",
      "customer@example.test",
      password.salt,
      password.hash,
      "local-demo",
      "cus_example",
      "contact_example",
      1,
    ],
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("Northstar demo routes", () => {
  it("sends a public support launcher to login and denies invalid credentials", async () => {
    const launcher = await server.app.request("http://demo.test/atendimento");
    expect(launcher.status).toBe(302);
    expect(launcher.headers.get("location")).toContain("/entrar?next=/conta");
    const invalid = await server.app.request("http://demo.test/entrar", {
      method: "POST",
      headers: {
        origin: "http://demo.test",
        "content-type": "application/x-www-form-urlencoded",
      },
      body: "email=customer%40example.test&password=wrong",
    });
    expect(invalid.status).toBe(401);
  });
  it("creates an opaque session, renders only authenticated account data, and expires it server-side", async () => {
    const login = await server.app.request("http://demo.test/entrar", {
      method: "POST",
      headers: {
        origin: "http://demo.test",
        "content-type": "application/x-www-form-urlencoded",
      },
      body: "email=customer%40example.test&password=test-password",
    });
    const cookie = login.headers.get("set-cookie")!;
    expect(cookie).toContain("northstar_session=");
    expect(cookie).toContain("HttpOnly");
    const account = await server.app.request("http://demo.test/conta", {
      headers: { cookie },
    });
    expect(account.status).toBe(200);
    const page = await account.text();
    expect(page).toContain("Purchase");
    expect(page).toContain(
      "Purchase details are unavailable for this historical record.",
    );
    expect(page).not.toContain("Purchased ");
    expect(page).toContain("intercom_user_jwt");
    expect(page).toContain('language_override":"en"');
    expect(page).toContain('user_id":"customer-example"');
    expect(page).toContain("window.setTimeout(shutdown,Math.max(0,remaining))");
    expect(page).toContain("localStorage.getItem(key)");
    expect(page).toContain("fetch('/solicitacoes'");
    expect(page).not.toContain('http-equiv="refresh"');
    await server.client.execute(
      "UPDATE demo_sessions SET expires_at = '2000-01-01T00:00:00.000Z'",
    );
    const expired = await server.app.request("http://demo.test/sessao", {
      headers: { cookie },
    });
    expect(expired.status).toBe(401);
    expect(account.headers.get("cache-control")).toBe("no-store");
    expect(expired.headers.get("cache-control")).toBe("no-store");
  });
  it("refreshes only the authenticated financial-request fragment", async () => {
    const login = await server.app.request("http://demo.test/entrar", {
      method: "POST",
      headers: {
        origin: "http://demo.test",
        "content-type": "application/x-www-form-urlencoded",
      },
      body: "email=customer%40example.test&password=test-password",
    });
    const requests = await server.app.request("http://demo.test/solicitacoes", {
      headers: { cookie: login.headers.get("set-cookie")! },
    });
    expect(requests.status).toBe(200);
    expect(requests.headers.get("cache-control")).toBe("no-store");
    expect(await requests.text()).not.toContain("<html");
  });
  it("allows only the local account return route and asks the account widget to open support", async () => {
    const unsafe = await server.app.request(
      "http://demo.test/entrar?next=/%5C%5Cforeign.test",
    );
    expect(await unsafe.text()).not.toContain("/%5C%5Cforeign.test");
    const login = await server.app.request("http://demo.test/entrar", {
      method: "POST",
      headers: {
        origin: "http://demo.test",
        "content-type": "application/x-www-form-urlencoded",
      },
      body: "email=customer%40example.test&password=test-password",
    });
    const launcher = await server.app.request("http://demo.test/atendimento", {
      headers: { cookie: login.headers.get("set-cookie")! },
    });
    expect(launcher.status).toBe(303);
    expect(launcher.headers.get("cache-control")).toBe("no-store");
    expect(launcher.headers.get("location")).toBe("/conta?chat=open");
    const account = await server.app.request(
      "http://demo.test/conta?chat=open",
      {
        headers: { cookie: login.headers.get("set-cookie")! },
      },
    );
    const page = await account.text();
    expect(page).toContain("w.Intercom('boot',w.intercomSettings)");
    expect(page).toContain("if(openChat)w.Intercom('show')");
  });
  it("rejects foreign-origin logout and does not expose a generic proxy", async () => {
    const csrf = await server.app.request("http://demo.test/sair", {
      method: "POST",
      headers: { origin: "http://foreign.test" },
    });
    expect(csrf.status).toBe(403);
    const missingToken = await server.app.request("http://demo.test/sair", {
      method: "POST",
      headers: { origin: "http://demo.test" },
    });
    expect(missingToken.status).toBe(403);
    expect(
      (await server.app.request("http://demo.test/proxy/http://foreign.test"))
        .status,
    ).toBe(404);
  });
  it("escapes widget configuration before inserting it into the account script", async () => {
    const originalAppId = process.env.INTERCOM_APP_ID;
    process.env.INTERCOM_APP_ID =
      "</script><script>window.injected=true</script>";
    try {
      const login = await server.app.request("http://demo.test/entrar", {
        method: "POST",
        headers: {
          origin: "http://demo.test",
          "content-type": "application/x-www-form-urlencoded",
        },
        body: "email=customer%40example.test&password=test-password",
      });
      const account = await server.app.request("http://demo.test/conta", {
        headers: { cookie: login.headers.get("set-cookie")! },
      });
      const page = await account.text();
      expect(page).toContain("\\u003c/script\\u003e");
      expect(page).not.toContain("</script><script>window.injected");
    } finally {
      process.env.INTERCOM_APP_ID = originalAppId;
    }
  });
  it("rejects oversized webhook payloads before any upstream request", async () => {
    const upstream = vi.fn();
    vi.stubGlobal("fetch", upstream);
    const response = await server.app.request(
      "http://demo.test/support/webhooks/intercom",
      {
        method: "POST",
        headers: { "content-length": String(256 * 1024 + 1) },
        body: "x",
      },
    );
    expect(response.status).toBe(413);
    expect(upstream).not.toHaveBeenCalled();
  });
  it("forwards admitted signed webhook bytes without rewriting them", async () => {
    const upstream = vi.fn(
      async () => new Response("accepted", { status: 200 }),
    );
    vi.stubGlobal("fetch", upstream);
    const body = new TextEncoder().encode('{"event":"ação"}');
    const response = await server.app.request(
      "http://demo.test/support/webhooks/stripe",
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "stripe-signature": "signed-test-payload",
        },
        body,
      },
    );
    expect(response.status).toBe(200);
    const [, init] = (
      upstream.mock.calls as unknown as Array<[string, RequestInit]>
    )[0]!;
    const headers = new Headers(init.headers);
    expect(headers.get("content-type")).toBe("application/json");
    expect(headers.get("stripe-signature")).toBe("signed-test-payload");
    expect(Array.from(init.body as Uint8Array)).toEqual(Array.from(body));
  });
});
