/**
 * The billing repro from #26214 across real processes sharing one LibSQL file.
 *
 * A peer process starts a foreach that charges five customers. Customers 0 and 1 are
 * charged, the later charges hang, and the peer is SIGKILLed shortly after customer 1's
 * charge returns. This process then boots as the next replica and runs the recovery
 * sweep. Every customer must be charged exactly once across both processes.
 *
 * The kill lands 200ms after the charge: long enough for one snapshot write to a local
 * file, and well inside the gap a timed checkpoint would leave.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import { Mastra } from '@mastra/core/mastra';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { LibSQLStore } from '../../storage';
import type { BillingPeerArgs } from './fixtures/foreach-billing-peer';
import { createBillingWorkflow } from './fixtures/foreach-billing-workflow';
import { createXprocEnv, DEFAULT_HANG_GUARD_MS, PEER_TIMEOUT_MS } from './peer-helper';
import type { XprocEnv } from './peer-helper';

const FIXTURE = new URL('./fixtures/foreach-billing-peer.ts', import.meta.url);
const TEST_TIMEOUT_MS = PEER_TIMEOUT_MS + 15_000;
/** Lease TTL for the peer, so its claim lapses within the test after the kill. */
const PEER_LEASE_TTL_MS = 1_500;
const KILL_AFTER_CHARGE_MS = 200;
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

describe('restarting a foreach after its process was SIGKILLed mid-billing (#26214)', () => {
  let env: XprocEnv;
  let storage: LibSQLStore | undefined;
  let replicaB: Mastra | undefined;

  beforeEach(async () => {
    env = await createXprocEnv({ workers: false });
  });

  afterEach(async () => {
    await replicaB?.shutdown();
    await env.cleanup();
    await storage?.close();
  });

  it.each([1, 3])(
    'charges every customer exactly once (concurrency %i)',
    async concurrency => {
      const logPath = path.join(env.dir, 'charges.log');
      writeFileSync(logPath, '');

      const previous = process.env.MASTRA_AGENT_THREAD_LEASE_TTL_MS;
      process.env.MASTRA_AGENT_THREAD_LEASE_TTL_MS = String(PEER_LEASE_TTL_MS);
      const args: BillingPeerArgs = { concurrency, logPath };
      const peer = await env.spawnPeer(FIXTURE, args, { role: 'billing-a', workers: false }).finally(() => {
        if (previous === undefined) delete process.env.MASTRA_AGENT_THREAD_LEASE_TTL_MS;
        else process.env.MASTRA_AGENT_THREAD_LEASE_TTL_MS = previous;
      });

      await peer.waitFor('charged-0', { timeoutMs: DEFAULT_HANG_GUARD_MS });
      await peer.waitFor('charged-1', { timeoutMs: DEFAULT_HANG_GUARD_MS });
      await sleep(KILL_AFTER_CHARGE_MS);
      await peer.kill();

      storage = new LibSQLStore({ id: 'foreach-billing-main', url: env.dbUrl });
      const workflow = createBillingWorkflow(concurrency, async customer => {
        writeFileSync(logPath, `B ${customer}\n`, { flag: 'a' });
      });
      replicaB = new Mastra({ logger: false, storage, workflows: { workflow } });
      const { runs } = await replicaB.listActiveWorkflowRuns();
      expect(runs, env.describe()).toHaveLength(1);
      const { runId, workflowName } = runs[0]!;

      await replicaB.restartAllActiveWorkflowRuns();
      const workflows = (await storage.getStore('workflows'))!;
      await expect
        .poll(async () => (await workflows.loadWorkflowSnapshot({ workflowName, runId }))?.status, {
          timeout: DEFAULT_HANG_GUARD_MS,
        })
        .toBe('success');

      const charges = readFileSync(logPath, 'utf8').trim().split('\n');
      const customers = charges.map(line => Number(line.split(' ')[1])).sort();
      expect(customers, `charges: ${charges.join(', ')}`).toEqual([0, 1, 2, 3, 4]);
      const snapshot = await workflows.loadWorkflowSnapshot({ workflowName, runId });
      expect(snapshot?.result).toEqual([0, 1, 2, 3, 4].map(charged => ({ charged })));
    },
    TEST_TIMEOUT_MS,
  );
});
