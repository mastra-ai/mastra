import { randomUUID } from 'node:crypto';
import type { MastraDBMessage } from '@mastra/core/agent';
import type { MastraMemory } from '@mastra/core/memory';

export interface VoiceThreadArgs {
  memory: MastraMemory;
  threadId: string;
  resourceId: string;
}

/**
 * Creates the call's memory thread up front when it doesn't exist yet, titled and tagged
 * so it reads as a voice call in Studio's thread list instead of an untitled thread that
 * only appears after the first exchange.
 */
export async function ensureVoiceCallThread({
  memory,
  threadId,
  resourceId,
  roomName,
}: VoiceThreadArgs & { roomName: string }): Promise<void> {
  const existing = await memory.getThreadById({ threadId });
  if (existing) return;
  await memory.createThread({
    threadId,
    resourceId,
    title: 'Voice call',
    metadata: { source: 'livekit', roomName },
  });
}

/**
 * Persists the spoken greeting as an assistant message. The greeting is spoken via TTS
 * without going through the Mastra agent, so without this the saved thread would start
 * at the caller's first words instead of being a faithful call transcript.
 */
export async function persistSpokenGreeting({
  memory,
  threadId,
  resourceId,
  greeting,
}: VoiceThreadArgs & { greeting: string }): Promise<void> {
  const message: MastraDBMessage = {
    id: randomUUID(),
    role: 'assistant',
    type: 'text',
    createdAt: new Date(),
    threadId,
    resourceId,
    content: {
      format: 2,
      parts: [{ type: 'text', text: greeting }],
      metadata: { source: 'voice', kind: 'greeting' },
    },
  };
  await memory.saveMessages({ messages: [message] });
}
