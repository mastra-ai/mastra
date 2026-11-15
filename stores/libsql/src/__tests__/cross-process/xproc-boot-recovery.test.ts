import { randomUUID } from 'node:crypto';

import { createDurableAgent, createEventedAgent } from '@mastra/core/agent/durable';
import { Mastra } from '@mastra/core/mastra';
import { MockMemory } from '@mastra/core/memory';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { LibSQLStore } from '../../storage';
import type { T81PeerArgs, T81PeerResult } from './fixtures/t81-peer';
import { createXprocEnv, DEFAULT_HANG_GUARD_MS, PEER_TIMEOUT_MS } from './peer-helper';
import type { PeerHandle, XprocEnv } from './peer-helper';
import { bootWorkers } from './process-workers';
import { createStepAgent } from './step-agent';

const FIXTURE = new URL('./fixtures/t81-peer.ts', import.meta.url);
const CELL_TIMEOUT_MS = PEER_TIMEOUT_MS + DEFAULT_HANG_GUARD_MS + 10_000;

for (const engine of ['durable', 'evented'] as const) {
  describe(`xproc-${engine}: boot recovery respects a live owner`, () => {
    let env: XprocEnv;
    let storage: LibSQLStore | undefined;
    let mastra: Mastra | undefined;
    let peer: PeerHandle | undefined;

    beforeEach(async () => {
      vi.stubEnv('MASTRA_AGENT_THREAD_LEASE_TTL_MS', '1500');
      env = await createXprocEnv({ workers: true });
    });

    afterEach(async () => {
      try {
        if (peer) {
          peer.send('release');
          await peer.kill();
        }
      } finally {
        peer = undefined;
        try {
          await mastra?.shutdown();
        } finally {
          mastra = undefined;
          try {
            await storage?.close();
          } finally {
            storage = undefined;
            try {
              await env?.cleanup();
            } finally {
              vi.unstubAllEnvs();
            }
          }
        }
      }
    });

    // COR-1492 / COR-1436: a running snapshot can belong to another healthy
    // replica. Boot recovery must discover it without re-executing its tools.
    it(
      'skips the live peer run and lets its original tools finish',
      async () => {
        const id = randomUUID();
        const args: T81PeerArgs = {
          engine,
          agentId: `boot-recovery-${id}`,
          runId: `run-${id}`,
          threadId: `thread-${id}`,
          resourceId: `resource-${id}`,
          releaseTimeoutMs: CELL_TIMEOUT_MS,
        };
        peer = await env.spawnPeer(FIXTURE, args, { role: `original-${engine}`, workers: true });
        expect(await peer.waitFor('blocked')).toEqual({ pid: peer.pid, runId: args.runId, step: 1 });

        storage = new LibSQLStore({ id: 'boot-recovery-replica', url: env.dbUrl });
        const memory = new MockMemory();
        memory.setStorage(storage);
        const { agent, modelCalls } = createStepAgent({ id: args.agentId, steps: 3, memory });
        const runner = engine === 'durable' ? createDurableAgent({ agent }) : createEventedAgent({ agent });
        mastra = new Mastra({
          agents: { t81: runner },
          storage,
          pubsub: env.pubsub(),
          logger: false,
          recovery: { durableAgents: 'auto' },
        });
        await bootWorkers(mastra, env.workers);

        const active = await runner.listActiveRuns();
        expect(active.total).toBe(1);
        expect(active.runs).toMatchObject([{ runId: args.runId }]);
        const recovered = await mastra.recoverAllDurableAgents();
        expect.soft(recovered, env.describe()).toEqual({
          agents: 1,
          recovered: 0,
          succeeded: 0,
          failed: 0,
          skipped: 1,
        });
        expect.soft(modelCalls(), 'boot recovery must not call the model').toBe(0);

        peer.send('release');
        const result = await peer.result<T81PeerResult>();
        expect(result.pid).toBe(peer.pid);
        expect(result.errors, env.describe()).toEqual([]);
        expect
          .soft(result.toolEvents.filter(event => event.event === 'commit').map(event => event.n))
          .toEqual([1, 2, 3]);
        expect(await peer.exit()).toEqual({ code: 0, signal: null });
        expect(modelCalls(), 'the peer finishes without work from the booting replica').toBe(0);
      },
      CELL_TIMEOUT_MS,
    );
  });
}
