import { MockLanguageModelV2, convertArrayToReadableStream } from '@internal/ai-sdk-v5/test';
import { Agent } from '@mastra/core/agent';
import { RequestContext } from '@mastra/core/request-context';
import { InMemoryStore } from '@mastra/core/storage';
import type { MemoryStorage } from '@mastra/core/storage';
import { describe, expect, it, vi } from 'vitest';

import { OBSERVATIONAL_MEMORY_DEFAULTS } from '../constants';
import { applyExtractorHooks } from '../extracted-values';
import { buildExtractorOutputSections, Extractor } from '../extractor';
import { ModelByInputTokens } from '../model-by-input-tokens';
import { SubconsciousRemindExtractor } from '../subconscious';
import { resolveReminderLaneModel, resolveSubconsciousAgentModel } from '../subconscious/model';
import { createRemindAskTool } from '../subconscious/remind';

function createModel(response: string) {
  return new MockLanguageModelV2({
    doGenerate: async () => ({
      rawCall: { rawPrompt: null, rawSettings: {} },
      finishReason: 'stop',
      usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 },
      warnings: [],
      content: [{ type: 'text', text: response }],
    }),
    doStream: async () => ({
      stream: convertArrayToReadableStream([
        { type: 'stream-start', warnings: [] },
        { type: 'response-metadata', id: 'remind-1', modelId: 'remind-model', timestamp: new Date() },
        { type: 'text-start', id: 'text-1' },
        { type: 'text-delta', id: 'text-1', delta: response },
        { type: 'text-end', id: 'text-1' },
        { type: 'finish', finishReason: 'stop', usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 } },
      ]),
      rawCall: { rawPrompt: null, rawSettings: {} },
      warnings: [],
    }),
  });
}

function createContext(response: string) {
  const requestContext = new RequestContext();
  requestContext.set('organizationId', 'acme');
  const memory = {
    storage: new InMemoryStore(),
    getKnowledgeSemanticIndex: vi.fn(),
  } as any;
  return {
    threadId: 'alpha',
    resourceId: 'user-42',
    mainAgent: { getModel: vi.fn(async () => createModel(response)) } as any,
    memory,
    requestContext,
    sendSignal: vi.fn(async () => undefined) as any,
    sendStateSignal: vi.fn(async () => ({ skipped: false })) as any,
  };
}

