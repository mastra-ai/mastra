/**
 * Gateway Observational Memory ownership tests (#30391).
 *
 * The gateway only serves Observational Memory for a `mastra/` model when the credential
 * is a Gateway project key. Organization keys (`msk-gateway-…`, `mskv2_…`) are served by
 * a gateway without the memory API, so local OM has to keep running for them — otherwise
 * nothing is ever persisted locally and nothing is recalled server-side either.
 *
 * These tests pin both outcomes, the legacy fallback for models that cannot answer the
 * question, and the mid-run transition between two owners.
 */
import type { MastraDBMessage, MastraMessageContentV2 } from '@mastra/core/agent';
import { MessageList } from '@mastra/core/agent';
import { RequestContext } from '@mastra/core/di';
import { InMemoryMemory, InMemoryDB } from '@mastra/core/storage';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ObservationalMemory } from '../observational-memory';
import { ObservationalMemoryProcessor } from '../processor';
import type { MemoryContextProvider } from '../processor';

const threadId = 'test-thread';
const resourceId = 'test-resource';

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

function createTestMessage(content: string, role: 'user' | 'assistant', id: string): MastraDBMessage {
  const messageContent: MastraMessageContentV2 = { format: 2, parts: [{ type: 'text', text: content }] };
  return { id, role, content: messageContent, type: 'text', createdAt: new Date(), threadId, resourceId };
}

function createRequestContext(): RequestContext {
  const ctx = new RequestContext();
  ctx.set('MastraMemory', { thread: { id: threadId }, resourceId });
  ctx.set('currentDate', new Date().toISOString());
  return ctx;
}

function createAbort() {
  return ((reason?: string) => {
    throw new Error(reason || 'Aborted');
  }) as (reason?: string) => never;
}

/**
 * A gateway model from an older `@mastra/core`: only `gatewayId` is available, so the
 * processor cannot tell which kind of key the gateway will see.
 */
function createLegacyGatewayModel(gatewayId: string) {
  return {
    gatewayId,
    modelId: 'openai/gpt-4o',
    provider: 'mastra',
    specificationVersion: 'v2' as const,
  };
}

/** A gateway model whose credential the gateway serves memory for (project key). */
function createManagedGatewayModel() {
  return {
    ...createLegacyGatewayModel('mastra'),
    isGatewayMemoryManaged: vi.fn().mockResolvedValue(true),
  };
}

/** A gateway model on a gateway without the memory API (organization key). */
function createLocalMemoryGatewayModel() {
  return {
    ...createLegacyGatewayModel('mastra'),
    isGatewayMemoryManaged: vi.fn().mockResolvedValue(false),
  };
}

