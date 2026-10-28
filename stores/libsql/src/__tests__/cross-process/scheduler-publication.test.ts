import type { Event } from '@mastra/core/events';
import { Scheduler } from '@mastra/core/workflows';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { LibSQLStore } from '../../storage';
import { createXprocEnv, PEER_TIMEOUT_MS } from './peer-helper';
import type { XprocEnv } from './peer-helper';

const FIXTURE = new URL('./fixtures/scheduler-publication-peer.ts', import.meta.url);
const FIRE_AT = Date.parse('2026-10-23T12:00:00Z');

// These are contract controls, not recovery tests: unknown publication is never replayed.
describe.skipIf(process.platform === 'win32').each(['workflow', 'agent'] as const)(
  '%s scheduler publisher death on LibSQL',
  targetType => {
    let env: XprocEnv;
    let storage: LibSQLStore;

    beforeEach(async () => {
      env = await createXprocEnv({ workers: false });
      storage = new LibSQLStore({ id: 'scheduler-replacement', url: env.dbUrl });
      await storage.init();
    });

    afterEach(async () => {
      vi.restoreAllMocks();
      await env.cleanup();
      await storage.close();
    });

    for (const boundary of ['claimed', 'published'] as const) {
      it.each([false, true])(
        `does not replay after publisher death at ${boundary}, and preserves later fires (terminal=%s)`,
        async terminal => {
          const schedules = (await storage.getStore('schedules'))!;
          const events: Event[] = [];
          const topic = targetType === 'workflow' ? 'workflows' : 'agent-schedules';
          await env.pubsub().subscribe(topic, event => {
            events.push(event);
          });
          await schedules.createSchedule({
            id: 'crash-schedule',
            target:
              targetType === 'workflow'
                ? { type: 'workflow', workflowId: 'crash-workflow' }
                : { type: 'agent', agentId: 'crash-agent', prompt: 'Check status' },
            cron: terminal ? '0 0 12 23 10 * 2026' : '* * * * *',
            timezone: 'UTC',
            status: 'active',
            nextFireAt: FIRE_AT,
            createdAt: FIRE_AT,
            updatedAt: FIRE_AT,
          });

          const publisher = await env.spawnPeer(FIXTURE, { boundary, fireAt: FIRE_AT }, { workers: false });
          await publisher.waitFor('boundary');
          if (boundary === 'published') await expect.poll(() => events.length).toBe(1);
          const claimed = await schedules.getSchedule('crash-schedule');
          expect(claimed).toMatchObject({
            status: terminal ? 'completed' : 'active',
            nextFireAt: terminal ? FIRE_AT : FIRE_AT + 60_000,
            lastRunId: `sched_crash-schedule_${FIRE_AT}`,
          });

          const clock = vi.spyOn(Date, 'now').mockReturnValue(FIRE_AT + 1_000);
          const replacement = new Scheduler({ schedulesStore: schedules, pubsub: env.pubsub() });
          await replacement.tick();
          await publisher.kill();
          expect(await schedules.getSchedule('crash-schedule')).toEqual(claimed);
          // Missing audit cannot distinguish the never-published and already-published cases.
          expect(await schedules.listTriggers('crash-schedule')).toEqual([]);
          await replacement.tick();
          expect(events).toHaveLength(boundary === 'published' ? 1 : 0);

          clock.mockReturnValue(FIRE_AT + 60_001);
          await replacement.tick();
          expect(events).toHaveLength((boundary === 'published' ? 1 : 0) + (terminal ? 0 : 1));
          if (!terminal) {
            const runId = `sched_crash-schedule_${FIRE_AT + 60_000}`;
            expect(events.at(-1)).toMatchObject({ runId });
            expect(await schedules.getSchedule('crash-schedule')).toMatchObject({
              status: 'active',
              nextFireAt: FIRE_AT + 120_000,
              lastRunId: `sched_crash-schedule_${FIRE_AT + 60_000}`,
            });
          }
        },
        PEER_TIMEOUT_MS + 15_000,
      );
    }
  },
);
