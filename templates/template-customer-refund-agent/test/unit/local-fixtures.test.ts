import { rm } from "node:fs/promises";
import { createClient } from "@libsql/client";
import { afterEach, describe, expect, it } from "vitest";
import {
  localFixtureBinding,
  resetLocalFixtures,
  seedInteractiveLocalDemoFixtures,
  seedLocalFixtures,
} from "../../src/mastra/runtime/local-fixtures";
import { temporaryDatabasePath } from "../support/temp-path";

const files: string[] = [];

afterEach(async () => {
  delete process.env.DATABASE_URL;
  await Promise.all(files.splice(0).map((file) => rm(file, { force: true })));
});

describe("local subscription billing-term migration", () => {
  it("seeds one API Credits purchase five days before the clock without a subscription", async () => {
    const path = temporaryDatabasePath("phase008-current-demo");
    files.push(path, `${path}-shm`, `${path}-wal`);
    process.env.APP_MODE = "local";
    process.env.DATABASE_URL = `file:${path}`;
    process.env.LOCAL_DEMO_DATABASE_URL = `file:${path}`;
    const client = createClient({ url: process.env.DATABASE_URL });
    const binding = localFixtureBinding();
    const seedAt = "2026-01-31T23:30:00.000Z";

    await seedInteractiveLocalDemoFixtures(client, binding, seedAt);
    await seedInteractiveLocalDemoFixtures(
      client,
      binding,
      "2026-02-01T00:30:00.000Z",
    );
    await seedLocalFixtures(client, binding);

    expect(
      (
        await client.execute({
          sql: "SELECT product, amount_minor, placed_at FROM local_orders WHERE tenant_id = ? AND provider_account_id = ?",
          args: [binding.tenantId, binding.providerAccountId],
        })
      ).rows,
    ).toEqual([
      expect.objectContaining({
        product: "API Credits",
        amount_minor: 500,
        placed_at: "2026-01-26T23:30:00.000Z",
      }),
    ]);
    expect(
      (
        await client.execute({
          sql: "SELECT COUNT(*) AS total FROM local_subscriptions WHERE tenant_id = ? AND provider_account_id = ?",
          args: [binding.tenantId, binding.providerAccountId],
        })
      ).rows[0]?.total,
    ).toBe(0);
    expect(
      (
        await client.execute({
          sql: "SELECT seeded_at FROM local_demo_seed_profiles WHERE tenant_id = ? AND provider_account_id = ?",
          args: [binding.tenantId, binding.providerAccountId],
        })
      ).rows,
    ).toEqual([{ seeded_at: seedAt }]);

    await resetLocalFixtures(client, binding);
    await seedInteractiveLocalDemoFixtures(client, binding, seedAt);
    expect(
      (await client.execute("SELECT COUNT(*) AS total FROM local_orders"))
        .rows[0]?.total,
    ).toBe(1);
    expect(
      (
        await client.execute(
          "SELECT COUNT(*) AS total FROM local_subscriptions",
        )
      ).rows[0]?.total,
    ).toBe(0);
    client.close();
  });

  it("leaves a populated legacy commerce history untouched", async () => {
    const path = temporaryDatabasePath("phase008-legacy-demo");
    files.push(path, `${path}-shm`, `${path}-wal`);
    process.env.APP_MODE = "local";
    process.env.DATABASE_URL = `file:${path}`;
    process.env.LOCAL_DEMO_DATABASE_URL = `file:${path}`;
    const client = createClient({ url: process.env.DATABASE_URL });
    const binding = localFixtureBinding();
    await seedLocalFixtures(client, binding);
    const before = await client.execute({
      sql: "SELECT product, amount_minor, placed_at FROM local_orders WHERE tenant_id = ? AND provider_account_id = ? AND order_id = 'ORD-1001'",
      args: [binding.tenantId, binding.providerAccountId],
    });
    await seedInteractiveLocalDemoFixtures(
      client,
      binding,
      "2026-09-14T12:00:00.000Z",
    );
    const after = await client.execute({
      sql: "SELECT product, amount_minor, placed_at FROM local_orders WHERE tenant_id = ? AND provider_account_id = ? AND order_id = 'ORD-1001'",
      args: [binding.tenantId, binding.providerAccountId],
    });
    expect(after.rows).toEqual(before.rows);
    client.close();
  });

  it("backfills the known annual fixture instead of retaining SQLite's new monthly default", async () => {
    const path = temporaryDatabasePath("phase008-recurring-migration");
    files.push(path, `${path}-shm`, `${path}-wal`);
    process.env.DATABASE_URL = `file:${path}`;
    process.env.LOCAL_DEMO_DATABASE_URL = `file:${path}`;
    const client = createClient({ url: process.env.DATABASE_URL });
    const binding = localFixtureBinding();
    await client.executeMultiple(`
      CREATE TABLE local_subscriptions (
        tenant_id TEXT NOT NULL,
        provider_account_id TEXT NOT NULL,
        subscription_id TEXT NOT NULL,
        customer_email TEXT NOT NULL,
        plan TEXT NOT NULL,
        amount_minor INTEGER NOT NULL,
        currency TEXT NOT NULL,
        status TEXT NOT NULL,
        renews_at TEXT NOT NULL,
        PRIMARY KEY(tenant_id, provider_account_id, subscription_id)
      );
    `);
    await client.execute({
      sql: "INSERT INTO local_subscriptions VALUES (?, ?, 'SUB-1004', 'riley@example.com', 'Team Plan - Annual', 58800, 'USD', 'active', '2027-05-02T00:00:00.000Z')",
      args: [binding.tenantId, binding.providerAccountId],
    });

    await seedLocalFixtures(client, binding);

    const annual = await client.execute({
      sql: "SELECT recurring_interval, recurring_interval_count, quantity FROM local_subscriptions WHERE tenant_id = ? AND provider_account_id = ? AND subscription_id = 'SUB-1004'",
      args: [binding.tenantId, binding.providerAccountId],
    });
    expect(annual.rows).toEqual([
      expect.objectContaining({
        recurring_interval: "year",
        recurring_interval_count: 1,
        quantity: 1,
      }),
    ]);
    client.close();
  });
});