describe('Subconscious remind', () => {
  it('runs hook extractors without adding prompt output or requiring a parsed value', async () => {
    const onExtracted = vi.fn();
    const extractor = new Extractor({ name: 'Lifecycle hook', mode: 'hook', onExtracted });

    expect(() => new Extractor({ name: 'Invalid hook', mode: 'hook' })).toThrow(/onExtracted/);
    expect(() => new Extractor({ name: 'Invalid hook', mode: 'hook', instructions: 'Do work.', onExtracted })).toThrow(
      /cannot include instructions or a schema/,
    );
    expect(extractor.mode).toBe('hook');
    expect(extractor.metadataKeyPath).toBe(false);
    expect(buildExtractorOutputSections([extractor])).toBe('');

    await applyExtractorHooks({
      source: 'observer',
      extractors: [extractor],
      rawObservations: 'The user asked about Project Atlas.',
      threadId: 'alpha',
    });

    expect(onExtracted).toHaveBeenCalledOnce();
    expect(onExtracted).toHaveBeenCalledWith(
      expect.objectContaining({
        current: 'The user asked about Project Atlas.',
        rawObservations: 'The user asked about Project Atlas.',
      }),
    );
  });

  it('emits at most one remembered reactive signal for a relevant cycle', async () => {
    const extractor = new SubconsciousRemindExtractor({
      name: 'remind',
      maxSteps: 3,
      builtIn: true,
    });
    const context = createContext('Project Atlas launches January 15.');
    const store = await context.memory.storage.getStore('knowledge');
    const node = await store.createNode({
      name: 'Project Atlas',
      kind: 'project',
      scope: ['org:acme', 'resource:user-42'],
    });
    const item = await store.appendItem({
      parentNodeId: node.id,
      text: 'Project Atlas launches January 15.',
      scope: ['org:acme', 'resource:user-42'],
      sourceThreadId: 'beta',
      resolutionScope: ['org:acme', 'resource:user-42', 'thread:beta'],
      defaultScope: ['org:acme', 'resource:user-42'],
    });
    context.mainAgent.getModel = vi.fn(async () =>
      createModel(`Project Atlas launches January 15. Source: ${item.id}`),
    );

    const result = await applyExtractorHooks({
      source: 'observer',
      extractors: [extractor],
      rawObservations: 'The user is scheduling Project Atlas.',
      ...context,
    });

    expect(result.failures).toBeUndefined();
    expect(context.sendSignal).toHaveBeenCalledOnce();
    expect(context.sendSignal).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'reactive',
        tagName: 'remembered',
        contents: expect.stringContaining(item.id),
        attributes: expect.objectContaining({
          source: 'subconscious',
          sourceIds: expect.stringContaining(item.id),
          agent: 'remind',
          threadId: 'alpha',
        }),
      }),
    );
  });

  it.each(['Project Atlas launches January 15.', 'Project Atlas launches January 15. Source: invented-item-id'])(
    'suppresses an ungrounded reminder: %s',
    async response => {
      const extractor = new SubconsciousRemindExtractor({
        name: 'remind',
        maxSteps: 3,
        builtIn: true,
      });
      const context = createContext(response);
      const store = await context.memory.storage.getStore('knowledge');
      const node = await store.createNode({
        name: 'Project Atlas',
        kind: 'project',
        scope: ['org:acme', 'resource:user-42'],
      });
      await store.appendItem({
        parentNodeId: node.id,
        text: 'Project Atlas launches January 15.',
        scope: ['org:acme', 'resource:user-42'],
        sourceThreadId: 'alpha',
        resolutionScope: ['org:acme', 'resource:user-42', 'thread:alpha'],
        defaultScope: ['org:acme', 'resource:user-42'],
      });

      const result = await applyExtractorHooks({
        source: 'observer',
        extractors: [extractor],
        rawObservations: 'The user is scheduling Project Atlas.',
        ...context,
      });

      expect(result.failures).toBeUndefined();
      expect(context.sendSignal).not.toHaveBeenCalled();
    },
  );

  it('stays quiet when the reminder agent finds nothing relevant', async () => {
    const extractor = new SubconsciousRemindExtractor({
      name: 'remind',
      maxSteps: 3,
      builtIn: true,
    });
    const context = createContext('<no-reminder />');

    await applyExtractorHooks({
      source: 'observer',
      extractors: [extractor],
      rawObservations: 'The user asked about the weather.',
      ...context,
    });

    expect(context.sendSignal).not.toHaveBeenCalled();
  });

  it('runs on the observational memory model when no main agent is available', async () => {
    const itemId = 'item-atlas-launch';
    const extractor = new SubconsciousRemindExtractor(
      { name: 'remind', maxSteps: 3, builtIn: true },
      createModel(`Project Atlas launches January 15. Source KnowledgeItem: ${itemId}.`) as any,
    );
    const context = createContext('unused');
    delete (context as any).mainAgent;
    const store = await context.memory.storage.getStore('knowledge');
    const node = await store.createNode({
      name: 'Project Atlas',
      kind: 'project',
      scope: ['org:acme', 'resource:user-42'],
    });
    const item = await store.appendItem({
      id: itemId,
      parentNodeId: node.id,
      text: 'Project Atlas launches January 15.',
      scope: ['org:acme', 'resource:user-42'],
      sourceThreadId: 'beta',
      resolutionScope: ['org:acme', 'resource:user-42', 'thread:beta'],
      defaultScope: ['org:acme', 'resource:user-42'],
    });

    const result = await applyExtractorHooks({
      source: 'observer',
      extractors: [extractor],
      rawObservations: 'The user is scheduling Project Atlas.',
      ...context,
    });

    expect(result.failures).toBeUndefined();
    expect(context.sendSignal).toHaveBeenCalledOnce();
    expect(context.sendSignal).toHaveBeenCalledWith(
      expect.objectContaining({ tagName: 'remembered', contents: expect.stringContaining(item.id) }),
    );
  });

  it("does not echo the thread's own freshly captured items back as reminders", async () => {
    const extractor = new SubconsciousRemindExtractor({
      name: 'remind',
      maxSteps: 3,
      builtIn: true,
    });
    const context = createContext('The launch happens January 15.');
    const store = await context.memory.storage.getStore('knowledge');
    const node = await store.createNode({
      name: 'Zeta initiative',
      kind: 'program',
      scope: ['org:acme', 'resource:user-42'],
    });
    // Captured by THIS thread, moments ago: the reminder must not whisper it back.
    await store.appendItem({
      parentNodeId: node.id,
      text: 'The launch happens January 15.',
      scope: ['org:acme', 'resource:user-42'],
      sourceThreadId: 'alpha',
      resolutionScope: ['org:acme', 'resource:user-42', 'thread:alpha'],
      defaultScope: ['org:acme', 'resource:user-42'],
    });

    const result = await applyExtractorHooks({
      source: 'observer',
      extractors: [extractor],
      rawObservations: 'The user is scheduling the launch.',
      ...context,
    });

    expect(result.failures).toBeUndefined();
    expect(context.sendSignal).not.toHaveBeenCalled();
  });

  it("does not echo fresh items written by the thread's own subconscious sub-agents", async () => {
    const extractor = new SubconsciousRemindExtractor({
      name: 'remind',
      maxSteps: 3,
      builtIn: true,
    });
    const context = createContext('The launch happens January 15.');
    const store = await context.memory.storage.getStore('knowledge');
    const node = await store.createNode({
      name: 'Zeta initiative',
      kind: 'program',
      scope: ['org:acme', 'resource:user-42'],
    });
    // Written moments ago by this thread's own curator sub-thread.
    await store.appendItem({
      parentNodeId: node.id,
      text: 'The launch happens January 15.',
      scope: ['org:acme', 'resource:user-42'],
      sourceThreadId: 'subconscious:alpha:curate',
      resolutionScope: ['org:acme', 'resource:user-42', 'thread:alpha'],
      defaultScope: ['org:acme', 'resource:user-42'],
    });

    const result = await applyExtractorHooks({
      source: 'observer',
      extractors: [extractor],
      rawObservations: 'The user is scheduling the launch.',
      ...context,
    });

    expect(result.failures).toBeUndefined();
    expect(context.sendSignal).not.toHaveBeenCalled();
  });

  it("still reminds about the thread's own older items once they age past the fresh window", async () => {
    vi.useFakeTimers();
    try {
      const extractor = new SubconsciousRemindExtractor({
        name: 'remind',
        maxSteps: 3,
        builtIn: true,
      });
      const context = createContext('The launch happens January 15.');
      const store = await context.memory.storage.getStore('knowledge');
      const node = await store.createNode({
        name: 'Zeta initiative',
        kind: 'program',
        scope: ['org:acme', 'resource:user-42'],
      });
      const item = await store.appendItem({
        parentNodeId: node.id,
        text: 'The launch happens January 15.',
        scope: ['org:acme', 'resource:user-42'],
        sourceThreadId: 'alpha',
        resolutionScope: ['org:acme', 'resource:user-42', 'thread:alpha'],
        defaultScope: ['org:acme', 'resource:user-42'],
      });
      context.mainAgent.getModel = vi.fn(async () => createModel(`The launch happens January 15. Source: ${item.id}`));

      vi.advanceTimersByTime(31 * 60 * 1000);

      const result = await applyExtractorHooks({
        source: 'observer',
        extractors: [extractor],
        rawObservations: 'The user is scheduling the launch.',
        ...context,
      });

      expect(result.failures).toBeUndefined();
      expect(context.sendSignal).toHaveBeenCalledOnce();
      expect(context.sendSignal).toHaveBeenCalledWith(
        expect.objectContaining({ tagName: 'remembered', contents: expect.stringContaining(item.id) }),
      );
    } finally {
      vi.useRealTimers();
    }
  });

  it('shows the reminder agent the recent messages so it can skip what is already visible', async () => {
    const { Agent } = await import('@mastra/core/agent');
    // The passive path enters the serialized reminder lane via queueMessage, not generate.
    const queueSpy = vi.spyOn(Agent.prototype, 'queueMessage' as any);
    queueSpy.mockClear();
    try {
      const extractor = new SubconsciousRemindExtractor({
        name: 'remind',
        maxSteps: 3,
        builtIn: true,
      });
      const context = createContext('<no-reminder />');
      const store = await context.memory.storage.getStore('knowledge');
      const node = await store.createNode({
        name: 'Moon weather',
        kind: 'topic',
        scope: ['org:acme', 'resource:user-42'],
      });
      await store.appendItem({
        parentNodeId: node.id,
        text: 'The moon has no weather to speak of.',
        scope: ['org:acme', 'resource:user-42'],
        sourceThreadId: 'beta',
        resolutionScope: ['org:acme', 'resource:user-42', 'thread:beta'],
        defaultScope: ['org:acme', 'resource:user-42'],
      });

      await applyExtractorHooks({
        source: 'observer',
        extractors: [extractor],
        rawObservations: 'The user asked about the weather on the moon.',
        recentMessages: 'user: what is the weather like on the moon?',
        ...context,
      });

      expect(queueSpy).toHaveBeenCalledOnce();
      const prompt = queueSpy.mock.calls[0]?.[0] as string;
      expect(prompt).toContain('user: what is the weather like on the moon?');
      expect(prompt).toContain('already visible');
    } finally {
      queueSpy.mockRestore();
    }
  });

  it('stays silent when no main agent and no observational memory model are available', async () => {
    const extractor = new SubconsciousRemindExtractor({ name: 'remind', maxSteps: 3, builtIn: true });
    const context = createContext('unused');
    delete (context as any).mainAgent;

    const result = await applyExtractorHooks({
      source: 'observer',
      extractors: [extractor],
      rawObservations: 'The user is scheduling Project Atlas.',
      ...context,
    });

    expect(result.failures).toBeUndefined();
    expect(context.sendSignal).not.toHaveBeenCalled();
  });

  describe('continuity: the reminder agent keeps one conversation per session', () => {
    async function seedRelevantItem(context: ReturnType<typeof createContext>) {
      const store = await context.memory.storage.getStore('knowledge');
      const node = await store.createNode({
        name: 'Project Atlas',
        kind: 'project',
        scope: ['org:acme', 'resource:user-42'],
      });
      return store.appendItem({
        parentNodeId: node.id,
        text: 'Project Atlas launches January 15.',
        scope: ['org:acme', 'resource:user-42'],
        sourceThreadId: 'beta',
        resolutionScope: ['org:acme', 'resource:user-42', 'thread:beta'],
        defaultScope: ['org:acme', 'resource:user-42'],
      });
    }

    /** Runs the hook with the lane's `queueMessage` stubbed, so the assertions are about wiring, not model output. */
    async function runWithGenerateSpy(options: {
      createRemindMemory?: () => any;
      threadId?: string;
      response?: string;
    }) {
      const { Agent } = await import('@mastra/core/agent');
      const generateSpy = vi.spyOn(Agent.prototype, 'queueMessage' as any).mockImplementation(function (
        this: unknown,
        _prompt: unknown,
        opts: any,
      ) {
        // Resolve the lane waiter the way a finished run would: through the queued entry's
        // onFinish stream option.
        opts?.ifIdle?.streamOptions?.onFinish?.({ text: options.response ?? '<no-reminder />' });
        return { accepted: Promise.resolve({ action: 'wake' }) };
      } as any);
      try {
        const extractor = new SubconsciousRemindExtractor({ name: 'remind', maxSteps: 3, builtIn: true }, undefined, {
          createRemindMemory: options.createRemindMemory,
        });
        const context = createContext('unused');
        if (options.threadId) context.threadId = options.threadId;
        await seedRelevantItem(context);

        const result = await applyExtractorHooks({
          source: 'observer',
          extractors: [extractor],
          rawObservations: 'The user is scheduling Project Atlas.',
          ...context,
        });

        // Snapshot the recorded calls before restoring — mockRestore clears them.
        return {
          result,
          context,
          calls: [...generateSpy.mock.calls] as any[][],
          agents: [...((generateSpy.mock as any).contexts ?? [])],
        };
      } finally {
        generateSpy.mockRestore();
      }
    }

    it('generates against the shared remind thread derived from the parent thread id', async () => {
      const remindMemory = { id: 'remind-memory' } as any;
      const { result, calls } = await runWithGenerateSpy({ createRemindMemory: () => remindMemory });

      expect(result.failures).toBeUndefined();
      expect(calls).toHaveLength(1);
      expect(calls[0]?.[1]).toMatchObject({
        threadId: 'subconscious:alpha:remind',
        resourceId: 'user-42',
      });
    });

    it('keys the thread off the parent thread id, never off the agent id', async () => {
      const { calls } = await runWithGenerateSpy({
        createRemindMemory: () => ({}) as any,
        threadId: 'gamma',
      });

      const thread = (calls[0]?.[1] as any).threadId;
      expect(thread).toBe('subconscious:gamma:remind');
      // The agent id convention is `subconscious-remind-<threadId>`; confusing the two produces a
      // thread that looks plausible and groups wrongly.
      expect(thread).not.toContain('subconscious-remind-');
    });

    it('hands the reminder agent the memory its owner built', async () => {
      const remindMemory = { id: 'remind-memory' } as any;
      const createRemindMemory = vi.fn(() => remindMemory);
      const { agents } = await runWithGenerateSpy({ createRemindMemory });

      expect(createRemindMemory).toHaveBeenCalledOnce();
      const agent = agents[0] as any;
      expect(await agent.getMemory()).toBe(remindMemory);
    });

    it('passes the same thread on every run, so passive reminders and questions share one conversation', async () => {
      const first = await runWithGenerateSpy({ createRemindMemory: () => ({}) as any });
      const second = await runWithGenerateSpy({ createRemindMemory: () => ({}) as any });

      expect((first.calls[0]?.[1] as any).threadId).toBe((second.calls[0]?.[1] as any).threadId);
    });

    it('builds the reminder agent without memory when no remind memory is available', async () => {
      const { result, calls, agents } = await runWithGenerateSpy({});

      expect(result.failures).toBeUndefined();
      // The turn still enters the serialized lane thread; only history persistence is absent.
      expect((calls[0]?.[1] as any).threadId).toBe('subconscious:alpha:remind');
      expect(await (agents[0] as any).getMemory()).toBeUndefined();
    });

    it('still drops the thread\u2019s own fresh items when a remind memory is attached', async () => {
      const extractor = new SubconsciousRemindExtractor({ name: 'remind', maxSteps: 3, builtIn: true }, undefined, {
        createRemindMemory: () => ({}) as any,
      });
      const context = createContext('The launch happens January 15.');
      const store = await context.memory.storage.getStore('knowledge');
      const node = await store.createNode({
        name: 'Zeta initiative',
        kind: 'program',
        scope: ['org:acme', 'resource:user-42'],
      });
      await store.appendItem({
        parentNodeId: node.id,
        text: 'The launch happens January 15.',
        scope: ['org:acme', 'resource:user-42'],
        sourceThreadId: 'alpha',
        resolutionScope: ['org:acme', 'resource:user-42', 'thread:alpha'],
        defaultScope: ['org:acme', 'resource:user-42'],
      });

      const result = await applyExtractorHooks({
        source: 'observer',
        extractors: [extractor],
        rawObservations: 'The user is scheduling the launch.',
        ...context,
      });

      // Continuity fixes repetition; freshness is a different failure and its guard must survive.
      expect(result.failures).toBeUndefined();
      expect(context.sendSignal).not.toHaveBeenCalled();
    });

    it('keeps the no-reminder contract when a remind memory is attached', async () => {
      const { result, context } = await runWithGenerateSpy({ createRemindMemory: () => ({}) as any });

      expect(result.failures).toBeUndefined();
      expect(context.sendSignal).not.toHaveBeenCalled();
    });

    it('persists the reminder exchange so a later run, even on a reconstructed Memory, sees it', async () => {
      const { Memory } = await import('../../../index');
      // One storage shared by both runs; each run gets its own Memory instance over it, the same
      // way a process restart reconstructs Memory around surviving storage.
      const sharedStorage = new InMemoryStore();
      const prompts: unknown[] = [];
      const recordingModel = (response: string) =>
        new MockLanguageModelV2({
          doGenerate: async options => {
            prompts.push(options.prompt);
            return {
              rawCall: { rawPrompt: null, rawSettings: {} },
              finishReason: 'stop' as const,
              usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 },
              warnings: [],
              content: [{ type: 'text' as const, text: response }],
            };
          },
          doStream: async options => {
            prompts.push(options.prompt);
            return {
              stream: convertArrayToReadableStream([
                { type: 'stream-start', warnings: [] },
                { type: 'response-metadata', id: 'remind-1', modelId: 'remind-model', timestamp: new Date() },
                { type: 'text-start', id: 'text-1' },
                { type: 'text-delta', id: 'text-1', delta: response },
                { type: 'text-end', id: 'text-1' },
                { type: 'finish', finishReason: 'stop', usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 } },
              ]),
              rawCall: { rawPrompt: null, rawSettings: {} },
              warnings: [],
            };
          },
        });

      const runOnce = async (response: string) => {
        const extractor = new SubconsciousRemindExtractor({ name: 'remind', maxSteps: 3, builtIn: true }, undefined, {
          createRemindMemory: () => new Memory({ storage: sharedStorage }),
        });
        const context = createContext('unused');
        const item = await seedRelevantItem(context);
        context.mainAgent.getModel = vi.fn(async () => recordingModel(response.replace('{itemId}', item.id))) as any;
        const result = await applyExtractorHooks({
          source: 'observer',
          extractors: [extractor],
          rawObservations: 'The user is scheduling Project Atlas.',
          ...context,
        });
        return { result, context };
      };

      // First run: a grounded reminder fires once and is written to the remind conversation.
      const first = await runOnce('marker-first-reminder Project Atlas launches January 15. Source: {itemId}');
      expect(first.result.failures).toBeUndefined();
      expect(first.context.sendSignal).toHaveBeenCalledOnce();

      // Second run: fresh Memory over the same storage. The persisted first exchange must reach
      // the model's prompt (that history is what lets it decline to repeat itself), and its
      // no-reminder decision must stay silent.
      prompts.length = 0;
      const second = await runOnce('<no-reminder />');
      expect(second.result.failures).toBeUndefined();
      expect(second.context.sendSignal).not.toHaveBeenCalled();
      expect(JSON.stringify(prompts)).toContain('marker-first-reminder');
    });

    it('deletes the derived reminder conversation when the session thread is deleted', async () => {
      const { Memory } = await import('../../../index');
      const storage = new InMemoryStore();
      const memory = new Memory({ storage });
      const now = new Date();
      const thread = (id: string) => ({
        id,
        resourceId: 'user-42',
        title: id,
        createdAt: now,
        updatedAt: now,
        metadata: {},
      });
      await memory.saveThread({ thread: thread('alpha') });
      await memory.saveThread({ thread: thread('subconscious:alpha:remind') });
      const memoryStore = await (memory as unknown as { getMemoryStore(): Promise<MemoryStorage> }).getMemoryStore();
      await memoryStore.saveMessages({
        messages: [
          {
            id: 'remind-msg-1',
            threadId: 'subconscious:alpha:remind',
            resourceId: 'user-42',
            role: 'assistant' as const,
            content: { format: 2 as const, parts: [{ type: 'text' as const, text: 'a persisted reminder' }] },
            type: 'text',
            createdAt: now,
          },
        ],
      });

      await memory.deleteThread('alpha');

      // The session owns its derived reminder conversation: both die together, messages included.
      expect(await memory.getThreadById({ threadId: 'alpha' })).toBeNull();
      expect(await memory.getThreadById({ threadId: 'subconscious:alpha:remind' })).toBeNull();
      const remaining = await memoryStore.listMessages({ threadId: 'subconscious:alpha:remind' });
      expect(remaining.messages).toHaveLength(0);
    });

    it('leaves other sessions reminder conversations alone when a thread is deleted', async () => {
      const { Memory } = await import('../../../index');
      const storage = new InMemoryStore();
      const memory = new Memory({ storage });
      const now = new Date();
      const thread = (id: string) => ({
        id,
        resourceId: 'user-42',
        title: id,
        createdAt: now,
        updatedAt: now,
        metadata: {},
      });
      await memory.saveThread({ thread: thread('alpha') });
      await memory.saveThread({ thread: thread('beta') });
      await memory.saveThread({ thread: thread('subconscious:beta:remind') });

      await memory.deleteThread('alpha');

      expect(await memory.getThreadById({ threadId: 'subconscious:beta:remind' })).not.toBeNull();
    });

    it('routes a remind memory construction failure into the extractor failure path', async () => {
      const extractor = new SubconsciousRemindExtractor({ name: 'remind', maxSteps: 3, builtIn: true }, undefined, {
        createRemindMemory: () => {
          throw new Error('remind memory unavailable');
        },
      });
      const context = createContext('Project Atlas launches January 15.');
      await seedRelevantItem(context);

      const result = await applyExtractorHooks({
        source: 'observer',
        extractors: [extractor],
        rawObservations: 'The user is scheduling Project Atlas.',
        ...context,
      });

      expect(result.failures).toEqual([{ slug: 'remind', error: 'remind memory unavailable' }]);
      expect(context.sendSignal).not.toHaveBeenCalled();
      expect(context.sendStateSignal).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'subconscious-activity',
          value: expect.objectContaining({ errors: ['remind: remind memory unavailable'] }),
        }),
      );
    });
  });

  it('isolates reminder failures from the observation lifecycle', async () => {
    const extractor = new SubconsciousRemindExtractor({
      name: 'remind',
      maxSteps: 3,
      builtIn: true,
    });
    const context = createContext('unused');
    context.mainAgent.getModel = vi.fn(async () => {
      throw new Error('reminder provider unavailable');
    });
    const store = await context.memory.storage.getStore('knowledge');
    const node = await store.createNode({
      name: 'Project Atlas',
      kind: 'project',
      scope: ['org:acme', 'resource:user-42'],
    });
    await store.appendItem({
      parentNodeId: node.id,
      text: 'Project Atlas launches January 15.',
      scope: ['org:acme', 'resource:user-42'],
      sourceThreadId: 'beta',
      resolutionScope: ['org:acme', 'resource:user-42', 'thread:beta'],
      defaultScope: ['org:acme', 'resource:user-42'],
    });

    const result = await applyExtractorHooks({
      source: 'observer',
      extractors: [extractor],
      rawObservations: 'The user asked about Project Atlas.',
      ...context,
    });

    expect(result.failures).toEqual([{ slug: 'remind', error: 'reminder provider unavailable' }]);
    expect(context.sendSignal).not.toHaveBeenCalled();
    expect(context.sendStateSignal).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'subconscious-activity',
        value: expect.objectContaining({ errors: ['remind: reminder provider unavailable'] }),
      }),
    );
  });
});

