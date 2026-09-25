import { createHmac } from 'node:crypto';
import { readFile } from 'node:fs/promises';

const file = process.argv[2];
const secret = process.env.ALERT_WEBHOOK_SECRET;
if ((process.env.RUNTIME_MODE ?? 'local') !== 'local') {
  throw new Error('Fixture signing is local-only. In staging, WorkOS signs webhook deliveries.');
}
if (!file || !secret || secret.length < 16) {
  throw new Error('Usage: RUNTIME_MODE=local ALERT_WEBHOOK_SECRET=<local-secret> npm run fixture:sign');
}
const body = await readFile(file);
const timestamp = String(Date.now());
const signature = createHmac('sha256', secret).update(`${timestamp}.`, 'utf8').update(body).digest('hex');
process.stdout.write(`t=${timestamp},v1=${signature}\n`);
