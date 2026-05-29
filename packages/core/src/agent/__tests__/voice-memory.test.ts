import { MockLanguageModelV2 } from '@internal/ai-sdk-v5/test';
import { describe, expect, it, vi } from 'vitest';
import { MockMemory } from '../../memory/mock';
import { MockStore } from '../../storage/mock';
import type { MastraVoice, VoiceTurnEvent } from '../../voice';
import { Agent } from '../agent';

function createMockVoice(): MastraVoice & {
  emitTurn: (turn: VoiceTurnEvent) => void;
} {
  const listeners = new Map<string, Set<(data: unknown) => void>>();

  return {
    addTools: vi.fn(),
    addInstructions: vi.fn(),
    speak: vi.fn(),
    listen: vi.fn(),
    updateConfig: vi.fn(),
    connect: vi.fn(),
    send: vi.fn(),
    answer: vi.fn(),
    close: vi.fn(),
    getSpeakers: vi.fn().mockResolvedValue([]),
    getListener: vi.fn().mockResolvedValue({ enabled: false }),
    serializeForSpan: vi.fn().mockReturnValue({ component: 'VOICE' }),
    on: vi.fn((event: string, callback: (data: unknown) => void) => {
      if (!listeners.has(event)) {
        listeners.set(event, new Set());
      }
      listeners.get(event)!.add(callback);
    }),
    off: vi.fn((event: string, callback: (data: unknown) => void) => {
      listeners.get(event)?.delete(callback);
    }),
    emitTurn: (turn: VoiceTurnEvent) => {
      for (const callback of listeners.get('turn') ?? []) {
        callback(turn);
      }
    },
  } as MastraVoice & { emitTurn: (turn: VoiceTurnEvent) => void };
}

describe('Agent voice memory persistence', () => {
  it('persists completed voice turns when memory scope is provided', async () => {
    const mockVoice = createMockVoice();
    const memoryStore = new MockStore();
    const memory = new MockMemory({ storage: memoryStore });

    const saveMessages = vi.spyOn(memory, 'saveMessages');
    const createThread = vi.spyOn(memory, 'createThread');

    const agent = new Agent({
      id: 'voice-memory-agent',
      name: 'Voice Memory Agent',
      instructions: 'You are helpful.',
      model: new MockLanguageModelV2({
        doGenerate: async () => ({
          finishReason: 'stop',
          usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
          content: [{ type: 'text', text: 'ok' }],
          warnings: [],
        }),
      }),
      memory,
      voice: mockVoice,
    });

    const voice = await agent.getVoice({
      memory: { thread: 'thread-voice-1', resource: 'user-1' },
    });

    mockVoice.emitTurn({ role: 'user', text: 'Hello from voice' });
    await vi.waitFor(() => expect(saveMessages).toHaveBeenCalled());

    expect(createThread).toHaveBeenCalledWith(
      expect.objectContaining({
        threadId: 'thread-voice-1',
        resourceId: 'user-1',
        saveThread: true,
      }),
    );

    const savedMessages = saveMessages.mock.calls[0]![0].messages;
    expect(savedMessages).toHaveLength(1);
    expect(savedMessages[0]).toMatchObject({
      role: 'user',
      threadId: 'thread-voice-1',
      resourceId: 'user-1',
      content: { format: 2, parts: [{ type: 'text', text: 'Hello from voice' }] },
    });

    mockVoice.emitTurn({ role: 'assistant', text: 'Hi there' });
    await vi.waitFor(() => expect(saveMessages).toHaveBeenCalledTimes(2));

    const assistantMessage = saveMessages.mock.calls[1]![0].messages[0];
    expect(assistantMessage).toMatchObject({
      role: 'assistant',
      threadId: 'thread-voice-1',
      resourceId: 'user-1',
      content: { format: 2, parts: [{ type: 'text', text: 'Hi there' }] },
    });

    expect(voice).toBe(mockVoice);
  });

  it('rebinds persistence when getVoice memory scope changes', async () => {
    const mockVoice = createMockVoice();
    const memory = new MockMemory({ storage: new MockStore() });
    const saveMessages = vi.spyOn(memory, 'saveMessages');

    const agent = new Agent({
      id: 'voice-memory-agent',
      name: 'Voice Memory Agent',
      instructions: 'You are helpful.',
      model: new MockLanguageModelV2({
        doGenerate: async () => ({
          finishReason: 'stop',
          usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
          content: [{ type: 'text', text: 'ok' }],
          warnings: [],
        }),
      }),
      memory,
      voice: mockVoice,
    });

    await agent.getVoice({ memory: { thread: 'thread-a', resource: 'user-1' } });
    mockVoice.emitTurn({ role: 'user', text: 'scope a' });
    await vi.waitFor(() => expect(saveMessages).toHaveBeenCalled());

    await agent.getVoice({ memory: { thread: 'thread-b', resource: 'user-2' } });
    mockVoice.emitTurn({ role: 'user', text: 'scope b' });
    await vi.waitFor(() => expect(saveMessages).toHaveBeenCalledTimes(2));

    expect(saveMessages.mock.calls[1]![0].messages[0]).toMatchObject({
      threadId: 'thread-b',
      resourceId: 'user-2',
      content: { format: 2, parts: [{ type: 'text', text: 'scope b' }] },
    });
  });

  it('requires resource when persisting voice turns', async () => {
    const mockVoice = createMockVoice();
    const memory = new MockMemory();

    const agent = new Agent({
      id: 'voice-memory-agent',
      name: 'Voice Memory Agent',
      instructions: 'You are helpful.',
      model: new MockLanguageModelV2({
        doGenerate: async () => ({
          finishReason: 'stop',
          usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
          content: [{ type: 'text', text: 'ok' }],
          warnings: [],
        }),
      }),
      memory,
      voice: mockVoice,
    });

    await expect(
      agent.getVoice({
        memory: { thread: 'thread-voice-1' },
      }),
    ).rejects.toThrow(/memory\.resource is required/i);
  });
});