describe('Subconscious remind ask lane', () => {
  function createAskTool(
    options: {
      response?: string;
      omModel?: any;
      createRemindMemory?: () => any;
      generate?: (prompt: string, args: any) => Promise<{ text: string }>;
    } = {},
  ) {
    const memory = { storage: new InMemoryStore(), getKnowledgeSemanticIndex: vi.fn() } as any;
    // Asks enter the serialized reminder lane via queueMessage; the stub resolves the lane
    // waiter through the queued entry's onFinish, the way a finished run would.
    const generateSpy = vi.spyOn(Agent.prototype, 'queueMessage' as any);
    generateSpy.mockImplementation(function (this: unknown, prompt: any, opts: any) {
      const accepted = (async () => {
        const text = options.generate
          ? (await options.generate(prompt as string, opts)).text
          : (options.response ?? 'That happened on Tuesday.');
        opts?.ifIdle?.streamOptions?.onFinish?.({ text });
        return { action: 'wake' };
      })();
      return { accepted };
    } as any);
    const tools = createRemindAskTool({
      memory,
      config: { name: 'remind', maxSteps: 3, builtIn: true },
      omModel: 'omModel' in options ? options.omModel : createModel('unused'),
      createRemindMemory: options.createRemindMemory,
    });
    return { tools, generateSpy, memory };
  }

  function askContext(overrides: Record<string, unknown> = {}) {
    const requestContext = new RequestContext();
    requestContext.set('organizationId', 'acme');
    return {
      agent: { agentId: 'main', threadId: 'alpha', resourceId: 'user-42' },
      requestContext,
      ...overrides,
    } as any;
  }

  function signalCapture() {
    const sent: any[] = [];
    const sender = {
      sendSignal: vi.fn((signal: any) => {
        sent.push(signal);
        return { persisted: Promise.resolve() };
      }),
    };
    return {
      sent,
      sender,
      mastra: { getAgentById: vi.fn(async () => sender) },
    };
  }

  async function settle() {
    for (let i = 0; i < 5; i++) await new Promise(resolve => setTimeout(resolve, 0));
  }

  it('answers when the observational memory model is the default sentinel', async () => {
    const { tools, generateSpy } = createAskTool({ omModel: 'default', response: 'Answered on the default model.' });
    try {
      const result: any = await tools.ask_memory.execute!({ question: 'what happened?' } as any, askContext());
      expect(result.ok).toBe(true);
      expect(result.answer).toBe('Answered on the default model.');
    } finally {
      generateSpy.mockRestore();
    }
  });

  it('answers when the observational memory model routes by input tokens', async () => {
    const tiered = new ModelByInputTokens({ upTo: { 1000: 'openai/gpt-5-nano', 100000: 'openai/gpt-5' } });
    const { tools, generateSpy } = createAskTool({ omModel: tiered, response: 'Answered on the tiered model.' });
    try {
      const result: any = await tools.ask_memory.execute!({ question: 'what happened?' } as any, askContext());
      expect(result.ok).toBe(true);
      expect(result.answer).toBe('Answered on the tiered model.');
    } finally {
      generateSpy.mockRestore();
    }
  });

  it('resolves default and token-routed models only as a last resort', async () => {
    const config = { name: 'remind', maxSteps: 3, builtIn: true } as any;
    // The default sentinel falls back to the observational memory default model.
    await expect(resolveSubconsciousAgentModel({ config, omModel: 'default' })).resolves.toBe(
      OBSERVATIONAL_MEMORY_DEFAULTS.observation.model,
    );
    // A token-routed model resolves at the smallest tier: an ask prompt is a question, not a transcript.
    const tiered = new ModelByInputTokens({ upTo: { 1000: 'openai/gpt-5-nano', 100000: 'openai/gpt-5' } });
    await expect(resolveSubconsciousAgentModel({ config, omModel: tiered })).resolves.toBe('openai/gpt-5-nano');
    // The main agent still wins over the fallback so extractor precedence is unchanged.
    const mainAgent = { getModel: vi.fn(async () => 'main-agent-model') } as any;
    await expect(resolveSubconsciousAgentModel({ config, omModel: 'default', mainAgent })).resolves.toBe(
      'main-agent-model',
    );
  });

  it('routes the reminder lane model by tier, clamping past the largest threshold', async () => {
    const config = { name: 'remind', maxSteps: 3, builtIn: true } as any;
    const tiered = new ModelByInputTokens({ upTo: { 1000: 'openai/gpt-5-nano', 100000: 'openai/gpt-5' } });
    // A small estimate takes the small tier; a bigger one crosses to the larger tier.
    await expect(resolveReminderLaneModel({ config, omModel: tiered, estimatedInputTokens: 100 })).resolves.toBe(
      'openai/gpt-5-nano',
    );
    await expect(resolveReminderLaneModel({ config, omModel: tiered, estimatedInputTokens: 5000 })).resolves.toBe(
      'openai/gpt-5',
    );
    // Past every threshold the lane clamps to the largest tier instead of throwing: an oversized
    // reminder turn should degrade, not fail the observation cycle.
    await expect(resolveReminderLaneModel({ config, omModel: tiered, estimatedInputTokens: 999999 })).resolves.toBe(
      'openai/gpt-5',
    );
  });

  it('passes failover arrays and dynamic model configs to the reminder agent unreduced', async () => {
    const config = { name: 'remind', maxSteps: 3, builtIn: true } as any;
    const failover = [{ model: 'openai/gpt-5' }, { model: 'openai/gpt-5-nano' }] as any;
    await expect(
      resolveReminderLaneModel({ config: { ...config, model: failover }, estimatedInputTokens: 10 }),
    ).resolves.toBe(failover);
    const dynamic = (() => 'openai/gpt-5') as any;
    await expect(
      resolveReminderLaneModel({ config: { ...config, model: dynamic }, estimatedInputTokens: 10 }),
    ).resolves.toBe(dynamic);
  });

  it('rejects immediately when the lane refuses the turn as blocked', async () => {
    const { tools, generateSpy } = createAskTool({});
    // A blocked disposition means the turn will never run: the waiter must fail now, not after
    // the full lane deadline.
    generateSpy.mockImplementation((() => ({
      accepted: Promise.resolve({ action: 'blocked', reason: 'thread-blocked' }),
    })) as any);
    try {
      const result: any = await tools.ask_memory.execute!({ question: 'when?' } as any, askContext());
      expect(result.ok).toBe(false);
      expect(result.error).toMatch(/refused this turn.*thread-blocked/);
    } finally {
      generateSpy.mockRestore();
    }
  });

  it('rejects a blocking ask immediately when the lane run fails after starting', async () => {
    const { tools, generateSpy } = createAskTool({});
    // A post-start failure reports through onError; the waiter must not burn the deadline.
    generateSpy.mockImplementation(((_prompt: any, opts: any) => {
      void Promise.resolve().then(() =>
        opts?.ifIdle?.streamOptions?.onError?.({ error: new Error('model exploded mid-stream') }),
      );
      return { accepted: Promise.resolve({ action: 'wake' }) };
    }) as any);
    try {
      const result: any = await tools.ask_memory.execute!({ question: 'when?' } as any, askContext());
      expect(result.ok).toBe(false);
      expect(result.error).toMatch(/model exploded mid-stream/);
    } finally {
      generateSpy.mockRestore();
    }
  });

  it('stops a blocking ask waiting when the calling turn aborts, without failing the lane', async () => {
    const { tools, generateSpy } = createAskTool({});
    // The lane turn never finishes on its own; only the abort should release the caller.
    generateSpy.mockImplementation((() => ({ accepted: Promise.resolve({ action: 'deliver' }) })) as any);
    const controller = new AbortController();
    try {
      const pending = tools.ask_memory.execute!(
        { question: 'when?' } as any,
        askContext({ abortSignal: controller.signal }),
      );
      // Abort AFTER the turn is queued so the listener path is exercised, not the
      // already-aborted upfront check.
      await new Promise(resolve => setTimeout(resolve, 0));
      controller.abort();
      const result: any = await pending;
      expect(result.ok).toBe(false);
      expect(result.error).toMatch(/aborted while waiting/);
    } finally {
      generateSpy.mockRestore();
    }
  });

  it('returns the answer as the tool result when wait is true', async () => {
    const { tools, generateSpy } = createAskTool({ response: 'The deploy happened on Tuesday.' });
    try {
      const result: any = await tools.ask_memory.execute!({ question: 'when did that happen?' } as any, askContext());
      expect(result.ok).toBe(true);
      expect(result.answer).toBe('The deploy happened on Tuesday.');
    } finally {
      generateSpy.mockRestore();
    }
  });

  it('asks on the shared remind thread, not a thread of its own', async () => {
    const calls: any[] = [];
    const { tools, generateSpy } = createAskTool({
      createRemindMemory: () => ({}) as any,
      generate: async (_prompt, args) => {
        calls.push(args);
        return { text: 'Tuesday.' };
      },
    });
    try {
      await tools.ask_memory.execute!({ question: 'when?' } as any, askContext());
      expect(calls[0]).toMatchObject({ threadId: 'subconscious:alpha:remind', resourceId: 'user-42' });
    } finally {
      generateSpy.mockRestore();
    }
  });

  it('returns immediately when wait is false, before the answer settles', async () => {
    let release: (value: { text: string }) => void = () => {};
    const deferred = new Promise<{ text: string }>(resolve => (release = resolve));
    const generateArgs: any[] = [];
    const { tools, generateSpy } = createAskTool({
      generate: async (_prompt, args) => {
        generateArgs.push(args);
        return deferred;
      },
      createRemindMemory: () => ({}) as any,
    });
    const capture = signalCapture();
    try {
      const result: any = await tools.ask_memory.execute!(
        { question: 'when?', wait: false } as any,
        askContext({ mastra: capture.mastra }),
      );
      expect(result.accepted).toBe(true);
      expect(capture.sent).toHaveLength(0);
      // The answer outlives the asking turn, so it must not be tied to that turn's abort signal.
      expect(generateArgs[0]).not.toHaveProperty('abortSignal');
      release({ text: 'Tuesday.' });
      await settle();
      expect(capture.sent).toHaveLength(1);
    } finally {
      generateSpy.mockRestore();
    }
  });

  it('reports a broken agent registry as a tool error instead of throwing', async () => {
    const { tools, generateSpy } = createAskTool({ response: 'Tuesday.' });
    try {
      const result: any = await tools.ask_memory.execute!(
        { question: 'when?', wait: false } as any,
        askContext({
          mastra: {
            getAgentById: vi.fn(async () => {
              throw new Error('agent registry unavailable');
            }),
          },
        }),
      );
      expect(result.ok).toBe(false);
      expect(result.error).toContain('agent registry unavailable');
    } finally {
      generateSpy.mockRestore();
    }
  });

  it('delivers the non-blocking answer as a remembered signal', async () => {
    const { tools, generateSpy } = createAskTool({ response: 'Tuesday.' });
    const capture = signalCapture();
    try {
      await tools.ask_memory.execute!(
        { question: 'when?', wait: false } as any,
        askContext({ mastra: capture.mastra }),
      );
      await settle();
      expect(capture.sent[0]).toEqual(
        expect.objectContaining({
          type: 'reactive',
          tagName: 'remembered',
          attributes: expect.objectContaining({ source: 'subconscious', agent: 'remind', threadId: 'alpha' }),
        }),
      );
      expect(capture.sender.sendSignal).toHaveBeenCalledWith(expect.anything(), {
        threadId: 'alpha',
        resourceId: 'user-42',
      });
    } finally {
      generateSpy.mockRestore();
    }
  });

  it('round-trips the correlation id from the acknowledgement to the late signal', async () => {
    const { tools, generateSpy } = createAskTool({ response: 'Tuesday.' });
    const capture = signalCapture();
    try {
      const result: any = await tools.ask_memory.execute!(
        { question: 'when?', wait: false } as any,
        askContext({ mastra: capture.mastra }),
      );
      await settle();
      expect(result.correlationId).toBeTruthy();
      expect(capture.sent[0].attributes.correlationId).toBe(result.correlationId);
    } finally {
      generateSpy.mockRestore();
    }
  });

  it('keeps the question and the answer in the shared thread', async () => {
    const generated: any[] = [];
    const { tools, generateSpy } = createAskTool({
      createRemindMemory: () => ({}) as any,
      generate: async (prompt, args) => {
        generated.push({ prompt, args });
        return { text: 'Tuesday.' };
      },
    });
    try {
      await tools.ask_memory.execute!({ question: 'when did the deploy happen?' } as any, askContext());
      expect(generated[0].prompt).toContain('when did the deploy happen?');
      expect(generated[0].args).toMatchObject({ threadId: 'subconscious:alpha:remind', resourceId: 'user-42' });
    } finally {
      generateSpy.mockRestore();
    }
  });

  it('isolates a blocking failure into an error result instead of throwing', async () => {
    const { tools, generateSpy } = createAskTool({
      generate: async () => {
        throw new Error('reminder provider unavailable');
      },
    });
    try {
      const result: any = await tools.ask_memory.execute!({ question: 'when?' } as any, askContext());
      expect(result).toEqual(expect.objectContaining({ ok: false, error: 'reminder provider unavailable' }));
    } finally {
      generateSpy.mockRestore();
    }
  });

  it('reports a non-blocking failure on the signal channel carrying the correlation id', async () => {
    const { tools, generateSpy } = createAskTool({
      generate: async () => {
        throw new Error('reminder provider unavailable');
      },
    });
    const capture = signalCapture();
    // A writer whose turn already ended rejects; that must not escape as an unhandled rejection.
    const writer = {
      custom: vi.fn(async () => {
        throw new Error('stream closed');
      }),
    };
    const unhandled: unknown[] = [];
    const onUnhandled = (reason: unknown) => unhandled.push(reason);
    process.on('unhandledRejection', onUnhandled);
    try {
      const result: any = await tools.ask_memory.execute!(
        { question: 'when?', wait: false } as any,
        askContext({ mastra: capture.mastra, writer }),
      );
      await settle();
      expect(writer.custom).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'data-subconscious-error',
          data: expect.objectContaining({ agent: 'remind' }),
        }),
      );
      expect(capture.sent[0].attributes.correlationId).toBe(result.correlationId);
      expect(capture.sent[0].contents).toEqual(expect.anything());
      expect(unhandled.map(String).filter(reason => reason.includes('stream closed'))).toEqual([]);
    } finally {
      process.off('unhandledRejection', onUnhandled);
      generateSpy.mockRestore();
    }
  });

  it('gives concurrent non-blocking questions distinct correlation ids', async () => {
    const { tools, generateSpy } = createAskTool({
      generate: async prompt => ({ text: prompt.includes('first') ? 'answer one' : 'answer two' }),
    });
    const capture = signalCapture();
    try {
      const context = askContext({ mastra: capture.mastra });
      const [one, two]: any[] = await Promise.all([
        tools.ask_memory.execute!({ question: 'the first one?', wait: false } as any, context),
        tools.ask_memory.execute!({ question: 'the second one?', wait: false } as any, context),
      ]);
      await settle();
      expect(one.correlationId).not.toBe(two.correlationId);
      const byId = new Map(capture.sent.map(signal => [signal.attributes.correlationId, signal]));
      expect(byId.get(one.correlationId)?.attributes.question).toBe('the first one?');
      expect(byId.get(two.correlationId)?.attributes.question).toBe('the second one?');
    } finally {
      generateSpy.mockRestore();
    }
  });

  it('leaves the passive reminder path unregressed while a question shares its thread', async () => {
    // Hold a question open across a full passive reminder run: the passive signal's shape and its
    // source ids must be untouched by an ask sharing the session, and the ask must still resolve.
    const extractor = new SubconsciousRemindExtractor({ name: 'remind', maxSteps: 3, builtIn: true });
    const context = createContext('Project Atlas launches January 15.');
    const store = await context.memory.storage.getStore('knowledge');
    const node = await store.createNode({
      name: 'Project Atlas',
      kind: 'project',
      scope: ['org:acme', 'resource:user-42'],
    });
    const item = await store.appendItem({
      parentNodeId: node.id,
      text: 'Project Atlas launches January 15.',
      scope: ['org:acme', 'resource:user-42'],
      sourceThreadId: 'beta',
      resolutionScope: ['org:acme', 'resource:user-42', 'thread:beta'],
      defaultScope: ['org:acme', 'resource:user-42'],
    });

    let releaseAsk: (value: { text: string }) => void = () => {};
    const pendingAsk = new Promise<{ text: string }>(resolve => (releaseAsk = resolve));
    const tools = createRemindAskTool({
      memory: context.memory,
      config: { name: 'remind', maxSteps: 3, builtIn: true },
      omModel: createModel('unused'),
      createRemindMemory: () => ({}) as any,
    });
    const generateSpy = vi.spyOn(Agent.prototype, 'queueMessage' as any);
    // The passive reply cites the item id: the grounded-citation guard suppresses
    // reminders that reference no candidate, and this test is about signal shape.
    // Both entry points share the lane, so the queue stub routes by prompt shape.
    generateSpy.mockImplementation(((prompt: string, opts: any) => {
      const finish = opts?.ifIdle?.streamOptions?.onFinish;
      if (prompt.includes('Question:')) {
        void pendingAsk.then(answer => finish?.({ text: answer.text }));
      } else {
        finish?.({ text: `Atlas ships mid January, worth checking. (${item.id})` });
      }
      return { accepted: Promise.resolve({ action: 'wake' }) };
    }) as any);

    try {
      const askInFlight = tools.ask_memory.execute!({ question: 'when?' } as any, askContext());

      const result = await applyExtractorHooks({
        source: 'observer',
        extractors: [extractor],
        rawObservations: 'The user is scheduling Project Atlas.',
        ...context,
      });

      expect(result.failures).toBeUndefined();
      expect(context.sendSignal).toHaveBeenCalledOnce();
      expect(context.sendSignal).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'reactive',
          tagName: 'remembered',
          // Both halves of the signal body: the reminder the agent wrote and the source ids
          // appended after it. Asserting only the id passes even if the reminder text is dropped.
          contents: expect.stringContaining('Atlas ships mid January, worth checking.'),
          attributes: expect.objectContaining({
            source: 'subconscious',
            sourceIds: expect.stringContaining(item.id),
            agent: 'remind',
            threadId: 'alpha',
          }),
        }),
      );

      releaseAsk({ text: 'January 15.' });
      expect(await askInFlight).toEqual(expect.objectContaining({ ok: true, answer: 'January 15.' }));
    } finally {
      generateSpy.mockRestore();
    }
  });

  it('returns an explicit unavailable result when no model can be resolved', async () => {
    const { tools, generateSpy } = createAskTool({ omModel: undefined });
    try {
      const result: any = await tools.ask_memory.execute!({ question: 'when?' } as any, askContext());
      expect(result.ok).toBe(false);
      expect(result.unavailable).toBe(true);
      expect(result.error).toMatch(/model/i);
      expect(generateSpy).not.toHaveBeenCalled();
    } finally {
      generateSpy.mockRestore();
    }
  });
});

