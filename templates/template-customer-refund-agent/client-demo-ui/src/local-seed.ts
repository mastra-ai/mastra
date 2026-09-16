import { pathToFileURL } from "node:url";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { createClient } from "@libsql/client";
import {
  customerByEmail,
  initializeDatabase,
  openDatabase,
  passwordRecord,
} from "./db.js";
import {
  databaseProfile,
  isLocalMode,
  templateRoot,
} from "../../config/app-mode.mjs";

const execFileAsync = promisify(execFile);

async function authoritativeLocalCommerce() {
  // A standalone client seed first invokes the same backend seed command as
  // demo:local. The client then copies the persisted facts, never a second
  // clock calculation or a price selected from its email address.
  await execFileAsync(
    process.execPath,
    ["scripts/local-fixtures.mjs", "seed"],
    {
      cwd: templateRoot,
      env: process.env,
    },
  );
  const backend = createClient({ url: databaseProfile().backend });
  try {
    const args = ["local-demo", "local-demo", "alex@example.com"];
    const orders = await backend.execute({
      sql: "SELECT product, amount_minor, currency, placed_at FROM local_orders WHERE tenant_id = ? AND provider_account_id = ? AND lower(customer_email) = lower(?) ORDER BY placed_at DESC LIMIT 2",
      args,
    });
    const subscriptions = await backend.execute({
      sql: "SELECT subscription_id, plan, amount_minor, currency, recurring_interval, started_at, renews_at FROM local_subscriptions WHERE tenant_id = ? AND provider_account_id = ? AND lower(customer_email) = lower(?) ORDER BY renews_at DESC LIMIT 2",
      args,
    });
    if (orders.rows.length !== 1 || subscriptions.rows.length > 1)
      throw new Error(
        "Local demo customer seed requires one unambiguous backend purchase and at most one subscription.",
      );
    const purchase = orders.rows[0]!;
    const subscription = subscriptions.rows[0];
    return {
      purchase: {
        product: String(purchase.product),
        amountMinor: Number(purchase.amount_minor),
        currency: String(purchase.currency),
        purchasedAt: String(purchase.placed_at),
      },
      subscription: subscription
        ? {
            subscriptionId: String(subscription.subscription_id),
            plan: String(subscription.plan),
            amountMinor: Number(subscription.amount_minor),
            currency: String(subscription.currency),
            interval: String(subscription.recurring_interval),
            startedAt: subscription.started_at
              ? String(subscription.started_at)
              : undefined,
            renewsAt: String(subscription.renews_at),
          }
        : undefined,
    };
  } finally {
    backend.close();
  }
}

/** The local account deliberately matches the backend's synthetic owner. It
 * has local-only identifiers: no vendor customer/contact is required. */
export async function seedLocalCustomers() {
  if (!isLocalMode())
    throw new Error("Local customer seed requires APP_MODE=local.");
  const client = openDatabase();
  try {
    await initializeDatabase(client);
    const commerce = await authoritativeLocalCommerce();
    const existing = await customerByEmail(client, "alex@example.com");
    if (existing) {
      // A client DB may predate display metadata. Fill only absent projections
      // after proving any stored subscription identifies the same backend
      // record. Never overwrite a recorded product, price, or date.
      const expectedIdentity =
        existing.id === "customer-alex" &&
        existing.tenantId === "local-demo" &&
        existing.stripeCustomerId === "local-customer-alex" &&
        existing.intercomContactId === "local-contact-alex";
      if (!expectedIdentity)
        throw new Error(
          "Local client account identity does not match the local demo. Use a fresh local client database.",
        );
      if (
        existing.subscriptionId &&
        existing.subscriptionId !== commerce.subscription?.subscriptionId
      )
        throw new Error(
          "Local client snapshot does not match the backend subscription. Use a fresh local client database.",
        );
      if (
        (existing.purchase &&
          (existing.purchase.product !== commerce.purchase.product ||
            existing.purchase.amountMinor !== commerce.purchase.amountMinor ||
            existing.purchase.currency !== commerce.purchase.currency ||
            existing.purchase.purchasedAt !== commerce.purchase.purchasedAt)) ||
        (existing.subscription &&
          (!commerce.subscription ||
            existing.subscription.plan !== commerce.subscription.plan ||
            existing.subscription.amountMinor !==
              commerce.subscription.amountMinor ||
            existing.subscription.currency !== commerce.subscription.currency ||
            existing.subscription.interval !== commerce.subscription.interval ||
            existing.subscription.renewsAt !== commerce.subscription.renewsAt))
      )
        throw new Error(
          "Local client snapshot display facts do not match the backend. Use a fresh local client database.",
        );
      if (
        !existing.purchase ||
        (commerce.subscription && !existing.subscription)
      )
        await client.execute({
          sql: "UPDATE demo_customers SET purchase_product = COALESCE(purchase_product, ?), purchase_amount_minor = COALESCE(purchase_amount_minor, ?), purchase_currency = COALESCE(purchase_currency, ?), purchase_purchased_at = COALESCE(purchase_purchased_at, ?), subscription_plan = COALESCE(subscription_plan, ?), subscription_amount_minor = COALESCE(subscription_amount_minor, ?), subscription_currency = COALESCE(subscription_currency, ?), subscription_interval = COALESCE(subscription_interval, ?), subscription_started_at = COALESCE(subscription_started_at, ?), subscription_renews_at = COALESCE(subscription_renews_at, ?) WHERE id = ?",
          args: [
            commerce.purchase.product,
            commerce.purchase.amountMinor,
            commerce.purchase.currency,
            commerce.purchase.purchasedAt,
            commerce.subscription?.plan ?? null,
            commerce.subscription?.amountMinor ?? null,
            commerce.subscription?.currency ?? null,
            commerce.subscription?.interval ?? null,
            commerce.subscription?.startedAt ?? null,
            commerce.subscription?.renewsAt ?? null,
            existing.id,
          ],
        });
      return;
    }
    const password = await passwordRecord("local-customer-alex");
    await client.execute({
      sql: "INSERT INTO demo_customers (id,name,email,password_salt,password_hash,tenant_id,stripe_customer_id,intercom_contact_id,subscription_id,purchase_paid,purchase_product,purchase_amount_minor,purchase_currency,purchase_purchased_at,subscription_plan,subscription_amount_minor,subscription_currency,subscription_interval,subscription_started_at,subscription_renews_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
      args: [
        "customer-alex",
        "Alex Morgan",
        "alex@example.com",
        password.salt,
        password.hash,
        "local-demo",
        "local-customer-alex",
        "local-contact-alex",
        commerce.subscription?.subscriptionId ?? null,
        1,
        commerce.purchase.product,
        commerce.purchase.amountMinor,
        commerce.purchase.currency,
        commerce.purchase.purchasedAt,
        commerce.subscription?.plan ?? null,
        commerce.subscription?.amountMinor ?? null,
        commerce.subscription?.currency ?? null,
        commerce.subscription?.interval ?? null,
        commerce.subscription?.startedAt ?? null,
        commerce.subscription?.renewsAt ?? null,
      ],
    });
  } finally {
    await client.close();
  }
}

if (
  process.argv[1] &&
  pathToFileURL(process.argv[1]).href === import.meta.url
) {
  await seedLocalCustomers();
  console.log(
    "Seeded local customer account without replacing existing records.",
  );
}
