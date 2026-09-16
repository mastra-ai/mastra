import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createClient } from "@libsql/client";
import { afterEach, describe, expect, it } from "vitest";
import {
  initializeDatabase,
  passwordRecord,
  verifyCustomer,
} from "../../src/db.js";
import { seedLocalCustomers } from "../../src/local-seed.js";

const originalEnvironment = { ...process.env };
const directories: string[] = [];

async function localProfile() {
  const directory = await mkdtemp(join(tmpdir(), "phase008-local-seed-"));
  directories.push(directory);
  const backend = join(directory, "backend.db");
  const client = join(directory, "client.db");
  Object.assign(process.env, {
    APP_MODE: "local",
    DATABASE_URL: `file:${backend}`,
    LOCAL_DEMO_DATABASE_URL: `file:${backend}`,
    LOCAL_DEMO_CLIENT_DATABASE_URL: `file:${client}`,
    ORIGINAL_DATABASE_URL: `file:${join(directory, "external.db")}`,
    ORIGINAL_DEMO_DATABASE_URL: `file:${join(directory, "external-client.db")}`,
    LOCAL_DEMO_SEED_AT: "2026-01-31T23:30:00.000Z",
  });
  delete process.env.LOCAL_DEMO_FIXTURE_PROFILE;
  return { backend, client };
}

async function seedHistoricalBackend(url: string) {
  const backend = createClient({ url: `file:${url}` });
  try {
    await backend.executeMultiple(`
      CREATE TABLE local_orders (tenant_id TEXT NOT NULL, provider_account_id TEXT NOT NULL, order_id TEXT NOT NULL, customer_email TEXT NOT NULL, product TEXT NOT NULL, amount_minor INTEGER NOT NULL, currency TEXT NOT NULL, status TEXT NOT NULL, charge_count INTEGER NOT NULL, placed_at TEXT NOT NULL, PRIMARY KEY(tenant_id, provider_account_id, order_id));
      CREATE TABLE local_subscriptions (tenant_id TEXT NOT NULL, provider_account_id TEXT NOT NULL, subscription_id TEXT NOT NULL, customer_email TEXT NOT NULL, plan TEXT NOT NULL, recurring_interval TEXT NOT NULL DEFAULT 'month', recurring_interval_count INTEGER NOT NULL DEFAULT 1, quantity INTEGER NOT NULL DEFAULT 1, amount_minor INTEGER NOT NULL, currency TEXT NOT NULL, status TEXT NOT NULL, started_at TEXT, renews_at TEXT NOT NULL, cancel_at_period_end INTEGER NOT NULL DEFAULT 0, cancels_at TEXT, PRIMARY KEY(tenant_id, provider_account_id, subscription_id));
      CREATE TABLE local_demo_seed_profiles (tenant_id TEXT NOT NULL, provider_account_id TEXT NOT NULL, profile TEXT NOT NULL, seeded_at TEXT NOT NULL, PRIMARY KEY(tenant_id, provider_account_id));
    `);
    await backend.execute({
      sql: "INSERT INTO local_orders VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
      args: [
        "local-demo",
        "local-demo",
        "DEMO-API-CREDITS-001",
        "alex@example.com",
        "API Credits",
        500,
        "USD",
        "fulfilled",
        1,
        "2026-01-31T23:30:00.000Z",
      ],
    });
    await backend.execute({
      sql: "INSERT INTO local_subscriptions(tenant_id, provider_account_id, subscription_id, customer_email, plan, recurring_interval, recurring_interval_count, quantity, amount_minor, currency, status, started_at, renews_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
      args: [
        "local-demo",
        "local-demo",
        "DEMO-WORKSPACE-001",
        "alex@example.com",
        "Workspace",
        "month",
        1,
        1,
        4900,
        "USD",
        "active",
        "2026-01-31T23:30:00.000Z",
        "2026-02-28T23:30:00.000Z",
      ],
    });
    await backend.execute({
      sql: "INSERT INTO local_demo_seed_profiles(tenant_id, provider_account_id, profile, seeded_at) VALUES (?, ?, 'interactive-current', ?)",
      args: ["local-demo", "local-demo", "2026-01-31T23:30:00.000Z"],
    });
  } finally {
    backend.close();
  }
}

async function customerRow(url: string) {
  const client = createClient({ url: `file:${url}` });
  try {
    const result = await client.execute(
      "SELECT id, subscription_id, purchase_product, purchase_amount_minor, purchase_purchased_at, subscription_plan, subscription_amount_minor, subscription_renews_at FROM demo_customers WHERE id = 'customer-alex'",
    );
    return result.rows[0];
  } finally {
    client.close();
  }
}

afterEach(async () => {
  process.env = { ...originalEnvironment };
  await Promise.all(
    directories
      .splice(0)
      .map((directory) => rm(directory, { recursive: true, force: true })),
  );
});