describe('reminder lane serialization (real runtime)', () => {
  // Tyler's review repro: two concurrent asks against the shared remind conversation must not
  // interleave. This test uses the REAL Agent + thread-stream runtime + Memory over shared
  // storage — no queueMessage spies — so it proves the runtime contract, not a mock of it.
  it('serializes concurrent asks into one causal transcript on the shared remind thread', async () => {
    const { Memory } = await import('../../../index');
    const sharedStorage = new InMemoryStore();
    const remindMemory = new Memory({ storage: sharedStorage });

    // The first model turn parks until we explicitly release it, guaranteeing the second ask
    // is enqueued while the first run is still in flight — the exact race from the review.
    let releaseFirst!: () => void;
    const firstGate = new Promise<void>(resolve => (releaseFirst = resolve));
    let streamCalls = 0;
    const answers = ['answer-first', 'answer-second'];
    const model = new MockLanguageModelV2({
      doStream: async () => {
        const index = streamCalls++;
        if (index === 0) await firstGate;
        const text = answers[index] ?? `answer-${index + 1}`;
        return {
          stream: convertArrayToReadableStream([
            { type: 'stream-start', warnings: [] },
            { type: 'response-metadata', id: `lane-${index}`, modelId: 'remind-model', timestamp: new Date() },
            { type: 'text-start', id: 'text-1' },
            { type: 'text-delta', id: 'text-1', delta: text },
            { type: 'text-end', id: 'text-1' },
            { type: 'finish', finishReason: 'stop', usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 } },
          ]),
          rawCall: { rawPrompt: null, rawSettings: {} },
          warnings: [],
        };
      },
    });

    const memory = { storage: new InMemoryStore(), getKnowledgeSemanticIndex: vi.fn() } as any;
    const tools = createRemindAskTool({
      memory,
      config: { name: 'remind', maxSteps: 3, builtIn: true },
      omModel: model as any,
      createRemindMemory: () => remindMemory as any,
    });
    const context = () => {
      const requestContext = new RequestContext();
      requestContext.set('organizationId', 'acme');
      return { agent: { agentId: 'main', threadId: 'alpha', resourceId: 'user-42' }, requestContext } as any;
    };

    const first = tools.ask_memory.execute!({ question: 'first question' } as any, context());
    // Wait for the first run to actually reach the model (run active on the lane thread).
    await vi.waitFor(() => expect(streamCalls).toBeGreaterThan(0));
    const second = tools.ask_memory.execute!({ question: 'second question' } as any, context());
    // Give the runtime a beat to route the second ask while the first is mid-stream, then
    // release the first turn.
    await new Promise(resolve => setTimeout(resolve, 25));
    expect(streamCalls).toBe(1); // second must be queued, not running concurrently
    releaseFirst();

    const [firstResult, secondResult] = (await Promise.all([first, second])) as any[];
    expect(firstResult).toEqual(expect.objectContaining({ ok: true, answer: 'answer-first' }));
    expect(secondResult).toEqual(expect.objectContaining({ ok: true, answer: 'answer-second' }));

    // The persisted transcript is the contract: question, its answer, next question, its answer.
    // Queued lane entries persist with the runtime's signal role rather than user — the causal
    // pairing, not the role label, is what the concurrency bug corrupted.
    const memoryStore = await (
      remindMemory as unknown as { getMemoryStore(): Promise<MemoryStorage> }
    ).getMemoryStore();
    const { messages } = await memoryStore.listMessages({ threadId: 'subconscious:alpha:remind' });
    const transcript = messages.map(message => {
      const parts = (message.content as { parts?: Array<{ type: string; text?: string }> })?.parts ?? [];
      const text = parts
        .filter(part => part.type === 'text')
        .map(part => part.text ?? '')
        .join('');
      return `${message.role}:${text.includes('first question') ? 'first' : text.includes('second question') ? 'second' : text}`;
    });
    expect(transcript).toEqual(['signal:first', 'assistant:answer-first', 'signal:second', 'assistant:answer-second']);
  });
});
