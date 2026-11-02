import { convertArrayToReadableStream, MockLanguageModelV2 } from '@internal/ai-sdk-v5/test';
import { describe, expect, it, vi } from 'vitest';
import { MockMemory } from '../../memory/mock';
import { Agent } from '../agent';

describe('onTitleGenerated callback', () => {
  function createMockModels() {
    const agentModel = new MockLanguageModelV2({
      doGenerate: async () => ({
        rawCall: { rawPrompt: null, rawSettings: {} },
        finishReason: 'stop' as const,
        usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
        content: [{ type: 'text' as const, text: 'Agent response' }],
        warnings: [],
      }),
      doStream: async () => ({
        rawCall: { rawPrompt: null, rawSettings: {} },
        warnings: [],
        stream: convertArrayToReadableStream([
          { type: 'stream-start' as const, warnings: [] },
          { type: 'response-metadata' as const, id: 'id-0', modelId: 'mock-model-id', timestamp: new Date(0) },
          { type: 'text-start' as const, id: 'text-1' },
          { type: 'text-delta' as const, id: 'text-1', delta: 'Agent response' },
          { type: 'text-end' as const, id: 'text-1' },
          {
            type: 'finish' as const,
            finishReason: 'stop' as const,
            usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
          },
        ]),
      }),
    });

    const titleModel = new MockLanguageModelV2({
      doGenerate: async () => ({
        rawCall: { rawPrompt: null, rawSettings: {} },
        finishReason: 'stop' as const,
        usage: { inputTokens: 5, outputTokens: 10, totalTokens: 15 },
        content: [{ type: 'text' as const, text: 'Generated Title' }],
        warnings: [],
      }),
    });

    return { agentModel, titleModel };
  }

  function createAgentWithTitleGen(agentModel: MockLanguageModelV2, titleModel: MockLanguageModelV2) {
    const mockMemory = new MockMemory();
    mockMemory.getMergedThreadConfig = () => ({
      generateTitle: { model: titleModel },
    });

    const agent = new Agent({
      id: 'on-title-gen-test',
      name: 'OnTitleGenerated Test',
      instructions: 'test agent',
      model: agentModel,
      memory: mockMemory,
    });

    return { agent, mockMemory };
  }

  it('should fire onTitleGenerated after title is persisted via generate()', async () => {
    const { agentModel, titleModel } = createMockModels();
    const { agent } = createAgentWithTitleGen(agentModel, titleModel);

    let receivedTitle: string | undefined;

    await agent.generate('Hello', {
      memory: {
        resource: 'user-1',
        thread: { id: 'thread-cb-1', title: '' },
        onTitleGenerated: title => {
          receivedTitle = title;
        },
      },
    });

    // Title generation is fire-and-forget, wait for it
    await new Promise(resolve => setTimeout(resolve, 200));

    expect(receivedTitle).toBe('Generated Title');
  });

  it('should fire onTitleGenerated after title is persisted via stream()', async () => {
    const { agentModel, titleModel } = createMockModels();
    const { agent } = createAgentWithTitleGen(agentModel, titleModel);

    let receivedTitle: string | undefined;

    const result = await agent.stream('Hello', {
      memory: {
        resource: 'user-1',
        thread: { id: 'thread-cb-2', title: '' },
        onTitleGenerated: title => {
          receivedTitle = title;
        },
      },
    });

    // Drain the stream to trigger onFinish
    for await (const _ of result.fullStream) {
      // drain
    }

    // Title generation is fire-and-forget, wait for it
    await new Promise(resolve => setTimeout(resolve, 200));

    expect(receivedTitle).toBe('Generated Title');
  });

  it('should not fire onTitleGenerated when thread already has a title', async () => {
    const { agentModel, titleModel } = createMockModels();
    const { agent } = createAgentWithTitleGen(agentModel, titleModel);

    let callbackFired = false;

    await agent.generate('Hello', {
      memory: {
        resource: 'user-1',
        thread: { id: 'thread-cb-3', title: 'Existing Title' },
        onTitleGenerated: () => {
          callbackFired = true;
        },
      },
    });

    await new Promise(resolve => setTimeout(resolve, 200));

    expect(callbackFired).toBe(false);
  });

  it('should not crash when onTitleGenerated throws', async () => {
    const { agentModel, titleModel } = createMockModels();
    const { agent } = createAgentWithTitleGen(agentModel, titleModel);

    await agent.generate('Hello', {
      memory: {
        resource: 'user-1',
        thread: { id: 'thread-cb-4', title: '' },
        onTitleGenerated: () => {
          throw new Error('Callback error');
        },
      },
    });

    // Should not throw — error is caught in the .catch() handler
    await new Promise(resolve => setTimeout(resolve, 200));
  });

  it('does not re-create a thread deleted while the title was being generated (#25203)', async () => {
    const { agentModel } = createMockModels();
    let releaseTitle!: () => void;
    const titleGate = new Promise<void>(resolve => {
      releaseTitle = resolve;
    });
    let titleRequested!: () => void;
    const titleStarted = new Promise<void>(resolve => {
      titleRequested = resolve;
    });
    const slowTitleModel = new MockLanguageModelV2({
      doGenerate: async () => {
        titleRequested();
        await titleGate;
        return {
          rawCall: { rawPrompt: null, rawSettings: {} },
          finishReason: 'stop' as const,
          usage: { inputTokens: 5, outputTokens: 10, totalTokens: 15 },
          content: [{ type: 'text' as const, text: 'Generated Title' }],
          warnings: [],
        };
      },
    });
    const { agent, mockMemory } = createAgentWithTitleGen(agentModel, slowTitleModel);

    let callbackFired = false;
    let titlePromise: Promise<unknown> | undefined;

    await agent.generate('Hello', {
      memory: {
        resource: 'user-1',
        thread: { id: 'thread-deleted-during-title', title: '' },
        onTitleGenerated: () => {
          callbackFired = true;
        },
      },
      serverless: {
        waitUntil: promise => {
          titlePromise = promise;
        },
      },
    } as any);

    await titleStarted;
    expect(await mockMemory.getThreadById({ threadId: 'thread-deleted-during-title' })).not.toBeNull();

    await mockMemory.deleteThread('thread-deleted-during-title');
    releaseTitle();
    expect(titlePromise).toBeDefined();
    await titlePromise;

    expect(await mockMemory.getThreadById({ threadId: 'thread-deleted-during-title' })).toBeNull();
    expect(callbackFired).toBe(false);
  });

  it('ignores a thread deleted between the existence check and the title update (#25203)', async () => {
    const { agentModel, titleModel } = createMockModels();
    const { agent, mockMemory } = createAgentWithTitleGen(agentModel, titleModel);
    const threadId = 'thread-deleted-before-update';
    const originalUpdate = mockMemory.updateThread.bind(mockMemory);
    vi.spyOn(mockMemory, 'updateThread').mockImplementation(async args => {
      if (args.title === 'Generated Title') await mockMemory.deleteThread(threadId);
      return originalUpdate(args);
    });

    let callbackFired = false;
    let titlePromise: Promise<unknown> | undefined;

    await agent.generate('Hello', {
      memory: {
        resource: 'user-1',
        thread: { id: threadId, title: '' },
        onTitleGenerated: () => {
          callbackFired = true;
        },
      },
      serverless: {
        waitUntil: promise => {
          titlePromise = promise;
        },
      },
    } as any);

    expect(titlePromise).toBeDefined();
    await titlePromise;

    expect(await mockMemory.getThreadById({ threadId })).toBeNull();
    expect(callbackFired).toBe(false);
  });
});

