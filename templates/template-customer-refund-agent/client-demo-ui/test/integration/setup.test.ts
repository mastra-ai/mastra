import {
  access,
  mkdir,
  mkdtemp,
  readFile,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { displayName, runSetup } from "../../src/setup.js";
import { openDatabase, verifyCustomer } from "../../src/db.js";

const original = { ...process.env };
const originalArgs = [...process.argv];
const originalCwd = process.cwd();
const temporaryDirectories: string[] = [];

async function configuredDirectory() {
  const directory = await mkdtemp(join(tmpdir(), "client-demo-setup-"));
  temporaryDirectories.push(directory);
  process.chdir(directory);
  process.argv = ["node", "setup.js", "--run", "setup-test-001"];
  Object.assign(process.env, {
    STRIPE_RESTRICTED_API_KEY: "rk_test_synthetic",
    STRIPE_SANDBOX_ENABLED: "true",
    COMMERCE_SOURCE: "stripe",
    STRIPE_TENANT_ID: "local-demo",
    STRIPE_ACCOUNT_ID: "acct_test_123",
    INTERCOM_DEVELOPMENT_ENABLED: "true",
    SUPPORT_SOURCE: "intercom",
    INTERCOM_TENANT_ID: "local-demo",
    INTERCOM_ACCESS_TOKEN: "token",
    INTERCOM_APP_ID: "app_test_123",
    INTERCOM_MESSENGER_JWT_SECRET: "messenger",
    DEMO_AUTH_BRIDGE_SIGNING_KEY: "bridge",
    LOCAL_AUTH_SIGNING_KEY: "local",
    DEMO_PRIVATE_DIR: join(directory, "private"),
  });
  delete process.env.APP_MODE;
  delete process.env.DEMO_DATABASE_URL;
  return directory;
}

afterEach(async () => {
  process.env = { ...original };
  process.argv = [...originalArgs];
  process.chdir(originalCwd);
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((path) => rm(path, { recursive: true, force: true })),
  );
});

