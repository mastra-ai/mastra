import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { customerByEmail, openDatabase, verifyCustomer } from "../../src/db.js";
import { seedCustomers, type Seed } from "../../src/seed.js";

const originalEnvironment = { ...process.env };
const directories: string[] = [];

async function configuredDatabase() {
  const directory = await mkdtemp(join(tmpdir(), "client-demo-seed-"));
  directories.push(directory);
  const client = join(directory, "client.db");
  Object.assign(process.env, {
    APP_MODE: "local",
    DATABASE_URL: `file:${join(directory, "backend.db")}`,
    LOCAL_DEMO_DATABASE_URL: `file:${join(directory, "backend.db")}`,
    LOCAL_DEMO_CLIENT_DATABASE_URL: `file:${client}`,
    ORIGINAL_DATABASE_URL: `file:${join(directory, "external.db")}`,
    ORIGINAL_DEMO_DATABASE_URL: `file:${join(directory, "external-client.db")}`,
  });
}

const account: Seed = {
  id: "customer-seed-001",
  name: "Seed Customer",
  email: "seed@example.com",
  password: "seed-password",
  scenario: "refund",
  tenantId: "tenant-seed",
  stripeCustomerId: "cus_seed_001",
  intercomContactId: "contact_seed_001",
  checkoutSessionId: "cs_seed_001",
  subscriptionId: "sub_seed_001",
  invoiceId: "in_seed_001",
  paymentIntentId: "pi_seed_001",
  purchasePaid: true,
  purchase: {
    product: "API Credits",
    amountMinor: 500,
    currency: "usd",
    purchasedAt: "2026-01-31T23:30:00.000Z",
  },
  subscription: {
    plan: "Workspace",
    amountMinor: 4900,
    currency: "usd",
    interval: "month",
    startedAt: "2026-01-31T23:30:00.000Z",
    renewsAt: "2026-02-28T23:30:00.000Z",
  },
};

afterEach(async () => {
  process.env = { ...originalEnvironment };
  await Promise.all(
    directories
      .splice(0)
      .map((directory) => rm(directory, { recursive: true, force: true })),
  );
});

describe("customer import seed", () => {
  it("preserves display metadata for a legacy replay and accepts a supplied replacement", async () => {
    await configuredDatabase();
    await seedCustomers([account]);
    const legacyReplay: Seed = { ...account };
    delete legacyReplay.purchase;
    delete legacyReplay.subscription;
    await seedCustomers([legacyReplay]);

    const client = openDatabase();
    try {
      expect(
        await verifyCustomer(client, account.email, account.password),
      ).toMatchObject({
        id: account.id,
      });
      expect(await customerByEmail(client, account.email)).toMatchObject({
        id: account.id,
        purchase: account.purchase,
        subscription: account.subscription,
      });
    } finally {
      client.close();
    }

    const replacement: Seed = {
      ...account,
      purchase: { ...account.purchase!, amountMinor: 700 },
      subscription: { ...account.subscription!, amountMinor: 5900 },
    };
    await seedCustomers([replacement]);
    const clientWithReplacement = openDatabase();
    try {
      expect(
        await customerByEmail(clientWithReplacement, account.email),
      ).toMatchObject({
        purchase: replacement.purchase,
        subscription: replacement.subscription,
      });
    } finally {
      clientWithReplacement.close();
    }
  });

  it("rejects a new ID that collides with an existing email or provider ID", async () => {
    await configuredDatabase();
    await seedCustomers([account]);

    const conflicts: Seed[] = [
      {
        ...account,
        id: "customer-seed-email",
        stripeCustomerId: "cus_seed_email",
      },
      {
        ...account,
        id: "customer-seed-stripe",
        email: "stripe@example.com",
        intercomContactId: "contact_seed_stripe",
      },
      {
        ...account,
        id: "customer-seed-intercom",
        email: "intercom@example.com",
        stripeCustomerId: "cus_seed_intercom",
      },
    ];

    for (const conflict of conflicts) {
      await expect(seedCustomers([conflict])).rejects.toThrow();
    }

    const client = openDatabase();
    try {
      expect(
        await verifyCustomer(client, account.email, account.password),
      ).toMatchObject({
        id: account.id,
      });
      expect(await customerByEmail(client, account.email)).toMatchObject({
        id: account.id,
        purchase: account.purchase,
        subscription: account.subscription,
      });
      expect(
        (await client.execute("SELECT id FROM demo_customers")).rows,
      ).toEqual([{ id: account.id }]);
    } finally {
      client.close();
    }
  });
});
