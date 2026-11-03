import { MockLanguageModelV2 } from '@internal/ai-sdk-v5/test';
import { initializeLogger, llm, voice } from '@livekit/agents';
import type { JobContext } from '@livekit/agents';
import { Agent } from '@mastra/core/agent';
import { Mastra } from '@mastra/core/mastra';
import { LibSQLStore } from '@mastra/libsql';
import { Memory } from '@mastra/memory';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { createLiveKitWorker } from './worker';
import type { CreateLiveKitWorkerOptions, SessionStartArgs } from './worker';

beforeAll(() => initializeLogger({ level: 'silent', pretty: false }));
const cleanups: Array<() => Promise<unknown>> = [];
afterEach(async () => {
  for (const cleanup of cleanups.splice(0).reverse()) await cleanup();
  vi.restoreAllMocks();
});

async function runWorker(options: Partial<CreateLiveKitWorkerOptions> = {}) {
  const storage = new LibSQLStore({ id: crypto.randomUUID(), url: ':memory:' });
  cleanups.push(() => storage.close());
  const memory = new Memory({ storage, options: { semanticRecall: false } });
  const agent = new Agent({
    id: 'support',
    name: 'Support',
    instructions: 'Help.',
    memory,
    model: new MockLanguageModelV2(),
  });
  const mastra = new Mastra({ agents: { support: agent }, storage, logger: false });
  const callbacks: Array<() => Promise<void>> = [];
  const ctx = {
    job: { id: 'job', metadata: JSON.stringify({ agentId: 'support', threadId: 'thread', resourceId: 'caller' }) },
    room: { name: 'room' },
    proc: { userData: {} },
    connect: vi.fn(async () => {}),
    addShutdownCallback: (callback: () => Promise<void>) => callbacks.push(callback),
  } as unknown as JobContext;
  const onSessionStart = vi.fn<(args: SessionStartArgs) => void>();
  const onCallEnd = vi.fn();
  vi.spyOn(voice.AgentSession.prototype, 'start').mockImplementation(async function (this: voice.AgentSession) {
    expect(this.listenerCount(voice.AgentSessionEventTypes.ConversationItemAdded)).toBe(1);
  });
  const say = vi
    .spyOn(voice.AgentSession.prototype, 'say')
    .mockImplementation(function (this: voice.AgentSession, _text, sayOptions) {
      if (sayOptions?.addToChatCtx !== false) {
        const item = llm.ChatMessage.create({
          id: 'greeting',
          role: 'assistant',
          content: 'Partial greeting',
          interrupted: true,
        });
        this.emit(voice.AgentSessionEventTypes.ConversationItemAdded, {
          type: voice.AgentSessionEventTypes.ConversationItemAdded,
          item,
          createdAt: Date.now(),
        });
      }
      return { waitForPlayout: async () => {} } as voice.SpeechHandle;
    });
  await createLiveKitWorker({
    mastra,
    vad: false,
    observability: false,
    turnDetection: 'manual',
    transcriptPersistence: 'memory',
    greeting: 'Full greeting that may be interrupted',
    onSessionStart,
    onCallEnd,
    ...options,
  }).entry(ctx);
  const session = onSessionStart.mock.calls[0]![0].session;
  cleanups.push(() => session.close());
  return { memory, onSessionStart, onCallEnd, callbacks, session, say };
}

describe('worker managed transcript lifecycle', () => {
  it('saves the native greeting once and flushes final items before onCallEnd', async () => {
    const f = await runWorker();
    vi.spyOn(f.session, 'close').mockImplementationOnce(async () => {
      const item = llm.ChatMessage.create({
        id: 'final',
        role: 'assistant',
        content: 'Final partial reply',
        interrupted: true,
      });
      f.session.emit(voice.AgentSessionEventTypes.ConversationItemAdded, {
        type: voice.AgentSessionEventTypes.ConversationItemAdded,
        item,
        createdAt: Date.now(),
      });
    });
    // LiveKit runs shutdown callbacks concurrently; the completion hook must await the shared drain.
    await Promise.all(f.callbacks.map(callback => callback()));
    const rows = (await f.memory.recall({ threadId: 'thread', resourceId: 'caller' })).messages;
    expect(rows).toHaveLength(2);
    expect(JSON.stringify(rows)).not.toContain('Full greeting');
    expect(f.onCallEnd).toHaveBeenCalledWith(
      expect.objectContaining({ transcriptPersistence: { saved: 2, failed: 0, pending: 0 } }),
    );
    expect(f.onSessionStart.mock.calls[0]![0].agent.memory).toMatchObject({ options: { readOnly: true } });
  });

  it('honors explicit greeting opt-out through native addToChatCtx', async () => {
    const f = await runWorker({ configuration: { greeting: { persist: false } } });
    await Promise.all(f.callbacks.map(callback => callback()));
    expect(f.say).toHaveBeenCalledWith('Full greeting that may be interrupted', { addToChatCtx: false });
    expect((await f.memory.recall({ threadId: 'thread', resourceId: 'caller' })).messages).toEqual([]);
  });

  it('rejects workflow/custom/disabled memory sources at worker setup', () => {
    const mastra = new Mastra({ logger: false });
    for (const incompatible of [{ generate: async () => null }, { workflow: 'flow' }, { memory: false as const }]) {
      expect(() =>
        createLiveKitWorker({ mastra, vad: false, transcriptPersistence: 'memory', ...incompatible }),
      ).toThrow(/requires a local Mastra agent/);
    }
  });
});
