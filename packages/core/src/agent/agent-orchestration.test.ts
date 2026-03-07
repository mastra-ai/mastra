import { MockLanguageModelV1, simulateReadableStream } from '@internal/ai-sdk-v4/test';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import type { AgentEvent } from './events';
import { Agent } from './index';

function createDummyModel() {
  return new MockLanguageModelV1({
    doGenerate: async () => ({
      rawCall: { rawPrompt: null, rawSettings: {} },
      finishReason: 'stop' as const,
      usage: { promptTokens: 10, completionTokens: 20 },
      text: 'Dummy response',
    }),
    doStream: async () => ({
      stream: simulateReadableStream({
        chunks: [{ type: 'text-delta' as const, textDelta: 'Dummy response' }],
      }),
      rawCall: { rawPrompt: null, rawSettings: {} },
    }),
  });
}

describe('Agent Events', () => {
  it('subscribe receives events and returns unsubscribe function', () => {
    const agent = new Agent({
      id: 'test-agent',
      name: 'Test Agent',
      instructions: 'You are helpful.',
      model: createDummyModel(),
      stateSchema: z.object({ counter: z.number().default(0) }),
    });

    const events: AgentEvent[] = [];
    const unsub = agent.subscribe(event => events.push(event));

    agent.setState({ counter: 1 });
    expect(events).toHaveLength(1);
    expect(events[0]!.type).toBe('state_changed');

    unsub();
    agent.setState({ counter: 2 });
    expect(events).toHaveLength(1); // no new event after unsub
  });

  it('on() filters by event type', () => {
    const agent = new Agent({
      id: 'test-agent',
      name: 'Test Agent',
      instructions: 'You are helpful.',
      model: createDummyModel(),
      modes: [
        { id: 'plan', name: 'Plan', default: true },
        { id: 'build', name: 'Build' },
      ],
      stateSchema: z.object({ counter: z.number().default(0) }),
    });

    const modeEvents: AgentEvent[] = [];
    const stateEvents: AgentEvent[] = [];

    agent.on('mode_changed', event => modeEvents.push(event));
    agent.on('state_changed', event => stateEvents.push(event));

    agent.switchMode('build');
    agent.setState({ counter: 42 });

    expect(modeEvents).toHaveLength(1);
    expect(stateEvents).toHaveLength(1);
    expect(modeEvents[0]!.type).toBe('mode_changed');
    expect(stateEvents[0]!.type).toBe('state_changed');
  });

  it('listener errors do not propagate', () => {
    const agent = new Agent({
      id: 'test-agent',
      name: 'Test Agent',
      instructions: 'You are helpful.',
      model: createDummyModel(),
      stateSchema: z.object({ x: z.number().default(0) }),
    });

    const events: AgentEvent[] = [];
    agent.subscribe(() => {
      throw new Error('boom');
    });
    agent.subscribe(event => events.push(event));

    agent.setState({ x: 1 });
    expect(events).toHaveLength(1);
  });

  it('multiple subscribers all receive events', () => {
    const agent = new Agent({
      id: 'test-agent',
      name: 'Test Agent',
      instructions: 'You are helpful.',
      model: createDummyModel(),
      stateSchema: z.object({ x: z.number().default(0) }),
    });

    const a: AgentEvent[] = [];
    const b: AgentEvent[] = [];

    agent.subscribe(e => a.push(e));
    agent.subscribe(e => b.push(e));

    agent.setState({ x: 5 });
    expect(a).toHaveLength(1);
    expect(b).toHaveLength(1);
  });
});

describe('Agent Modes', () => {
  it('hasModes returns false when no modes configured', () => {
    const agent = new Agent({
      id: 'test-agent',
      name: 'Test Agent',
      instructions: 'You are helpful.',
      model: createDummyModel(),
    });

    expect(agent.hasModes()).toBe(false);
    expect(agent.listModes()).toEqual([]);
    expect(agent.getCurrentModeId()).toBeUndefined();
    expect(agent.getCurrentMode()).toBeUndefined();
  });

  it('defaults to the mode marked default', () => {
    const agent = new Agent({
      id: 'test-agent',
      name: 'Test Agent',
      instructions: 'You are helpful.',
      model: createDummyModel(),
      modes: [
        { id: 'alpha', name: 'Alpha' },
        { id: 'beta', name: 'Beta', default: true },
      ],
    });

    expect(agent.hasModes()).toBe(true);
    expect(agent.getCurrentModeId()).toBe('beta');
    expect(agent.getCurrentMode()!.id).toBe('beta');
  });

  it('defaults to first mode when none marked default', () => {
    const agent = new Agent({
      id: 'test-agent',
      name: 'Test Agent',
      instructions: 'You are helpful.',
      model: createDummyModel(),
      modes: [
        { id: 'first', name: 'First' },
        { id: 'second', name: 'Second' },
      ],
    });

    expect(agent.getCurrentModeId()).toBe('first');
  });

  it('switchMode changes the current mode and emits event', () => {
    const agent = new Agent({
      id: 'test-agent',
      name: 'Test Agent',
      instructions: 'You are helpful.',
      model: createDummyModel(),
      modes: [
        { id: 'plan', name: 'Plan', default: true },
        { id: 'build', name: 'Build' },
      ],
    });

    const events: AgentEvent[] = [];
    agent.subscribe(e => events.push(e));

    agent.switchMode('build');
    expect(agent.getCurrentModeId()).toBe('build');
    expect(events).toHaveLength(1);
    expect(events[0]).toEqual({
      type: 'mode_changed',
      modeId: 'build',
      previousModeId: 'plan',
    });
  });

  it('switchMode to same mode is a no-op', () => {
    const agent = new Agent({
      id: 'test-agent',
      name: 'Test Agent',
      instructions: 'You are helpful.',
      model: createDummyModel(),
      modes: [{ id: 'plan', name: 'Plan', default: true }],
    });

    const events: AgentEvent[] = [];
    agent.subscribe(e => events.push(e));

    agent.switchMode('plan');
    expect(events).toHaveLength(0);
  });

  it('switchMode throws for unknown mode', () => {
    const agent = new Agent({
      id: 'test-agent',
      name: 'Test Agent',
      instructions: 'You are helpful.',
      model: createDummyModel(),
      modes: [{ id: 'plan', name: 'Plan', default: true }],
    });

    expect(() => agent.switchMode('nonexistent')).toThrow('Mode not found: nonexistent');
  });

  it('switchMode throws when modes not configured', () => {
    const agent = new Agent({
      id: 'test-agent',
      name: 'Test Agent',
      instructions: 'You are helpful.',
      model: createDummyModel(),
    });

    expect(() => agent.switchMode('plan')).toThrow('Cannot switch modes: no modes configured on this agent');
  });

  it('listModes returns all configured modes', () => {
    const modes = [
      { id: 'plan', name: 'Plan', default: true },
      { id: 'build', name: 'Build' },
      { id: 'review', name: 'Review' },
    ];
    const agent = new Agent({
      id: 'test-agent',
      name: 'Test Agent',
      instructions: 'You are helpful.',
      model: createDummyModel(),
      modes,
    });

    expect(agent.listModes()).toEqual(modes);
  });
});

