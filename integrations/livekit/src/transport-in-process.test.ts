import type { Agent as MastraAgent } from '@mastra/core/agent';
import type { MastraMemory } from '@mastra/core/memory';
import { describe, expect, it, vi } from 'vitest';
import type { VoiceTurn } from './transport';
import { inProcessTransport } from './transport-in-process';

function fakeAgent(overrides: Partial<Record<keyof MastraAgent, unknown>> = {}) {
  const stream = vi.fn(async () => ({
    fullStream: (async function* () {
      yield { type: 'text-delta', payload: { id: '1', text: 'hi' } };
    })(),
  }));
  return {
    stream,
    hasOwnMemory: () => true,
    getInstructions: vi.fn(async () => 'be helpful'),
    getMemory: vi.fn(async () => null),
    ...overrides,
  } as unknown as MastraAgent;
}

function turn(partial: Partial<VoiceTurn> = {}): VoiceTurn {
  return {
    messages: [{ role: 'user', content: 'hello' }],
    memory: false,
    abortSignal: new AbortController().signal,
    ...partial,
  };
}

describe('inProcessTransport', () => {
  it('forwards messages, memory, requestContext, and abort signal to agent.stream', async () => {
    const agent = fakeAgent();
    const transport = inProcessTransport(agent);
    const abortSignal = new AbortController().signal;
    await transport.stream(
      turn({ messages: [{ role: 'user', content: 'q' }], memory: { thread: 't', resource: 'r' }, abortSignal }),
    );

    const stream = agent.stream as unknown as ReturnType<typeof vi.fn>;
    const [messages, options] = stream.mock.calls[0]!;
    expect(messages).toEqual([{ role: 'user', content: 'q' }]);
    expect(options.memory).toEqual({ thread: 't', resource: 'r' });
    expect(options.abortSignal).toBe(abortSignal);
  });

  it('merges base streamOptions but omits memory when disabled', async () => {
    const agent = fakeAgent();
    const transport = inProcessTransport(agent, { streamOptions: { maxSteps: 3 } as never });
    await transport.stream(turn({ memory: false }));

    const stream = agent.stream as unknown as ReturnType<typeof vi.fn>;
    const [, options] = stream.mock.calls[0]!;
    expect(options.maxSteps).toBe(3);
    expect('memory' in options).toBe(false);
  });

  it('reports memory support from the agent', async () => {
    expect(await inProcessTransport(fakeAgent({ hasOwnMemory: () => true })).supportsMemory?.()).toBe(true);
    expect(await inProcessTransport(fakeAgent({ hasOwnMemory: () => false })).supportsMemory?.()).toBe(false);
  });

  it('resolves instructions and swallows errors', async () => {
    expect(await inProcessTransport(fakeAgent()).getInstructions?.({})).toBe('be helpful');
    const throwing = fakeAgent({ getInstructions: vi.fn(async () => { throw new Error('nope'); }) });
    expect(await inProcessTransport(throwing).getInstructions?.({})).toBeUndefined();
  });

  it('creates the thread and persists the greeting through the agent memory', async () => {
    const memory = {
      getThreadById: vi.fn(async () => null),
      createThread: vi.fn(async () => ({})),
      saveMessages: vi.fn(async () => ({})),
    } as unknown as MastraMemory;
    const agent = fakeAgent({ getMemory: vi.fn(async () => memory) });
    const transport = inProcessTransport(agent);

    await transport.ensureThread?.({ memory: { thread: 't', resource: 'r' }, roomName: 'room-1' });
    expect(memory.createThread).toHaveBeenCalledWith(
      expect.objectContaining({ threadId: 't', resourceId: 'r', metadata: { source: 'livekit', roomName: 'room-1' } }),
    );

    await transport.persistGreeting?.({ memory: { thread: 't', resource: 'r' }, greeting: 'Hello there' });
    const [{ messages }] = (memory.saveMessages as unknown as ReturnType<typeof vi.fn>).mock.calls[0]!;
    expect(messages[0]).toMatchObject({ role: 'assistant', threadId: 't', resourceId: 'r' });
  });

  it('no-ops thread/greeting helpers when the agent has no memory', async () => {
    const transport = inProcessTransport(fakeAgent({ getMemory: vi.fn(async () => null) }));
    await expect(transport.ensureThread?.({ memory: { thread: 't' }, roomName: 'r' })).resolves.toBeUndefined();
    await expect(transport.persistGreeting?.({ memory: { thread: 't' }, greeting: 'hi' })).resolves.toBeUndefined();
  });
});
