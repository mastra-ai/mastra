import { initializeDatabase, openDatabase, passwordRecord } from './db.js';

const client = openDatabase();
await initializeDatabase(client);
await client.batch(['DELETE FROM demo_sessions', 'DELETE FROM demo_customers']);
const password = await passwordRecord('test-password');
await client.execute({
  sql: 'INSERT INTO demo_customers (id,name,email,password_salt,password_hash,tenant_id,stripe_customer_id,intercom_contact_id,purchase_paid,purchase_product,purchase_amount_minor,purchase_currency,purchase_purchased_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET password_salt=excluded.password_salt,password_hash=excluded.password_hash,purchase_paid=excluded.purchase_paid,purchase_product=excluded.purchase_product,purchase_amount_minor=excluded.purchase_amount_minor,purchase_currency=excluded.purchase_currency,purchase_purchased_at=excluded.purchase_purchased_at',
  args: [
    'customer-e2e',
    'E2E Customer',
    'customer@example.test',
    password.salt,
    password.hash,
    'local-demo',
    'cus_e2e',
    'contact_e2e',
    1,
    'Northstar Toolkit',
    500,
    'USD',
    '2026-08-01T14:00:00.000Z',
  ],
});
const otherPassword = await passwordRecord('other-test-password');
await client.execute({
  sql: 'INSERT INTO demo_customers (id,name,email,password_salt,password_hash,tenant_id,stripe_customer_id,intercom_contact_id,purchase_paid) VALUES (?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET name=excluded.name,email=excluded.email,password_salt=excluded.password_salt,password_hash=excluded.password_hash',
  args: [
    'customer-other-e2e',
    'Alternate Customer',
    'other@example.test',
    otherPassword.salt,
    otherPassword.hash,
    'local-demo',
    'cus_other_e2e',
    'contact_other_e2e',
    1,
  ],
});
