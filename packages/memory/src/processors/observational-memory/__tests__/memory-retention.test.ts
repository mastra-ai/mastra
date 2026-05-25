/**
 * Regression tests for memory retention in ObservationalMemoryProcessor.
 *
 * The root cause: processInputStep() creates `this.turn` on the input processor
 * instance, while processOutputResult() runs on a separate output processor
 * instance. The output instance cannot clear the input instance's private
 * `this.turn`, so the ended turn retains heavy _context.systemMessage strings.
 *
 * The fix: ObservationTurn.dispose() clears _context, _currentStep, writer,
 * requestContext, observabilityContext, actorModelContext, and memory after
 * the turn ends. The processor also clears __omTurn, __omActorModelContext,
 * and __omObservabilityContext from shared processor state.
 */
import { InMemoryMemory, InMemoryDB } from '@mastra/core/storage';
import { describe, it, expect, beforeEach, vi } from 'vitest';

import { ObservationalMemory } from '../observational-memory';
import { ObservationalMemoryProcessor } from '../processor';
import type { MemoryContextProvider } from '../processor';

function createInMemoryStorage(): InMemoryMemory {
  const db = new InMemoryDB();
  return new InMemoryMemory({ db });
}

function createStubMemoryProvider(): MemoryContextProvider {
  return {
    getContext: vi.fn().mockResolvedValue({
      systemMessage: undefined,
      messages: [],
      hasObservations: false,
      omRecord: null,
      continuationMessage: undefined,
      otherThreadsContext: undefined,
    }),
    persistMessages: vi.fn().mockResolvedValue(undefined),
  };
}

/** Create a minimal non-gateway model object. */
function createMockModel() {
  return {
    modelId: 'openai/gpt-4o',
    provider: 'openai',
  };
}

describe('OM processor memory retention', () => {
  let om: ObservationalMemory;
  let inputProcessor: ObservationalMemoryProcessor;
  let outputProcessor: ObservationalMemoryProcessor;
  const threadId = 'test-memory-retention-thread';
  const resourceId = 'test-memory-retention-resource';

  beforeEach(() => {
    const storage = createInMemoryStorage();
    om = new ObservationalMemory({
      storage,
      observation: { messageTokens: 100_000, model: 'test-model' },
      reflection: { observationTokens: 100_000, model: 'test-model' },
      scope: 'thread',
    });
    // Production creates separate instances for input and output processors
    inputProcessor = new ObservationalMemoryProcessor(om, createStubMemoryProvider());
    outputProcessor = new ObservationalMemoryProcessor(om, createStubMemoryProvider());
  });

  it('clears shared state after processOutputResult with split processor instances', async () => {
    const { MessageList } = await import('@mastra/core/agent');
    const { RequestContext } = await import('@mastra/core/di');

    const state: Record<string, unknown> = {};
    const messageList = new MessageList({ threadId, resourceId });

    const requestContext = new RequestContext();
    requestContext.set('MastraMemory', { thread: { id: threadId }, resourceId });

    const model = createMockModel();
    const abort = vi.fn();

    // ── Step 0: Run processInputStep on the INPUT processor ──
    await inputProcessor.processInputStep({
      messageList,
      messages: [],
      requestContext,
      stepNumber: 0,
      state,
      steps: [],
      systemMessages: [],
      model: model as any,
      retryCount: 0,
      abort: abort as any,
      writer: undefined,
    });

    // Verify the input processor created a turn and stored it in shared state
    expect(state.__omTurn).toBeDefined();
    expect(state.__omActorModelContext).toBeDefined();
    expect(state.__omActorModelContext).toEqual({
      provider: 'openai',
      modelId: 'openai/gpt-4o',
    });

    // Add a dummy assistant response so output processor has something to process
    messageList.add(
      {
        id: 'assistant-1',
        role: 'assistant',
        content: { format: 2, parts: [{ type: 'text', text: 'test response' }] },
        createdAt: new Date(),
        threadId,
        resourceId,
      } as any,
      'response',
    );

    // ── Run processOutputResult on the OUTPUT processor ──
    await outputProcessor.processOutputResult({
      messageList,
      messages: messageList.get.response.db(),
      requestContext,
      state,
      abort: abort as any,
      result: {} as any,
      retryCount: 0,
    });

    // ── Verify shared state is cleared ──
    expect(state.__omTurn).toBeUndefined();
    expect(state.__omActorModelContext).toBeUndefined();
    expect(state.__omObservabilityContext).toBeUndefined();
  });

  it('clears input processor turn internal references after end+dispose', async () => {
    const { MessageList } = await import('@mastra/core/agent');
    const { RequestContext } = await import('@mastra/core/di');

    const state: Record<string, unknown> = {};
    const messageList = new MessageList({ threadId, resourceId });

    const requestContext = new RequestContext();
    requestContext.set('MastraMemory', { thread: { id: threadId }, resourceId });

    const model = createMockModel();
    const abort = vi.fn();

    // Run input on the input processor
    await inputProcessor.processInputStep({
      messageList,
      messages: [],
      requestContext,
      stepNumber: 0,
      state,
      steps: [],
      systemMessages: [],
      model: model as any,
      retryCount: 0,
      abort: abort as any,
      writer: undefined,
    });

    expect(state.__omTurn).toBeDefined();

    // Add a dummy assistant response
    messageList.add(
      {
        id: 'assistant-2',
        role: 'assistant',
        content: { format: 2, parts: [{ type: 'text', text: 'test response' }] },
        createdAt: new Date(),
        threadId,
        resourceId,
      } as any,
      'response',
    );

    // Run processOutputResult on the OUTPUT processor (split instances)
    await outputProcessor.processOutputResult({
      messageList,
      messages: messageList.get.response.db(),
      requestContext,
      state,
      abort: abort as any,
      result: {} as any,
      retryCount: 0,
    });

    // Verify state is cleared after output processing
    expect(state.__omTurn).toBeUndefined();
    expect(state.__omActorModelContext).toBeUndefined();

    // The output processor ended the turn via state.__omTurn, but the input
    // processor's `this.turn` still references the same ObservationTurn object.
    // Verify that the turn was disposed: _context, writer, requestContext,
    // observabilityContext, actorModelContext, and memory should all be cleared.
    const inputTurn = (inputProcessor as any).turn;
    expect(inputTurn).toBeDefined();
    expect(inputTurn._context).toBeUndefined();
    expect(inputTurn.writer).toBeUndefined();
    expect(inputTurn.requestContext).toBeUndefined();
    expect(inputTurn.observabilityContext).toBeUndefined();
    expect(inputTurn.actorModelContext).toBeUndefined();
    expect(inputTurn.memory).toBeUndefined();
    expect(inputTurn._ended).toBe(true);
  });
});
