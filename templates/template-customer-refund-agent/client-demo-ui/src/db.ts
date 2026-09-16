import { createClient, type Client } from "@libsql/client";
import {
  createHash,
  randomBytes,
  scrypt as scryptCallback,
  timingSafeEqual,
} from "node:crypto";
import { promisify } from "node:util";
import { mkdir } from "node:fs/promises";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import type { DemoCustomer, DemoSession } from "./types.js";
import { assertDatabaseIsolation } from "../../config/app-mode.mjs";

const scrypt = promisify(scryptCallback);
const SESSION_TTL_MS = 8 * 60 * 60 * 1000;

export function databaseUrl() {
  // Keep the legacy external workspace-relative URL stable. Local profile
  // paths are root-resolved so backend children and workspace scripts agree.
  return assertDatabaseIsolation().client;
}
export function openDatabase(url = databaseUrl()) {
  ensureDatabaseDirectorySync(url);
  return createClient({ url });
}
export async function initializeDatabase(client: Client) {
  await ensureDatabaseDirectory(databaseUrl());
  await client.batch([
    "CREATE TABLE IF NOT EXISTS demo_customers (id TEXT PRIMARY KEY, name TEXT NOT NULL, email TEXT NOT NULL UNIQUE COLLATE NOCASE, password_salt TEXT NOT NULL, password_hash TEXT NOT NULL, tenant_id TEXT NOT NULL, stripe_customer_id TEXT NOT NULL UNIQUE, intercom_contact_id TEXT NOT NULL UNIQUE, checkout_session_id TEXT, subscription_id TEXT, invoice_id TEXT, payment_intent_id TEXT, purchase_paid INTEGER NOT NULL DEFAULT 0, purchase_product TEXT, purchase_amount_minor INTEGER, purchase_currency TEXT, purchase_purchased_at TEXT, subscription_plan TEXT, subscription_amount_minor INTEGER, subscription_currency TEXT, subscription_interval TEXT, subscription_started_at TEXT, subscription_renews_at TEXT)",
    "CREATE TABLE IF NOT EXISTS demo_sessions (id_hash TEXT PRIMARY KEY, customer_id TEXT NOT NULL REFERENCES demo_customers(id), csrf_token TEXT NOT NULL, expires_at TEXT NOT NULL, created_at TEXT NOT NULL)",
  ]);
  for (const sql of [
    "ALTER TABLE demo_customers ADD COLUMN purchase_product TEXT",
    "ALTER TABLE demo_customers ADD COLUMN purchase_amount_minor INTEGER",
    "ALTER TABLE demo_customers ADD COLUMN purchase_currency TEXT",
    "ALTER TABLE demo_customers ADD COLUMN purchase_purchased_at TEXT",
    "ALTER TABLE demo_customers ADD COLUMN subscription_plan TEXT",
    "ALTER TABLE demo_customers ADD COLUMN subscription_amount_minor INTEGER",
    "ALTER TABLE demo_customers ADD COLUMN subscription_currency TEXT",
    "ALTER TABLE demo_customers ADD COLUMN subscription_interval TEXT",
    "ALTER TABLE demo_customers ADD COLUMN subscription_started_at TEXT",
    "ALTER TABLE demo_customers ADD COLUMN subscription_renews_at TEXT",
  ])
    try {
      await client.execute(sql);
    } catch (error) {
      if (!String(error).includes("duplicate column")) throw error;
    }
}
export async function ensureDatabaseDirectory(url: string) {
  if (!url.startsWith("file:") || url.includes(":memory:")) return;
  const filename = fileURLToPath(
    new URL(url, pathToFileURL(`${process.cwd()}/`)),
  );
  if (!filename) return;
  await mkdir(dirname(resolve(process.cwd(), filename)), { recursive: true });
}
function ensureDatabaseDirectorySync(url: string) {
  if (!url.startsWith("file:") || url.includes(":memory:")) return;
  const filename = fileURLToPath(
    new URL(url, pathToFileURL(`${process.cwd()}/`)),
  );
  if (filename)
    mkdirSync(dirname(resolve(process.cwd(), filename)), { recursive: true });
}
function digest(value: string) {
  return createHash("sha256").update(value).digest("hex");
}
export async function passwordRecord(password: string) {
  const salt = randomBytes(16).toString("base64url");
  const hash = Buffer.from(
    (await scrypt(password, salt, 64)) as Buffer,
  ).toString("base64url");
  return { salt, hash };
}
export async function passwordMatches(
  password: string,
  salt: string,
  expected: string,
) {
  const actual = Buffer.from(
    (await scrypt(password, salt, 64)) as Buffer,
  ).toString("base64url");
  const left = Buffer.from(actual);
  const right = Buffer.from(expected);
  return left.length === right.length && timingSafeEqual(left, right);
}
function customerFromRow(row: Record<string, unknown>): DemoCustomer {
  return {
    id: String(row.id),
    name: String(row.name),
    email: String(row.email),
    tenantId: String(row.tenant_id),
    stripeCustomerId: String(row.stripe_customer_id),
    intercomContactId: String(row.intercom_contact_id),
    checkoutSessionId: row.checkout_session_id
      ? String(row.checkout_session_id)
      : undefined,
    subscriptionId: row.subscription_id
      ? String(row.subscription_id)
      : undefined,
    invoiceId: row.invoice_id ? String(row.invoice_id) : undefined,
    paymentIntentId: row.payment_intent_id
      ? String(row.payment_intent_id)
      : undefined,
    purchasePaid: Number(row.purchase_paid) === 1,
    purchase:
      row.purchase_product &&
      row.purchase_amount_minor !== null &&
      row.purchase_currency &&
      row.purchase_purchased_at
        ? {
            product: String(row.purchase_product),
            amountMinor: Number(row.purchase_amount_minor),
            currency: String(row.purchase_currency),
            purchasedAt: String(row.purchase_purchased_at),
          }
        : undefined,
    subscription:
      row.subscription_plan &&
      row.subscription_amount_minor !== null &&
      row.subscription_currency &&
      row.subscription_interval &&
      row.subscription_renews_at
        ? {
            plan: String(row.subscription_plan),
            amountMinor: Number(row.subscription_amount_minor),
            currency: String(row.subscription_currency),
            interval: String(row.subscription_interval),
            startedAt: row.subscription_started_at
              ? String(row.subscription_started_at)
              : undefined,
            renewsAt: String(row.subscription_renews_at),
          }
        : undefined,
  };
}
export async function customerByEmail(client: Client, email: string) {
  const result = await client.execute({
    sql: "SELECT * FROM demo_customers WHERE email = ?",
    args: [email],
  });
  return result.rows[0] ? customerFromRow(result.rows[0]) : undefined;
}
export async function verifyCustomer(
  client: Client,
  email: string,
  password: string,
) {
  const result = await client.execute({
    sql: "SELECT * FROM demo_customers WHERE email = ?",
    args: [email],
  });
  const row = result.rows[0];
  if (
    !row ||
    !(await passwordMatches(
      password,
      String(row.password_salt),
      String(row.password_hash),
    ))
  )
    return undefined;
  return customerFromRow(row);
}
export async function createSession(client: Client, customer: DemoCustomer) {
  const id = randomBytes(32).toString("base64url");
  const csrfToken = randomBytes(24).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS).toISOString();
  await client.execute({
    sql: "INSERT INTO demo_sessions (id_hash, customer_id, csrf_token, expires_at, created_at) VALUES (?, ?, ?, ?, ?)",
    args: [
      digest(id),
      customer.id,
      csrfToken,
      expiresAt,
      new Date().toISOString(),
    ],
  });
  return { id, csrfToken, expiresAt };
}
export async function sessionById(
  client: Client,
  id?: string,
): Promise<DemoSession | undefined> {
  if (!id) return undefined;
  const result = await client.execute({
    sql: "SELECT s.csrf_token, s.expires_at, c.* FROM demo_sessions s JOIN demo_customers c ON c.id = s.customer_id WHERE s.id_hash = ?",
    args: [digest(id)],
  });
  const row = result.rows[0];
  if (!row) return undefined;
  if (Date.parse(String(row.expires_at)) <= Date.now()) {
    await client.execute({
      sql: "DELETE FROM demo_sessions WHERE id_hash = ?",
      args: [digest(id)],
    });
    return undefined;
  }
  return {
    id,
    customer: customerFromRow(row),
    csrfToken: String(row.csrf_token),
    expiresAt: String(row.expires_at),
  };
}
export async function deleteSession(client: Client, id?: string) {
  if (id)
    await client.execute({
      sql: "DELETE FROM demo_sessions WHERE id_hash = ?",
      args: [digest(id)],
    });
}
