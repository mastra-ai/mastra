import type { Client } from "@libsql/client";
import { POLICY_DOCUMENTS } from "../knowledge/policy-docs.ts";
import type { ProviderBinding } from "../providers/contracts";
import { requireLocalDatabaseUrl } from "../lib/database-url.ts";
import { isLocalMode } from "../../../config/app-mode.mjs";
import {
  interactiveLocalCommerce,
  localDemoSeedInstant,
} from "../../../config/demo-commerce.mjs";

const localSchema = `
  CREATE TABLE IF NOT EXISTS local_orders (tenant_id TEXT NOT NULL, provider_account_id TEXT NOT NULL, order_id TEXT NOT NULL, customer_email TEXT NOT NULL, product TEXT NOT NULL, amount_minor INTEGER NOT NULL, currency TEXT NOT NULL, status TEXT NOT NULL, charge_count INTEGER NOT NULL, placed_at TEXT NOT NULL, PRIMARY KEY(tenant_id, provider_account_id, order_id));
  CREATE TABLE IF NOT EXISTS local_subscriptions (tenant_id TEXT NOT NULL, provider_account_id TEXT NOT NULL, subscription_id TEXT NOT NULL, customer_email TEXT NOT NULL, plan TEXT NOT NULL, recurring_interval TEXT NOT NULL DEFAULT 'month', recurring_interval_count INTEGER NOT NULL DEFAULT 1, quantity INTEGER NOT NULL DEFAULT 1, amount_minor INTEGER NOT NULL, currency TEXT NOT NULL, status TEXT NOT NULL, started_at TEXT, renews_at TEXT NOT NULL, cancel_at_period_end INTEGER NOT NULL DEFAULT 0, cancels_at TEXT, PRIMARY KEY(tenant_id, provider_account_id, subscription_id));
  CREATE TABLE IF NOT EXISTS local_refunds (refund_id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL, provider_account_id TEXT NOT NULL, order_id TEXT NOT NULL, amount_minor INTEGER NOT NULL, currency TEXT NOT NULL, reason TEXT NOT NULL, issued_at TEXT NOT NULL);
  CREATE TABLE IF NOT EXISTS local_subscription_credits (credit_id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL, provider_account_id TEXT NOT NULL, customer_id TEXT NOT NULL, subscription_id TEXT NOT NULL, amount_minor INTEGER NOT NULL, currency TEXT NOT NULL, reason TEXT NOT NULL, issued_at TEXT NOT NULL, UNIQUE(tenant_id, provider_account_id, subscription_id, credit_id));
  CREATE TABLE IF NOT EXISTS local_knowledge (tenant_id TEXT NOT NULL, provider_account_id TEXT NOT NULL, source TEXT NOT NULL, title TEXT NOT NULL, text TEXT NOT NULL, version TEXT NOT NULL, effective_at TEXT, expires_at TEXT, PRIMARY KEY(tenant_id, provider_account_id, source));
  CREATE TABLE IF NOT EXISTS local_deliveries (tenant_id TEXT NOT NULL, provider_account_id TEXT NOT NULL, idempotency_key TEXT NOT NULL, payload_fingerprint TEXT NOT NULL, receipt TEXT NOT NULL, PRIMARY KEY(tenant_id, provider_account_id, idempotency_key));
  CREATE TABLE IF NOT EXISTS local_demo_seed_profiles (tenant_id TEXT NOT NULL, provider_account_id TEXT NOT NULL, profile TEXT NOT NULL, seeded_at TEXT NOT NULL, PRIMARY KEY(tenant_id, provider_account_id));
`;

export const localFixtureOrders = [
  {
    orderId: "ORD-1001",
    customerEmail: "alex@example.com",
    product: "Pro Plan - Monthly",
    amountMinor: 4900,
    currency: "USD",
    status: "fulfilled",
    chargeCount: 2,
    placedAt: "2026-08-01T14:00:00.000Z",
  },
  {
    orderId: "ORD-1002",
    customerEmail: "jordan@example.com",
    product: "Wireless Headphones",
    amountMinor: 12999,
    currency: "USD",
    status: "shipped",
    chargeCount: 1,
    placedAt: "2026-08-10T09:30:00.000Z",
  },
  {
    orderId: "ORD-1003",
    customerEmail: "sam@example.com",
    product: "Standing Desk",
    amountMinor: 34900,
    currency: "USD",
    status: "fulfilled",
    chargeCount: 1,
    placedAt: "2026-07-20T11:15:00.000Z",
  },
  {
    orderId: "ORD-1004",
    customerEmail: "riley@example.com",
    product: "Team Plan - Annual",
    amountMinor: 58800,
    currency: "USD",
    status: "fulfilled",
    chargeCount: 1,
    placedAt: "2026-05-02T08:00:00.000Z",
  },
] as const;
export const localFixtureSubscriptions = [
  {
    subscriptionId: "SUB-1001",
    customerEmail: "alex@example.com",
    plan: "Pro Plan - Monthly",
    recurringInterval: "month",
    recurringIntervalCount: 1,
    quantity: 1,
    amountMinor: 4900,
    currency: "USD",
    status: "active",
    renewsAt: "2026-09-01T00:00:00.000Z",
  },
  {
    subscriptionId: "SUB-1004",
    customerEmail: "riley@example.com",
    plan: "Team Plan - Annual",
    recurringInterval: "year",
    recurringIntervalCount: 1,
    quantity: 1,
    amountMinor: 58800,
    currency: "USD",
    status: "active",
    renewsAt: "2027-05-02T00:00:00.000Z",
  },
] as const;