describe("demo setup transport", () => {
  it("rejects local mode before manifest, database, or provider effects", async () => {
    const directory = await configuredDirectory();
    const localClient = join(directory, "local-client.db");
    process.env.APP_MODE = "local";
    process.env.LOCAL_DEMO_DATABASE_URL = `file:${join(directory, "local.db")}`;
    process.env.LOCAL_DEMO_CLIENT_DATABASE_URL = `file:${localClient}`;
    let calls = 0;

    await expect(
      runSetup({
        fetchImpl: async () => {
          calls += 1;
          return Response.json({});
        },
      }),
    ).rejects.toThrow("APP_MODE=local");

    expect(calls).toBe(0);
    await expect(access(process.env.DEMO_PRIVATE_DIR!)).rejects.toThrow();
    await expect(access(localClient)).rejects.toThrow();
  });

  it.each(["staging", "production"])(
    "uses both external providers for explicit %s mode despite legacy mock flags",
    async (mode) => {
      const directory = await configuredDirectory();
      Object.assign(process.env, {
        APP_MODE: mode,
        COMMERCE_SOURCE: "mock",
        SUPPORT_SOURCE: "mock",
        DATABASE_URL: `file:${join(directory, "external-backend.db")}`,
        DEMO_DATABASE_URL: `file:${join(directory, "external-client.db")}`,
        LOCAL_DEMO_DATABASE_URL: `file:${join(directory, "local.db")}`,
        LOCAL_DEMO_CLIENT_DATABASE_URL: `file:${join(directory, "local-client.db")}`,
      });
      const calls: string[] = [];
      await expect(
        runSetup({
          fetchImpl: async (input) => {
            const path = new URL(String(input)).pathname;
            calls.push(path);
            if (path === "/v1/account")
              return Response.json({ id: "acct_test_123" });
            if (path === "/me")
              return Response.json({ app: { id_code: "app_test_123" } });
            throw new Error("stop after external provider selection");
          },
        }),
      ).rejects.toThrow("stop after external provider selection");
      expect(calls).toEqual(["/v1/account", "/me", "/v1/customers"]);
    },
  );

  it("validates explicit external database isolation before provider effects", async () => {
    const directory = await configuredDirectory();
    const shared = `file:${join(directory, "shared.db")}`;
    Object.assign(process.env, {
      APP_MODE: "staging",
      COMMERCE_SOURCE: "mock",
      SUPPORT_SOURCE: "mock",
      DATABASE_URL: `file:${join(directory, "external-backend.db")}`,
      DEMO_DATABASE_URL: shared,
      LOCAL_DEMO_DATABASE_URL: `file:${join(directory, "local-backend.db")}`,
      LOCAL_DEMO_CLIENT_DATABASE_URL: shared,
    });
    let calls = 0;

    await expect(
      runSetup({
        fetchImpl: async () => {
          calls += 1;
          return Response.json({});
        },
      }),
    ).rejects.toThrow("different files");

    expect(calls).toBe(0);
    await expect(access(process.env.DEMO_PRIVATE_DIR!)).rejects.toThrow();
  });

  it("resumes one response-lost payment and replays a completed run without provider writes", async () => {
    const directory = await mkdtemp(join(tmpdir(), "client-demo-setup-"));
    temporaryDirectories.push(directory);
    process.chdir(directory);
    process.argv = ["node", "setup.js", "--run", "setup-test-001"];
    Object.assign(process.env, {
      STRIPE_RESTRICTED_API_KEY: "rk_test_synthetic",
      STRIPE_SANDBOX_ENABLED: "true",
      COMMERCE_SOURCE: "stripe",
      STRIPE_TENANT_ID: "local-demo",
      STRIPE_ACCOUNT_ID: "acct_test_123",
      INTERCOM_DEVELOPMENT_ENABLED: "true",
      SUPPORT_SOURCE: "intercom",
      INTERCOM_TENANT_ID: "local-demo",
      INTERCOM_ACCESS_TOKEN: "token",
      INTERCOM_APP_ID: "app_test_123",
      INTERCOM_MESSENGER_JWT_SECRET: "messenger",
      DEMO_AUTH_BRIDGE_SIGNING_KEY: "bridge",
      LOCAL_AUTH_SIGNING_KEY: "local",
      DEMO_PRIVATE_DIR: join(directory, "private"),
    });
    delete process.env.APP_MODE;
    delete process.env.DEMO_DATABASE_URL;
    const calls: Request[] = [];
    let paidInvoices = 0;
    let subscriptions = 0;
    const fetchImpl: typeof fetch = async (input, init) => {
      const request = new Request(input, init);
      calls.push(request);
      const url = new URL(request.url);
      const form = new URLSearchParams(await request.clone().text());
      if (url.pathname === "/v1/account")
        return Response.json({ id: "acct_test_123" });
      if (url.pathname === "/me")
        return Response.json({ app: { id_code: "app_test_123" } });
      if (url.pathname === "/v1/customers" && request.method === "GET")
        return Response.json({ data: [] });
      if (url.pathname === "/v1/customers")
        return Response.json({
          id: `cus_${form.get("email")?.split(".")[0]}`,
          livemode: false,
        });
      if (url.pathname === "/contacts/search")
        return Response.json({ data: [] });
      if (url.pathname === "/contacts")
        return Response.json({ id: `contact_${calls.length}` });
      if (url.pathname === "/v1/payment_methods")
        return Response.json({ id: "pm_1", livemode: false });
      if (url.pathname.endsWith("/attach"))
        return Response.json({ id: "pm_1", livemode: false });
      if (url.pathname.startsWith("/v1/customers/"))
        return Response.json({ id: "cus_1", livemode: false });
      if (url.pathname === "/v1/invoices")
        return Response.json({ id: "in_alex", livemode: false });
      if (url.pathname === "/v1/invoiceitems")
        return Response.json({ id: "ii_1", livemode: false });
      if (url.pathname.endsWith("/finalize"))
        return Response.json({ id: "in_alex", livemode: false });
      if (url.pathname.endsWith("/pay")) {
        if (paidInvoices === 0) paidInvoices += 1;
        if (
          calls.filter((call) => new URL(call.url).pathname.endsWith("/pay"))
            .length === 1
        )
          throw new TypeError("response lost after remote payment");
        return Response.json({
          id: "in_alex",
          livemode: false,
          status: "paid",
          amount_paid: 500,
          currency: "usd",
          payment_intent: "pi_alex",
          status_transitions: { paid_at: 1_789_000_000 },
        });
      }
      if (url.pathname === "/v1/products")
        return Response.json({ id: "prod_1", livemode: false });
      if (url.pathname === "/v1/prices")
        return Response.json({ id: "price_1", livemode: false });
      if (url.pathname === "/v1/subscriptions") {
        subscriptions += 1;
        return Response.json({
          id: "sub_1",
          livemode: false,
          status: "active",
          latest_invoice: "in_jordan",
          items: {
            data: [
              {
                current_period_start: 1_789_000_000,
                current_period_end: 1_791_678_400,
              },
            ],
          },
        });
      }
      if (url.pathname === "/v1/invoices/in_jordan")
        return Response.json({
          id: "in_jordan",
          livemode: false,
          status: "paid",
          amount_paid: 4900,
          currency: "usd",
          payment_intent: "pi_jordan",
          status_transitions: { paid_at: 1_789_000_000 },
        });
      throw new Error(`unexpected ${request.method} ${url.pathname}`);
    };

    await expect(runSetup({ fetchImpl })).rejects.toThrow("response lost");
    await runSetup({ fetchImpl });

    const paths = calls.map((request) => new URL(request.url).pathname);
    expect(paths).toContain("/v1/invoices/in_alex/pay");
    expect(paths).toContain("/v1/subscriptions");
    expect(paths.indexOf("/v1/invoiceitems")).toBeGreaterThan(
      paths.indexOf("/v1/invoices"),
    );
    expect(paths.indexOf("/v1/invoices/in_alex/finalize")).toBeGreaterThan(
      paths.indexOf("/v1/invoiceitems"),
    );
    const invoice = calls.find(
      (request) =>
        new URL(request.url).pathname === "/v1/invoices" &&
        request.method === "POST",
    );
    expect(
      new URLSearchParams(await invoice?.clone().text()).get("auto_advance"),
    ).toBe("false");
    const invoiceItem = calls.find(
      (request) => new URL(request.url).pathname === "/v1/invoiceitems",
    );
    expect(
      new URLSearchParams(await invoiceItem?.clone().text()).get("description"),
    ).toBe("API Credits");
    const price = calls.find(
      (request) => new URL(request.url).pathname === "/v1/prices",
    );
    expect(
      new URLSearchParams(await price?.clone().text()).get("unit_amount"),
    ).toBe("4900");
    const paymentMethod = calls.find(
      (request) => new URL(request.url).pathname === "/v1/payment_methods",
    );
    expect(
      new URLSearchParams(await paymentMethod?.clone().text()).get(
        "card[token]",
      ),
    ).toBe("tok_visa");
    expect(paths.some((path) => /refund|balance|cancel/.test(path))).toBe(
      false,
    );
    expect(paidInvoices).toBe(1);
    expect(subscriptions).toBe(1);
    const verifiedManifest = JSON.parse(
      await readFile(
        join(directory, "private", "demo-round-setup-test-001.json"),
        "utf8",
      ),
    ) as {
      customers: { jordan?: { subscription?: Record<string, unknown> } };
    };
    expect(verifiedManifest.customers.jordan?.subscription).toMatchObject({
      plan: "Workspace",
      amountMinor: 4900,
      currency: "USD",
      interval: "month",
      startedAt: "2026-09-10T00:26:40.000Z",
      renewsAt: "2026-10-11T00:26:40.000Z",
    });
    expect(
      calls
        .filter(
          (request) => new URL(request.url).origin === "https://api.stripe.com",
        )
        .every(
          (request) =>
            request.headers.get("stripe-version") === "2026-08-26.dahlia",
        ),
    ).toBe(true);
    expect(
      calls
        .filter(
          (request) =>
            new URL(request.url).origin === "https://api.intercom.io",
        )
        .every((request) => request.headers.get("intercom-version") === "2.16"),
    ).toBe(true);
    expect(
      (await stat(join(directory, ".data", "northstar-demo.db"))).isFile(),
    ).toBe(true);
    const beforeReplay = calls.length;
    await runSetup({ fetchImpl });
    expect(
      calls.slice(beforeReplay).filter((request) => request.method === "POST"),
    ).toHaveLength(0);
    const manifest = join(
      directory,
      "private",
      "demo-round-setup-test-001.json",
    );
    expect((await stat(manifest)).mode & 0o777).toBe(0o600);
    const credentials = JSON.parse(await readFile(manifest, "utf8")) as {
      customers: Record<
        string,
        { email: string; password: string; name: string }
      >;
    };
    // Names derive from the new round identifier, but are persisted before
    // provider setup. A retry therefore keeps provider and login identities
    // stable instead of producing a fresh random name mid-round.
    expect(credentials.customers.alex?.name).toBe(
      displayName("setup-test-001", "alex"),
    );
    expect(credentials.customers.jordan?.name).toBe(
      displayName("setup-test-001", "jordan"),
    );
    expect(displayName("setup-test-002", "alex")).not.toBe(
      credentials.customers.alex?.name,
    );
    const database = openDatabase();
    try {
      for (const customer of Object.values(credentials.customers))
        expect(
          await verifyCustomer(database, customer.email, customer.password),
        ).toBeDefined();
    } finally {
      database.close();
    }
    expect(
      (await stat(join(directory, ".data", "northstar-demo.db"))).isFile(),
    ).toBe(true);
  });

  it("rejects live keys and mismatched Stripe or Intercom accounts before mutations", async () => {
    await configuredDirectory();
    let calls = 0;
    process.env.STRIPE_RESTRICTED_API_KEY = "rk_live_forbidden";
    await expect(
      runSetup({
        fetchImpl: async () => {
          calls += 1;
          return Response.json({});
        },
      }),
    ).rejects.toThrow("test sandbox");
    expect(calls).toBe(0);
    process.env.STRIPE_RESTRICTED_API_KEY = "rk_test_synthetic";
    await expect(
      runSetup({
        fetchImpl: async () => {
          calls += 1;
          return Response.json({ id: "acct_wrong" });
        },
      }),
    ).rejects.toThrow("credential account");
    const requests: Request[] = [];
    await expect(
      runSetup({
        fetchImpl: async (input, init) => {
          const request = new Request(input, init);
          requests.push(request);
          return Response.json(
            new URL(request.url).pathname === "/v1/account"
              ? { id: "acct_test_123" }
              : { app: { id_code: "app_wrong" } },
          );
        },
      }),
    ).rejects.toThrow("Intercom token");
    expect(
      requests.filter((request) => request.method === "POST"),
    ).toHaveLength(0);
  });

  it("rejects an unpaid Alex invoice before importing any login", async () => {
    const directory = await configuredDirectory();
    const responses = [
      { id: "acct_test_123" },
      { app: { id_code: "app_test_123" } },
      { data: [] },
      { id: "cus_alex", livemode: false },
      { data: [] },
      { id: "contact_alex" },
      { id: "pm_alex", livemode: false },
      { id: "pm_alex", livemode: false },
      { id: "cus_alex", livemode: false },
      { id: "in_alex", livemode: false },
      { id: "ii_alex", livemode: false },
      { id: "in_alex", livemode: false },
      {
        id: "in_alex",
        livemode: false,
        status: "open",
        amount_paid: 0,
        currency: "usd",
      },
    ];
    await expect(
      runSetup({ fetchImpl: async () => Response.json(responses.shift()) }),
    ).rejects.toThrow("paid USD 5");
    await expect(
      access(join(directory, ".data", "northstar-demo.db")),
    ).rejects.toThrow();
  });

  it("rejects expired runs and Git-contained private directories before provider calls", async () => {
    const directory = await configuredDirectory();
    await mkdir(join(directory, "private"));
    await writeFile(
      join(directory, "private", "demo-round-setup-test-001.json"),
      JSON.stringify({
        run: "setup-test-001",
        createdAt: "2000-01-01T00:00:00.000Z",
        customers: {},
      }),
    );
    let calls = 0;
    const fetchImpl: typeof fetch = async () => {
      calls += 1;
      return Response.json({});
    };
    await expect(runSetup({ fetchImpl })).rejects.toThrow(
      "idempotency safety window",
    );
    expect(calls).toBe(0);
    process.env.DEMO_PRIVATE_DIR = resolve(import.meta.dirname, "../../.data");
    await expect(runSetup({ fetchImpl })).rejects.toThrow(
      "outside the Git repository",
    );
    expect(calls).toBe(0);
    await expect(
      access(join(directory, ".data", "northstar-demo.db")),
    ).rejects.toThrow();
  });
});
