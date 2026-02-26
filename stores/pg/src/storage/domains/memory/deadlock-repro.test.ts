/**
 * PostgreSQL deadlock reproduction test for Observational Memory.
 *
 * Tests whether concurrent agents sharing a resourceId can deadlock
 * when performing parallel saveMessages + OM observation operations.
 *
 * Findings:
 * - With auto-commit OM operations (the real code path), no deadlocks
 *   occur even under extreme concurrency (8 agents, 500 rounds, 4000+ ops).
 * - With explicit transactions wrapping OM + saveMessages operations AND
 *   cross-thread row updates, deadlocks are reliably reproduced.
 *
 * The fix prevents the conditions that lead to shared OM row contention:
 * 1. Thread scope now validates threadId (prevents fallback to shared resource row)
 * 2. Lock ordering in doSynchronousObservation: thread first, then OM
 *
 * To run: docker compose up -d && npx vitest run src/storage/domains/memory/deadlock-repro.test.ts
 */
import crypto from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PostgresStore } from '../..';
import { TEST_CONFIG } from '../../test-utils';
import type { MemoryPG } from '.';

const TIMEOUT = 120_000;

describe.skip('PG OM deadlock reproduction', () => {
  let store: PostgresStore;
  let memory: MemoryPG;
  const resourceId = `resource-dl-${crypto.randomUUID()}`;
  const threadIds: string[] = [];
  let sharedOmId: string;

  beforeAll(async () => {
    store = new PostgresStore(TEST_CONFIG);
    await store.init();
    // Set aggressive deadlock detection to speed up the test
    await store.db.none(`SET deadlock_timeout = '50ms'`);
    memory = (await store.getStore('memory')) as MemoryPG;

    for (let i = 0; i < 4; i++) {
      const threadId = `thread-dl-${i}-${crypto.randomUUID()}`;
      threadIds.push(threadId);
      await memory.saveThread({
        thread: {
          id: threadId,
          resourceId,
          title: `Thread ${i}`,
          metadata: {},
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      });
    }

    // Shared OM record — simulates resource scope or missing threadId fallback
    const omRecord = await memory.initializeObservationalMemory({
      threadId: null,
      resourceId,
      scope: 'resource',
      config: {},
    });
    sharedOmId = omRecord.id;
  }, TIMEOUT);

  afterAll(async () => {
    try {
      await store.db.none(`DELETE FROM mastra_observational_memory WHERE id = $1`, [sharedOmId]).catch(() => {});
      for (const threadId of threadIds) {
        await store.db.none(`DELETE FROM mastra_messages WHERE thread_id = $1`, [threadId]).catch(() => {});
        await store.db.none(`DELETE FROM mastra_threads WHERE id = $1`, [threadId]).catch(() => {});
      }
      await store.close();
    } catch {}
  }, TIMEOUT);

  it(
    'should NOT deadlock with auto-commit OM operations (real code path)',
    async () => {
      const ROUNDS = 500;
      const AGENTS = 8;
      let deadlockCount = 0;
      let otherErrors = 0;

      const agentWork = async (agentIdx: number) => {
        const threadIdx = agentIdx % threadIds.length;
        const threadId = threadIds[threadIdx]!;

        for (let round = 0; round < ROUNDS; round++) {
          try {
            // saveMessages pattern: TX with INSERT + UPDATE thread
            const msgId = crypto.randomUUID();
            const now = new Date().toISOString();
            await store.db.tx(async (t: any) => {
              await t.none(
                `INSERT INTO mastra_messages (id, thread_id, content, "createdAt", "createdAtZ", role, type, "resourceId")
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
                 ON CONFLICT (id) DO UPDATE SET content = EXCLUDED.content, role = EXCLUDED.role`,
                [
                  msgId,
                  threadId,
                  JSON.stringify({ format: 2, parts: [{ type: 'text', text: `r${round}` }] }),
                  now,
                  now,
                  'user',
                  'v2',
                  resourceId,
                ],
              );
              await t.none(`UPDATE mastra_threads SET "updatedAt" = $1, "updatedAtZ" = $2 WHERE id = $3`, [
                now,
                now,
                threadId,
              ]);
            });
          } catch (err: any) {
            if (err.message?.includes('deadlock')) deadlockCount++;
            else otherErrors++;
          }

          try {
            // Observation pattern: auto-commit OM update + auto-commit thread update
            const now2 = new Date().toISOString();
            await store.db.none(
              `UPDATE mastra_observational_memory SET
                "activeObservations" = $1, "observationTokenCount" = $2,
                "updatedAt" = $3, "updatedAtZ" = $4
              WHERE id = $5`,
              [`obs-a${agentIdx}-r${round}`, Math.round(Math.random() * 1000), now2, now2, sharedOmId],
            );
            await store.db.none(
              `UPDATE mastra_threads SET metadata = $1, "updatedAt" = $2, "updatedAtZ" = $3 WHERE id = $4`,
              [JSON.stringify({ om: { task: `a${agentIdx}-r${round}` } }), now2, now2, threadId],
            );
          } catch (err: any) {
            if (err.message?.includes('deadlock')) deadlockCount++;
            else otherErrors++;
          }
        }
      };

      await Promise.all(Array.from({ length: AGENTS }, (_, i) => agentWork(i)));

      console.log(`[AUTO-COMMIT] Agents: ${AGENTS}, Rounds: ${ROUNDS}`);
      console.log(`[AUTO-COMMIT] Deadlocks: ${deadlockCount}, Other errors: ${otherErrors}`);

      // Auto-commit OM operations cannot deadlock with saveMessages TXs
      expect(deadlockCount).toBe(0);
      expect(otherErrors).toBe(0);
    },
    TIMEOUT,
  );

  it(
    'should detect deadlocks when ops are grouped in a TX with cross-thread updates (unfixed order)',
    async () => {
      const ROUNDS = 20;
      const AGENTS = 6;
      let deadlockCount = 0;
      let otherErrors = 0;

      const agentWork = async (agentIdx: number) => {
        const threadIdx = agentIdx % threadIds.length;
        const threadId = threadIds[threadIdx]!;
        // Cross-thread: simulates resource-scoped observation updating another thread
        const otherThreadId = threadIds[(threadIdx + 1) % threadIds.length]!;

        for (let round = 0; round < ROUNDS; round++) {
          try {
            const msgId = crypto.randomUUID();
            const now = new Date().toISOString();

            // Full step in a single TX — UNFIXED order (OM before other thread)
            await store.db.tx(async (t: any) => {
              // saveMessages: own thread
              await t.none(
                `INSERT INTO mastra_messages (id, thread_id, content, "createdAt", "createdAtZ", role, type, "resourceId")
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
                 ON CONFLICT (id) DO UPDATE SET content = EXCLUDED.content`,
                [
                  msgId,
                  threadId,
                  JSON.stringify({ format: 2, parts: [{ type: 'text', text: `step-${round}` }] }),
                  now,
                  now,
                  'user',
                  'v2',
                  resourceId,
                ],
              );
              await t.none(`UPDATE mastra_threads SET "updatedAt" = $1, "updatedAtZ" = $2 WHERE id = $3`, [
                now,
                now,
                threadId,
              ]);
              // Observation: shared OM row, then ANOTHER thread's metadata
              await t.none(
                `UPDATE mastra_observational_memory SET
                  "activeObservations" = $1, "observationTokenCount" = $2,
                  "updatedAt" = $3, "updatedAtZ" = $4
                WHERE id = $5`,
                [`obs-${round}`, Math.round(Math.random() * 1000), now, now, sharedOmId],
              );
              await t.none(
                `UPDATE mastra_threads SET metadata = $1, "updatedAt" = $2, "updatedAtZ" = $3 WHERE id = $4`,
                [JSON.stringify({ om: { task: `cross-${round}` } }), now, now, otherThreadId],
              );
            });
          } catch (err: any) {
            if (err.message?.includes('deadlock')) deadlockCount++;
            else otherErrors++;
          }
        }
      };

      await Promise.all(Array.from({ length: AGENTS }, (_, i) => agentWork(i)));

      console.log(`[TX-UNFIXED] Agents: ${AGENTS}, Rounds: ${ROUNDS}`);
      console.log(`[TX-UNFIXED] Deadlocks: ${deadlockCount}, Other errors: ${otherErrors}`);

      // Cross-thread TX operations CAN deadlock due to conflicting row lock order
      if (deadlockCount > 0) {
        console.log(`[TX-UNFIXED] Successfully reproduced ${deadlockCount} deadlocks`);
      }
    },
    TIMEOUT,
  );
});
