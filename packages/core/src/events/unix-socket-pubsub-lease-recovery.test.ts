import { createHash } from 'node:crypto';
import { link, mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it, vi } from 'vitest';

const recoveryRace = vi.hoisted(() => ({
  enabled: false,
  isolatedRenames: 0,
  leaseWrites: 0,
  rejectClaimantStats: false,
  pauseAfterLockInstall: false,
  lockInstalled: undefined as (() => void) | undefined,
  resumeLockInstall: undefined as Promise<void> | undefined,
  publishedOwnerGenerations: [] as string[],
  pauseOwnerRead: false,
  ownerReadPaused: undefined as (() => void) | undefined,
  resumeOwnerRead: undefined as Promise<void> | undefined,
  pauseRecoveryRename: false,
  recoveryRenamePaused: undefined as (() => void) | undefined,
  resumeRecoveryRename: undefined as Promise<void> | undefined,
}));

vi.mock('node:fs/promises', async importOriginal => {
  const actual = await importOriginal<typeof import('node:fs/promises')>();
  return {
    ...actual,
    link: async (existingPath: Parameters<typeof actual.link>[0], newPath: Parameters<typeof actual.link>[1]) => {
      await actual.link(existingPath, newPath);
      if (String(newPath).includes('.owners/')) {
        recoveryRace.publishedOwnerGenerations.push(String(newPath).split('/').at(-1)!);
      }
      if (
        recoveryRace.pauseAfterLockInstall &&
        String(existingPath).endsWith('.tmp') &&
        String(newPath).endsWith('.lock')
      ) {
        recoveryRace.lockInstalled?.();
        await recoveryRace.resumeLockInstall;
      }
    },
    readdir: async (path: Parameters<typeof actual.readdir>[0], options?: Parameters<typeof actual.readdir>[1]) => {
      if (recoveryRace.pauseOwnerRead && String(path).endsWith('.owners')) {
        recoveryRace.pauseOwnerRead = false;
        recoveryRace.ownerReadPaused?.();
        await recoveryRace.resumeOwnerRead;
      }
      return actual.readdir(path, options as never);
    },
    stat: async (path: Parameters<typeof actual.stat>[0], options?: Parameters<typeof actual.stat>[1]) => {
      if (recoveryRace.rejectClaimantStats && String(path).includes('.claimants/')) {
        throw new Error('claimant timestamps are unavailable');
      }
      return actual.stat(path, options as never);
    },
    rename: async (oldPath: Parameters<typeof actual.rename>[0], newPath: Parameters<typeof actual.rename>[1]) => {
      const from = String(oldPath);
      const to = String(newPath);
      if (recoveryRace.pauseRecoveryRename && from.endsWith('.lock') && to.endsWith('.isolated')) {
        recoveryRace.pauseRecoveryRename = false;
        recoveryRace.recoveryRenamePaused?.();
        await recoveryRace.resumeRecoveryRename;
      }
      if (recoveryRace.enabled) {
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
    recoveryRace.rejectClaimantStats = false;
    recoveryRace.pauseAfterLockInstall = false;
    recoveryRace.lockInstalled = undefined;
    recoveryRace.resumeLockInstall = undefined;
    recoveryRace.publishedOwnerGenerations = [];
    recoveryRace.pauseOwnerRead = false;
    recoveryRace.ownerReadPaused = undefined;
    recoveryRace.resumeOwnerRead = undefined;
    recoveryRace.pauseRecoveryRename = false;
    recoveryRace.recoveryRenamePaused = undefined;
    recoveryRace.resumeRecoveryRename = undefined;
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

  it('creates a recovery marker for a stale lock left by a crashed holder', async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'mastra-uds-lease-recovery-start-'));
    const key = 'stale-lock-without-recovery-marker';
    const fileName = createHash('sha256').update(key).digest('hex');
    const mutationDirectory = join(tempDir, 'leases', 'mutations');
    const lockPath = join(mutationDirectory, `${fileName}.lock`);
    await mkdir(mutationDirectory, { recursive: true });
    await writeFile(
      lockPath,
      JSON.stringify({ pid: 2_147_483_647, processNonce: 'dead-process', token: 'dead-token' }),
    );

    const first = new UnixSocketPubSub(join(tempDir, 'first.sock'));
    const second = new UnixSocketPubSub(join(tempDir, 'second.sock'));
    pubsubs.push(first, second);

    const acquisitions = Promise.all([
      first.acquireLease(key, 'first-owner', 10_000),
      second.acquireLease(key, 'second-owner', 10_000),
    ]);
    const results = await Promise.race([
      acquisitions,
      new Promise<'timed-out'>(resolve => setTimeout(() => resolve('timed-out'), 250)),
    ]);

    expect(results).not.toBe('timed-out');
    if (results === 'timed-out') return;
    expect(results.filter(result => result.acquired)).toHaveLength(1);
    const winner = results.find(result => result.acquired)!.owner;
    await expect(first.getLeaseOwner(key)).resolves.toBe(winner);
    await expect(second.getLeaseOwner(key)).resolves.toBe(winner);
  });

  it('elects the next recovery owner generation without filesystem timestamps', async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'mastra-uds-lease-recovery-generation-'));
    const key = 'recovery-generation-key';
    const fileName = createHash('sha256').update(key).digest('hex');
    const mutationDirectory = join(tempDir, 'leases', 'mutations');
    const lockPath = join(mutationDirectory, `${fileName}.lock`);
    const recoveryDirectory = `${lockPath}.recoveries`;
    const recoveryPath = join(recoveryDirectory, 'dead-token.marker');
    const deadOwner = { pid: 2_147_483_647, processNonce: 'dead-recovery-owner', token: 'dead-owner-token' };
    await mkdir(`${recoveryPath}.owners`, { recursive: true });
    await writeFile(
      lockPath,
      JSON.stringify({ pid: 2_147_483_647, processNonce: 'dead-process', token: 'dead-token' }),
    );
    await link(lockPath, recoveryPath);
    await writeFile(`${recoveryPath}.owner`, JSON.stringify(deadOwner));
    await writeFile(join(`${recoveryPath}.owners`, '0.json'), JSON.stringify(deadOwner));

    const first = new UnixSocketPubSub(join(tempDir, 'first.sock'));
    const second = new UnixSocketPubSub(join(tempDir, 'second.sock'));
    pubsubs.push(first, second);
    recoveryRace.rejectClaimantStats = true;

    const results = await Promise.all([
      first.acquireLease(key, 'first-owner', 10_000),
      second.acquireLease(key, 'second-owner', 10_000),
    ]);

    expect(results.filter(result => result.acquired)).toHaveLength(1);
    expect(recoveryRace.publishedOwnerGenerations).toEqual(['1.json']);
    const winner = results.find(result => result.acquired)!.owner;
    await expect(first.getLeaseOwner(key)).resolves.toBe(winner);
    await expect(second.getLeaseOwner(key)).resolves.toBe(winner);
  });

  it('rechecks the lock when recovery finishes before a late owner read', async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'mastra-uds-lease-late-recovery-owner-'));
    const key = 'late-recovery-owner-key';
    const fileName = createHash('sha256').update(key).digest('hex');
    const lockPath = join(tempDir, 'leases', 'mutations', `${fileName}.lock`);
    const recoveryPath = join(`${lockPath}.recoveries`, 'dead-token.marker');
    await mkdir(`${recoveryPath}.owners`, { recursive: true });
    await writeFile(
      lockPath,
      JSON.stringify({ pid: 2_147_483_647, processNonce: 'dead-process', token: 'dead-token' }),
    );
    await link(lockPath, recoveryPath);

    const first = new UnixSocketPubSub(join(tempDir, 'first.sock'));
    const second = new UnixSocketPubSub(join(tempDir, 'second.sock'));
    pubsubs.push(first, second);

    let signalRenamePaused!: () => void;
    const renamePaused = new Promise<void>(resolve => {
      signalRenamePaused = resolve;
    });
    let resumeRename!: () => void;
    recoveryRace.resumeRecoveryRename = new Promise<void>(resolve => {
      resumeRename = resolve;
    });
    recoveryRace.recoveryRenamePaused = signalRenamePaused;
    recoveryRace.pauseRecoveryRename = true;

    const firstAcquisition = first.acquireLease(key, 'first-owner', 10_000);
    await renamePaused;

    let signalOwnerReadPaused!: () => void;
    const ownerReadPaused = new Promise<void>(resolve => {
      signalOwnerReadPaused = resolve;
    });
    let resumeOwnerRead!: () => void;
    recoveryRace.resumeOwnerRead = new Promise<void>(resolve => {
      resumeOwnerRead = resolve;
    });
    recoveryRace.ownerReadPaused = signalOwnerReadPaused;
    recoveryRace.pauseOwnerRead = true;

    const secondAcquisition = second.acquireLease(key, 'second-owner', 10_000);
    await ownerReadPaused;
    resumeRename();
    const firstResult = await firstAcquisition;
    resumeOwnerRead();
    const [secondResult] = await Promise.allSettled([secondAcquisition]);

    expect(secondResult.status).toBe('fulfilled');
    const results = [firstResult, secondResult.status === 'fulfilled' ? secondResult.value : undefined].filter(
      result => result !== undefined,
    );
    expect(results.filter(result => result.acquired)).toHaveLength(1);
    const winner = results.find(result => result.acquired)!.owner;
    await expect(first.getLeaseOwner(key)).resolves.toBe(winner);
    await expect(second.getLeaseOwner(key)).resolves.toBe(winner);
  });

  it('releases an installed mutation lock when close interrupts post-install checks', async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'mastra-uds-lease-close-after-install-'));
    const first = new UnixSocketPubSub(join(tempDir, 'first.sock'));
    const second = new UnixSocketPubSub(join(tempDir, 'second.sock'));
    pubsubs.push(first, second);
    await first.acquireLease('setup-key', 'setup-owner', 10_000);
    await first.releaseLease('setup-key', 'setup-owner');

    let signalInstalled!: () => void;
    const installed = new Promise<void>(resolve => {
      signalInstalled = resolve;
    });
    let resumeInstall!: () => void;
    recoveryRace.resumeLockInstall = new Promise<void>(resolve => {
      resumeInstall = resolve;
    });
    recoveryRace.lockInstalled = signalInstalled;
    recoveryRace.pauseAfterLockInstall = true;

    const acquisitionResult = Promise.allSettled([first.acquireLease('close-after-install', 'first-owner', 10_000)]);
    await installed;
    const closeResult = first.close();
    resumeInstall();

    await closeResult;
    const [acquisition] = await acquisitionResult;
    expect(acquisition).toMatchObject({ status: 'rejected', reason: new Error('UnixSocketPubSub is closed') });
    await expect(second.acquireLease('close-after-install', 'second-owner', 10_000)).resolves.toEqual({
      acquired: true,
      owner: 'second-owner',
    });
  });
});
