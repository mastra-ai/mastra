import { describe, it, expect } from 'vitest';
import { Agent } from '../agent';
import { InMemoryStore } from '../storage/mock';
import { Harness } from './harness';
import type { HarnessEvent } from './types';

function createHarness() {
  const agent = new Agent({
    name: 'test-agent',
    instructions: 'You are a test agent.',
    model: { provider: 'openai', name: 'gpt-4o', toolChoice: 'auto' } as any,
  });

  return new Harness({
    id: 'test-harness',
    storage: new InMemoryStore(),
    modes: [{ id: 'default', name: 'Default', default: true, agent }],
  });
}

async function processSubscribedChunks(harness: Harness, chunks: any[]) {
  const subscription = {
    stream: (async function* () {
      for (const chunk of chunks) yield chunk;
    })(),
    activeRunId: () => 'om-run',
    abort: () => {},
    unsubscribe: () => {},
  };

  harness.session.stream.attach({ subscription: subscription as any, key: 'test-agent:test-resource:test-thread' });
  await (harness as any).processSubscribedThreadStream(subscription);
}

describe('Harness OM failure abort behavior', () => {
  it('aborts stream and emits an error when OM buffering fails', async () => {
    const harness = createHarness();
    const events: HarnessEvent[] = [];
    harness.subscribe(event => {
      events.push(event);
    });

    harness.session.run.ensureAbortController();

    await processSubscribedChunks(harness, [
      {
        type: 'data-om-buffering-failed',
        data: {
          cycleId: 'c1',
          operationType: 'observation',
          error: 'Bad Request',
        },
      },
      { type: 'text-start', payload: { id: 't1' } },
    ]);

    expect(events.some(e => e.type === 'om_buffering_failed')).toBe(true);
    const errorEvent = events.find(e => e.type === 'error');
    expect(errorEvent?.type).toBe('error');
    expect((errorEvent as Extract<HarnessEvent, { type: 'error' }>).error.message).toContain(
      'Observational memory observation buffering failed: Bad Request',
    );
    expect(events.some(e => e.type === 'agent_end' && e.reason === 'aborted')).toBe(true);
    expect(harness.session.run.isAbortRequested()).toBe(false);
    expect(harness.session.run.hasAbortController()).toBe(false);
    expect(events.some(e => e.type === 'message_start')).toBe(false);
  });

  it('aborts stream and emits an error when OM observation run fails', async () => {
    const harness = createHarness();
    const events: HarnessEvent[] = [];
    harness.subscribe(event => {
      events.push(event);
    });

    harness.session.run.ensureAbortController();

    await processSubscribedChunks(harness, [
      {
        type: 'data-om-observation-failed',
        data: {
          cycleId: 'c2',
          operationType: 'reflection',
          error: 'Model unavailable',
          durationMs: 50,
        },
      },
      { type: 'text-start', payload: { id: 't2' } },
    ]);

    expect(events.some(e => e.type === 'om_reflection_failed')).toBe(true);
    const errorEvent = events.find(e => e.type === 'error');
    expect(errorEvent?.type).toBe('error');
    expect((errorEvent as Extract<HarnessEvent, { type: 'error' }>).error.message).toContain(
      'Observational memory reflection run failed: Model unavailable',
    );
    expect(events.some(e => e.type === 'agent_end' && e.reason === 'aborted')).toBe(true);
    expect(harness.session.run.isAbortRequested()).toBe(false);
    expect(events.some(e => e.type === 'message_start')).toBe(false);
  });
});
