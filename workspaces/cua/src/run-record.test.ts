import assert from 'node:assert/strict';
import { mkdtemp, readFile, readdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { test } from 'vitest';
import { reserveRunRecord } from '../examples/run-record.js';

async function recordLocation() {
  return pathToFileURL(join(await mkdtemp(join(tmpdir(), 'mastra-cua-record-')), 'run.json'));
}

test('a completed run is archived before reserving the next run', async () => {
  const file = await recordLocation();
  const previous = JSON.stringify({ name: 'old', cleanupConfirmed: true });
  await writeFile(file, previous);
  await reserveRunRecord(file, { name: 'next' });
  assert.deepEqual(JSON.parse(await readFile(file, 'utf8')), { name: 'next' });
  const archived = (await readdir(new URL('.', file))).find(name => name.startsWith('run-completed-'));
  assert.ok(archived);
  assert.equal(await readFile(new URL(archived, file), 'utf8'), previous);
  await assert.rejects(reserveRunRecord(file, { name: 'third' }), /requires cleanup/);
});

test('unfinished and malformed records remain unchanged', async () => {
  for (const previous of ['{"name":"active"}', '{"cleanupConfirmed":"true"}', 'invalid']) {
    const file = await recordLocation();
    await writeFile(file, previous);
    await assert.rejects(reserveRunRecord(file, { name: 'next' }));
    assert.equal(await readFile(file, 'utf8'), previous);
    assert.deepEqual(await readdir(new URL('.', file)), ['run.json']);
  }
});

test('simultaneous starts reserve only one record', async () => {
  const file = await recordLocation();
  await writeFile(file, JSON.stringify({ name: 'old', cleanupConfirmed: true }));
  const results = await Promise.allSettled([
    reserveRunRecord(file, { name: 'first' }),
    reserveRunRecord(file, { name: 'second' }),
  ]);
  assert.equal(results.filter(result => result.status === 'fulfilled').length, 1);
  const saved = JSON.parse(await readFile(file, 'utf8'));
  assert.ok(['first', 'second'].includes(saved.name));
  assert.equal(saved.cleanupConfirmed, undefined);
});
