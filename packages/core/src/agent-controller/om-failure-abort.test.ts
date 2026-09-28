import { describe, it, expect } from 'vitest';
import { Agent } from '../agent';
import { InMemoryStore } from '../storage/mock';
import { AgentController } from './agent-controller';
import { createMockWorkspace } from './test-utils';
import type { AgentControllerEvent } from './types';

async function createSession() {
  const agent = new Agent({
    name: 'test-agent',
    instructions: 'You are a test agent.',
    model: { provider: 'openai', name: 'gpt-4o', toolChoice: 'auto' },
  });

  const controller = new AgentController({
    workspace: createMockWorkspace(),
    id: 'test-controller',
    storage: new InMemoryStore(),
    modes: [{ id: 'default', name: 'Default', default: true, agent }],
  });
  await controller.init();
  const session = await controller.createSession({ id: 'test-session', ownerId: 'test-owner' });
  return { session };
}

describe('AgentController OM failure abort behavior', () => {
  it('aborts stream and emits an error when OM buffering fails', async () => {
    const { session } = await createSession();
    const events: AgentControllerEvent[] = [];
    session.subscribe(event => events.push(event));

    session.run.ensureAbortController();

    await (session as any).processStream({
      fullStream: (async function* () {
        yield {
          type: 'data-om-buffering-failed',
          data: {
            cycleId: 'c1',
            operationType: 'observation',
            error: 'Bad Request',
          },
        };
        yield { type: 'text-start', payload: { id: 't1' } };
      })(),
    });

    expect(events.some(e => e.type === 'om_buffering_failed')).toBe(true);
    const errorEvent = events.find(e => e.type === 'error');
    expect(errorEvent?.type).toBe('error');
    expect((errorEvent as Extract<AgentControllerEvent, { type: 'error' }>).error.message).toContain(
      'Observational memory observation buffering failed: Bad Request',
    );
    expect(events.some(e => e.type === 'agent_end' && e.reason === 'aborted')).toBe(true);
    expect(session.run.isAbortRequested()).toBe(false);
    expect(session.run.hasAbortController()).toBe(false);
    expect(events.some(e => e.type === 'message_start')).toBe(false);
  });

  it('aborts stream and emits an error when OM observation run fails', async () => {
    const { session } = await createSession();
    const events: AgentControllerEvent[] = [];
    session.subscribe(event => events.push(event));

    session.run.ensureAbortController();

    await (session as any).processStream({
      fullStream: (async function* () {
        yield {
          type: 'data-om-observation-failed',
          data: {
            cycleId: 'c2',
            operationType: 'reflection',
            error: 'Model unavailable',
            durationMs: 50,
          },
        };
        yield { type: 'text-start', payload: { id: 't2' } };
      })(),
    });

    expect(events.some(e => e.type === 'om_reflection_failed')).toBe(true);
    const errorEvent = events.find(e => e.type === 'error');
    expect(errorEvent?.type).toBe('error');
    expect((errorEvent as Extract<AgentControllerEvent, { type: 'error' }>).error.message).toContain(
      'Observational memory reflection run failed: Model unavailable',
    );
    expect(events.some(e => e.type === 'agent_end' && e.reason === 'aborted')).toBe(true);
    expect(session.run.isAbortRequested()).toBe(false);
    expect(events.some(e => e.type === 'message_start')).toBe(false);
  });

  it('continues the stream after an observer model buffering failure under continue policy', async () => {
    const { session } = await createSession();
    const events: AgentControllerEvent[] = [];
    session.subscribe(event => events.push(event));

    session.run.ensureAbortController();

    await (session as any).processStream({
      fullStream: (async function* () {
        yield {
          type: 'data-om-buffering-failed',
          data: {
            cycleId: 'c3',
            operationType: 'observation',
            error: 'fetch failed',
            failurePolicy: 'continue',
            failureKind: 'observer-model',
          },
        };
        yield { type: 'text-start', payload: { id: 't3' } };
      })(),
    });

    const failureIndex = events.findIndex(e => e.type === 'om_buffering_failed');
    const continuationIndex = events.findIndex(e => e.type === 'message_start');
    expect(failureIndex).toBeGreaterThanOrEqual(0);
    expect(continuationIndex).toBeGreaterThan(failureIndex);
    expect(events.some(e => e.type === 'error')).toBe(false);
    expect(events.some(e => e.type === 'agent_end' && e.reason === 'aborted')).toBe(false);
  });

  it('continues the stream after an awaited observer model failure under continue policy', async () => {
    const { session } = await createSession();
    const events: AgentControllerEvent[] = [];
    session.subscribe(event => events.push(event));

    session.run.ensureAbortController();

    await (session as any).processStream({
      fullStream: (async function* () {
        yield {
          type: 'data-om-observation-failed',
          data: {
            cycleId: 'c4',
            operationType: 'observation',
            error: 'fetch failed',
            durationMs: 50,
            failurePolicy: 'continue',
            failureKind: 'observer-model',
          },
        };
        yield { type: 'text-start', payload: { id: 't4' } };
      })(),
    });

    const failureIndex = events.findIndex(e => e.type === 'om_observation_failed');
    const continuationIndex = events.findIndex(e => e.type === 'message_start');
    expect(failureIndex).toBeGreaterThanOrEqual(0);
    expect(continuationIndex).toBeGreaterThan(failureIndex);
    expect(events.some(e => e.type === 'error')).toBe(false);
    expect(events.some(e => e.type === 'agent_end' && e.reason === 'aborted')).toBe(false);
  });

  const failClosedMetadataCases = [
    ['policy missing', { failureKind: 'observer-model' }],
    ['kind missing', { failurePolicy: 'continue' }],
    ['both missing', {}],
    ['unknown policy', { failurePolicy: 'ignore', failureKind: 'observer-model' }],
    ['unknown kind', { failurePolicy: 'continue', failureKind: 'provider' }],
    ['mismatched kind', { failurePolicy: 'continue', failureKind: 'reflector-model' }],
    [
      'inherited policy',
      Object.assign(Object.create({ failurePolicy: 'continue' }), { failureKind: 'observer-model' }),
    ],
    ['inherited kind', Object.assign(Object.create({ failureKind: 'observer-model' }), { failurePolicy: 'continue' })],
    ['both inherited', Object.create({ failurePolicy: 'continue', failureKind: 'observer-model' })],
  ] as const;

  it.each(['data-om-buffering-failed', 'data-om-observation-failed'] as const)(
    'fails closed for %s without complete own continuation metadata',
    async type => {
      for (const [name, metadata] of failClosedMetadataCases) {
        const { session } = await createSession();
        const events: AgentControllerEvent[] = [];
        session.subscribe(event => {
          events.push(event);
        });
        session.run.ensureAbortController();

        const data = Object.assign(
          Object.create(Object.getPrototypeOf(metadata)),
          {
            cycleId: `fail-closed-${name}`,
            operationType: 'observation',
            error: 'storage failed',
            durationMs: 50,
          },
          metadata,
        );

        await (session as any).processStream({
          fullStream: (async function* () {
            yield { type, data };
            yield { type: 'text-start', payload: { id: 'blocked' } };
          })(),
        });

        expect(
          events.some(e => e.type === 'error'),
          name,
        ).toBe(true);
        expect(
          events.some(e => e.type === 'agent_end' && e.reason === 'aborted'),
          name,
        ).toBe(true);
        expect(
          events.some(e => e.type === 'message_start'),
          name,
        ).toBe(false);
      }
    },
  );
});
