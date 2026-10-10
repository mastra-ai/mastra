import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { Render } from '@renderinc/sdk';
import { confirmTermination } from './cleanup.ts';
const files = [
  'production-live-attempt1.json',
  'production-live-attempt2.json',
  'production-live-attempt3.json',
  'production-live-snapshots.json',
  'production-live.json',
  'production-focused-live.json',
  'production-agent-released.json',
  'production-agent-main.json',
  'production-verification.json',
  'operation-audit-attempt1.json',
  'operation-audit.json',
  'example-operations-haiku-artifacts/result.json',
  'example-operations-haiku-retry1-artifacts/result.json',
  'upstream-artifacts/consumer/validation/example-operations-sonnet-artifacts/result.json',
  'example-artifacts/result.json',
  'upstream-artifacts/consumer/validation/example-artifacts/result.json',
];
const client = new Render(),
  api = client.experimental.sandboxes;
const ids = new Set(),
  snapshots = new Map();
for (const file of files) {
  const record = JSON.parse(await readFile('validation/' + file, 'utf8'));
  for (const run of [record, ...(record.additionalModelRuns ?? []), ...(record.documentation?.examples ?? [])]) {
    for (const id of run.resources ?? []) ids.add(id);
    if (run.sandboxId) ids.add(run.sandboxId);
    if (run.restoredId) ids.add(run.restoredId);
    if (run.snapshot) snapshots.set(run.snapshot.id, run.snapshot);
    for (const snapshot of run.snapshots ?? []) snapshots.set(snapshot.id, snapshot);
  }
}
const result = { checkedAt: new Date().toISOString(), sandboxes: [], snapshots: [] };
// Reuse one fresh paginated inventory to avoid a separate list request for every receipt.
const terminal = new Map();
let cursor;
do {
  const rows = await api.list({ status: ['terminated', 'errored'], limit: 100, cursor });
  for (const { sandbox } of rows)
    if (ids.has(sandbox.id) && (sandbox.status === 'terminated' || sandbox.terminatedAt)) {
      terminal.set(sandbox.id, {
        id: sandbox.id,
        status: sandbox.status,
        terminatedAt: sandbox.terminatedAt ?? null,
      });
    }
  cursor = rows.length === 100 && terminal.size < ids.size ? rows.at(-1)?.cursor : undefined;
} while (cursor);
for (const id of ids) result.sandboxes.push(terminal.get(id) ?? (await confirmTermination(client, id)));
for (const snapshot of snapshots.values()) {
  await assert.rejects(
    api.snapshots.get({ sandboxGroupId: snapshot.sandboxGroupId, snapshotId: snapshot.id }),
    error => error.statusCode === 404,
  );
  result.snapshots.push({ id: snapshot.id, deleted: true, confirmation: 'SDK get returned 404' });
}
result.result = 'PASS';
await writeFile('validation/production-cleanup.json', JSON.stringify(result, null, 2) + '\n');
console.log(`${ids.size} sandboxes confirmed terminated; ${snapshots.size} snapshots confirmed deleted.`);
