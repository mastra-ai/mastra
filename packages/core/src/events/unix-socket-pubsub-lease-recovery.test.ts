import { createHash } from 'node:crypto';
import { link, mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it, vi } from 'vitest';

const recoveryRace = vi.hoisted(() => ({
  enabled: false,
  isolatedRenames: 0,
  leaseWrites: 0,
}));

vi.mock('node:fs/promises', async importOriginal => {
  const actual = await importOriginal<typeof import('node:fs/promises')>();
  return {
    ...actual,
    rename: async (oldPath: Parameters<typeof actual.rename>[0], newPath: Parameters<typeof actual.rename>[1]) => {
      if (recoveryRace.enabled) {
        const from = String(oldPath);
        const to = String(newPath);
        if (from.endsWith('.lock') && to.endsWith('.isolated')) {
          recoveryRace.isolatedRenames += 1;
          if (recoveryRace.isolatedRenames === 2) {
            await new Promise(resolve => setTimeout(resolve, 60));
          }
        } else if (
          from.includes('/leases/') &&
          from.endsWith('.tmp') &&
          !to.includes('/mutations/') &&
          !to.includes('/processes/')
        ) {
          recoveryRace.leaseWrites += 1;
          if (recoveryRace.leaseWrites === 1) {
            await new Promise(resolve => setTimeout(resolve, 150));
          }
        }
      }
      return actual.rename(oldPath, newPath);
    },
  };
});

import { UnixSocketPubSub } from './unix-socket-pubsub';

describe('UnixSocketPubSub lease recovery', () => {
  const pubsubs: UnixSocketPubSub[] = [];
  let tempDir: string | undefined;

  afterEach(async () => {
    recoveryRace.enabled = false;
    await Promise.allSettled(pubsubs.splice(0).map(pubsub => pubsub.close()));
    if (tempDir) {
      await rm(tempDir, { recursive: true, force: true });
      tempDir = undefined;
    }
  });

  it('admits only one mutation while two contenders recover the same stale lock', async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'mastra-uds-lease-recovery-'));
    const key = 'concurrent-recovery-key';
    const fileName = createHash('sha256').update(key).digest('hex');
    const mutationDirectory = join(tempDir, 'leases', 'mutations');
    const lockPath = join(mutationDirectory, `${fileName}.lock`);
    const recoveryDirectory = `${lockPath}.recoveries`;
    const recoveryPath = join(recoveryDirectory, 'dead-token.marker');
    await mkdir(recoveryDirectory, { recursive: true });
    await writeFile(
      lockPath,
      JSON.stringify({ pid: 2_147_483_647, processNonce: 'dead-process', token: 'dead-token' }),
    );
    await link(lockPath, recoveryPath);

    const first = new UnixSocketPubSub(join(tempDir, 'first.sock'));
    const second = new UnixSocketPubSub(join(tempDir, 'second.sock'));
    pubsubs.push(first, second);
    recoveryRace.isolatedRenames = 0;
    recoveryRace.leaseWrites = 0;
    recoveryRace.enabled = true;

    const results = await Promise.all([
      first.acquireLease(key, 'first-owner', 10_000),
      second.acquireLease(key, 'second-owner', 10_000),
    ]);

    expect(recoveryRace.isolatedRenames).toBe(1);
    expect(results.filter(result => result.acquired)).toHaveLength(1);
    const winner = results.find(result => result.acquired)!.owner;
    await expect(first.getLeaseOwner(key)).resolves.toBe(winner);
    await expect(second.getLeaseOwner(key)).resolves.toBe(winner);
  });
});
