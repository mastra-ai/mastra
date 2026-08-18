import { MockLanguageModelV2, convertArrayToReadableStream } from '@internal/ai-sdk-v5/test';
import { RequestContext } from '@mastra/core/request-context';
import { InMemoryStore } from '@mastra/core/storage';
import type { MemoryStorage } from '@mastra/core/storage';
import { describe, expect, it, vi } from 'vitest';

import { applyExtractorHooks } from '../extracted-values';
import { buildExtractorOutputSections, Extractor } from '../extractor';
import { SubconsciousRemindExtractor } from '../subconscious';

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
    const generateSpy = vi.spyOn(Agent.prototype, 'generate' as any);
    generateSpy.mockClear();
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

      expect(generateSpy).toHaveBeenCalledOnce();
      const prompt = generateSpy.mock.calls[0]?.[0] as string;
      expect(prompt).toContain('user: what is the weather like on the moon?');
      expect(prompt).toContain('already visible');
    } finally {
      generateSpy.mockRestore();
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

    /** Runs the hook with `generate` stubbed, so the assertions are about wiring, not model output. */
    async function runWithGenerateSpy(options: {
      createRemindMemory?: () => any;
      threadId?: string;
      response?: string;
    }) {
      const { Agent } = await import('@mastra/core/agent');
      const generateSpy = vi
        .spyOn(Agent.prototype, 'generate' as any)
        .mockResolvedValue({ text: options.response ?? '<no-reminder />' } as any);
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
        memory: { thread: 'subconscious:alpha:remind', resource: 'user-42' },
      });
    });

    it('keys the thread off the parent thread id, never off the agent id', async () => {
      const { calls } = await runWithGenerateSpy({
        createRemindMemory: () => ({}) as any,
        threadId: 'gamma',
      });

      const thread = (calls[0]?.[1] as any).memory.thread;
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

      expect((first.calls[0]?.[1] as any).memory.thread).toBe((second.calls[0]?.[1] as any).memory.thread);
    });

    it('omits the memory option entirely when no remind memory is available', async () => {
      const { result, calls } = await runWithGenerateSpy({});

      expect(result.failures).toBeUndefined();
      expect(calls[0]?.[1]).not.toHaveProperty('memory');
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