describe("local customer seed", () => {
  it("copies the backend profile, replays after a clock advance, and rebuilds only the client database", async () => {
    const profile = await localProfile();
    await seedLocalCustomers();
    const first = await customerRow(profile.client);
    expect(first).toMatchObject({
      subscription_id: null,
      purchase_product: "API Credits",
      purchase_amount_minor: 500,
      purchase_purchased_at: "2026-01-26T23:30:00.000Z",
      subscription_plan: null,
      subscription_amount_minor: null,
      subscription_renews_at: null,
    });

    process.env.LOCAL_DEMO_SEED_AT = "2026-02-01T23:30:00.000Z";
    await seedLocalCustomers();
    expect(await customerRow(profile.client)).toEqual(first);

    await rm(profile.client, { force: true });
    await seedLocalCustomers();
    expect(await customerRow(profile.client)).toEqual(first);
  });

  it("preserves a matching historic subscription while backfilling its purchase metadata", async () => {
    const profile = await localProfile();
    await seedHistoricalBackend(profile.backend);
    const client = createClient({ url: `file:${profile.client}` });
    await initializeDatabase(client);
    const password = await passwordRecord("legacy-password");
    await client.execute({
      sql: "INSERT INTO demo_customers (id,name,email,password_salt,password_hash,tenant_id,stripe_customer_id,intercom_contact_id,subscription_id,purchase_paid,subscription_plan,subscription_amount_minor,subscription_currency,subscription_interval,subscription_started_at,subscription_renews_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
      args: [
        "customer-alex",
        "Alex Morgan",
        "alex@example.com",
        password.salt,
        password.hash,
        "local-demo",
        "local-customer-alex",
        "local-contact-alex",
        "DEMO-WORKSPACE-001",
        1,
        "Workspace",
        4900,
        "USD",
        "month",
        "2026-01-31T23:30:00.000Z",
        "2026-02-28T23:30:00.000Z",
      ],
    });
    await seedLocalCustomers();
    expect(
      await verifyCustomer(client, "alex@example.com", "legacy-password"),
    ).toMatchObject({ id: "customer-alex" });
    const row = await customerRow(profile.client);
    expect(row).toMatchObject({
      subscription_id: "DEMO-WORKSPACE-001",
      purchase_product: "API Credits",
      purchase_purchased_at: "2026-01-31T23:30:00.000Z",
      subscription_plan: "Workspace",
      subscription_amount_minor: 4900,
      subscription_renews_at: "2026-02-28T23:30:00.000Z",
    });
    client.close();
  });

  it.each([
    [
      "customer ID",
      "customer-alex",
      "someone-else@example.com",
      "other-stripe-customer",
      "other-intercom-contact",
    ],
    [
      "Stripe customer ID",
      "different-customer",
      "someone-else@example.com",
      "local-customer-alex",
      "other-intercom-contact",
    ],
  ])(
    "rejects a conflicting existing %s without creating or changing Alex",
    async (_kind, id, email, stripeCustomerId, intercomContactId) => {
      const profile = await localProfile();
      const client = createClient({ url: `file:${profile.client}` });
      await initializeDatabase(client);
      const password = await passwordRecord("existing-password");
      await client.execute({
        sql: "INSERT INTO demo_customers (id,name,email,password_salt,password_hash,tenant_id,stripe_customer_id,intercom_contact_id,purchase_paid) VALUES (?,?,?,?,?,?,?,?,?)",
        args: [
          id,
          "Existing Customer",
          email,
          password.salt,
          password.hash,
          "other-tenant",
          stripeCustomerId,
          intercomContactId,
          0,
        ],
      });
      client.close();

      await expect(seedLocalCustomers()).rejects.toThrow();

      const check = createClient({ url: `file:${profile.client}` });
      try {
        expect(
          await verifyCustomer(check, email, "existing-password"),
        ).toMatchObject({ id, stripeCustomerId, intercomContactId });
        expect(
          (
            await check.execute({
              sql: "SELECT id FROM demo_customers WHERE email = ?",
              args: ["alex@example.com"],
            })
          ).rows,
        ).toEqual([]);
        expect(
          (await check.execute("SELECT id FROM demo_customers")).rows,
        ).toEqual([{ id }]);
      } finally {
        check.close();
      }
    },
  );

  it("rejects a stale client snapshot without replacing its stored facts", async () => {
    const profile = await localProfile();
    await seedLocalCustomers();
    const client = createClient({ url: `file:${profile.client}` });
    await client.execute(
      "UPDATE demo_customers SET purchase_product = 'Different product' WHERE id = 'customer-alex'",
    );
    client.close();

    await expect(seedLocalCustomers()).rejects.toThrow(
      "display facts do not match the backend",
    );
    expect((await customerRow(profile.client))?.purchase_product).toBe(
      "Different product",
    );
  });
});