describe('ObservationalMemoryProcessor — gateway memory ownership', () => {
  let om: ObservationalMemory;
  let processor: ObservationalMemoryProcessor;

  beforeEach(() => {
    om = new ObservationalMemory({
      storage: new InMemoryMemory({ db: new InMemoryDB() }),
      observation: { messageTokens: 100_000, model: 'test-model' },
      reflection: { observationTokens: 100_000, model: 'test-model' },
      scope: 'thread',
    });
    processor = new ObservationalMemoryProcessor(om, createStubMemoryProvider());
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  function buildInputStepArgs(
    messageList: MessageList,
    state: Record<string, unknown>,
    stepNumber: number,
    model: any,
  ) {
    return {
      messageList,
      messages: messageList.get.all.db(),
      requestContext: createRequestContext(),
      stepNumber,
      state,
      steps: [],
      systemMessages: [],
      model,
      retryCount: 0,
      abort: createAbort(),
      abortSignal: new AbortController().signal,
    } as any;
  }

  function buildOutputResultArgs(messageList: MessageList, state: Record<string, unknown>) {
    return {
      messageList,
      messages: messageList.get.response.db(),
      requestContext: createRequestContext(),
      state,
      result: { text: 'Hello back' } as any,
      retryCount: 0,
      abort: createAbort(),
    } as any;
  }

  function buildConversation() {
    const messageList = new MessageList({ threadId, resourceId });
    messageList.add(createTestMessage('Hello', 'user', 'msg-1'), 'input');
    messageList.add(createTestMessage('Hi there', 'assistant', 'msg-2'), 'response');
    return messageList;
  }

  describe('when the gateway serves memory for the model', () => {
    it('skips local input processing and records the decision', async () => {
      const state: Record<string, unknown> = {};
      const messageList = new MessageList({ threadId, resourceId });
      const getThreadContextSpy = vi.spyOn(om, 'getThreadContext');

      const result = await processor.processInputStep(
        buildInputStepArgs(messageList, state, 0, createManagedGatewayModel()),
      );

      // Unchanged reference: local OM did not touch the list.
      expect(result).toBe(messageList);
      // The thread context is validated before the gateway check.
      expect(getThreadContextSpy).toHaveBeenCalled();
      expect(state.__isGatewayMemoryManaged).toBe(true);
      expect(state.__omTurn).toBeUndefined();
    });

    it('skips local output processing', async () => {
      const messageList = buildConversation();
      const persistSpy = vi.spyOn(om, 'persistMessages');
      const state: Record<string, unknown> = { __isGatewayMemoryManaged: true };

      const result = await processor.processOutputResult(buildOutputResultArgs(messageList, state));

      expect(result).toBe(messageList);
      expect(persistSpy).not.toHaveBeenCalled();
    });

    it('keeps skipping a model that can only report its gateway id', async () => {
      const state: Record<string, unknown> = {};
      const messageList = new MessageList({ threadId, resourceId });

      const result = await processor.processInputStep(
        buildInputStepArgs(messageList, state, 0, createLegacyGatewayModel('mastra')),
      );

      // Older core / plain model: the historical `mastra/` prefix skip is preserved so
      // gateway-side memory is never double-processed.
      expect(result).toBe(messageList);
      expect(state.__isGatewayMemoryManaged).toBe(true);
    });
  });

  describe('when the gateway does not serve memory for the model', () => {
    it('runs local input processing and persists on finalization', async () => {
      const messageList = buildConversation();
      const state: Record<string, unknown> = {};

      const persistSpy = vi.spyOn(om, 'persistMessages');

      const result = await processor.processInputStep(
        buildInputStepArgs(messageList, state, 0, createLocalMemoryGatewayModel()),
      );

      // A local turn was started and the decision was recorded as not gateway-managed,
      // so a later step cannot inherit a stale "gateway handles it" answer.
      expect(result).toBe(messageList);
      expect(state.__isGatewayMemoryManaged).toBe(false);
      expect(state.__omTurn).toBeDefined();

      await processor.processOutputResult(buildOutputResultArgs(messageList, state));

      // The conversation reached storage instead of being dropped.
      expect(persistSpy).toHaveBeenCalledTimes(1);
      const [savedMessages, savedThreadId, savedResourceId] = persistSpy.mock.calls[0]!;
      expect(savedThreadId).toBe(threadId);
      expect(savedResourceId).toBe(resourceId);
      expect(savedMessages.map(message => message.id)).toEqual(['msg-1', 'msg-2']);
    });

    it('treats a throwing ownership check as local', async () => {
      const state: Record<string, unknown> = {};
      const messageList = new MessageList({ threadId, resourceId });
      const throwingModel = {
        ...createLegacyGatewayModel('mastra'),
        isGatewayMemoryManaged: vi.fn().mockRejectedValue(new Error('missing credential')),
      };

      await processor.processInputStep(buildInputStepArgs(messageList, state, 0, throwingModel));

      // An unresolvable credential is not proof the gateway serves memory.
      expect(state.__isGatewayMemoryManaged).toBe(false);
      expect(state.__omTurn).toBeDefined();
    });

    it('does not skip a non-mastra gateway or a plain model', async () => {
      const otherGatewayState: Record<string, unknown> = {};
      await processor.processInputStep(
        buildInputStepArgs(
          new MessageList({ threadId, resourceId }),
          otherGatewayState,
          0,
          createLegacyGatewayModel('netlify'),
        ),
      );
      expect(otherGatewayState.__isGatewayMemoryManaged).toBe(false);

      const plainModelState: Record<string, unknown> = {};
      await processor.processInputStep(
        buildInputStepArgs(new MessageList({ threadId, resourceId }), plainModelState, 0, 'test-model'),
      );
      expect(plainModelState.__isGatewayMemoryManaged).toBe(false);
    });
  });

  describe('when ownership changes mid-run', () => {
    it('finalizes the open local turn before a gateway-managed step returns early', async () => {
      const messageList = buildConversation();
      const state: Record<string, unknown> = {};

      // Step 0: local owner, so a turn is open.
      await processor.processInputStep(buildInputStepArgs(messageList, state, 0, createLocalMemoryGatewayModel()));
      const localTurn = state.__omTurn as { ended: boolean } | undefined;
      expect(localTurn).toBeDefined();
      expect(localTurn!.ended).toBe(false);

      const persistSpy = vi.spyOn(om, 'persistMessages');

      // Step 1: the gateway took over. processOutputResult will short-circuit on this
      // flag, so the turn must be drained here or its messages are never saved.
      await processor.processInputStep(buildInputStepArgs(messageList, state, 1, createManagedGatewayModel()));

      expect(state.__isGatewayMemoryManaged).toBe(true);
      expect(localTurn!.ended).toBe(true);
      expect(state.__omTurn).toBeUndefined();
      expect(persistSpy).toHaveBeenCalledTimes(1);
      expect(persistSpy.mock.calls[0]![0].map(message => message.id)).toEqual(['msg-1', 'msg-2']);

      // Finalization is a no-op now — the turn was already drained, so nothing is
      // written twice and nothing is lost.
      await processor.processOutputResult(buildOutputResultArgs(messageList, state));
      expect(persistSpy).toHaveBeenCalledTimes(1);
    });

    it('drains an open turn during output finalization if the input step did not', async () => {
      const messageList = buildConversation();
      const state: Record<string, unknown> = {};

      await processor.processInputStep(buildInputStepArgs(messageList, state, 0, createLocalMemoryGatewayModel()));

      // Simulate a step that flipped ownership without going through processInputStep
      // (for example a resumed stream): finalization must still not drop the turn.
      state.__isGatewayMemoryManaged = true;

      const persistSpy = vi.spyOn(om, 'persistMessages');
      const result = await processor.processOutputResult(buildOutputResultArgs(messageList, state));

      expect(result).toBe(messageList);
      expect(persistSpy).toHaveBeenCalledTimes(1);
      expect(state.__omTurn).toBeUndefined();
    });
  });
});
