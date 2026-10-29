import { MockLanguageModelV2 } from '@internal/ai-sdk-v5/test';
import type { MastraDBMessage } from '@mastra/core/agent';
import { MessageList } from '@mastra/core/agent';
import { RequestContext } from '@mastra/core/di';
import { InMemoryDB, InMemoryMemory } from '@mastra/core/storage';
import { describe, expect, it, vi } from 'vitest';

import { createObservationEndMarker } from '../markers';
import { ObservationalMemory } from '../observational-memory';
import type { MemoryContextProvider } from '../processor';
import { ObservationalMemoryProcessor } from '../processor';

const threadId = 'thread-recovered';
const resourceId = 'resource-recovered';
const responseId = 'assistant-1';

function message(id: string, role: 'user' | 'assistant', text: string, at: string): MastraDBMessage {
  return {
    id,
    role,
    content: { format: 2, parts: [{ type: 'text', text }] },
    type: 'text',
    createdAt: new Date(at),
    threadId,
    resourceId,
  };
}

const memoryProvider: MemoryContextProvider = {
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

async function createStorage() {
  const storage = new InMemoryMemory({ db: new InMemoryDB() });
  await storage.saveThread({
    thread: { id: threadId, resourceId, title: 't', createdAt: new Date(), updatedAt: new Date(), metadata: {} },
  });
  return storage;
}

/**
 * Runs the first input step of a turn whose response message id is `responseId`,
 * with the stored record's observedMessageIds replaced by `observedMessageIds`.
 */
async function runRecoveredStep(observedMessageIds: unknown) {
  return runStepOnStorage(await createStorage(), { observedMessageIds });
}

function addFixtureMessages(om: ObservationalMemory, messageList: MessageList, marking?: 'sealed' | 'end-marker') {
  messageList.add(message('user-1', 'user', 'hello', '2025-01-01T08:00:00.000Z'), 'input');
  const response = message(responseId, 'assistant', 'partial answer', '2025-01-01T08:00:01.000Z');
  // What the dead worker persisted on the message: the seal buffering sets before the
  // Observer runs, or the end marker sync observation writes before it may reflect.
  if (marking === 'sealed') om.sealMessagesForBuffering([response]);
  if (marking === 'end-marker') {
    response.content.parts.push(
      createObservationEndMarker({
        cycleId: 'cycle-1',
        operationType: 'observation',
        startedAt: '2025-01-01T08:00:01.000Z',
        tokensObserved: 50,
        observationTokens: 5,
        recordId: 'record',
        threadId,
      }) as any,
    );
  }
  messageList.add(response, 'response');
}

/**
 * Runs the first input step of a turn, as a worker recovering it would: the response message
 * `responseId` is already in the list. Without `override`, the record is read as stored.
 */
async function runStepOnStorage(
  storage: InMemoryMemory,
  override?: { observedMessageIds: unknown },
  prepare?: (om: ObservationalMemory, recordId: string) => Promise<void>,
  options: { response?: 'sealed' | 'end-marker'; stored?: boolean } = {},
) {
  const model = new MockLanguageModelV2({
    doGenerate: async () => ({
      rawCall: { rawPrompt: null, rawSettings: {} },
      finishReason: 'stop' as const,
      usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
      content: [{ type: 'text' as const, text: 'ok' }],
      warnings: [],
    }),
  });

  const om = new ObservationalMemory({
    storage,
    scope: 'thread',
    model: model as any,
    observation: { messageTokens: 500_000 },
    reflection: { observationTokens: 500_000 },
  });

  const stored = await om.getOrCreateRecord(threadId, resourceId);
  await prepare?.(om, stored.id);
  if (override) {
    const getObservationalMemory = storage.getObservationalMemory.bind(storage);
    vi.spyOn(storage, 'getObservationalMemory').mockImplementation(async (...args) => {
      const record = await getObservationalMemory(...args);
      return record ? { ...record, observedMessageIds: override.observedMessageIds as any } : record;
    });
  }

  const processor = new ObservationalMemoryProcessor(om, memoryProvider);
  const messageList = new MessageList({ threadId, resourceId });
  if (options.stored) {
    // Recover from what the dead worker persisted.
    const { messages } = await storage.listMessages({ threadId });
    messageList.add(messages, 'memory');
  } else {
    addFixtureMessages(om, messageList, options.response);
  }

  const requestContext = new RequestContext();
  requestContext.set('MastraMemory', { thread: { id: threadId }, resourceId });

  const rotateResponseMessageId = vi.fn(() => 'assistant-rotated');
  await processor.processInputStep({
    messageList,
    messages: [],
    requestContext,
    stepNumber: 1,
    state: {},
    steps: [],
    systemMessages: [],
    model: model as any,
    retryCount: 0,
    messageId: responseId,
    rotateResponseMessageId,
    abort: (() => {
      throw new Error('aborted');
    }) as any,
  } as any);

  return { rotateResponseMessageId };
}

describe('recovered OM turn with a non-array observedMessageIds', () => {
  it('rotates the response id when the stored array lists it (control)', async () => {
    const { rotateResponseMessageId } = await runRecoveredStep([responseId]);
    expect(rotateResponseMessageId).toHaveBeenCalledTimes(1);
  });

  it('does not throw or rotate when observedMessageIds is an object', async () => {
    const { rotateResponseMessageId } = await runRecoveredStep({ 0: responseId });
    expect(rotateResponseMessageId).not.toHaveBeenCalled();
  });

  it('does not treat a string as a list and substring-match the response id', async () => {
    const { rotateResponseMessageId } = await runRecoveredStep(`["${responseId}-other"]`);
    expect(rotateResponseMessageId).not.toHaveBeenCalled();
  });
});

describe('recovered OM turn whose response was observed by the dead worker', () => {
  it('does not rotate a response nobody observed or sealed', async () => {
    const { rotateResponseMessageId } = await runStepOnStorage(await createStorage());
    expect(rotateResponseMessageId).not.toHaveBeenCalled();
  });

  it('rotates the response id when the response was observed through buffered activation', async () => {
    const storage = await createStorage();
    const { rotateResponseMessageId } = await runStepOnStorage(
      storage,
      undefined,
      async (_om, recordId) => {
        // The dead worker buffered a chunk covering the response, then activated it.
        await storage.updateBufferedObservations({
          id: recordId,
          chunk: {
            cycleId: 'cycle-1',
            observations: '- user said hello',
            tokenCount: 5,
            messageIds: ['user-1', responseId],
            messageTokens: 50,
            lastObservedAt: new Date('2025-01-01T08:00:01.001Z'),
          },
        });
        const activation = await storage.swapBufferedToActive({
          id: recordId,
          activationRatio: 1,
          messageTokensThreshold: 50,
          currentPendingTokens: 50,
        });
        expect(activation.activatedMessageIds).toContain(responseId);
      },
      { response: 'sealed' },
    );

    expect(rotateResponseMessageId).toHaveBeenCalledTimes(1);
  });

  it('rotates the response id when a reflection ran after the response was observed', async () => {
    const storage = await createStorage();
    const { rotateResponseMessageId } = await runStepOnStorage(
      storage,
      undefined,
      async (_om, recordId) => {
        // The dead worker observed the response, then a reflection rolled the record over.
        await storage.updateActiveObservations({
          id: recordId,
          observations: '- user said hello',
          tokenCount: 5,
          lastObservedAt: new Date('2025-01-01T08:00:01.001Z'),
          observedMessageIds: ['user-1', responseId],
        });
        const current = (await storage.getObservationalMemory(threadId, resourceId))!;
        const next = await storage.createReflectionGeneration({
          currentRecord: current,
          reflection: '- greeting',
          tokenCount: 2,
        });
        expect(next.id).not.toBe(recordId);
      },
      { response: 'end-marker' },
    );

    expect(rotateResponseMessageId).toHaveBeenCalledTimes(1);
  });

  it('rotates the response id after a real sync observation that reflected', async () => {
    const storage = await createStorage();
    // The dead worker stored the turn, observed it synchronously, and the cycle reflected.
    await storage.saveMessages({
      messages: [
        message('user-1', 'user', 'hello', '2025-01-01T08:00:00.000Z'),
        message(responseId, 'assistant', 'partial answer', '2025-01-01T08:00:01.000Z'),
      ],
    });
    const dead = new ObservationalMemory({
      storage,
      scope: 'thread',
      model: 'openai/gpt-4o-mini',
      observation: { messageTokens: 1, bufferTokens: false },
      reflection: { observationTokens: 1 },
    });
    vi.spyOn(dead.observer, 'call').mockResolvedValue({ observations: '- user said hello '.repeat(20) } as any);
    vi.spyOn(dead.reflector, 'call').mockResolvedValue({ observations: '- greeting' } as any);
    const { messages: stored } = await storage.listMessages({ threadId });
    const observed = await dead.observe({ threadId, resourceId, messages: stored, force: true });
    expect(observed).toMatchObject({ observed: true, reflected: true });
    expect(observed.record.observedMessageIds ?? []).not.toContain(responseId);

    const { rotateResponseMessageId } = await runStepOnStorage(storage, undefined, undefined, { stored: true });
    expect(rotateResponseMessageId).toHaveBeenCalledTimes(1);
  });

  it('rotates on a second recovery after a reflection dropped the ids the first recovery used', async () => {
    const storage = await createStorage();
    await storage.saveMessages({
      messages: [
        message('user-1', 'user', 'hello', '2025-01-01T08:00:00.000Z'),
        message(responseId, 'assistant', 'partial answer', '2025-01-01T08:00:01.000Z'),
      ],
    });
    // The first dead worker committed an observation of the response, but neither its seal
    // nor its end marker reached storage.
    const om = new ObservationalMemory({ storage, scope: 'thread', model: 'openai/gpt-4o-mini' });
    const record = await om.getOrCreateRecord(threadId, resourceId);
    await storage.updateActiveObservations({
      id: record.id,
      observations: '- user said hello',
      tokenCount: 5,
      lastObservedAt: new Date('2025-01-01T08:00:01.001Z'),
      observedMessageIds: ['user-1', responseId],
    });

    const first = await runStepOnStorage(storage, undefined, undefined, { stored: true });
    expect(first.rotateResponseMessageId).toHaveBeenCalledTimes(1);
    // Only the seal flag is written; the stored parts are untouched.
    const [stored] = (await storage.listMessagesById({ messageIds: [responseId] })).messages;
    expect(stored!.content.metadata).toMatchObject({ mastra: { sealed: true } });
    expect(stored!.content.parts).toEqual([{ type: 'text', text: 'partial answer' }]);

    // The recovering worker dies too, and a reflection rolls the record over first.
    const current = (await storage.getObservationalMemory(threadId, resourceId))!;
    await storage.createReflectionGeneration({ currentRecord: current, reflection: '- greeting', tokenCount: 2 });

    const second = await runStepOnStorage(storage, undefined, undefined, { stored: true });
    expect(second.rotateResponseMessageId).toHaveBeenCalledTimes(1);
  });

  it('fails the recovery step instead of rotating when the seal cannot be stored', async () => {
    const storage = await createStorage();
    await storage.saveMessages({
      messages: [
        message('user-1', 'user', 'hello', '2025-01-01T08:00:00.000Z'),
        message(responseId, 'assistant', 'partial answer', '2025-01-01T08:00:01.000Z'),
      ],
    });
    const om = new ObservationalMemory({ storage, scope: 'thread', model: 'openai/gpt-4o-mini' });
    const record = await om.getOrCreateRecord(threadId, resourceId);
    await storage.updateActiveObservations({
      id: record.id,
      observations: '- user said hello',
      tokenCount: 5,
      lastObservedAt: new Date('2025-01-01T08:00:01.001Z'),
      observedMessageIds: ['user-1', responseId],
    });

    vi.spyOn(storage, 'updateMessages').mockRejectedValueOnce(new Error('storage unavailable'));
    await expect(runStepOnStorage(storage, undefined, undefined, { stored: true })).rejects.toThrow(
      'storage unavailable',
    );

    // The retried step stores the seal, so it survives a reflection.
    const retried = await runStepOnStorage(storage, undefined, undefined, { stored: true });
    expect(retried.rotateResponseMessageId).toHaveBeenCalledTimes(1);
    const current = (await storage.getObservationalMemory(threadId, resourceId))!;
    await storage.createReflectionGeneration({ currentRecord: current, reflection: '- greeting', tokenCount: 2 });
    const afterReflection = await runStepOnStorage(storage, undefined, undefined, { stored: true });
    expect(afterReflection.rotateResponseMessageId).toHaveBeenCalledTimes(1);
  });
});
