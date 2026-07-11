import { describe, expect, it, vi } from 'vitest';

import { normalizeBehavior } from '../definition/normalize.js';
import { InMemoryBehaviorRuntimeStore } from '../runtime/in-memory-store.js';
import { BehaviorTransitionEngine } from '../runtime/transition-engine.js';
import { BehaviorScheduler, type BehaviorAuditEvent } from './scheduler.js';

const definition = normalizeBehavior({
  id: 'sync',
  version: '1',
  initialState: 'poll',
  states: [{
    id: 'poll',
    periodic: { intervalMs: 1_000, transition: 'again' },
    transitions: [
      { id: 'again', target: 'poll' },
      { id: 'exit', target: 'exit', exit: true },
    ],
  }],
});

const setup = async (judge?: () => Promise<{ approved: boolean; reason?: string }>) => {
  let time = 0;
  const now = () => new Date(time);
  const store = new InMemoryBehaviorRuntimeStore();
  await store.init();
  const engine = new BehaviorTransitionEngine({ definition, store, now, judge });
  await engine.initialize('thread');
  const audit: BehaviorAuditEvent[] = [];
  const scheduler = new BehaviorScheduler({
    behaviorId: definition.id,
    definition,
    store,
    engine,
    now,
    retryBackoffMs: 500,
    onAudit: event => { audit.push(event); },
  });
  return { store, engine, scheduler, audit, advance: (ms: number) => (time += ms), now };
};

describe('BehaviorScheduler', () => {
  it('skips not-due work and recovers due work after restart', async () => {
    const fixture = await setup();
    expect(await fixture.scheduler.tick()).toBe(0);
    fixture.advance(1_000);
    const restarted = new BehaviorScheduler({
      behaviorId: definition.id,
      definition,
      store: fixture.store,
      engine: fixture.engine,
      now: fixture.now,
    });
    expect(await restarted.tick()).toBe(1);
    const record = await fixture.store.readThread({ threadId: 'thread', behaviorId: 'sync' });
    expect(record?.transitionHistory).toHaveLength(1);
    expect(record?.checkpoints.schedulerCheckpoint).toBe(new Date(1_000).toISOString());
  });

  it('prevents duplicate work across scheduler instances', async () => {
    const fixture = await setup();
    fixture.advance(1_000);
    const second = new BehaviorScheduler({
      behaviorId: definition.id,
      definition,
      store: fixture.store,
      engine: fixture.engine,
      now: fixture.now,
    });
    const results = await Promise.all([fixture.scheduler.tick(), second.tick()]);
    expect(results.reduce((sum, value) => sum + value, 0)).toBe(1);
    const record = await fixture.store.readThread({ threadId: 'thread', behaviorId: 'sync' });
    expect(record?.transitionHistory).toHaveLength(1);
  });

  it('backs off failed transitions and emits audit diagnostics', async () => {
    const guarded = normalizeBehavior({
      id: 'guarded', version: '1', initialState: 'poll', states: [{
        id: 'poll', periodic: { intervalMs: 100, transition: 'again' }, transitions: [
          { id: 'again', target: 'poll', guards: [{ id: 'deny' }] },
          { id: 'exit', target: 'exit', exit: true },
        ],
      }],
    });
    let time = 0;
    const now = () => new Date(time);
    const store = new InMemoryBehaviorRuntimeStore();
    const engine = new BehaviorTransitionEngine({ definition: guarded, store, now, guards: { deny: () => false } });
    await store.init();
    await engine.initialize('thread');
    time = 100;
    const audit: BehaviorAuditEvent[] = [];
    const scheduler = new BehaviorScheduler({
      behaviorId: guarded.id, definition: guarded, store, engine, now, retryBackoffMs: 500, onAudit: e => { audit.push(e); },
    });
    expect(await scheduler.tick()).toBe(0);
    const record = await store.readThread({ threadId: 'thread', behaviorId: 'guarded' });
    expect(record?.nextCheckAt).toBe(new Date(600).toISOString());
    expect(record?.audit.lastSchedulerError).toContain('rejected');
    expect(audit.map(event => event.type)).toEqual(['scheduler.claimed', 'scheduler.failed']);
  });

  it('owns one timer and stops it during replacement', () => {
    vi.useFakeTimers();
    const setIntervalSpy = vi.spyOn(globalThis, 'setInterval');
    const scheduler = new BehaviorScheduler({
      behaviorId: definition.id,
      definition,
      store: {} as never,
      engine: {} as never,
    });
    scheduler.start();
    scheduler.start();
    expect(setIntervalSpy).toHaveBeenCalledOnce();
    scheduler.stop();
    expect(vi.getTimerCount()).toBe(0);
    vi.useRealTimers();
  });
});
