import { randomUUID } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  killProcess,
  makeStorageDir,
  PACKAGE_DIR,
  REDIS_URL,
  spawnFixture,
  waitForLine,
} from '../test-fixtures/harness';
import type { ManagedProcess } from '../test-fixtures/harness';

const ENTRY = resolve(PACKAGE_DIR, 'test-fixtures/approval-cross-server.entry.ts');

// An evented run parks on a tool approval on one server, which stays up, and another server approves it. The
// resumed tool-call step runs on the first server's workers, where the parked run's thread lease must not stop
// the approved tool. (#31066)
describe('tool approval resumed on another server', () => {
  let storage: Awaited<ReturnType<typeof makeStorageDir>>;
  let owner: ManagedProcess | undefined;
  let approver: ManagedProcess | undefined;

  beforeAll(async () => {
    storage = await makeStorageDir('mastra-approval-');
  });

  afterAll(async () => {
    await killProcess(approver);
    await killProcess(owner);
    await storage?.cleanup();
  });

  it('runs the approved tool once and finishes the run', async () => {
    const ledger = join(storage.dir, 'ran.log');
    const env = { REDIS_URL, KEY_PREFIX: `approval-${randomUUID()}`, STORAGE_URL: storage.storageUrl, LEDGER: ledger };
    owner = spawnFixture({ entry: ENTRY, label: 'owner', env: { ...env, ROLE: 'owner' } });
    await waitForLine(owner, 'parked:');
    const parked = owner.stdout.match(/parked:(.*)/)![1]!;

    approver = spawnFixture({ entry: ENTRY, label: 'approver', env: { ...env, ROLE: 'approver', PARKED: parked } });
    await waitForLine(approver, 'resumed:', 60_000);
    const { chunks, errors } = JSON.parse(approver.stdout.match(/resumed:(.*)/)![1]!);

    expect(errors).toEqual([]);
    expect(chunks).toContain('tool-result');
    expect(chunks.at(-1)).toBe('finish');
    expect(existsSync(ledger) ? readFileSync(ledger, 'utf8').trim().split('\n') : []).toEqual(['owner']);
  });
});
