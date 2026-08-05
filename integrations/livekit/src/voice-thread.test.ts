import type { MastraMemory } from '@mastra/core/memory';
import { describe, expect, it, vi } from 'vitest';
import { ensureVoiceCallThread, persistSpokenGreeting } from './voice-thread';

function fakeMemory(existingThread: unknown = null) {
  const memory = {
    getThreadById: vi.fn(async () => existingThread),
    createThread: vi.fn(async () => ({})),
    saveMessages: vi.fn(async () => ({ messages: [] })),
  };
  return { memory: memory as unknown as MastraMemory, calls: memory };
}

describe('ensureVoiceCallThread', () => {
  it('creates a titled, tagged thread when none exists', async () => {
    const { memory, calls } = fakeMemory();
    await ensureVoiceCallThread({ memory, threadId: 't1', resourceId: 'call-center', roomName: 'room-9' });
    expect(calls.createThread).toHaveBeenCalledWith({
      threadId: 't1',
      resourceId: 'call-center',
      title: 'Voice call',
      metadata: { source: 'livekit', roomName: 'room-9' },
    });
  });

  it('leaves an existing thread untouched', async () => {
    const { memory, calls } = fakeMemory({ id: 't1', title: 'My chat' });
    await ensureVoiceCallThread({ memory, threadId: 't1', resourceId: 'call-center', roomName: 'room-9' });
    expect(calls.createThread).not.toHaveBeenCalled();
  });
});

describe('persistSpokenGreeting', () => {
  it('saves the greeting as a tagged assistant message', async () => {
    const { memory, calls } = fakeMemory();
    await persistSpokenGreeting({ memory, threadId: 't1', resourceId: 'call-center', greeting: 'Hi there!' });
    expect(calls.saveMessages).toHaveBeenCalledTimes(1);
    const [{ messages }] = calls.saveMessages.mock.calls[0]! as [{ messages: Array<Record<string, unknown>> }];
    expect(messages).toHaveLength(1);
    expect(messages[0]).toMatchObject({
      role: 'assistant',
      threadId: 't1',
      resourceId: 'call-center',
      content: {
        format: 2,
        parts: [{ type: 'text', text: 'Hi there!' }],
        metadata: { source: 'voice', kind: 'greeting' },
      },
    });
  });
});