export function localFixtureBinding(
  tenantId = process.env.LOCAL_FIXTURE_TENANT || "local-demo",
  providerAccountId = process.env.LOCAL_FIXTURE_ACCOUNT || "local-demo",
): ProviderBinding {
  return {
    tenantId,
    providerKind: "local",
    providerAccountId,
    externalConversationId: "local",
  };
}

export async function initializeLocalFixtures(client: Client) {
  await client.executeMultiple(localSchema);
  for (const sql of [
    "ALTER TABLE local_deliveries ADD COLUMN payload_fingerprint TEXT NOT NULL DEFAULT ''",
    "ALTER TABLE local_knowledge ADD COLUMN effective_at TEXT",
    "ALTER TABLE local_knowledge ADD COLUMN expires_at TEXT",
    "ALTER TABLE local_subscriptions ADD COLUMN cancel_at_period_end INTEGER NOT NULL DEFAULT 0",
    "ALTER TABLE local_subscriptions ADD COLUMN cancels_at TEXT",
    "ALTER TABLE local_subscriptions ADD COLUMN recurring_interval TEXT NOT NULL DEFAULT 'month'",
    "ALTER TABLE local_subscriptions ADD COLUMN recurring_interval_count INTEGER NOT NULL DEFAULT 1",
    "ALTER TABLE local_subscriptions ADD COLUMN quantity INTEGER NOT NULL DEFAULT 1",
    "ALTER TABLE local_subscriptions ADD COLUMN started_at TEXT",
  ])
    try {
      await client.execute(sql);
    } catch (error) {
      if (!String(error).includes("duplicate column")) throw error;
    }
  await client.batch(
    POLICY_DOCUMENTS.map((document) => ({
      sql: "UPDATE local_knowledge SET effective_at = '2026-01-01T00:00:00.000Z' WHERE source = ? AND title = ? AND text = ? AND version = 'local-v1' AND effective_at IS NULL",
      args: [document.source, document.title, document.text],
    })),
    "write",
  );
}

export async function seedLocalFixtures(
  client: Client,
  binding: ProviderBinding,
) {
  requireLocalDatabaseUrl();
  await initializeLocalFixtures(client);
  const args = [binding.tenantId, binding.providerAccountId];
  const profile = await client.execute({
    sql: "SELECT profile FROM local_demo_seed_profiles WHERE tenant_id = ? AND provider_account_id = ?",
    args,
  });
  // An interactive demo has intentionally distinct current-date commerce
  // facts. Never add historical characterization rows to that same binding.
  if (profile.rows[0]?.profile === "interactive-current") return;
  await client.batch(
    [
      ...localFixtureOrders.map((row) => ({
        sql: "INSERT OR IGNORE INTO local_orders VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        args: [
          ...args,
          row.orderId,
          row.customerEmail,
          row.product,
          row.amountMinor,
          row.currency,
          row.status,
          row.chargeCount,
          row.placedAt,
        ],
      })),
      ...localFixtureSubscriptions.map((row) => ({
        // Older fixture databases already contain these two stable IDs.  Their
        // newly-added billing columns received SQLite defaults during migration,
        // so write the fixture's canonical typed terms on conflict rather than
        // silently turning SUB-1004's annual plan into monthly eligibility.
        sql: "INSERT INTO local_subscriptions(tenant_id, provider_account_id, subscription_id, customer_email, plan, recurring_interval, recurring_interval_count, quantity, amount_minor, currency, status, renews_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(tenant_id, provider_account_id, subscription_id) DO UPDATE SET recurring_interval = excluded.recurring_interval, recurring_interval_count = excluded.recurring_interval_count, quantity = excluded.quantity WHERE local_subscriptions.customer_email = excluded.customer_email AND local_subscriptions.plan = excluded.plan AND local_subscriptions.amount_minor = excluded.amount_minor AND local_subscriptions.currency = excluded.currency",
        args: [
          ...args,
          row.subscriptionId,
          row.customerEmail,
          row.plan,
          row.recurringInterval,
          row.recurringIntervalCount,
          row.quantity,
          row.amountMinor,
          row.currency,
          row.status,
          row.renewsAt,
        ],
      })),
      ...POLICY_DOCUMENTS.map((document) => ({
        sql: "INSERT OR IGNORE INTO local_knowledge(tenant_id, provider_account_id, source, title, text, version, effective_at, expires_at) VALUES (?, ?, ?, ?, ?, 'local-v1', '2026-01-01T00:00:00.000Z', NULL)",
        args: [...args, document.source, document.title, document.text],
      })),
    ],
    "write",
  );
}

