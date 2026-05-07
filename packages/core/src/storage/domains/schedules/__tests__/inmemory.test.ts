import { describe, it, expect, beforeEach } from 'vitest';
import { InMemoryDB } from '../../inmemory-db';
import type { Schedule, ScheduleTrigger } from '../base';
import { InMemorySchedulesStorage } from '../inmemory';

function makeSchedule(overrides: Partial<Schedule> = {}): Schedule {
  return {
    id: overrides.id ?? `sched_${crypto.randomUUID()}`,
    target: overrides.target ?? {
      type: 'workflow',
      workflowId: 'test-workflow',
      inputData: { foo: 'bar' },
    },
    cron: overrides.cron ?? '*/10 * * * *',
    timezone: overrides.timezone,
    status: overrides.status ?? 'active',
    nextFireAt: overrides.nextFireAt ?? Date.now() + 10_000,
    lastFireAt: overrides.lastFireAt,
    lastRunId: overrides.lastRunId,
    createdAt: overrides.createdAt ?? Date.now(),
    updatedAt: overrides.updatedAt ?? Date.now(),
    metadata: overrides.metadata,
  };
}

function makeTrigger(overrides: Partial<ScheduleTrigger> = {}): ScheduleTrigger {
  return {
    id: overrides.id ?? `tr_${crypto.randomUUID()}`,
    scheduleId: overrides.scheduleId ?? 'sched_1',
    runId: overrides.runId ?? 'run_1',
    scheduledFireAt: overrides.scheduledFireAt ?? Date.now(),
    actualFireAt: overrides.actualFireAt ?? Date.now(),
    outcome: overrides.outcome ?? 'published',
    triggerKind: overrides.triggerKind ?? 'schedule-fire',
    error: overrides.error,
  };
}