describe('Agent State', () => {
  it('getState returns empty object when no state configured', () => {
    const agent = new Agent({
      id: 'test-agent',
      name: 'Test Agent',
      instructions: 'You are helpful.',
      model: createDummyModel(),
    });

    expect(agent.getState()).toEqual({});
  });

  it('initializes state from schema defaults', () => {
    const agent = new Agent({
      id: 'test-agent',
      name: 'Test Agent',
      instructions: 'You are helpful.',
      model: createDummyModel(),
      stateSchema: z.object({
        counter: z.number().default(0),
        label: z.string().default('untitled'),
      }),
    });

    expect(agent.getState()).toEqual({ counter: 0, label: 'untitled' });
  });

  it('initialState overrides schema defaults', () => {
    const agent = new Agent({
      id: 'test-agent',
      name: 'Test Agent',
      instructions: 'You are helpful.',
      model: createDummyModel(),
      stateSchema: z.object({
        counter: z.number().default(0),
        label: z.string().default('untitled'),
      }),
      initialState: { counter: 10 },
    });

    expect(agent.getState()).toEqual({ counter: 10, label: 'untitled' });
  });

  it('setState updates state and emits event', () => {
    const agent = new Agent({
      id: 'test-agent',
      name: 'Test Agent',
      instructions: 'You are helpful.',
      model: createDummyModel(),
      stateSchema: z.object({
        counter: z.number().default(0),
      }),
    });

    const events: AgentEvent[] = [];
    agent.subscribe(e => events.push(e));

    agent.setState({ counter: 42 });
    expect(agent.getState()).toEqual({ counter: 42 });
    expect(events).toHaveLength(1);

    const event = events[0]!;
    expect(event.type).toBe('state_changed');
    if (event.type === 'state_changed') {
      expect(event.changedKeys).toEqual(['counter']);
      expect(event.state).toEqual({ counter: 42 });
    }
  });

  it('setState validates against schema', () => {
    const agent = new Agent({
      id: 'test-agent',
      name: 'Test Agent',
      instructions: 'You are helpful.',
      model: createDummyModel(),
      stateSchema: z.object({
        counter: z.number(),
      }),
      initialState: { counter: 0 },
    });

    expect(() => agent.setState({ counter: 'not a number' as any })).toThrow('Invalid state update');
  });

  it('setState works without schema (unvalidated)', () => {
    const agent = new Agent({
      id: 'test-agent',
      name: 'Test Agent',
      instructions: 'You are helpful.',
      model: createDummyModel(),
      initialState: { foo: 'bar' },
    });

    agent.setState({ foo: 'baz', extra: true });
    expect(agent.getState()).toEqual({ foo: 'baz', extra: true });
  });

  it('getState returns a snapshot (not a reference)', () => {
    const agent = new Agent({
      id: 'test-agent',
      name: 'Test Agent',
      instructions: 'You are helpful.',
      model: createDummyModel(),
      initialState: { counter: 0 },
    });

    const snapshot = agent.getState();
    (snapshot as any).counter = 999;
    expect(agent.getState().counter).toBe(0);
  });
});

describe('Agent Orchestration Integration', () => {
  it('modes and state work together', () => {
    const agent = new Agent({
      id: 'test-agent',
      name: 'Test Agent',
      instructions: 'You are helpful.',
      model: createDummyModel(),
      modes: [
        { id: 'plan', name: 'Plan', default: true },
        { id: 'build', name: 'Build' },
      ],
      stateSchema: z.object({
        currentModelId: z.string().optional(),
      }),
    });

    const events: AgentEvent[] = [];
    agent.subscribe(e => events.push(e));

    agent.switchMode('build');
    agent.setState({ currentModelId: 'anthropic/claude-sonnet-4-20250514' });

    expect(agent.getCurrentModeId()).toBe('build');
    expect(agent.getState()).toEqual({ currentModelId: 'anthropic/claude-sonnet-4-20250514' });
    expect(events).toHaveLength(2);
    expect(events[0]!.type).toBe('mode_changed');
    expect(events[1]!.type).toBe('state_changed');
  });
});
