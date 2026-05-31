import type { MastraStorage, SchedulesStorage } from '@mastra/core/storage';
import { beforeAll, beforeEach, describe, it, expect } from 'vitest';
import { createSampleSchedule, createSampleTrigger } from './data';

export interface SchedulesTestOptions {
  storage: MastraStorage;
}

export function createSchedulesTests({ storage }: SchedulesTestOptions) {
  let scheduleStore: SchedulesStorage | undefined;

  beforeAll(async () => {
    const store = await storage.getStore('schedules');
    if (!store) return; // Domain optional — adapter doesn't implement schedules.
    scheduleStore = store;
  });

  describe('Schedules', () => {
    beforeEach(async () => {
      if (!scheduleStore) return;
      await scheduleStore.dangerouslyClearAll();
    });

    describe('createSchedule + getSchedule', () => {
      it('creates and retrieves a schedule', async () => {
        if (!scheduleStore) return;
        const sched = createSampleSchedule();
        const created = await scheduleStore.createSchedule(sched);
        expect(created.id).toBe(sched.id);

        const fetched = await scheduleStore.getSchedule(sched.id);
        expect(fetched).not.toBeNull();
        expect(fetched!.id).toBe(sched.id);
        expect(fetched!.cron).toBe(sched.cron);
        expect(fetched!.status).toBe('active');
        expect(fetched!.target).toEqual(sched.target);
        expect(fetched!.nextFireAt).toBe(sched.nextFireAt);
      });

      it('returns null for non-existent schedule', async () => {
        if (!scheduleStore) return;
        expect(await scheduleStore.getSchedule('missing')).toBeNull();
      });

      it('throws when creating a duplicate id', async () => {
        if (!scheduleStore) return;
        const sched = createSampleSchedule({ id: 'dup' });
        await scheduleStore.createSchedule(sched);
        await expect(scheduleStore.createSchedule(sched)).rejects.toThrow();
      });

      it('round-trips optional fields', async () => {
        if (!scheduleStore) return;
        const sched = createSampleSchedule({
          timezone: 'America/New_York',
          metadata: { owner: 'team-x', priority: 5 },
          lastFireAt: Date.now() - 1_000,
          lastRunId: 'run_abc',
        });
        await scheduleStore.createSchedule(sched);

        const fetched = await scheduleStore.getSchedule(sched.id);
        expect(fetched!.timezone).toBe('America/New_York');
        expect(fetched!.metadata).toEqual({ owner: 'team-x', priority: 5 });
        expect(fetched!.lastFireAt).toBe(sched.lastFireAt);
        expect(fetched!.lastRunId).toBe('run_abc');
      });
    });

    describe('listSchedules', () => {
      it('lists all schedules', async () => {
        if (!scheduleStore) return;
        await scheduleStore.createSchedule(createSampleSchedule({ id: 'a' }));
        await scheduleStore.createSchedule(createSampleSchedule({ id: 'b' }));
        const all = await scheduleStore.listSchedules();
        expect(all.map(s => s.id).sort()).toEqual(['a', 'b']);
      });

      it('filters by status', async () => {
        if (!scheduleStore) return;
        await scheduleStore.createSchedule(createSampleSchedule({ id: 'a', status: 'active' }));
        await scheduleStore.createSchedule(createSampleSchedule({ id: 'b', status: 'paused' }));
        const active = await scheduleStore.listSchedules({ status: 'active' });
        expect(active.map(s => s.id)).toEqual(['a']);
      });

      it('filters by workflowId', async () => {
        if (!scheduleStore) return;
        await scheduleStore.createSchedule(
          createSampleSchedule({ id: 'a', target: { type: 'workflow', workflowId: 'wf1' } }),
        );
        await scheduleStore.createSchedule(
          createSampleSchedule({ id: 'b', target: { type: 'workflow', workflowId: 'wf2' } }),
        );
        const wf1 = await scheduleStore.listSchedules({ workflowId: 'wf1' });
        expect(wf1.map(s => s.id)).toEqual(['a']);
      });
    });

    describe('listDueSchedules', () => {
      it('returns active schedules with nextFireAt <= now, ordered ascending', async () => {
        if (!scheduleStore) return;
        await scheduleStore.createSchedule(createSampleSchedule({ id: 's1', nextFireAt: 5_000 }));
        await scheduleStore.createSchedule(createSampleSchedule({ id: 's2', nextFireAt: 9_000 }));
        await scheduleStore.createSchedule(createSampleSchedule({ id: 's3', nextFireAt: 11_000 }));

        const due = await scheduleStore.listDueSchedules(10_000);
        expect(due.map(s => s.id)).toEqual(['s1', 's2']);
      });

      it('skips paused schedules', async () => {
        if (!scheduleStore) return;
        await scheduleStore.createSchedule(createSampleSchedule({ id: 's1', status: 'paused', nextFireAt: 5_000 }));
        const due = await scheduleStore.listDueSchedules(10_000);
        expect(due).toHaveLength(0);
      });

      it('respects limit', async () => {
        if (!scheduleStore) return;
        await scheduleStore.createSchedule(createSampleSchedule({ id: 's1', nextFireAt: 1_000 }));
        await scheduleStore.createSchedule(createSampleSchedule({ id: 's2', nextFireAt: 2_000 }));
        await scheduleStore.createSchedule(createSampleSchedule({ id: 's3', nextFireAt: 3_000 }));
        const due = await scheduleStore.listDueSchedules(10_000, 2);
        expect(due.map(s => s.id)).toEqual(['s1', 's2']);
      });
    });

    describe('updateSchedule', () => {
      it('patches provided fields and bumps updatedAt', async () => {
        if (!scheduleStore) return;
        const sched = createSampleSchedule({ id: 's1', updatedAt: 1 });
        await scheduleStore.createSchedule(sched);

        const updated = await scheduleStore.updateSchedule('s1', { status: 'paused', cron: '0 * * * *' });
        expect(updated.status).toBe('paused');
        expect(updated.cron).toBe('0 * * * *');
        expect(updated.updatedAt).toBeGreaterThan(1);
      });

      it('throws when schedule does not exist', async () => {
        if (!scheduleStore) return;
        await expect(scheduleStore.updateSchedule('missing', { status: 'paused' })).rejects.toThrow();
      });
    });

    describe('updateScheduleNextFire (CAS)', () => {
      it('advances nextFireAt when expected matches', async () => {
        if (!scheduleStore) return;
        await scheduleStore.createSchedule(createSampleSchedule({ id: 's1', nextFireAt: 100 }));

        const ok = await scheduleStore.updateScheduleNextFire('s1', 100, 200, 150, 'run_1');
        expect(ok).toBe(true);

        const fetched = await scheduleStore.getSchedule('s1');
        expect(fetched!.nextFireAt).toBe(200);
        expect(fetched!.lastFireAt).toBe(150);
        expect(fetched!.lastRunId).toBe('run_1');
      });

      it('returns false and does not update on mismatch', async () => {
        if (!scheduleStore) return;
        await scheduleStore.createSchedule(createSampleSchedule({ id: 's1', nextFireAt: 100 }));

        const ok = await scheduleStore.updateScheduleNextFire('s1', 99, 200, 150, 'run_1');
        expect(ok).toBe(false);

        const fetched = await scheduleStore.getSchedule('s1');
        expect(fetched!.nextFireAt).toBe(100);
      });

      it('returns false when schedule does not exist', async () => {
        if (!scheduleStore) return;
        const ok = await scheduleStore.updateScheduleNextFire('missing', 100, 200, 150, 'run_1');
        expect(ok).toBe(false);
      });

      it('returns false when schedule is paused', async () => {
        if (!scheduleStore) return;
        await scheduleStore.createSchedule(createSampleSchedule({ id: 's1', nextFireAt: 100 }));
        await scheduleStore.updateSchedule('s1', { status: 'paused' });

        const ok = await scheduleStore.updateScheduleNextFire('s1', 100, 200, 150, 'run_1');
        expect(ok).toBe(false);

        const fetched = await scheduleStore.getSchedule('s1');
        expect(fetched!.nextFireAt).toBe(100);
        expect(fetched!.status).toBe('paused');
      });
    });

    describe('deleteSchedule', () => {
      it('removes schedule and its trigger history', async () => {
        if (!scheduleStore) return;
        await scheduleStore.createSchedule(createSampleSchedule({ id: 's1' }));
        await scheduleStore.recordTrigger(createSampleTrigger({ scheduleId: 's1', runId: 'r1' }));
        await scheduleStore.recordTrigger(createSampleTrigger({ scheduleId: 's2', runId: 'r2' }));

        await scheduleStore.deleteSchedule('s1');
        expect(await scheduleStore.getSchedule('s1')).toBeNull();
        expect(await scheduleStore.listTriggers('s1')).toHaveLength(0);
        expect(await scheduleStore.listTriggers('s2')).toHaveLength(1);
      });
    });

    describe('recordTrigger / listTriggers', () => {
      it('lists triggers for a schedule, newest first', async () => {
        if (!scheduleStore) return;
        await scheduleStore.recordTrigger(createSampleTrigger({ scheduleId: 's1', runId: 'r1', actualFireAt: 100 }));
        await scheduleStore.recordTrigger(createSampleTrigger({ scheduleId: 's1', runId: 'r2', actualFireAt: 200 }));
        await scheduleStore.recordTrigger(createSampleTrigger({ scheduleId: 's2', runId: 'r3', actualFireAt: 300 }));

        const triggers = await scheduleStore.listTriggers('s1');
        expect(triggers.map(t => t.runId)).toEqual(['r2', 'r1']);
      });

      it('filters by actualFireAt range', async () => {
        if (!scheduleStore) return;
        await scheduleStore.recordTrigger(createSampleTrigger({ scheduleId: 's1', runId: 'r1', actualFireAt: 100 }));
        await scheduleStore.recordTrigger(createSampleTrigger({ scheduleId: 's1', runId: 'r2', actualFireAt: 200 }));
        await scheduleStore.recordTrigger(createSampleTrigger({ scheduleId: 's1', runId: 'r3', actualFireAt: 300 }));

        const triggers = await scheduleStore.listTriggers('s1', { fromActualFireAt: 150, toActualFireAt: 300 });
        expect(triggers.map(t => t.runId)).toEqual(['r2']);
      });

      it('respects limit', async () => {
        if (!scheduleStore) return;
        await scheduleStore.recordTrigger(createSampleTrigger({ scheduleId: 's1', runId: 'r1', actualFireAt: 100 }));
        await scheduleStore.recordTrigger(createSampleTrigger({ scheduleId: 's1', runId: 'r2', actualFireAt: 200 }));
        await scheduleStore.recordTrigger(createSampleTrigger({ scheduleId: 's1', runId: 'r3', actualFireAt: 300 }));

        const triggers = await scheduleStore.listTriggers('s1', { limit: 2 });
        expect(triggers.map(t => t.runId)).toEqual(['r3', 'r2']);
      });

      it('records failed outcome with error', async () => {
        if (!scheduleStore) return;
        await scheduleStore.recordTrigger(
          createSampleTrigger({ scheduleId: 's1', runId: 'r1', outcome: 'failed', error: 'pubsub down' }),
        );
        const [trigger] = await scheduleStore.listTriggers('s1');
        expect(trigger?.outcome).toBe('failed');
        expect(trigger?.error).toBe('pubsub down');
      });

      it('records drain rows with parentTriggerId and null runId', async () => {
        if (!scheduleStore) return;
        await scheduleStore.recordTrigger(
          createSampleTrigger({
            scheduleId: 's1',
            runId: 'r1',
            id: 'fire_1',
            outcome: 'deferred',
          }),
        );
        await scheduleStore.recordTrigger(
          createSampleTrigger({
            scheduleId: 's1',
            id: 'drain_1',
            runId: null,
            outcome: 'appended-from-queue',
            triggerKind: 'queue-drain',
            parentTriggerId: 'fire_1',
            actualFireAt: Date.now() + 1_000,
            metadata: { appendedMessageId: 'msg_1' },
          }),
        );
        const [drain, fire] = await scheduleStore.listTriggers('s1');
        expect(drain?.triggerKind).toBe('queue-drain');
        expect(drain?.parentTriggerId).toBe('fire_1');
        expect(drain?.runId).toBeNull();
        expect(drain?.metadata).toEqual({ appendedMessageId: 'msg_1' });
        expect(fire?.triggerKind).toBe('schedule-fire');
      });
    });

    describe('listSchedules ownership filters', () => {
      it('filters by ownerType and ownerId', async () => {
        if (!scheduleStore) return;
        await scheduleStore.createSchedule(createSampleSchedule({ id: 'wf' }));
        await scheduleStore.createSchedule(createSampleSchedule({ id: 'hb1', ownerType: 'agent', ownerId: 'agentA' }));
        await scheduleStore.createSchedule(createSampleSchedule({ id: 'hb2', ownerType: 'agent', ownerId: 'agentB' }));

        const allAgent = await scheduleStore.listSchedules({ ownerType: 'agent' });
        expect(allAgent.map(s => s.id).sort()).toEqual(['hb1', 'hb2']);

        const agentA = await scheduleStore.listSchedules({ ownerType: 'agent', ownerId: 'agentA' });
        expect(agentA.map(s => s.id)).toEqual(['hb1']);
      });
    });
  });
}
