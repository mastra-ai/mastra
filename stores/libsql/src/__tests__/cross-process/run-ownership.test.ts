/**
 * Boot-time workflow recovery across real processes sharing one LibSQL file
 * (#25579, #27508). A peer process plays replica A and executes a run; this
 * process plays replica B, booting while A is busy.
 *
 * The run-ownership lease lives in storage, so this checks the contract end to
 * end: A's claim, its heartbeat and its release are written through one LibSQL
 * connection and read by B's sweep through another, in a different process.
 * An in-memory store cannot show that, because both replicas would share one
 * object.
 */
import { Mastra } from '@mastra/core/mastra';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { LibSQLStore } from '../../storage';
import { createOwnedWorkflow } from './fixtures/run-ownership-workflow';
import { createXprocEnv, DEFAULT_HANG_GUARD_MS, PEER_TIMEOUT_MS } from './peer-helper';
import type { PeerHandle, XprocEnv } from './peer-helper';

const FIXTURE = new URL('./fixtures/run-ownership-peer.ts', import.meta.url);
const TEST_TIMEOUT_MS = PEER_TIMEOUT_MS + 15_000;
/** Lease TTL for the peer, so a lapse or a renewal happens within a test. Renewed every TTL/3. */
const PEER_LEASE_TTL_MS = 1_500;

describe('workflow run ownership across processes on a shared LibSQL file', () => {
  let env: XprocEnv;
  let storage: LibSQLStore;
  let replicaB: Mastra;
  let executedByB: string[];

  beforeEach(async () => {
    env = await createXprocEnv({ workers: false });
    storage = new LibSQLStore({ id: 'run-ownership-main', url: env.dbUrl });
    executedByB = [];
    const workflow = createOwnedWorkflow(async runId => {
      executedByB.push(runId);
    });
    replicaB = new Mastra({ logger: false, storage, workflows: { workflow } });
  });

  afterEach(async () => {
    await replicaB.shutdown();
    await env.cleanup();
    await storage.close();
  });

  async function startReplicaA(): Promise<{ peer: PeerHandle; runId: string }> {
    const previous = process.env.MASTRA_AGENT_THREAD_LEASE_TTL_MS;
    process.env.MASTRA_AGENT_THREAD_LEASE_TTL_MS = String(PEER_LEASE_TTL_MS);
    try {
      const peer = await env.spawnPeer(FIXTURE, {}, { role: 'replica-a', workers: false });
      const { runId } = await peer.waitFor<{ runId: string }>('executing', { timeoutMs: DEFAULT_HANG_GUARD_MS });
      return { peer, runId };
    } finally {
      if (previous === undefined) delete process.env.MASTRA_AGENT_THREAD_LEASE_TTL_MS;
      else process.env.MASTRA_AGENT_THREAD_LEASE_TTL_MS = previous;
    }
  }

  const ownership = async (runId: string) => (await storage.getStore('workflows'))!.getRunOwnership({ runId });
  const status = async (runId: string) =>
    (await (await storage.getStore('workflows'))!.loadWorkflowSnapshot({ workflowName: 'run-ownership-wf', runId }))
      ?.status;

  it(
    'does not re-execute a run that a live replica in another process is executing',
    async () => {
      const { peer, runId } = await startReplicaA();

      expect(
        (await replicaB.listActiveWorkflowRuns()).runs.map(r => r.runId),
        env.describe(),
      ).toEqual([runId]);
      await replicaB.restartAllActiveWorkflowRuns();
      expect(executedByB, 'replica B re-executed the run replica A is still executing').toEqual([]);

      peer.send('finish');
      expect(await peer.result()).toEqual({ status: 'success' });
      expect(executedByB).toEqual([]);
      expect(await status(runId)).toBe('success');
      expect((await ownership(runId))?.live, 'replica A did not release its lease when the run settled').toBe(false);
    },
    TEST_TIMEOUT_MS,
  );

  it(
    'keeps the run owned while replica A renews its lease past the TTL',
    async () => {
      const { peer, runId } = await startReplicaA();
      const first = await ownership(runId);
      expect(first?.live).toBe(true);

      // Wait until the first lease would have expired; only a renewal keeps it live.
      const firstExpiry = first!.leaseExpiresAt!.getTime();
      await expect
        .poll(async () => (await ownership(runId))?.leaseExpiresAt?.getTime() ?? 0, {
          timeout: DEFAULT_HANG_GUARD_MS,
          message: 'replica A never renewed its lease',
        })
        .toBeGreaterThan(firstExpiry + PEER_LEASE_TTL_MS);
      expect((await ownership(runId))?.live, 'replica A stopped renewing its lease').toBe(true);

      await replicaB.restartAllActiveWorkflowRuns();
      expect(executedByB, 'replica B took over a run whose owner is still renewing').toEqual([]);

      peer.send('finish');
      expect(await peer.result()).toEqual({ status: 'success' });
      expect(executedByB).toEqual([]);
    },
    TEST_TIMEOUT_MS,
  );

  it(
    'recovers the run once the crashed owner process lease lapses',
    async () => {
      const { peer, runId } = await startReplicaA();

      await replicaB.restartAllActiveWorkflowRuns();
      expect(executedByB).toEqual([]);

      await peer.kill();
      // The sweep re-checks after the lease expiry plus up to 5s jitter, then restarts the run.
      await expect.poll(() => executedByB, { timeout: DEFAULT_HANG_GUARD_MS }).toEqual([runId]);
      await expect.poll(() => status(runId), { timeout: DEFAULT_HANG_GUARD_MS }).toBe('success');
    },
    TEST_TIMEOUT_MS,
  );
});
