import { randomUUID } from 'node:crypto';

import { createDurableAgent, createEventedAgent } from '@mastra/core/agent/durable';
import { Mastra } from '@mastra/core/mastra';
import { MockMemory } from '@mastra/core/memory';
import type { MastraCompositeStore } from '@mastra/core/storage';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { T81PeerArgs, T81PeerResult } from './fixtures/t81-peer';
import { createXprocEnv, DEFAULT_HANG_GUARD_MS, PEER_TIMEOUT_MS } from './peer-helper';
import type { PeerHandle, XprocEnv } from './peer-helper';
import { bootWorkers } from './process-workers';
import { createStepAgent } from './step-agent';
import { dropXprocStore, openXprocStore } from './xproc-store';
import type { XprocStore } from './xproc-store';

const FIXTURE = new URL('./fixtures/t81-peer.ts', import.meta.url);
const CELL_TIMEOUT_MS = PEER_TIMEOUT_MS + DEFAULT_HANG_GUARD_MS + 10_000;
const PG_CONNECTION_STRING = process.env.DB_URL ?? '';

// Postgres has workflow step guards, so a durable agent's loop events may leave
// the owning process. With a push-only pubsub every worker process received
// them and ran the steps a second time.
for (const storeKind of ['libsql', 'pg'] as const) {
  for (const engine of ['durable', 'evented'] as const) {
    describe.skipIf(storeKind === 'pg' && !PG_CONNECTION_STRING)(
      `xproc-${engine} on ${storeKind}: boot recovery respects a live owner`,
      () => {
        let env: XprocEnv;
        let store: XprocStore;
        let storage: MastraCompositeStore | undefined;
        let mastra: Mastra | undefined;
        let peer: PeerHandle | undefined;

        beforeEach(async () => {
          vi.stubEnv('MASTRA_AGENT_THREAD_LEASE_TTL_MS', '1500');
          env = await createXprocEnv({ workers: true });
          store =
            storeKind === 'pg'
              ? {
                  kind: 'pg',
                  connectionString: PG_CONNECTION_STRING,
                  schemaName: `xproc_boot_${randomUUID().replace(/-/g, '').slice(0, 12)}`,
                }
              : { kind: 'libsql' };
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
                  await dropXprocStore(store);
                } finally {
                  try {
                    await env?.cleanup();
                  } finally {
                    vi.unstubAllEnvs();
                  }
                }
              }
            }
          }
        });

        // COR-1492 / COR-1436: a running snapshot can belong to another healthy
        // replica. Boot recovery must discover it without re-executing its tools.
        // Both processes run workers, so the replica must also leave the peer's
        // steps alone while the run continues.
        it(
          'skips the live peer run and lets its original tools finish',
          async () => {
            const id = randomUUID();
            const args: T81PeerArgs = {
              engine,
              store,
              agentId: `boot-recovery-${id}`,
              runId: `run-${id}`,
              threadId: `thread-${id}`,
              resourceId: `resource-${id}`,
              releaseTimeoutMs: CELL_TIMEOUT_MS,
            };
            // Create the tables before two processes open the store at once.
            storage = await openXprocStore(store, 'boot-recovery-replica', env.dbUrl);
            await storage.init();
            peer = await env.spawnPeer(FIXTURE, args, { role: `original-${engine}`, workers: true });
            expect(await peer.waitFor('blocked')).toEqual({ pid: peer.pid, runId: args.runId, step: 1 });

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
      },
    );
  }
}