/** Seed the current interactive demo only into an empty binding. Existing
 * commerce histories remain authoritative and are never rewritten. */
export async function seedInteractiveLocalDemoFixtures(
  client: Client,
  binding: ProviderBinding,
  seedAt = localDemoSeedInstant(),
) {
  if (!isLocalMode())
    throw new Error("Interactive local commerce seed requires APP_MODE=local.");
  requireLocalDatabaseUrl();
  await initializeLocalFixtures(client);
  const args = [binding.tenantId, binding.providerAccountId];
  const transaction = await client.transaction("write");
  try {
    const existing = await transaction.execute({
      sql: "SELECT (SELECT COUNT(*) FROM local_orders WHERE tenant_id = ? AND provider_account_id = ?) + (SELECT COUNT(*) FROM local_subscriptions WHERE tenant_id = ? AND provider_account_id = ?) AS total",
      args: [...args, ...args],
    });
    const profile = await transaction.execute({
      sql: "SELECT profile FROM local_demo_seed_profiles WHERE tenant_id = ? AND provider_account_id = ?",
      args,
    });
    if (profile.rows[0]?.profile === "interactive-current") {
      await transaction.rollback();
      return;
    }
    if (Number(existing.rows[0]?.total ?? 0) > 0) {
      await transaction.rollback();
      return;
    }
    const commerce = interactiveLocalCommerce(seedAt);
    const seededAt = new Date(seedAt).toISOString();
    await transaction.batch([
      {
        sql: "INSERT INTO local_orders VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        args: [
          ...args,
          commerce.purchase.orderId,
          "alex@example.com",
          commerce.purchase.product,
          commerce.purchase.amountMinor,
          commerce.purchase.currency,
          "fulfilled",
          1,
          commerce.purchase.purchasedAt,
        ],
      },
      {
        sql: "INSERT INTO local_demo_seed_profiles(tenant_id, provider_account_id, profile, seeded_at) VALUES (?, ?, 'interactive-current', ?)",
        args: [...args, seededAt],
      },
      ...POLICY_DOCUMENTS.map((document) => ({
        sql: "INSERT OR IGNORE INTO local_knowledge(tenant_id, provider_account_id, source, title, text, version, effective_at, expires_at) VALUES (?, ?, ?, ?, ?, 'local-v1', '2026-01-01T00:00:00.000Z', NULL)",
        args: [...args, document.source, document.title, document.text],
      })),
    ]);
    await transaction.commit();
  } catch (error) {
    try {
      await transaction.rollback();
    } catch {}
    throw error;
  }
}

export async function resetLocalFixtures(
  client: Client,
  binding: ProviderBinding,
) {
  requireLocalDatabaseUrl();
  await initializeLocalFixtures(client);
  const args = [binding.tenantId, binding.providerAccountId];
  const tx = await client.transaction("write");
  try {
    const effects = await tx.execute({
      sql: "SELECT (SELECT COUNT(*) FROM local_refunds WHERE tenant_id = ? AND provider_account_id = ?) + (SELECT COUNT(*) FROM local_subscription_credits WHERE tenant_id = ? AND provider_account_id = ?) + (SELECT COUNT(*) FROM local_deliveries WHERE tenant_id = ? AND provider_account_id = ?) + (SELECT COUNT(*) FROM local_subscriptions WHERE tenant_id = ? AND provider_account_id = ? AND (status != 'active' OR cancel_at_period_end = 1)) AS total",
      args: [...args, ...args, ...args, ...args],
    });
    if (Number(effects.rows[0]?.total ?? 0) > 0)
      throw new Error(
        "Refusing fixture reset: durable refund/idempotency or delivery effects, including cancellation history, exist for this binding. Use a new local database rather than deleting history.",
      );
    // Cancellation attempts carry an explicit binding; a global
    // support_idempotency row does not. Do not let another tenant's unrelated
    // replay key block this fixture binding's reset.
    const table = "support_subscription_cancellation_attempts";
    if (
      (
        await tx.execute({
          sql: "SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?",
          args: [table],
        })
      ).rows[0]
    ) {
      const persisted = await tx.execute({
        sql: "SELECT COUNT(*) AS total FROM support_subscription_cancellation_attempts WHERE tenant_id = ? AND provider_account_id = ?",
        args,
      });
      if (Number(persisted.rows[0]?.total ?? 0) > 0)
        throw new Error(
          "Refusing fixture reset: durable idempotency or cancellation attempts exist. Use a new local database rather than deleting history.",
        );
    }
    await tx.batch(
      [
        "local_orders",
        "local_subscriptions",
        "local_knowledge",
        "local_refunds",
        "local_subscription_credits",
        "local_deliveries",
        "local_demo_seed_profiles",
      ].map((table) => ({
        sql: `DELETE FROM ${table} WHERE tenant_id = ? AND provider_account_id = ?`,
        args,
      })),
    );
    await tx.commit();
  } catch (error) {
    try {
      await tx.rollback();
    } catch {}
    throw error;
  }
}