describe('InMemorySchedulesStorage', () => {
  let db: InMemoryDB;
  let storage: InMemorySchedulesStorage;

  beforeEach(() => {
    db = new InMemoryDB();
    storage = new InMemorySchedulesStorage({ db });
  });

  describe('createSchedule', () => {
    it('creates a schedule and returns it', async () => {
      const sched = makeSchedule();
      const created = await storage.createSchedule(sched);

      expect(created.id).toBe(sched.id);
      expect(created.target).toEqual(sched.target);

      const fetched = await storage.getSchedule(sched.id);
      expect(fetched).not.toBeNull();
      expect(fetched!.id).toBe(sched.id);
    });

    it('throws if a schedule with the same id already exists', async () => {
      const sched = makeSchedule();
      await storage.createSchedule(sched);
      await expect(storage.createSchedule(sched)).rejects.toThrow(/already exists/);
    });

    it('stores a copy — original mutations do not affect stored row', async () => {
      const sched = makeSchedule();
      await storage.createSchedule(sched);

      sched.status = 'paused';
      (sched.target as any).workflowId = 'mutated';

      const fetched = await storage.getSchedule(sched.id);
      expect(fetched!.status).toBe('active');
      expect((fetched!.target as any).workflowId).toBe('test-workflow');
    });
  });

  describe('getSchedule', () => {
    it('returns null when schedule does not exist', async () => {
      const fetched = await storage.getSchedule('missing');
      expect(fetched).toBeNull();
    });
  });

  describe('listSchedules', () => {
    it('returns all schedules when no filter is provided', async () => {
      await storage.createSchedule(makeSchedule({ id: 's1' }));
      await storage.createSchedule(makeSchedule({ id: 's2' }));
      const rows = await storage.listSchedules();
      expect(rows).toHaveLength(2);
    });

    it('filters by status', async () => {
      await storage.createSchedule(makeSchedule({ id: 's1', status: 'active' }));
      await storage.createSchedule(makeSchedule({ id: 's2', status: 'paused' }));

      const active = await storage.listSchedules({ status: 'active' });
      expect(active).toHaveLength(1);
      expect(active[0]!.id).toBe('s1');

      const paused = await storage.listSchedules({ status: 'paused' });
      expect(paused).toHaveLength(1);
      expect(paused[0]!.id).toBe('s2');
    });

    it('filters by workflowId', async () => {
      await storage.createSchedule(makeSchedule({ id: 's1', target: { type: 'workflow', workflowId: 'wf-a' } }));
      await storage.createSchedule(makeSchedule({ id: 's2', target: { type: 'workflow', workflowId: 'wf-b' } }));
      const a = await storage.listSchedules({ workflowId: 'wf-a' });
      expect(a).toHaveLength(1);
      expect(a[0]!.id).toBe('s1');
    });
  });

  describe('listDueSchedules', () => {
    it('returns active schedules with nextFireAt <= now, ordered ascending', async () => {
      const now = 10_000;
      await storage.createSchedule(makeSchedule({ id: 's1', nextFireAt: 5_000 }));
      await storage.createSchedule(makeSchedule({ id: 's2', nextFireAt: 9_000 }));
      await storage.createSchedule(makeSchedule({ id: 's3', nextFireAt: 11_000 }));

      const due = await storage.listDueSchedules(now);
      expect(due.map(s => s.id)).toEqual(['s1', 's2']);
    });

    it('skips paused schedules even if they are due', async () => {
      await storage.createSchedule(makeSchedule({ id: 's1', nextFireAt: 5_000, status: 'paused' }));
      const due = await storage.listDueSchedules(10_000);
      expect(due).toHaveLength(0);
    });

    it('respects the limit', async () => {
      await storage.createSchedule(makeSchedule({ id: 's1', nextFireAt: 1_000 }));
      await storage.createSchedule(makeSchedule({ id: 's2', nextFireAt: 2_000 }));
      await storage.createSchedule(makeSchedule({ id: 's3', nextFireAt: 3_000 }));

      const due = await storage.listDueSchedules(10_000, 2);
      expect(due.map(s => s.id)).toEqual(['s1', 's2']);
    });
  });

  describe('updateSchedule', () => {
    it('patches fields and bumps updatedAt', async () => {
      const sched = makeSchedule({ id: 's1', updatedAt: 1 });
      await storage.createSchedule(sched);

      const updated = await storage.updateSchedule('s1', { status: 'paused', cron: '0 0 * * *' });
      expect(updated.status).toBe('paused');
      expect(updated.cron).toBe('0 0 * * *');
      expect(updated.updatedAt).toBeGreaterThan(1);
    });

    it('throws when schedule does not exist', async () => {
      await expect(storage.updateSchedule('missing', { status: 'paused' })).rejects.toThrow(/not found/);
    });
  });

  describe('updateScheduleNextFire (CAS)', () => {
    it('advances nextFireAt and records last fire metadata when expected matches', async () => {
      const sched = makeSchedule({ id: 's1', nextFireAt: 100 });
      await storage.createSchedule(sched);

      const ok = await storage.updateScheduleNextFire('s1', 100, 200, 150, 'run_1');
      expect(ok).toBe(true);

      const fetched = await storage.getSchedule('s1');
      expect(fetched!.nextFireAt).toBe(200);
      expect(fetched!.lastFireAt).toBe(150);
      expect(fetched!.lastRunId).toBe('run_1');
    });

    it('returns false and does not update when expected does not match', async () => {
      const sched = makeSchedule({ id: 's1', nextFireAt: 100 });
      await storage.createSchedule(sched);

      const ok = await storage.updateScheduleNextFire('s1', 99, 200, 150, 'run_1');
      expect(ok).toBe(false);

      const fetched = await storage.getSchedule('s1');
      expect(fetched!.nextFireAt).toBe(100);
      expect(fetched!.lastRunId).toBeUndefined();
    });

    it('returns false when schedule does not exist', async () => {
      const ok = await storage.updateScheduleNextFire('missing', 100, 200, 150, 'run_1');
      expect(ok).toBe(false);
    });
  });

  describe('deleteSchedule', () => {
    it('removes the schedule and its trigger history', async () => {
      const sched = makeSchedule({ id: 's1' });
      await storage.createSchedule(sched);
      await storage.recordTrigger(makeTrigger({ scheduleId: 's1', runId: 'run_a' }));
      await storage.recordTrigger(makeTrigger({ scheduleId: 's2', runId: 'run_b' }));

      await storage.deleteSchedule('s1');
      expect(await storage.getSchedule('s1')).toBeNull();
      expect(await storage.listTriggers('s1')).toHaveLength(0);
      expect(await storage.listTriggers('s2')).toHaveLength(1);
    });
  });

  describe('recordTrigger / listTriggers', () => {
    it('lists triggers for a schedule, newest first', async () => {
      await storage.recordTrigger(makeTrigger({ scheduleId: 's1', runId: 'r1', actualFireAt: 100 }));
      await storage.recordTrigger(makeTrigger({ scheduleId: 's1', runId: 'r2', actualFireAt: 200 }));
      await storage.recordTrigger(makeTrigger({ scheduleId: 's2', runId: 'r3', actualFireAt: 300 }));

      const triggers = await storage.listTriggers('s1');
      expect(triggers.map(f => f.runId)).toEqual(['r2', 'r1']);
    });

    it('filters by actualFireAt range', async () => {
      await storage.recordTrigger(makeTrigger({ scheduleId: 's1', runId: 'r1', actualFireAt: 100 }));
      await storage.recordTrigger(makeTrigger({ scheduleId: 's1', runId: 'r2', actualFireAt: 200 }));
      await storage.recordTrigger(makeTrigger({ scheduleId: 's1', runId: 'r3', actualFireAt: 300 }));

      const triggers = await storage.listTriggers('s1', { fromActualFireAt: 150, toActualFireAt: 300 });
      expect(triggers.map(f => f.runId)).toEqual(['r2']);
    });

    it('respects limit', async () => {
      await storage.recordTrigger(makeTrigger({ scheduleId: 's1', runId: 'r1', actualFireAt: 100 }));
      await storage.recordTrigger(makeTrigger({ scheduleId: 's1', runId: 'r2', actualFireAt: 200 }));
      await storage.recordTrigger(makeTrigger({ scheduleId: 's1', runId: 'r3', actualFireAt: 300 }));

      const triggers = await storage.listTriggers('s1', { limit: 2 });
      expect(triggers.map(f => f.runId)).toEqual(['r3', 'r2']);
    });
  });

  describe('dangerouslyClearAll', () => {
    it('clears all schedules and triggers', async () => {
      await storage.createSchedule(makeSchedule({ id: 's1' }));
      await storage.recordTrigger(makeTrigger({ scheduleId: 's1', runId: 'r1' }));

      await storage.dangerouslyClearAll();

      expect(await storage.listSchedules()).toHaveLength(0);
      expect(await storage.listTriggers('s1')).toHaveLength(0);
    });
  });
});
