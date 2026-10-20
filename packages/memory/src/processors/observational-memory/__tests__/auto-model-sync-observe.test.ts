/**
 * `'auto'` must follow the step's actor model on the turn's sync observation path.
 *
 * The agentic loop runs input-step processors without an agent, so
 * `mainAgent.getModel()` cannot supply the main model there. Before the fix the
 * step-0 sync observation dropped the captured actor model, and `'auto'` fell
 * back to `google/gemini-2.5-flash` even when Google had no credential.
 */
import { MockLanguageModelV2, convertArrayToReadableStream } from '@internal/ai-sdk-v5/test';
import type { MastraDBMessage } from '@mastra/core/agent';
import { MessageList } from '@mastra/core/agent';
import { RequestContext } from '@mastra/core/di';
import { InMemoryMemory, InMemoryDB } from '@mastra/core/storage';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ObservationalMemory } from '../observational-memory';
import { ObservationalMemoryProcessor } from '../processor';
import type { MemoryContextProvider } from '../processor';

const noopMemoryProvider: MemoryContextProvider = {
  getContext: async () => ({
    systemMessage: undefined,
    messages: [],
    hasObservations: false,
    omRecord: null,
    continuationMessage: undefined,
    otherThreadsContext: undefined,
  }),
  persistMessages: async () => {},
};

function createObserverModel(modelId: string) {
  const text = '<observations>\n* User discussed topic X\n</observations>';
  return new MockLanguageModelV2({
    provider: 'anthropic',
    modelId,
    doStream: async () => ({
      stream: convertArrayToReadableStream([
        { type: 'stream-start', warnings: [] },
        { type: 'text-start', id: 'text-1' },
        { type: 'text-delta', id: 'text-1', delta: text },
        { type: 'text-end', id: 'text-1' },
        { type: 'finish', finishReason: 'stop', usage: { inputTokens: 100, outputTokens: 20, totalTokens: 120 } },
      ]),
      rawCall: { rawPrompt: null, rawSettings: {} },
      warnings: [],
    }),
  });
}

function createMessage(text: string, role: 'user' | 'assistant', id: string, createdAt: Date): MastraDBMessage {
  return { id, role, content: { format: 2, parts: [{ type: 'text', text }] }, type: 'text', createdAt };
}

describe("'auto' model on the turn's sync observation", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('uses the actor model provider instead of falling back to Gemini when Google is unusable', async () => {
    vi.stubEnv('GOOGLE_GENERATIVE_AI_API_KEY', '');
    const threadId = 'auto-sync-thread';
    const resourceId = 'auto-sync-resource';
    const storage = new InMemoryMemory({ db: new InMemoryDB() });
    await storage.saveThread({
      thread: { id: threadId, resourceId, title: 't', createdAt: new Date(), updatedAt: new Date(), metadata: {} },
    });

    const resolveModel = vi.fn(async (modelId: string) => createObserverModel(modelId));
    const om = new ObservationalMemory({
      storage,
      scope: 'thread',
      canUseProvider: providerId => providerId === 'anthropic',
      resolveModel,
      observation: { model: 'auto', messageTokens: 500, bufferTokens: false },
      reflection: { model: 'auto', observationTokens: 50_000 },
    });
    const processor = new ObservationalMemoryProcessor(om, noopMemoryProvider);

    const requestContext = new RequestContext();
    requestContext.set('MastraMemory', { thread: { id: threadId }, resourceId });
    const messageList = new MessageList({ threadId, resourceId });
    for (let i = 0; i < 20; i++) {
      messageList.add(
        createMessage(
          `Step ${i}: `.padEnd(200, 'x'),
          i % 2 === 0 ? 'user' : 'assistant',
          `msg-${i}`,
          new Date(Date.now() - (30 - i) * 1000),
        ),
        'memory',
      );
    }

    const actorModel = Object.assign(createObserverModel('claude-sonnet-4-5'), { id: 'anthropic/claude-sonnet-4-5' });
    // No `agent`: the agentic loop's input-step runner does not pass one.
    await processor.processInputStep({
      messageList,
      messages: messageList.get.all.db(),
      requestContext,
      stepNumber: 0,
      state: {},
      steps: [],
      systemMessages: [],
      model: actorModel as any,
      retryCount: 0,
      abort: ((reason?: string) => {
        throw new Error(reason || 'Aborted');
      }) as (reason?: string) => never,
      abortSignal: new AbortController().signal,
    });

    const pickedModelIds = resolveModel.mock.calls.map(([modelId]) => modelId);
    expect(pickedModelIds).toContain('anthropic/claude-haiku-4-5');
    expect(pickedModelIds.filter(modelId => modelId.startsWith('google/'))).toEqual([]);
    const record = await storage.getObservationalMemory(threadId, resourceId);
    expect(record?.activeObservations).toContain('User discussed topic X');
  });

  it('uses an identity-only currentModel passed to observe() when Google is unusable', async () => {
    vi.stubEnv('GOOGLE_GENERATIVE_AI_API_KEY', '');
    const threadId = 'auto-identity-thread';
    const resourceId = 'auto-identity-resource';
    const storage = new InMemoryMemory({ db: new InMemoryDB() });
    await storage.saveThread({
      thread: { id: threadId, resourceId, title: 't', createdAt: new Date(), updatedAt: new Date(), metadata: {} },
    });

    const resolveModel = vi.fn(async (modelId: string) => createObserverModel(modelId));
    const om = new ObservationalMemory({
      storage,
      scope: 'thread',
      canUseProvider: providerId => providerId === 'anthropic',
      resolveModel,
      observation: { model: 'auto', messageTokens: 500, bufferTokens: false },
      reflection: { model: 'auto', observationTokens: 50_000 },
    });

    const messages = Array.from({ length: 20 }, (_, i) =>
      createMessage(
        `Step ${i}: `.padEnd(200, 'x'),
        i % 2 === 0 ? 'user' : 'assistant',
        `msg-${i}`,
        new Date(Date.now() - (30 - i) * 1000),
      ),
    );

    await om.observe({
      threadId,
      resourceId,
      messages,
      force: true,
      currentModel: { provider: 'anthropic', modelId: 'claude-sonnet-4-5' },
    });

    const pickedModelIds = resolveModel.mock.calls.map(([modelId]) => modelId);
    expect(pickedModelIds).toContain('anthropic/claude-haiku-4-5');
    expect(pickedModelIds.filter(modelId => modelId.startsWith('google/'))).toEqual([]);
    const record = await storage.getObservationalMemory(threadId, resourceId);
    expect(record?.activeObservations).toContain('User discussed topic X');
  });

  it('fails with a clear error instead of picking an unusable Gemini when no main model is known', async () => {
    vi.stubEnv('GOOGLE_GENERATIVE_AI_API_KEY', '');
    const resolveModel = vi.fn(async (modelId: string) => createObserverModel(modelId));
    const om = new ObservationalMemory({
      storage: new InMemoryMemory({ db: new InMemoryDB() }),
      model: 'auto',
      canUseProvider: () => false,
      resolveModel,
    });

    await expect((om as any).resolveObservationModel(1, {})).rejects.toThrow(/could not determine the main model/);
    expect(resolveModel).not.toHaveBeenCalled();
  });
});
