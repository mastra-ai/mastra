import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { EventEmitterPubSub } from '../../events/event-emitter';
import type { Event } from '../../events/types';
import { InMemoryDB } from '../../storage/domains/inmemory-db';
import { InMemorySchedulesStorage } from '../../storage/domains/schedules/inmemory';
import { WorkflowScheduler } from './scheduler';

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

describe('WorkflowScheduler', () => {
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
    const scheduler = new WorkflowScheduler({ schedulesStore: store, pubsub });

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
    expect(triggers[0]!.status).toBe('published');
  });

  it('skips paused schedules', async () => {
    const { store } = makeStore();
    const pubsub = new EventEmitterPubSub();
    const { events } = captureWorkflowsTopic(pubsub);
    const scheduler = new WorkflowScheduler({ schedulesStore: store, pubsub });

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
    const scheduler = new WorkflowScheduler({ schedulesStore: store, pubsub });

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
    const a = new WorkflowScheduler({ schedulesStore: store, pubsub });
    const b = new WorkflowScheduler({ schedulesStore: store, pubsub });

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
    const scheduler = new WorkflowScheduler({ schedulesStore: store, pubsub, config: { onError } });

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
    expect(triggers[0]!.status).toBe('failed');
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
    const scheduler = new WorkflowScheduler({ schedulesStore: store, pubsub, config: { onError } });

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
    const scheduler = new WorkflowScheduler({ schedulesStore: store, pubsub });

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
    const scheduler = new WorkflowScheduler({
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
});
