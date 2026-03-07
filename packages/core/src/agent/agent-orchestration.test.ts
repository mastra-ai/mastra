import { MockLanguageModelV1, simulateReadableStream } from '@internal/ai-sdk-v4/test';
import { convertArrayToReadableStream, MockLanguageModelV2 } from '@internal/ai-sdk-v5/test';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import { MockMemory } from '../memory/mock';

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

function createV2StreamModel(text = 'Hello from send') {
  return new MockLanguageModelV2({
    doGenerate: async () => ({
      rawCall: { rawPrompt: null, rawSettings: {} },
      finishReason: 'stop' as const,
      usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
      content: [{ type: 'text' as const, text }],
      warnings: [],
    }),
    doStream: async () => ({
      rawCall: { rawPrompt: null, rawSettings: {} },
      warnings: [],
      stream: convertArrayToReadableStream([
        { type: 'stream-start', warnings: [] },
        { type: 'text-start', id: 'text-1' },
        { type: 'text-delta', id: 'text-1', delta: text },
        { type: 'text-end', id: 'text-1' },
        {
          type: 'finish',
          finishReason: 'stop' as const,
          usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
        },
      ]),
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

describe('Agent .send()', () => {
  it('operation events stream contains lifecycle events', async () => {
    const mockMemory = new MockMemory();
    const agent = new Agent({
      id: 'send-agent',
      name: 'Send Agent',
      instructions: 'You are helpful.',
      model: createV2StreamModel('Hello world'),
      memory: mockMemory,
    });

    const op = agent.send({
      messages: 'Hi there',
      threadId: 'thread-1',
      resourceId: 'user-1',
    });

    const events: AgentEvent[] = [];
    for await (const event of op.events) {
      events.push(event);
    }

    const eventTypes = events.map(e => e.type);
    expect(eventTypes).toContain('send_start');
    expect(eventTypes).toContain('message_start');
    expect(eventTypes).toContain('message_update');
    expect(eventTypes).toContain('message_end');
    expect(eventTypes).toContain('send_end');

    const sendEnd = events.find(e => e.type === 'send_end');
    expect(sendEnd).toBeDefined();
    if (sendEnd && sendEnd.type === 'send_end') {
      expect(sendEnd.reason).toBe('complete');
    }
  });

  it('global subscribers also receive events from send operations', async () => {
    const mockMemory = new MockMemory();
    const agent = new Agent({
      id: 'send-agent',
      name: 'Send Agent',
      instructions: 'You are helpful.',
      model: createV2StreamModel('Hello world'),
      memory: mockMemory,
    });

    const globalEvents: AgentEvent[] = [];
    agent.subscribe(e => globalEvents.push(e));

    const op = agent.send({
      messages: 'Hi there',
      threadId: 'thread-1',
      resourceId: 'user-1',
    });

    await op.result;

    const eventTypes = globalEvents.map(e => e.type);
    expect(eventTypes).toContain('send_start');
    expect(eventTypes).toContain('send_end');
  });

  it('result resolves with the assembled message', async () => {
    const mockMemory = new MockMemory();
    const agent = new Agent({
      id: 'send-agent',
      name: 'Send Agent',
      instructions: 'You are helpful.',
      model: createV2StreamModel('Test response'),
      memory: mockMemory,
    });

    const op = agent.send({
      messages: 'Hello',
      threadId: 'thread-1',
      resourceId: 'user-1',
    });

    const { message } = await op.result;

    expect(message.role).toBe('assistant');
    expect(message.content.length).toBeGreaterThan(0);
    const textContent = message.content.find(c => c.type === 'text');
    expect(textContent).toBeDefined();
    expect(textContent!.text).toContain('Test response');
  });

  it('op.abort() cancels this specific send', async () => {
    const mockMemory = new MockMemory();
    const agent = new Agent({
      id: 'abort-agent',
      name: 'Abort Agent',
      instructions: 'You are helpful.',
      model: new MockLanguageModelV2({
        doGenerate: async () => ({
          rawCall: { rawPrompt: null, rawSettings: {} },
          finishReason: 'stop' as const,
          usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
          content: [{ type: 'text' as const, text: 'response' }],
          warnings: [],
        }),
        doStream: async () => {
          await new Promise(resolve => setTimeout(resolve, 100));
          return {
            rawCall: { rawPrompt: null, rawSettings: {} },
            warnings: [],
            stream: convertArrayToReadableStream([
              { type: 'stream-start', warnings: [] },
              { type: 'text-start', id: 'text-1' },
              { type: 'text-delta', id: 'text-1', delta: 'slow' },
              { type: 'text-end', id: 'text-1' },
              {
                type: 'finish',
                finishReason: 'stop' as const,
                usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
              },
            ]),
          };
        },
      }),
      memory: mockMemory,
    });

    const op = agent.send({
      messages: 'Hello',
      threadId: 'thread-1',
      resourceId: 'user-1',
    });

    setTimeout(() => op.abort(), 10);

    const events: AgentEvent[] = [];
    for await (const event of op.events) {
      events.push(event);
    }

    const eventTypes = events.map(e => e.type);
    expect(eventTypes).toContain('send_start');
    expect(eventTypes).toContain('send_end');
    const sendEnd = events.find(e => e.type === 'send_end');
    if (sendEnd && sendEnd.type === 'send_end') {
      expect(sendEnd.reason).toBe('aborted');
    }
  });

  it('emits error event when stream contains an error chunk', async () => {
    const mockMemory = new MockMemory();
    const agent = new Agent({
      id: 'error-agent',
      name: 'Error Agent',
      instructions: 'You are helpful.',
      model: new MockLanguageModelV2({
        doGenerate: async () => ({
          rawCall: { rawPrompt: null, rawSettings: {} },
          finishReason: 'stop' as const,
          usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
          content: [{ type: 'text' as const, text: '' }],
          warnings: [],
        }),
        doStream: async () => ({
          rawCall: { rawPrompt: null, rawSettings: {} },
          warnings: [],
          stream: convertArrayToReadableStream([
            { type: 'stream-start', warnings: [] },
            { type: 'error', error: new Error('Stream error') },
            {
              type: 'finish',
              finishReason: 'error' as const,
              usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
            },
          ]),
        }),
      }),
      memory: mockMemory,
    });

    const op = agent.send({
      messages: 'Hello',
      threadId: 'thread-1',
      resourceId: 'user-1',
    });

    const events: AgentEvent[] = [];
    for await (const event of op.events) {
      events.push(event);
    }

    const eventTypes = events.map(e => e.type);
    expect(eventTypes).toContain('send_start');
    expect(eventTypes).toContain('error');
    expect(eventTypes).toContain('send_end');

    const errorEvent = events.find(e => e.type === 'error');
    if (errorEvent && errorEvent.type === 'error') {
      expect(errorEvent.error.message).toBe('Stream error');
    }
  });

  it('emits usage_update event with token counts', async () => {
    const mockMemory = new MockMemory();
    const agent = new Agent({
      id: 'usage-agent',
      name: 'Usage Agent',
      instructions: 'You are helpful.',
      model: createV2StreamModel('Token test'),
      memory: mockMemory,
    });

    const op = agent.send({
      messages: 'Hello',
      threadId: 'thread-1',
      resourceId: 'user-1',
    });

    const events: AgentEvent[] = [];
    for await (const event of op.events) {
      events.push(event);
    }

    const usageEvents = events.filter(e => e.type === 'usage_update');
    expect(usageEvents.length).toBeGreaterThanOrEqual(1);

    const usage = usageEvents[0]!;
    if (usage.type === 'usage_update') {
      expect(usage.usage.totalTokens).toBeGreaterThan(0);
    }
  });

  it('concurrent sends have isolated event streams', async () => {
    const mockMemory = new MockMemory();
    const agent = new Agent({
      id: 'concurrent-agent',
      name: 'Concurrent Agent',
      instructions: 'You are helpful.',
      model: createV2StreamModel('Response'),
      memory: mockMemory,
    });

    const op1 = agent.send({ messages: 'First', threadId: 't-1', resourceId: 'u-1' });
    const op2 = agent.send({ messages: 'Second', threadId: 't-2', resourceId: 'u-2' });

    const events1: AgentEvent[] = [];
    const events2: AgentEvent[] = [];

    await Promise.all([
      (async () => {
        for await (const e of op1.events) events1.push(e);
      })(),
      (async () => {
        for await (const e of op2.events) events2.push(e);
      })(),
    ]);

    expect(events1.some(e => e.type === 'send_start')).toBe(true);
    expect(events2.some(e => e.type === 'send_start')).toBe(true);
    expect(events1.some(e => e.type === 'send_end')).toBe(true);
    expect(events2.some(e => e.type === 'send_end')).toBe(true);
  });
});
