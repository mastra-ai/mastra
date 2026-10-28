import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { initializeDatabase, openDatabase, passwordRecord } from './db.js';
import type { DemoCustomer } from './types.js';

export type Seed = {
  id: string;
  name: string;
  email: string;
  password: string;
  scenario: 'refund' | 'credit' | 'knowledge';
  tenantId: string;
  stripeCustomerId: string;
  intercomContactId: string;
  checkoutSessionId?: string;
  subscriptionId?: string;
  invoiceId?: string;
  paymentIntentId?: string;
  purchasePaid?: boolean;
  purchase?: DemoCustomer['purchase'];
  subscription?: DemoCustomer['subscription'];
};
export async function seedCustomers(records: Seed[]) {
  const client = openDatabase();
  try {
    await initializeDatabase(client);
    for (const item of records) {
      const password = await passwordRecord(item.password);
      await client.execute({
        sql: 'INSERT INTO demo_customers (id,name,email,password_salt,password_hash,tenant_id,stripe_customer_id,intercom_contact_id,checkout_session_id,subscription_id,invoice_id,payment_intent_id,purchase_paid,purchase_product,purchase_amount_minor,purchase_currency,purchase_purchased_at,subscription_plan,subscription_amount_minor,subscription_currency,subscription_interval,subscription_started_at,subscription_renews_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET name=excluded.name,email=excluded.email,password_salt=excluded.password_salt,password_hash=excluded.password_hash,tenant_id=excluded.tenant_id,stripe_customer_id=excluded.stripe_customer_id,intercom_contact_id=excluded.intercom_contact_id,checkout_session_id=excluded.checkout_session_id,subscription_id=excluded.subscription_id,invoice_id=excluded.invoice_id,payment_intent_id=excluded.payment_intent_id,purchase_paid=excluded.purchase_paid,purchase_product=COALESCE(excluded.purchase_product,purchase_product),purchase_amount_minor=COALESCE(excluded.purchase_amount_minor,purchase_amount_minor),purchase_currency=COALESCE(excluded.purchase_currency,purchase_currency),purchase_purchased_at=COALESCE(excluded.purchase_purchased_at,purchase_purchased_at),subscription_plan=COALESCE(excluded.subscription_plan,subscription_plan),subscription_amount_minor=COALESCE(excluded.subscription_amount_minor,subscription_amount_minor),subscription_currency=COALESCE(excluded.subscription_currency,subscription_currency),subscription_interval=COALESCE(excluded.subscription_interval,subscription_interval),subscription_started_at=COALESCE(excluded.subscription_started_at,subscription_started_at),subscription_renews_at=COALESCE(excluded.subscription_renews_at,subscription_renews_at)',
        args: [
          item.id,
          item.name,
          item.email,
          password.salt,
          password.hash,
          item.tenantId,
          item.stripeCustomerId,
          item.intercomContactId,
          item.checkoutSessionId ?? null,
          item.subscriptionId ?? null,
          item.invoiceId ?? null,
          item.paymentIntentId ?? null,
          item.purchasePaid ? 1 : 0,
          item.purchase?.product ?? null,
          item.purchase?.amountMinor ?? null,
          item.purchase?.currency ?? null,
          item.purchase?.purchasedAt ?? null,
          item.subscription?.plan ?? null,
          item.subscription?.amountMinor ?? null,
          item.subscription?.currency ?? null,
          item.subscription?.interval ?? null,
          item.subscription?.startedAt ?? null,
          item.subscription?.renewsAt ?? null,
        ],
      });
    }
  } finally {
    client.close();
  }
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  const input = process.argv.indexOf('--input');
  if (input === -1 || !process.argv[input + 1]) throw new Error('Use --input <private-customers.json>.');
  const records = JSON.parse(await readFile(process.argv[input + 1]!, 'utf8')) as Seed[];
  await seedCustomers(records);
  console.log(JSON.stringify({ seeded: records.length }));
}