describe('generateTitle.emitEvent', () => {
  function createEmitEventMockModels(delayTitleGeneration = false) {
    // Gate created up front so the release function is valid immediately —
    // doGenerate may not have been entered yet when the test releases it.
    let openTitleGate: (() => void) | undefined;
    const titleGate = new Promise<void>(resolve => {
      openTitleGate = resolve;
    });

    // Resolves once the title model is actually invoked, i.e. the run is inside
    // the finish-time title wait. Tests use it to act deterministically instead
    // of sleeping a fixed amount and hoping the wait was entered.
    let markTitleGenerationStarted: (() => void) | undefined;
    const titleGenerationStarted = new Promise<void>(resolve => {
      markTitleGenerationStarted = resolve;
    });

    const agentModel = new MockLanguageModelV2({
      doGenerate: async () => ({
        rawCall: { rawPrompt: null, rawSettings: {} },
        finishReason: 'stop' as const,
        usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
        content: [{ type: 'text' as const, text: 'Agent response' }],
        warnings: [],
      }),
      doStream: async () => ({
        rawCall: { rawPrompt: null, rawSettings: {} },
        warnings: [],
        stream: convertArrayToReadableStream([
          { type: 'stream-start' as const, warnings: [] },
          { type: 'response-metadata' as const, id: 'id-0', modelId: 'mock-model-id', timestamp: new Date(0) },
          { type: 'text-start' as const, id: 'text-1' },
          { type: 'text-delta' as const, id: 'text-1', delta: 'Agent response' },
          { type: 'text-end' as const, id: 'text-1' },
          {
            type: 'finish' as const,
            finishReason: 'stop' as const,
            usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
          },
        ]),
      }),
    });

    const titleModel = new MockLanguageModelV2({
      doGenerate: async () => {
        markTitleGenerationStarted?.();
        if (delayTitleGeneration) {
          await titleGate;
        }
        return {
          rawCall: { rawPrompt: null, rawSettings: {} },
          finishReason: 'stop' as const,
          usage: { inputTokens: 5, outputTokens: 10, totalTokens: 15 },
          content: [{ type: 'text' as const, text: 'Generated Title' }],
          warnings: [],
        };
      },
    });

    return {
      agentModel,
      titleModel,
      titleGenerationStarted,
      resolveTitleGeneration: () => openTitleGate?.(),
    };
  }

  function createEmitEventAgent(
    agentModel: MockLanguageModelV2,
    titleModel: MockLanguageModelV2,
    generateTitle: unknown,
  ) {
    const mockMemory = new MockMemory();
    mockMemory.getMergedThreadConfig = () => ({ generateTitle }) as any;

    const agent = new Agent({
      id: 'emit-event-test',
      name: 'Emit Event Test',
      instructions: 'test agent',
      model: agentModel,
      memory: mockMemory,
    });

    return { agent, mockMemory };
  }

  async function pollForPersistedTitle(mockMemory: MockMemory, threadId: string, timeoutMs = 2000) {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      const thread = await mockMemory.getThreadById({ threadId });
      if (thread?.title) return thread.title;
      await new Promise(resolve => setTimeout(resolve, 25));
    }
    return undefined;
  }

  it('should not emit data-thread-title when emitEvent is unset (fire-and-forget preserved)', async () => {
    const { agentModel, titleModel } = createEmitEventMockModels();
    const { agent, mockMemory } = createEmitEventAgent(agentModel, titleModel, { model: titleModel });

    const streamResult = await agent.stream('Hello', {
      memory: { resource: 'user-1', thread: { id: 'thread-emit-2', title: '' } },
    });

    const types: string[] = [];
    for await (const chunk of streamResult.fullStream) {
      types.push(chunk?.type);
    }

    expect(types).not.toContain('data-thread-title');
    expect(types).toContain('finish');

    // Title generation still runs fire-and-forget
    const persisted = await pollForPersistedTitle(mockMemory, 'thread-emit-2');
    expect(persisted).toBe('Generated Title');
  });

  it('should release finish immediately when aborted during the title wait, and still persist the title', async () => {
    const { agentModel, titleModel, resolveTitleGeneration, titleGenerationStarted } = createEmitEventMockModels(true);
    const { agent, mockMemory } = createEmitEventAgent(agentModel, titleModel, { model: titleModel, emitEvent: true });

    const abortController = new AbortController();

    const streamResult = await agent.stream('Hello', {
      memory: { resource: 'user-1', thread: { id: 'thread-emit-3', title: '' } },
      abortSignal: abortController.signal,
    });

    const types: string[] = [];
    for await (const chunk of streamResult.fullStream) {
      types.push(chunk?.type);
      // `finish` is being held by the deferred title generation. Wait until the
      // title model has actually been entered (a deterministic signal that the
      // run is inside the title wait), then abort mid-wait. Aborting earlier
      // would race ahead of #executeOnFinish, which map-results-step skips
      // entirely when the signal is already aborted.
      if (chunk?.type === 'step-finish') {
        await titleGenerationStarted;
        abortController.abort();
      }
    }

    expect(types).toContain('finish');
    expect(types).not.toContain('data-thread-title');

    // Title generation continues detached and still persists
    resolveTitleGeneration();
    const persisted = await pollForPersistedTitle(mockMemory, 'thread-emit-3');
    expect(persisted).toBe('Generated Title');
  });

  it('should not wait for the title on generate() even with emitEvent: true', async () => {
    const { agentModel, titleModel, resolveTitleGeneration } = createEmitEventMockModels(true);
    const { agent, mockMemory } = createEmitEventAgent(agentModel, titleModel, { model: titleModel, emitEvent: true });

    // generate() returns JSON — no writer is passed, so the title (whose model
    // is deferred here) must not hold the response.
    await agent.generate('Hello', {
      memory: { resource: 'user-1', thread: { id: 'thread-emit-4', title: '' } },
    });

    const threadBefore = await mockMemory.getThreadById({ threadId: 'thread-emit-4' });
    expect(threadBefore?.title).toBeFalsy();

    resolveTitleGeneration();
    const persisted = await pollForPersistedTitle(mockMemory, 'thread-emit-4');
    expect(persisted).toBe('Generated Title');
  });

  it('should respect the minMessages threshold before emitting', async () => {
    const { agentModel, titleModel } = createEmitEventMockModels();
    const { agent, mockMemory } = createEmitEventAgent(agentModel, titleModel, {
      model: titleModel,
      emitEvent: true,
      minMessages: 3,
    });

    // First turn: two messages in the thread (user + assistant response) — below
    // minMessages: 3, no emission
    const firstTurn = await agent.stream('Hello', {
      memory: { resource: 'user-1', thread: { id: 'thread-emit-5', title: '' } },
    });
    const firstTurnTypes: string[] = [];
    for await (const chunk of firstTurn.fullStream) {
      firstTurnTypes.push(chunk?.type);
    }
    expect(firstTurnTypes).not.toContain('data-thread-title');

    await new Promise(resolve => setTimeout(resolve, 100));
    const threadAfterFirstTurn = await mockMemory.getThreadById({ threadId: 'thread-emit-5' });
    expect(threadAfterFirstTurn?.title).toBeFalsy();

    // Second turn: the thread now has four messages (two per turn) — threshold
    // met, emit before finish
    const secondTurn = await agent.stream('Follow up', {
      memory: { resource: 'user-1', thread: { id: 'thread-emit-5' } },
    });
    const secondTurnChunks: any[] = [];
    for await (const chunk of secondTurn.fullStream) {
      secondTurnChunks.push(chunk);
    }
    const secondTurnTypes = secondTurnChunks.map(chunk => chunk?.type);
    const titleIndex = secondTurnTypes.indexOf('data-thread-title');
    const finishIndex = secondTurnTypes.indexOf('finish');
    expect(titleIndex).toBeGreaterThanOrEqual(0);
    expect(finishIndex).toBeGreaterThan(titleIndex);

    const titleChunk = secondTurnChunks[titleIndex];
    expect(titleChunk.data).toEqual({ threadId: 'thread-emit-5', title: 'Generated Title' });

    const thread = await mockMemory.getThreadById({ threadId: 'thread-emit-5' });
    expect(thread?.title).toBe('Generated Title');
  });
});
