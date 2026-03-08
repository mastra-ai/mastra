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
  it('subscribe receives events and returns unsubscribe function', async () => {
    const mockMemory = new MockMemory();
    const agent = new Agent({
      id: 'test-agent',
      name: 'Test Agent',
      instructions: 'You are helpful.',
      model: createV2StreamModel(),
      memory: mockMemory,
    });

    const events: AgentEvent[] = [];
    const unsub = agent.subscribe(event => events.push(event));

    const op = agent.send({ messages: 'hi', threadId: 't1', resourceId: 'r1' });
    await op.result;

    expect(events.length).toBeGreaterThan(0);

    const countBefore = events.length;
    unsub();

    const op2 = agent.send({ messages: 'hi again', threadId: 't1', resourceId: 'r1' });
    await op2.result;

    expect(events.length).toBe(countBefore);
  });

  it('on() filters by event type', async () => {
    const mockMemory = new MockMemory();
    const agent = new Agent({
      id: 'test-agent',
      name: 'Test Agent',
      instructions: 'You are helpful.',
      model: createV2StreamModel(),
      memory: mockMemory,
    });

    const sendEvents: AgentEvent[] = [];
    agent.on('send_start', event => sendEvents.push(event));

    const op = agent.send({ messages: 'hi', threadId: 't1', resourceId: 'r1' });
    await op.result;

    expect(sendEvents).toHaveLength(1);
    expect(sendEvents[0]!.type).toBe('send_start');
  });

  it('listener errors do not propagate', async () => {
    const mockMemory = new MockMemory();
    const agent = new Agent({
      id: 'test-agent',
      name: 'Test Agent',
      instructions: 'You are helpful.',
      model: createV2StreamModel(),
      memory: mockMemory,
    });

    const events: AgentEvent[] = [];
    agent.subscribe(() => {
      throw new Error('boom');
    });
    agent.subscribe(event => events.push(event));

    const op = agent.send({ messages: 'hi', threadId: 't1', resourceId: 'r1' });
    await op.result;

    expect(events.length).toBeGreaterThan(0);
  });
});

