import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { EventEmitterPubSub } from '../../events/event-emitter';
import type { Event } from '../../events/types';
import { InMemoryDB } from '../../storage/domains/inmemory-db';
import { InMemorySchedulesStorage } from '../../storage/domains/schedules/inmemory';
import { Scheduler } from './scheduler';

function makeStore(): { store: InMemorySchedulesStorage; db: InMemoryDB } {
  const db = new InMemoryDB();
  const store = new InMemorySchedulesStorage({ db });
  return { store, db };
}

function captureWorkflowsTopic(pubsub: EventEmitterPubSub): { events: Event[] } {
  const events: Event[] = [];
  void pubsub.subscribe('workflows', async event => {
    events.push(event);
  });
  return { events };
}

describe('Scheduler', () => {
  beforeEach(() => {
    vi.useRealTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('publishes workflow.start when a schedule is due', async () => {
    const { store } = makeStore();
    const pubsub = new EventEmitterPubSub();
    const { events } = captureWorkflowsTopic(pubsub);
    const scheduler = new Scheduler({ schedulesStore: store, pubsub });

    const past = Date.now() - 5_000;
    const created = await store.createSchedule({
      id: 'sched-due',
      target: { type: 'workflow', workflowId: 'wf-test', inputData: { hello: 'world' } },
      cron: '0 0 1 1 *', // not used by tick (we set nextFireAt directly)
      status: 'active',
      nextFireAt: past,
      createdAt: past,
      updatedAt: past,
    });

    await scheduler.tick();

    expect(events).toHaveLength(1);
    expect(events[0]!.type).toBe('workflow.start');
    expect(events[0]!.data).toMatchObject({
      workflowId: 'wf-test',
      prevResult: { status: 'success', output: { hello: 'world' } },
      requestContext: {},
      initialState: {},
    });

    const updated = await store.getSchedule(created.id);
    expect(updated).not.toBeNull();
    expect(updated!.nextFireAt).toBeGreaterThan(past);
    expect(updated!.lastRunId).toBe(events[0]!.runId);

    const triggers = await store.listTriggers(created.id);
    expect(triggers).toHaveLength(1);
    expect(triggers[0]!.outcome).toBe('published');
  });

  it('skips paused schedules', async () => {
    const { store } = makeStore();
    const pubsub = new EventEmitterPubSub();
    const { events } = captureWorkflowsTopic(pubsub);
    const scheduler = new Scheduler({ schedulesStore: store, pubsub });

    const past = Date.now() - 5_000;
    await store.createSchedule({
      id: 'sched-paused',
      target: { type: 'workflow', workflowId: 'wf-test' },
      cron: '0 0 1 1 *',
      status: 'paused',
      nextFireAt: past,
      createdAt: past,
      updatedAt: past,
    });

    await scheduler.tick();

    expect(events).toHaveLength(0);
  });

  it('does not publish when the schedule is not yet due', async () => {
    const { store } = makeStore();
    const pubsub = new EventEmitterPubSub();
    const { events } = captureWorkflowsTopic(pubsub);
    const scheduler = new Scheduler({ schedulesStore: store, pubsub });

    const future = Date.now() + 60_000;
    await store.createSchedule({
      id: 'sched-future',
      target: { type: 'workflow', workflowId: 'wf-test' },
      cron: '0 0 1 1 *',
      status: 'active',
      nextFireAt: future,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    await scheduler.tick();

    expect(events).toHaveLength(0);
  });

  it('CAS dedup: only one of two concurrent ticks publishes for the same fire', async () => {
    const { store } = makeStore();
    const pubsub = new EventEmitterPubSub();
    const { events } = captureWorkflowsTopic(pubsub);
    const a = new Scheduler({ schedulesStore: store, pubsub });
    const b = new Scheduler({ schedulesStore: store, pubsub });

    const past = Date.now() - 5_000;
    await store.createSchedule({
      id: 'sched-dedup',
      target: { type: 'workflow', workflowId: 'wf-test' },
      cron: '0 0 1 1 *',
      status: 'active',
      nextFireAt: past,
      createdAt: past,
      updatedAt: past,
    });

    await Promise.all([a.tick(), b.tick()]);

    expect(events).toHaveLength(1);
    const triggers = await store.listTriggers('sched-dedup');
    expect(triggers).toHaveLength(1);
  });

  it('records a failed trigger when publish throws and invokes onError', async () => {
    const { store } = makeStore();
    const pubsub = new EventEmitterPubSub();
    const original = pubsub.publish.bind(pubsub);
    const publishSpy = vi.spyOn(pubsub, 'publish').mockImplementation(async (topic, event) => {
      if (topic === 'workflows') {
        throw new Error('boom');
      }
      return original(topic, event);
    });
    const onError = vi.fn();
    const scheduler = new Scheduler({ schedulesStore: store, pubsub, config: { onError } });

    const past = Date.now() - 5_000;
    await store.createSchedule({
      id: 'sched-fail',
      target: { type: 'workflow', workflowId: 'wf-test' },
      cron: '0 0 1 1 *',
      status: 'active',
      nextFireAt: past,
      createdAt: past,
      updatedAt: past,
    });

    await scheduler.tick();

    const triggers = await store.listTriggers('sched-fail');
    expect(triggers).toHaveLength(1);
    expect(triggers[0]!.outcome).toBe('failed');
    expect(triggers[0]!.error).toBe('boom');
    expect(onError).toHaveBeenCalledOnce();
    expect(onError.mock.calls[0]![1]).toEqual({ scheduleId: 'sched-fail' });

    publishSpy.mockRestore();
  });

  it('isolates a throwing onError handler so the tick loop keeps processing the batch', async () => {
    const { store } = makeStore();
    const pubsub = new EventEmitterPubSub();
    const original = pubsub.publish.bind(pubsub);
    const publishSpy = vi.spyOn(pubsub, 'publish').mockImplementation(async (topic, event) => {
      if (topic === 'workflows') {
        throw new Error('boom');
      }
      return original(topic, event);
    });
    // First call throws inside the user hook. If the scheduler doesn't
    // isolate it, the throw escapes #fireSchedule, aborts #processTick,
    // and the second schedule never gets a recorded trigger.
    const onError = vi.fn().mockImplementationOnce(() => {
      throw new Error('hook exploded');
    });
    const scheduler = new Scheduler({ schedulesStore: store, pubsub, config: { onError } });

    const past = Date.now() - 5_000;
    await store.createSchedule({
      id: 'sched-a',
      target: { type: 'workflow', workflowId: 'wf-test' },
      cron: '0 0 1 1 *',
      status: 'active',
      nextFireAt: past,
      createdAt: past,
      updatedAt: past,
    });
    await store.createSchedule({
      id: 'sched-b',
      target: { type: 'workflow', workflowId: 'wf-test' },
      cron: '0 0 1 1 *',
      status: 'active',
      nextFireAt: past + 1,
      createdAt: past,
      updatedAt: past,
    });

    await expect(scheduler.tick()).resolves.toBeUndefined();

    expect(onError).toHaveBeenCalledTimes(2);
    const triggersA = await store.listTriggers('sched-a');
    const triggersB = await store.listTriggers('sched-b');
    expect(triggersA).toHaveLength(1);
    expect(triggersB).toHaveLength(1);

    publishSpy.mockRestore();
  });

  it('uses a deterministic runId derived from id + scheduledFireAt', async () => {
    const { store } = makeStore();
    const pubsub = new EventEmitterPubSub();
    const { events } = captureWorkflowsTopic(pubsub);
    const scheduler = new Scheduler({ schedulesStore: store, pubsub });

    const past = Date.now() - 5_000;
    const fireAt = past;
    await store.createSchedule({
      id: 'sched-det',
      target: { type: 'workflow', workflowId: 'wf-test' },
      cron: '0 0 1 1 *',
      status: 'active',
      nextFireAt: fireAt,
      createdAt: past,
      updatedAt: past,
    });

    await scheduler.tick();

    expect(events[0]!.runId).toBe(`sched_sched-det_${fireAt}`);
  });

  it('start() runs an immediate tick and stop() stops the loop', async () => {
    const { store } = makeStore();
    const pubsub = new EventEmitterPubSub();
    const { events } = captureWorkflowsTopic(pubsub);
    const scheduler = new Scheduler({
      schedulesStore: store,
      pubsub,
      config: { tickIntervalMs: 60_000 }, // long enough that the immediate tick is the only one
    });

    const past = Date.now() - 5_000;
    await store.createSchedule({
      id: 'sched-startstop',
      target: { type: 'workflow', workflowId: 'wf-test' },
      cron: '0 0 1 1 *',
      status: 'active',
      nextFireAt: past,
      createdAt: past,
      updatedAt: past,
    });

    await scheduler.start();
    expect(scheduler.isRunning).toBe(true);
    expect(events).toHaveLength(1);

    await scheduler.stop();
    expect(scheduler.isRunning).toBe(false);
  });

  it('does not keep the event loop alive after stop (setInterval is unrefed)', async () => {
    const origSetInterval = globalThis.setInterval;
    const unref = vi.fn();
    const setIntervalSpy = vi
      .spyOn(globalThis, 'setInterval')
      .mockImplementation((handler: any, ms?: number, ...args: any[]) => {
        const handle = origSetInterval(handler, ms, ...args);
        // Replace unref on the real handle with a spy so we can assert it's called
        const origUnref = handle.unref.bind(handle);
        handle.unref = () => {
          unref();
          return origUnref();
        };
        return handle;
      });

    const { store } = makeStore();
    const pubsub = new EventEmitterPubSub();
    const scheduler = new Scheduler({
      schedulesStore: store,
      pubsub,
      config: { tickIntervalMs: 60_000 },
    });

    await scheduler.start();
    expect(setIntervalSpy).toHaveBeenCalledOnce();
    expect(unref).toHaveBeenCalled();

    await scheduler.stop();
    setIntervalSpy.mockRestore();
  });

  it('starts on runtimes where setInterval returns a numeric handle (e.g. Cloudflare Workers)', async () => {
    // workerd's setInterval returns a number, which has no .unref method
    const setIntervalSpy = vi.spyOn(globalThis, 'setInterval').mockImplementation((() => 123) as any);

    try {
      const { store } = makeStore();
      const pubsub = new EventEmitterPubSub();
      const scheduler = new Scheduler({
        schedulesStore: store,
        pubsub,
        config: { tickIntervalMs: 60_000 },
      });

      await expect(scheduler.start()).resolves.toBeUndefined();
      expect(scheduler.isRunning).toBe(true);

      await scheduler.stop();
    } finally {
      setIntervalSpy.mockRestore();
    }
  });

  it('skips firing when the target workflow is not registered', async () => {
    const { store } = makeStore();
    const pubsub = new EventEmitterPubSub();
    const { events } = captureWorkflowsTopic(pubsub);
    const scheduler = new Scheduler({
      schedulesStore: store,
      pubsub,
      config: {
        tickIntervalMs: 60_000,
        isTargetReady: () => false,
        missesBeforeDelete: 3,
      },
    });

    const past = Date.now() - 5_000;
    await store.createSchedule({
      id: 'sched-ghost',
      target: { type: 'workflow', workflowId: 'wf-missing' },
      cron: '0 0 1 1 *',
      status: 'active',
      nextFireAt: past,
      createdAt: past,
      updatedAt: past,
    });

    await scheduler.start();
    // No publish, row still present, nextFireAt not advanced.
    expect(events).toHaveLength(0);
    const row = await store.getSchedule('sched-ghost');
    expect(row?.nextFireAt).toBe(past);

    await scheduler.stop();
  });

  it('deletes a schedule whose target workflow is missing for too many consecutive ticks', async () => {
    const { store } = makeStore();
    const pubsub = new EventEmitterPubSub();
    const { events } = captureWorkflowsTopic(pubsub);
    const scheduler = new Scheduler({
      schedulesStore: store,
      pubsub,
      config: {
        tickIntervalMs: 60_000,
        isTargetReady: () => false,
        missesBeforeDelete: 3,
      },
    });

    const past = Date.now() - 5_000;
    await store.createSchedule({
      id: 'sched-ghost',
      target: { type: 'workflow', workflowId: 'wf-missing' },
      cron: '0 0 1 1 *',
      status: 'active',
      nextFireAt: past,
      createdAt: past,
      updatedAt: past,
    });

    // Three ticks total — first two skip, third deletes the row.
    await scheduler.start();
    expect(await store.getSchedule('sched-ghost')).not.toBeNull();
    await scheduler.tick();
    expect(await store.getSchedule('sched-ghost')).not.toBeNull();
    await scheduler.tick();
    expect(await store.getSchedule('sched-ghost')).toBeNull();
    expect(events).toHaveLength(0);

    await scheduler.stop();
  });

  it('resets the miss counter when the target workflow appears within the grace window', async () => {
    const { store } = makeStore();
    const pubsub = new EventEmitterPubSub();
    const { events } = captureWorkflowsTopic(pubsub);
    let registered = false;
    const scheduler = new Scheduler({
      schedulesStore: store,
      pubsub,
      config: {
        tickIntervalMs: 60_000,
        isTargetReady: () => registered,
        missesBeforeDelete: 3,
      },
    });

    const past = Date.now() - 5_000;
    await store.createSchedule({
      id: 'sched-late',
      target: { type: 'workflow', workflowId: 'wf-late' },
      cron: '0 0 1 1 *',
      status: 'active',
      nextFireAt: past,
      createdAt: past,
      updatedAt: past,
    });

    // Two misses while the workflow hasn't registered yet.
    await scheduler.start();
    await scheduler.tick();
    expect(await store.getSchedule('sched-late')).not.toBeNull();
    expect(events).toHaveLength(0);

    // Workflow finishes registering before the grace window expires.
    registered = true;
    await scheduler.tick();
    expect(events).toHaveLength(1);
    const row = await store.getSchedule('sched-late');
    expect(row).not.toBeNull();
    expect(row?.nextFireAt).toBeGreaterThan(past);

    await scheduler.stop();
  });

  it('does not interfere with firing when no predicate is configured', async () => {
    const { store } = makeStore();
    const pubsub = new EventEmitterPubSub();
    const { events } = captureWorkflowsTopic(pubsub);
    const scheduler = new Scheduler({
      schedulesStore: store,
      pubsub,
      config: { tickIntervalMs: 60_000 },
    });

    const past = Date.now() - 5_000;
    await store.createSchedule({
      id: 'sched-no-predicate',
      target: { type: 'workflow', workflowId: 'wf-test' },
      cron: '0 0 1 1 *',
      status: 'active',
      nextFireAt: past,
      createdAt: past,
      updatedAt: past,
    });

    await scheduler.start();
    expect(events).toHaveLength(1);

    await scheduler.stop();
  });

  describe('stale-build fencing (#19169)', () => {
    const makeDueSchedule = (store: InMemorySchedulesStorage, definitionHash?: string) => {
      const past = Date.now() - 5_000;
      return store
        .createSchedule({
          id: 'sched-fence',
          target: { type: 'workflow', workflowId: 'wf-fenced', definitionHash },
          cron: '0 0 1 1 *',
          status: 'active',
          nextFireAt: past,
          createdAt: past,
          updatedAt: past,
        })
        .then(() => past);
    };

    it('does not claim the fire when isTargetCurrent reports a stale local definition', async () => {
      const { store } = makeStore();
      const pubsub = new EventEmitterPubSub();
      const { events } = captureWorkflowsTopic(pubsub);
      const scheduler = new Scheduler({
        schedulesStore: store,
        pubsub,
        config: { tickIntervalMs: 60_000, isTargetCurrent: () => false },
      });

      const past = await makeDueSchedule(store, 'aaaaaaaaaaaaaaaa');
      const casSpy = vi.spyOn(store, 'updateScheduleNextFire');

      await scheduler.start();
      await scheduler.tick();

      // No publish, no CAS attempt, nextFireAt untouched so a current
      // instance can still claim this fire, and the row is NOT deleted
      // (unlike the missing-target grace window).
      expect(events).toHaveLength(0);
      expect(casSpy).not.toHaveBeenCalled();
      const row = await store.getSchedule('sched-fence');
      expect(row).not.toBeNull();
      expect(row?.nextFireAt).toBe(past);

      await scheduler.stop();
    });

    it('claims the fire once the local definition matches again', async () => {
      const { store } = makeStore();
      const pubsub = new EventEmitterPubSub();
      const { events } = captureWorkflowsTopic(pubsub);
      let current = false;
      const scheduler = new Scheduler({
        schedulesStore: store,
        pubsub,
        config: { tickIntervalMs: 60_000, isTargetCurrent: () => current },
      });

      const past = await makeDueSchedule(store, 'aaaaaaaaaaaaaaaa');

      await scheduler.start();
      expect(events).toHaveLength(0);

      // Simulates the row being left for an instance running the current
      // build — here the same instance "becomes" current (e.g. reconcile
      // rewrote the row hash to match).
      current = true;
      await scheduler.tick();
      expect(events).toHaveLength(1);
      const row = await store.getSchedule('sched-fence');
      expect(row?.nextFireAt).toBeGreaterThan(past);

      await scheduler.stop();
    });

    it('fails open when the isTargetCurrent predicate throws', async () => {
      const { store } = makeStore();
      const pubsub = new EventEmitterPubSub();
      const { events } = captureWorkflowsTopic(pubsub);
      const scheduler = new Scheduler({
        schedulesStore: store,
        pubsub,
        config: {
          tickIntervalMs: 60_000,
          isTargetCurrent: () => {
            throw new Error('predicate boom');
          },
        },
      });

      await makeDueSchedule(store, 'aaaaaaaaaaaaaaaa');

      await scheduler.start();
      expect(events).toHaveLength(1);

      await scheduler.stop();
    });

    it('fires normally when no isTargetCurrent predicate is configured', async () => {
      const { store } = makeStore();
      const pubsub = new EventEmitterPubSub();
      const { events } = captureWorkflowsTopic(pubsub);
      const scheduler = new Scheduler({
        schedulesStore: store,
        pubsub,
        config: { tickIntervalMs: 60_000 },
      });

      await makeDueSchedule(store, 'aaaaaaaaaaaaaaaa');

      await scheduler.start();
      expect(events).toHaveLength(1);

      await scheduler.stop();
    });

    it('escalates and records a failed trigger when the skip is never picked up', async () => {
      const { store } = makeStore();
      const pubsub = new EventEmitterPubSub();
      const { events } = captureWorkflowsTopic(pubsub);
      const scheduler = new Scheduler({
        schedulesStore: store,
        pubsub,
        config: { tickIntervalMs: 60_000, isTargetCurrent: () => false, staleSkipsBeforeEscalation: 3 },
      });

      const past = await makeDueSchedule(store, 'aaaaaaaaaaaaaaaa');

      await scheduler.start(); // tick 1
      await scheduler.tick(); // tick 2
      expect(await store.listTriggers('sched-fence')).toHaveLength(0);

      await scheduler.tick(); // tick 3 — hits the escalation limit

      const triggers = await store.listTriggers('sched-fence');
      expect(triggers).toHaveLength(1);
      expect(triggers[0]!.outcome).toBe('failed');
      expect(triggers[0]!.error).toContain('no local target definition matches');

      // Escalation is visibility only: the fire is still never published and
      // the row stays claimable by an instance running the recorded build.
      expect(events).toHaveLength(0);
      const row = await store.getSchedule('sched-fence');
      expect(row?.nextFireAt).toBe(past);

      await scheduler.stop();
    });

    it('records the escalation only once rather than on every subsequent tick', async () => {
      const { store } = makeStore();
      const pubsub = new EventEmitterPubSub();
      const scheduler = new Scheduler({
        schedulesStore: store,
        pubsub,
        config: { tickIntervalMs: 60_000, isTargetCurrent: () => false, staleSkipsBeforeEscalation: 2 },
      });

      await makeDueSchedule(store, 'aaaaaaaaaaaaaaaa');

      await scheduler.start();
      for (let i = 0; i < 5; i++) await scheduler.tick();

      expect(await store.listTriggers('sched-fence')).toHaveLength(1);

      await scheduler.stop();
    });

    it('resets the stale-skip counter once the definition matches again', async () => {
      const { store } = makeStore();
      const pubsub = new EventEmitterPubSub();
      let current = false;
      const scheduler = new Scheduler({
        schedulesStore: store,
        pubsub,
        config: { tickIntervalMs: 60_000, isTargetCurrent: () => current, staleSkipsBeforeEscalation: 3 },
      });

      await makeDueSchedule(store, 'aaaaaaaaaaaaaaaa');

      await scheduler.start();
      await scheduler.tick();

      // A matching instance claims it before the limit is reached, so the
      // stall never escalates.
      current = true;
      await scheduler.tick();

      const triggers = await store.listTriggers('sched-fence');
      expect(triggers.every(t => t.outcome !== 'failed')).toBe(true);

      await scheduler.stop();
    });

    it('does not escalate while a current-build instance keeps claiming each fire', async () => {
      const { store } = makeStore();
      const pubsub = new EventEmitterPubSub();
      const scheduler = new Scheduler({
        schedulesStore: store,
        pubsub,
        // Permanently stale straggler: its definition never becomes current.
        config: { tickIntervalMs: 60_000, isTargetCurrent: () => false, staleSkipsBeforeEscalation: 2 },
      });

      let fireAt = await makeDueSchedule(store, 'aaaaaaaaaaaaaaaa');

      await scheduler.start();

      // Walk well past the escalation limit. Each round a healthy instance
      // claims the fire the straggler just declined (`start()` runs a tick of
      // its own), advancing nextFireAt, and the straggler then declines the
      // fresh window.
      for (let i = 0; i < 6; i++) {
        const nextFireAt = fireAt + 1_000;
        expect(
          await store.updateScheduleNextFire('sched-fence', fireAt, nextFireAt, fireAt, `sched-sched-fence-${fireAt}`),
        ).toBe(true);
        fireAt = nextFireAt;
        await scheduler.tick();
      }

      // Every fire was served, so nothing should have been recorded as failed.
      const triggers = await store.listTriggers('sched-fence');
      expect(triggers.filter(t => t.outcome === 'failed')).toHaveLength(0);

      await scheduler.stop();
    });

    it('escalates when the same fire window goes unclaimed for consecutive ticks', async () => {
      const { store } = makeStore();
      const pubsub = new EventEmitterPubSub();
      const scheduler = new Scheduler({
        schedulesStore: store,
        pubsub,
        config: { tickIntervalMs: 60_000, isTargetCurrent: () => false, staleSkipsBeforeEscalation: 2 },
      });

      // nextFireAt never advances: nobody in the fleet matches the row.
      await makeDueSchedule(store, 'aaaaaaaaaaaaaaaa');

      await scheduler.start();
      for (let i = 0; i < 3; i++) await scheduler.tick();

      const triggers = await store.listTriggers('sched-fence');
      expect(triggers.filter(t => t.outcome === 'failed')).toHaveLength(1);

      await scheduler.stop();
    });

    it('runs the fence after target-readiness so a missing target still uses the grace window', async () => {
      const { store } = makeStore();
      const pubsub = new EventEmitterPubSub();
      const { events } = captureWorkflowsTopic(pubsub);
      const isTargetCurrent = vi.fn(() => true);
      const scheduler = new Scheduler({
        schedulesStore: store,
        pubsub,
        config: {
          tickIntervalMs: 60_000,
          isTargetReady: () => false,
          isTargetCurrent,
          missesBeforeDelete: 3,
        },
      });

      await makeDueSchedule(store, 'aaaaaaaaaaaaaaaa');

      await scheduler.start();
      expect(events).toHaveLength(0);
      // Readiness failed first — the fence is never consulted.
      expect(isTargetCurrent).not.toHaveBeenCalled();

      await scheduler.stop();
    });
  });

  describe('claim/execute affinity (#19169)', () => {
    const capturePublishes = (pubsub: EventEmitterPubSub) => {
      const calls: { topic: string; event: any; options?: { localOnly?: boolean } }[] = [];
      const original = pubsub.publish.bind(pubsub);
      vi.spyOn(pubsub, 'publish').mockImplementation(async (topic, event, options?) => {
        calls.push({ topic, event, options });
        return original(topic, event, options);
      });
      return calls;
    };

    const makeDue = (store: InMemorySchedulesStorage, definitionHash?: string) => {
      const past = Date.now() - 5_000;
      return store.createSchedule({
        id: 'sched-affinity',
        target: { type: 'workflow', workflowId: 'wf-affinity', definitionHash },
        cron: '0 0 1 1 *',
        status: 'active',
        nextFireAt: past,
        createdAt: past,
        updatedAt: past,
      });
    };

    it('keeps the fire local when this process can execute workflows itself', async () => {
      const { store } = makeStore();
      const pubsub = new EventEmitterPubSub();
      const calls = capturePublishes(pubsub);
      const scheduler = new Scheduler({
        schedulesStore: store,
        pubsub,
        config: { tickIntervalMs: 60_000, canExecuteLocally: () => true },
      });

      await makeDue(store);
      await scheduler.tick();

      const start = calls.find(c => c.event.type === 'workflow.start');
      expect(start).toBeDefined();
      // The claimant runs the current build, so pinning execution here is what
      // prevents a straggler from a previous deploy from picking up the fire.
      expect(start!.options?.localOnly).toBe(true);

      await scheduler.stop();
    });

    it('broadcasts on the shared topic when this process has no local execution', async () => {
      const { store } = makeStore();
      const pubsub = new EventEmitterPubSub();
      const calls = capturePublishes(pubsub);
      const scheduler = new Scheduler({
        schedulesStore: store,
        pubsub,
        config: { tickIntervalMs: 60_000, canExecuteLocally: () => false },
      });

      await makeDue(store);
      await scheduler.tick();

      const start = calls.find(c => c.event.type === 'workflow.start');
      expect(start).toBeDefined();
      // Scheduler-only topology: pinning locally would strand the fire, so it
      // must go out to the shared topic and rely on the hash fence instead.
      expect(start!.options?.localOnly).toBeFalsy();

      await scheduler.stop();
    });

    it('broadcasts when no canExecuteLocally predicate is configured', async () => {
      const { store } = makeStore();
      const pubsub = new EventEmitterPubSub();
      const calls = capturePublishes(pubsub);
      const scheduler = new Scheduler({ schedulesStore: store, pubsub, config: { tickIntervalMs: 60_000 } });

      await makeDue(store);
      await scheduler.tick();

      const start = calls.find(c => c.event.type === 'workflow.start');
      expect(start).toBeDefined();
      expect(start!.options?.localOnly).toBeFalsy();

      await scheduler.stop();
    });

    it('stamps the schedule definition hash on the fired event', async () => {
      const { store } = makeStore();
      const pubsub = new EventEmitterPubSub();
      const { events } = captureWorkflowsTopic(pubsub);
      const scheduler = new Scheduler({ schedulesStore: store, pubsub, config: { tickIntervalMs: 60_000 } });

      await makeDue(store, 'abcdef0123456789');
      await scheduler.tick();

      expect(events).toHaveLength(1);
      // Consumers compare this against their own registered definition.
      expect((events[0]!.data as any).scheduleDefinitionHash).toBe('abcdef0123456789');

      await scheduler.stop();
    });

    it('omits the hash when the schedule row has none', async () => {
      const { store } = makeStore();
      const pubsub = new EventEmitterPubSub();
      const { events } = captureWorkflowsTopic(pubsub);
      const scheduler = new Scheduler({ schedulesStore: store, pubsub, config: { tickIntervalMs: 60_000 } });

      await makeDue(store);
      await scheduler.tick();

      expect(events).toHaveLength(1);
      // Legacy/imperative schedules carry no hash — consumers must fail open.
      expect((events[0]!.data as any).scheduleDefinitionHash).toBeUndefined();

      await scheduler.stop();
    });
  });

  it('applies defaults when config values are explicitly undefined', async () => {
    const { store } = makeStore();
    const pubsub = new EventEmitterPubSub();

    // Simulate a user config where optional fields are present but undefined,
    // e.g. from destructuring a partial object.
    const scheduler = new Scheduler({
      schedulesStore: store,
      pubsub,
      config: { enabled: true, tickIntervalMs: undefined, batchSize: undefined },
    });

    const listDue = vi.spyOn(store, 'listDueSchedules');
    const siSpy = vi.spyOn(globalThis, 'setInterval');

    await scheduler.start();

    // batchSize should fall back to 100 (the default), not undefined/NaN
    expect(listDue).toHaveBeenCalled();
    const batchArg = listDue.mock.calls[0]![1];
    expect(batchArg).toBe(100);

    // tickIntervalMs should fall back to 10_000 (the default), not undefined
    // setInterval is called once after the warm-up tick
    const intervalCall = siSpy.mock.calls.find(call => {
      const cb = call[0];
      return typeof cb === 'function' && call[1] !== undefined;
    });
    expect(intervalCall).toBeDefined();
    expect(intervalCall![1]).toBe(10_000);

    await scheduler.stop();
    siSpy.mockRestore();
  });
});