describe('Agent Harness Config', () => {
  it('hasModes returns false when no harness configured', () => {
    const agent = new Agent({
      id: 'test-agent',
      name: 'Test Agent',
      instructions: 'You are helpful.',
      model: createDummyModel(),
    });

    expect(agent.hasModes()).toBe(false);
    expect(agent.listModes()).toEqual([]);
    expect(agent.getDefaultMode()).toBeUndefined();
  });

  it('hasModes returns true when harness has modes', () => {
    const agent = new Agent({
      id: 'test-agent',
      name: 'Test Agent',
      instructions: 'You are helpful.',
      model: createDummyModel(),
      harness: {
        modes: [
          { id: 'plan', name: 'Plan', default: true },
          { id: 'build', name: 'Build' },
        ],
      },
    });

    expect(agent.hasModes()).toBe(true);
    expect(agent.listModes()).toHaveLength(2);
  });

  it('getDefaultMode returns the mode marked default', () => {
    const agent = new Agent({
      id: 'test-agent',
      name: 'Test Agent',
      instructions: 'You are helpful.',
      model: createDummyModel(),
      harness: {
        modes: [
          { id: 'alpha', name: 'Alpha' },
          { id: 'beta', name: 'Beta', default: true },
        ],
      },
    });

    expect(agent.getDefaultMode()!.id).toBe('beta');
  });

  it('getDefaultMode falls back to first mode', () => {
    const agent = new Agent({
      id: 'test-agent',
      name: 'Test Agent',
      instructions: 'You are helpful.',
      model: createDummyModel(),
      harness: {
        modes: [
          { id: 'first', name: 'First' },
          { id: 'second', name: 'Second' },
        ],
      },
    });

    expect(agent.getDefaultMode()!.id).toBe('first');
  });

  it('listModes returns all configured modes', () => {
    const modes = [
      { id: 'plan', name: 'Plan', default: true as const },
      { id: 'build', name: 'Build' },
      { id: 'review', name: 'Review' },
    ];
    const agent = new Agent({
      id: 'test-agent',
      name: 'Test Agent',
      instructions: 'You are helpful.',
      model: createDummyModel(),
      harness: { modes },
    });

    expect(agent.listModes()).toEqual(modes);
  });

  it('getStateSchema returns the schema from harness config', () => {
    const schema = z.object({ counter: z.number().default(0) });
    const agent = new Agent({
      id: 'test-agent',
      name: 'Test Agent',
      instructions: 'You are helpful.',
      model: createDummyModel(),
      harness: { stateSchema: schema },
    });

    expect(agent.getStateSchema()).toBe(schema);
  });

  it('getStateSchema returns undefined when no harness', () => {
    const agent = new Agent({
      id: 'test-agent',
      name: 'Test Agent',
      instructions: 'You are helpful.',
      model: createDummyModel(),
    });

    expect(agent.getStateSchema()).toBeUndefined();
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
    const textContent = message.content.find(c => c.type === 'text');
    expect(textContent).toBeDefined();
    expect(textContent!.text).toContain('Test response');
  });

  it('accepts modeId per-operation', async () => {
    const mockMemory = new MockMemory();
    const agent = new Agent({
      id: 'mode-agent',
      name: 'Mode Agent',
      instructions: 'You are helpful.',
      model: createV2StreamModel('mode response'),
      memory: mockMemory,
      harness: {
        modes: [
          { id: 'plan', name: 'Plan', default: true },
          { id: 'build', name: 'Build' },
        ],
      },
    });

    const op = agent.send({
      messages: 'Hello',
      threadId: 'thread-1',
      resourceId: 'user-1',
      modeId: 'build',
    });

    const { message } = await op.result;
    expect(message.role).toBe('assistant');
  });

  it('throws for unknown modeId', async () => {
    const mockMemory = new MockMemory();
    const agent = new Agent({
      id: 'mode-agent',
      name: 'Mode Agent',
      instructions: 'You are helpful.',
      model: createV2StreamModel(),
      memory: mockMemory,
      harness: {
        modes: [{ id: 'plan', name: 'Plan' }],
      },
    });

    const op = agent.send({
      messages: 'Hello',
      threadId: 'thread-1',
      resourceId: 'user-1',
      modeId: 'nonexistent',
    });

    const events: AgentEvent[] = [];
    for await (const event of op.events) {
      events.push(event);
    }

    const errorEvent = events.find(e => e.type === 'error');
    expect(errorEvent).toBeDefined();
  });

  it('validates state against harness stateSchema', async () => {
    const mockMemory = new MockMemory();
    const agent = new Agent({
      id: 'state-agent',
      name: 'State Agent',
      instructions: 'You are helpful.',
      model: createV2StreamModel(),
      memory: mockMemory,
      harness: {
        stateSchema: z.object({ counter: z.number() }),
      },
    });

    const op = agent.send({
      messages: 'Hello',
      threadId: 'thread-1',
      resourceId: 'user-1',
      state: { counter: 'not a number' as any },
    });

    const events: AgentEvent[] = [];
    for await (const event of op.events) {
      events.push(event);
    }

    const errorEvent = events.find(e => e.type === 'error');
    expect(errorEvent).toBeDefined();
  });

  it('accepts valid state per-operation', async () => {
    const mockMemory = new MockMemory();
    const agent = new Agent({
      id: 'state-agent',
      name: 'State Agent',
      instructions: 'You are helpful.',
      model: createV2StreamModel(),
      memory: mockMemory,
      harness: {
        stateSchema: z.object({ counter: z.number() }),
      },
    });

    const op = agent.send({
      messages: 'Hello',
      threadId: 'thread-1',
      resourceId: 'user-1',
      state: { counter: 42 },
    });

    const { message } = await op.result;
    expect(message.role).toBe('assistant');
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
