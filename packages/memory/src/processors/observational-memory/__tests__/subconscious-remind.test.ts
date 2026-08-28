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
import { resolveReminderConversationModel, resolveSubconsciousAgentModel } from '../subconscious/model';
import { createRemindAskTool, createReplyToolProcessor } from '../subconscious/remind';
import { REMINDER_TURN_DEADLINE_MS, RemindRequestRegistry } from '../subconscious/remind-request-state';

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
    const record = await store.appendKnowledge({
      node,
      text: 'Project Atlas launches January 15.',
      scope: ['org:acme', 'resource:user-42'],
      sourceThreadId: 'beta',
      resolutionScope: ['org:acme', 'resource:user-42', 'thread:beta'],
      defaultScope: ['org:acme', 'resource:user-42'],
    });
    context.mainAgent.getModel = vi.fn(async () =>
      createModel(`Project Atlas launches January 15. Source: ${record.id}`),
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
        contents: expect.stringContaining(record.id),
        attributes: expect.objectContaining({
          source: 'subconscious',
          sourceIds: expect.stringContaining(record.id),
          agent: 'remind',
          threadId: 'alpha',
        }),
      }),
    );
  });

  it.each(['Project Atlas launches January 15.', 'Project Atlas launches January 15. Source: invented-record-id'])(
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
      await store.appendKnowledge({
        node,
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
    const recordId = 'item-atlas-launch';
    const extractor = new SubconsciousRemindExtractor(
      { name: 'remind', maxSteps: 3, builtIn: true },
      createModel(`Project Atlas launches January 15. Source KnowledgeRecord: ${recordId}.`) as any,
    );
    const context = createContext('unused');
    delete (context as any).mainAgent;
    const store = await context.memory.storage.getStore('knowledge');
    const node = await store.createNode({
      name: 'Project Atlas',
      kind: 'project',
      scope: ['org:acme', 'resource:user-42'],
    });
    const item = await store.appendKnowledge({
      id: recordId,
      node: node.id,
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

  it("does not echo the thread's own freshly captured records back as reminders", async () => {
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
    await store.appendKnowledge({
      node: node.id,
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
    await store.appendKnowledge({
      node: node.id,
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
      const item = await store.appendKnowledge({
        node: node.id,
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
    // The passive path enters the continuing reminder conversation through sendMessage.
    const sendMessageSpy = vi.spyOn(Agent.prototype, 'sendMessage' as any);
    sendMessageSpy.mockClear();
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
      await store.appendKnowledge({
        node: node.id,
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

      expect(sendMessageSpy).toHaveBeenCalledOnce();
      const prompt = sendMessageSpy.mock.calls[0]?.[0] as string;
      expect(prompt).toContain('user: what is the weather like on the moon?');
      expect(prompt).toContain('already visible');
    } finally {
      sendMessageSpy.mockRestore();
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
    function createRemindMemoryStub(extra: Record<string, unknown> = {}) {
      let thread: any;
      return {
        ...extra,
        getThreadById: vi.fn(async () => thread),
        saveThread: vi.fn(async ({ thread: nextThread }: any) => {
          thread = nextThread;
          return nextThread;
        }),
      } as any;
    }

    async function seedRelevantItem(context: ReturnType<typeof createContext>) {
      const store = await context.memory.storage.getStore('knowledge');
      const node = await store.createNode({
        name: 'Project Atlas',
        kind: 'project',
        scope: ['org:acme', 'resource:user-42'],
      });
      return store.appendKnowledge({
        node,
        text: 'Project Atlas launches January 15.',
        scope: ['org:acme', 'resource:user-42'],
        sourceThreadId: 'beta',
        resolutionScope: ['org:acme', 'resource:user-42', 'thread:beta'],
        defaultScope: ['org:acme', 'resource:user-42'],
      });
    }

    /** Runs the hook with the conversation's `sendMessage` stubbed, so assertions cover wiring rather than model output. */
    async function runWithGenerateSpy(options: {
      createRemindMemory?: () => any;
      threadId?: string;
      resourceId?: string | null;
      response?: string;
    }) {
      const { Agent } = await import('@mastra/core/agent');
      const generateSpy = vi.spyOn(Agent.prototype, 'sendMessage' as any).mockImplementation(function () {
        return {
          accepted: Promise.resolve({
            action: 'wake',
            output: {
              consumeStream: vi.fn().mockResolvedValue(undefined),
              getFullOutput: vi.fn().mockResolvedValue({ text: options.response ?? '<no-reminder />' }),
            },
          }),
        };
      } as any);
      try {
        const extractor = new SubconsciousRemindExtractor({ name: 'remind', maxSteps: 3, builtIn: true }, undefined, {
          createRemindMemory: options.createRemindMemory,
        });
        const context = createContext('unused');
        if (options.threadId) context.threadId = options.threadId;
        if (options.resourceId === null) {
          context.resourceId = undefined as any;
          context.requestContext.set('knowledgeResourceId', 'user-42');
        } else if (options.resourceId) {
          context.resourceId = options.resourceId;
        }
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
      const remindMemory = createRemindMemoryStub({ id: 'remind-memory' });
      const { result, calls } = await runWithGenerateSpy({ createRemindMemory: () => remindMemory });

      expect(result.failures).toBeUndefined();
      expect(calls).toHaveLength(1);
      expect(calls[0]?.[1]).toMatchObject({
        threadId: 'subconscious:alpha:remind',
        resourceId: 'user-42',
      });
    });

    it('runs stateless when the observation path lacks the session resource owner', async () => {
      const createRemindMemory = vi.fn(() => ({ id: 'remind-memory' }) as any);
      const { result, calls } = await runWithGenerateSpy({ createRemindMemory, resourceId: null });

      expect(result.failures).toBeUndefined();
      expect(calls).toHaveLength(1);
      expect(calls[0]?.[1]).not.toHaveProperty('memory');
      expect(createRemindMemory).not.toHaveBeenCalled();
    });

    it('keys the thread off the parent thread id, never off the agent id', async () => {
      const { calls } = await runWithGenerateSpy({
        createRemindMemory: () => createRemindMemoryStub(),
        threadId: 'gamma',
      });

      const thread = (calls[0]?.[1] as any).threadId;
      expect(thread).toBe('subconscious:gamma:remind');
      // The agent id convention is `subconscious-remind-<threadId>`; confusing the two produces a
      // thread that looks plausible and groups wrongly.
      expect(thread).not.toContain('subconscious-remind-');
    });

    it('hands the reminder agent the memory its owner built', async () => {
      const remindMemory = createRemindMemoryStub({ id: 'remind-memory' });
      const createRemindMemory = vi.fn(() => remindMemory);
      const { agents } = await runWithGenerateSpy({ createRemindMemory });

      expect(createRemindMemory).toHaveBeenCalledOnce();
      const agent = agents[0] as any;
      expect(await agent.getMemory()).toBe(remindMemory);
    });

    it('passes the same thread on every run, so passive reminders and questions share one conversation', async () => {
      const first = await runWithGenerateSpy({ createRemindMemory: () => createRemindMemoryStub() });
      const second = await runWithGenerateSpy({ createRemindMemory: () => createRemindMemoryStub() });

      expect((first.calls[0]?.[1] as any).threadId).toBe((second.calls[0]?.[1] as any).threadId);
    });

    it('builds the reminder agent without memory when no remind memory is available', async () => {
      const { result, calls, agents } = await runWithGenerateSpy({});

      expect(result.failures).toBeUndefined();
      // The turn still enters the serialized conversation thread; only history persistence is absent.
      expect((calls[0]?.[1] as any).threadId).toBe('subconscious:alpha:remind');
      expect(await (agents[0] as any).getMemory()).toBeUndefined();
    });

    it('still drops the thread\u2019s own fresh items when a remind memory is attached', async () => {
      const extractor = new SubconsciousRemindExtractor({ name: 'remind', maxSteps: 3, builtIn: true }, undefined, {
        createRemindMemory: () => createRemindMemoryStub(),
      });
      const context = createContext('The launch happens January 15.');
      const store = await context.memory.storage.getStore('knowledge');
      const node = await store.createNode({
        name: 'Zeta initiative',
        kind: 'program',
        scope: ['org:acme', 'resource:user-42'],
      });
      await store.appendKnowledge({
        node,
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
      const { result, context } = await runWithGenerateSpy({ createRemindMemory: () => createRemindMemoryStub() });

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
      await memory.saveThread({
        thread: {
          ...thread('subconscious:alpha:remind'),
          metadata: { subconsciousRemindParentThreadId: 'alpha' },
        },
      });
      const memoryStore = await (memory as unknown as { getMemoryStore(): Promise<MemoryStorage> }).getMemoryStore();
      await memoryStore.saveMessages({
        messages: [
          {
            id: 'remind-msg-1',
            threadId: 'subconscious:alpha:remind',
            resourceId: 'user-42',
            role: 'assistant' as const,
            content: {
              format: 2 as const,
              parts: [{ type: 'text' as const, text: 'a persisted reminder', createdAt: now.getTime() }],
            },
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

    it('does not delete an unmarked same-resource thread with a colliding derived id', async () => {
      const { Memory } = await import('../../../index');
      const storage = new InMemoryStore();
      const memory = new Memory({ storage });
      const now = new Date();
      await memory.saveThread({
        thread: { id: 'alpha', resourceId: 'user-42', title: 'alpha', createdAt: now, updatedAt: now, metadata: {} },
      });
      await memory.saveThread({
        thread: {
          id: 'subconscious:alpha:remind',
          resourceId: 'user-42',
          title: 'unrelated same-resource thread',
          createdAt: now,
          updatedAt: now,
          metadata: {},
        },
      });

      await memory.deleteThread('alpha');

      expect(await memory.getThreadById({ threadId: 'alpha' })).toBeNull();
      expect(await memory.getThreadById({ threadId: 'subconscious:alpha:remind' })).not.toBeNull();
    });

    it('does not delete a derived-id thread owned by another resource', async () => {
      const { Memory } = await import('../../../index');
      const storage = new InMemoryStore();
      const memory = new Memory({ storage });
      const now = new Date();
      await memory.saveThread({
        thread: { id: 'alpha', resourceId: 'user-42', title: 'alpha', createdAt: now, updatedAt: now, metadata: {} },
      });
      await memory.saveThread({
        thread: {
          id: 'subconscious:alpha:remind',
          resourceId: 'user-99',
          title: 'unrelated',
          createdAt: now,
          updatedAt: now,
          metadata: {},
        },
      });

      await memory.deleteThread('alpha');

      expect(await memory.getThreadById({ threadId: 'alpha' })).toBeNull();
      expect(await memory.getThreadById({ threadId: 'subconscious:alpha:remind' })).not.toBeNull();
    });

    it('does not delete a colliding reminder thread owned by another resource', async () => {
      const { Memory } = await import('../../../index');
      const storage = new InMemoryStore();
      const memory = new Memory({ storage });
      const now = new Date();
      await memory.saveThread({
        thread: { id: 'alpha', resourceId: 'user-42', title: 'alpha', createdAt: now, updatedAt: now, metadata: {} },
      });
      await memory.saveThread({
        thread: {
          id: 'subconscious:alpha:remind',
          resourceId: 'other-user',
          title: 'collision',
          createdAt: now,
          updatedAt: now,
          metadata: {},
        },
      });

      await memory.deleteThread('alpha');

      expect(await memory.getThreadById({ threadId: 'alpha' })).toBeNull();
      expect(await memory.getThreadById({ threadId: 'subconscious:alpha:remind' })).not.toBeNull();
    });

    it('does not cascade from a missing parent into a colliding reminder thread', async () => {
      const { Memory } = await import('../../../index');
      const storage = new InMemoryStore();
      const memory = new Memory({ storage });
      const now = new Date();
      await memory.saveThread({
        thread: {
          id: 'subconscious:missing:remind',
          resourceId: 'missing',
          title: 'collision',
          createdAt: now,
          updatedAt: now,
          metadata: {},
        },
      });

      await memory.deleteThread('missing');

      expect(await memory.getThreadById({ threadId: 'subconscious:missing:remind' })).not.toBeNull();
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
    await store.appendKnowledge({
      node: node.id,
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

describe('Subconscious remind ask conversation', () => {
  function createAskTool(
    options: {
      response?: string;
      omModel?: any;
      createRemindMemory?: () => any;
      generate?: (prompt: string, args: any) => Promise<{ text: string }>;
    } = {},
  ) {
    const memory = { storage: new InMemoryStore(), getKnowledgeSemanticIndex: vi.fn() } as any;
    // Asks are delivered with sendMessage. The stub exercises the real current-input processor,
    // then answers with the reply tool that processor exposes for this correlated question.
    const generateSpy = vi.spyOn(Agent.prototype, 'sendMessage' as any);
    generateSpy.mockImplementation(function (this: Agent, input: any, opts: any) {
      void (async () => {
        const text = options.generate
          ? (await options.generate(input?.contents as string, opts)).text
          : (options.response ?? 'That happened on Tuesday.');
        const processor = createReplyToolProcessor(registry, {
          remindThreadId: opts?.threadId,
          resourceId: opts?.resourceId,
        });
        const processed = await processor.processInputStep?.({ messages: [input], tools: {} } as any);
        if (!processed || !('tools' in processed)) return;
        const replyTool = processed.tools?.reply_to_memory_question as any;
        if (!replyTool) return;
        await replyTool.execute(
          { correlationId: input?.metadata?.correlationId, answer: text },
          {
            requestContext: opts?.requestContext,
            agent: { threadId: opts?.threadId, resourceId: opts?.resourceId },
          },
        );
      })().catch(() => {});
      return { accepted: Promise.resolve({ action: 'deliver', runId: 'run-stub' }) };
    } as any);
    const registry = new RemindRequestRegistry();
    const tools = createRemindAskTool({
      memory,
      config: { name: 'remind', maxSteps: 3, builtIn: true },
      omModel: 'omModel' in options ? options.omModel : createModel('unused'),
      createRemindMemory: options.createRemindMemory,
      registry,
    });
    return { tools, generateSpy, memory, registry };
  }

  function askContext(overrides: Record<string, unknown> = {}) {
    const requestContext = new RequestContext();
    requestContext.set('organizationId', 'acme');
    const sourceAgent = {
      sendSignal: vi.fn(() => ({ accepted: Promise.resolve({ action: 'deliver' }) })),
    };
    return {
      agent: { agentId: 'main', threadId: 'alpha', resourceId: 'user-42' },
      requestContext,
      mastra: { getAgentById: vi.fn(async () => sourceAgent) },
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

  it.each([
    ['routing acceptance', { accepted: new Promise(() => {}) }],
    ['signal persistence', { accepted: Promise.resolve({ action: 'persist' }), persisted: new Promise(() => {}) }],
  ])('fails terminal delivery when %s never settles', async (_label, signalResult) => {
    vi.useFakeTimers();
    const { tools, generateSpy, registry } = createAskTool({ response: 'A terminal answer.' });
    const sourceAgent = { sendSignal: vi.fn(() => signalResult) };
    try {
      const result: any = await tools.ask_memory.execute!(
        { question: 'what happened?' } as any,
        askContext({ mastra: { getAgentById: vi.fn(async () => sourceAgent) } }),
      );
      await vi.advanceTimersByTimeAsync(0);
      expect(registry.get(result.correlationId)?.status).toBe('terminal_sending');

      await vi.advanceTimersByTimeAsync(REMINDER_TURN_DEADLINE_MS);
      expect(registry.get(result.correlationId)).toMatchObject({
        status: 'delivery_unknown',
        failure: {
          status: 'delivery_unknown',
          message: `Terminal answer delivery timed out after ${REMINDER_TURN_DEADLINE_MS}ms`,
        },
      });
    } finally {
      generateSpy.mockRestore();
      registry.dispose();
      vi.useRealTimers();
    }
  });

  it('bounds reminder question routing acceptance by the request deadline', async () => {
    vi.useFakeTimers();
    const { tools, generateSpy, registry } = createAskTool();
    generateSpy.mockReturnValue({ accepted: new Promise(() => {}) } as any);
    try {
      const pending = tools.ask_memory.execute!({ question: 'what happened?' } as any, askContext());
      await vi.advanceTimersByTimeAsync(REMINDER_TURN_DEADLINE_MS);
      await expect(pending).resolves.toMatchObject({ ok: false, status: 'timed_out' });
    } finally {
      generateSpy.mockRestore();
      registry.dispose();
      vi.useRealTimers();
    }
  });

  it('does not submit a reminder question when the caller is already aborted', async () => {
    const { tools, generateSpy, registry } = createAskTool();
    const controller = new AbortController();
    controller.abort();
    try {
      await expect(
        tools.ask_memory.execute!(
          { question: 'what happened?' } as any,
          askContext({ abortSignal: controller.signal }),
        ),
      ).resolves.toMatchObject({ ok: false, status: 'delivery_failed' });
      expect(generateSpy).not.toHaveBeenCalled();
    } finally {
      generateSpy.mockRestore();
      registry.dispose();
    }
  });

  it('bounds terminal delivery by the remaining request deadline', async () => {
    vi.useFakeTimers();
    const sourceAgent = { sendSignal: vi.fn(() => ({ accepted: new Promise(() => {}) })) };
    const { tools, generateSpy, registry } = createAskTool({
      generate: async () => {
        await new Promise(resolve => setTimeout(resolve, REMINDER_TURN_DEADLINE_MS - 1_000));
        return { text: 'A late terminal answer.' };
      },
    });
    try {
      const result: any = await tools.ask_memory.execute!(
        { question: 'what happened?' } as any,
        askContext({ mastra: { getAgentById: vi.fn(async () => sourceAgent) } }),
      );
      await vi.advanceTimersByTimeAsync(REMINDER_TURN_DEADLINE_MS - 1_000);
      expect(registry.get(result.correlationId)?.status).toBe('terminal_sending');

      await vi.advanceTimersByTimeAsync(1_000);
      expect(registry.get(result.correlationId)).toMatchObject({
        status: 'delivery_unknown',
        failure: { status: 'delivery_unknown', message: 'Terminal answer delivery timed out after 1000ms' },
      });
    } finally {
      generateSpy.mockRestore();
      registry.dispose();
      vi.useRealTimers();
    }
  });

  it('accepts a question when the observational memory model is the default sentinel', async () => {
    const { tools, generateSpy } = createAskTool({ omModel: 'default', response: 'Answered on the default model.' });
    try {
      const result: any = await tools.ask_memory.execute!({ question: 'what happened?' } as any, askContext());
      expect(result.ok).toBe(true);
      expect(result.accepted).toBe(true);
      expect(result.status).toBe('pending');
    } finally {
      generateSpy.mockRestore();
    }
  });

  it('does not collapse a token-routed observational-memory model without runtime context', async () => {
    const config = { name: 'remind', maxSteps: 3, builtIn: true } as any;
    const tiered = new ModelByInputTokens({ upTo: { 1000: 'openai/gpt-5-nano', 100000: 'openai/gpt-5' } });
    await expect(resolveReminderConversationModel({ config, omModel: tiered })).resolves.toBeUndefined();

    const mainAgent = { getModel: vi.fn(async () => 'main-agent-model') } as any;
    await expect(resolveReminderConversationModel({ config, omModel: tiered, mainAgent })).resolves.toBe(
      'main-agent-model',
    );
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

  it('prefers a configured reminder model over token-routed observational memory', async () => {
    const tiered = new ModelByInputTokens({ upTo: { 1000: 'openai/gpt-5-nano', 100000: 'openai/gpt-5' } });
    const reminderModel = (() => 'openai/gpt-5') as any;
    const config = { name: 'remind', maxSteps: 3, builtIn: true, model: reminderModel } as any;
    await expect(resolveReminderConversationModel({ config, omModel: tiered })).resolves.toBe(reminderModel);
  });

  it('passes failover arrays and dynamic model configs to the reminder agent unreduced', async () => {
    const config = { name: 'remind', maxSteps: 3, builtIn: true } as any;
    const failover = [{ model: 'openai/gpt-5' }, { model: 'openai/gpt-5-nano' }] as any;
    await expect(resolveReminderConversationModel({ config: { ...config, model: failover } })).resolves.toBe(failover);
    const dynamic = (() => 'openai/gpt-5') as any;
    await expect(resolveReminderConversationModel({ config: { ...config, model: dynamic } })).resolves.toBe(dynamic);
  });

  it('rejects immediately when the conversation refuses the turn as blocked', async () => {
    const { tools, generateSpy } = createAskTool({});
    // A blocked disposition means the turn will never run: the waiter must fail now, not after
    // the full conversation deadline.
    generateSpy.mockImplementation((() => ({
      accepted: Promise.resolve({ action: 'blocked', reason: 'thread-blocked' }),
    })) as any);
    try {
      const result: any = await tools.ask_memory.execute!({ question: 'when?' } as any, askContext());
      expect(result.ok).toBe(false);
      expect(result.error).toBe('thread-blocked');
    } finally {
      generateSpy.mockRestore();
    }
  });

  it('rejects a blocking ask immediately when the conversation run fails after starting', async () => {
    const { tools, generateSpy } = createAskTool({});
    // A post-start failure reports through onError, and it fires BEFORE `accepted` names the run —
    // the failure has to wait for the run id and then land, rather than stranding the question until
    // the deadline. The waiter must not burn the deadline.
    generateSpy.mockImplementation(((_input: any, opts: any) => {
      opts?.ifIdle?.streamOptions?.onError?.({ error: new Error('model exploded mid-stream') });
      return { accepted: Promise.resolve({ action: 'wake', runId: 'run-failed' }) };
    }) as any);
    try {
      const result: any = await tools.ask_memory.execute!({ question: 'when?' } as any, askContext());
      expect(result.ok).toBe(false);
      expect(result.error).toMatch(/model exploded mid-stream/);
    } finally {
      generateSpy.mockRestore();
    }
  });

  it('keeps an accepted question alive when the calling turn aborts', async () => {
    const { tools, generateSpy } = createAskTool({});
    generateSpy.mockImplementation((() => ({ accepted: Promise.resolve({ action: 'deliver' }) })) as any);
    const controller = new AbortController();
    try {
      const result: any = await tools.ask_memory.execute!(
        { question: 'when?' } as any,
        askContext({ abortSignal: controller.signal }),
      );
      controller.abort();
      expect(result.ok).toBe(true);
      expect(result.accepted).toBe(true);
      expect(result.status).toBe('pending');
    } finally {
      generateSpy.mockRestore();
    }
  });

  it('acknowledges the question instead of returning the answer inline', async () => {
    const { tools, generateSpy } = createAskTool({ response: 'The deploy happened on Tuesday.' });
    try {
      const result: any = await tools.ask_memory.execute!({ question: 'when did that happen?' } as any, askContext());
      expect(result.ok).toBe(true);
      expect(result.accepted).toBe(true);
      expect(result).not.toHaveProperty('answer');
    } finally {
      generateSpy.mockRestore();
    }
  });

  it('asks on the shared remind thread, not a thread of its own', async () => {
    const calls: any[] = [];
    const { tools, generateSpy } = createAskTool({
      createRemindMemory: () => createRemindMemoryStub(),
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
      createRemindMemory: () => createRemindMemoryStub(),
    });
    const capture = signalCapture();
    try {
      const result: any = await tools.ask_memory.execute!(
        { question: 'when?' } as any,
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
        { question: 'when?' } as any,
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
      await tools.ask_memory.execute!({ question: 'when?' } as any, askContext({ mastra: capture.mastra }));
      await settle();
      expect(capture.sent[0]).toEqual(
        expect.objectContaining({
          type: 'reactive',
          tagName: 'remembered',
          attributes: expect.objectContaining({
            source: 'subconscious',
            agent: 'remind',
            sourceThreadId: 'alpha',
            sourceResourceId: 'user-42',
          }),
        }),
      );
      expect(capture.sender.sendSignal).toHaveBeenCalledWith(expect.anything(), {
        threadId: 'alpha',
        resourceId: 'user-42',
        ifIdle: expect.objectContaining({ behavior: 'wake' }),
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
        { question: 'when?' } as any,
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
      createRemindMemory: () => createRemindMemoryStub(),
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

  it('acknowledges accepted delivery without waiting for the reminder model', async () => {
    const { tools, generateSpy } = createAskTool({
      generate: async () => {
        throw new Error('reminder provider unavailable');
      },
    });
    try {
      const result: any = await tools.ask_memory.execute!({ question: 'when?' } as any, askContext());
      expect(result).toEqual(expect.objectContaining({ ok: true, accepted: true, status: 'pending' }));
      await settle();
    } finally {
      generateSpy.mockRestore();
    }
  });

  it('does not fabricate a terminal signal when the accepted reminder run later fails', async () => {
    const { tools, generateSpy, registry } = createAskTool({
      generate: async () => {
        throw new Error('reminder provider unavailable');
      },
    });
    const capture = signalCapture();
    try {
      const result: any = await tools.ask_memory.execute!(
        { question: 'when?' } as any,
        askContext({ mastra: capture.mastra }),
      );
      await settle();
      expect(result).toEqual(expect.objectContaining({ ok: true, accepted: true, status: 'pending' }));
      expect(capture.sent).toEqual([]);
      expect(registry.get(result.correlationId)?.status).toBe('pending');
    } finally {
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
        tools.ask_memory.execute!({ question: 'the first one?' } as any, context),
        tools.ask_memory.execute!({ question: 'the second one?' } as any, context),
      ]);
      await settle();
      expect(one.correlationId).not.toBe(two.correlationId);
      const byId = new Map(capture.sent.map(signal => [signal.attributes.correlationId, signal]));
      expect(byId.get(one.correlationId)?.contents).toBe('answer one');
      expect(byId.get(two.correlationId)?.contents).toBe('answer two');
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
    const item = await store.appendKnowledge({
      node,
      text: 'Project Atlas launches January 15.',
      scope: ['org:acme', 'resource:user-42'],
      sourceThreadId: 'beta',
      resolutionScope: ['org:acme', 'resource:user-42', 'thread:beta'],
      defaultScope: ['org:acme', 'resource:user-42'],
    });

    let releaseAsk: (value: { text: string }) => void = () => {};
    const pendingAsk = new Promise<{ text: string }>(resolve => (releaseAsk = resolve));
    const registry = new RemindRequestRegistry();
    const tools = createRemindAskTool({
      memory: context.memory,
      config: { name: 'remind', maxSteps: 3, builtIn: true },
      omModel: createModel('unused'),
      createRemindMemory: () => createRemindMemoryStub(),
      registry,
    });
    // The passive reply cites the item id: the grounded-citation guard suppresses
    // reminders that reference no candidate, and this test is about signal shape.
    // Both entry points use sendMessage on the shared reminder conversation. Passive work owns its
    // output; question work is accepted immediately and can only answer through the bound reply tool.
    const sendSpy = vi.spyOn(Agent.prototype, 'sendMessage' as any);
    sendSpy.mockImplementation(function (_input: any, opts: any) {
      const input = _input as { metadata?: Record<string, unknown> } | string;
      if (typeof input === 'string') {
        return {
          accepted: Promise.resolve({
            action: 'wake',
            output: {
              consumeStream: vi.fn(async () => {}),
              getFullOutput: vi.fn(async () => ({ text: `Atlas ships mid January, worth checking. (${item.id})` })),
            },
          }),
        };
      }
      void pendingAsk.then(async answer => {
        const processor = createReplyToolProcessor(registry, {
          remindThreadId: opts?.threadId,
          resourceId: opts?.resourceId,
        });
        const processed = await processor.processInputStep?.({ messages: [input], tools: {} } as any);
        if (!processed || !('tools' in processed)) return;
        await (processed.tools?.reply_to_memory_question as any).execute(
          { correlationId: input.metadata?.correlationId, answer: answer.text },
          { agent: { threadId: opts?.threadId, resourceId: opts?.resourceId } },
        );
      });
      return { accepted: Promise.resolve({ action: 'deliver', runId: 'run-ask' }) };
    } as any);

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

      const acknowledgement: any = await askInFlight;
      expect(acknowledgement).toEqual(
        expect.objectContaining({ ok: true, accepted: true, status: 'pending', correlationId: expect.any(String) }),
      );
      releaseAsk({ text: 'January 15.' });
      await vi.waitFor(() => expect(registry.get(acknowledgement.correlationId)?.status).toBe('replied'));
      const targets = sendSpy.mock.calls.map(([, target]: any[]) => target);
      expect(targets).toHaveLength(2);
      expect(targets.every(target => target.threadId === 'subconscious:alpha:remind')).toBe(true);
    } finally {
      sendSpy.mockRestore();
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

describe('reminder conversation serialization (real runtime)', () => {
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
    // The scripted model answers each question exactly once, the way a well-behaved reminder agent
    // does: the id it has already replied to gets no second reply.
    const repliedTo = new Set<string>();
    const model = new MockLanguageModelV2({
      doStream: async ({ prompt }: any) => {
        const transcript = JSON.stringify(prompt);

        // The open question is the last correlation id the model can see. Answering means calling
        // the reply tool with it — the run's text alone would settle nothing.
        const ids = [...transcript.matchAll(/correlationId: (remind-ask-[0-9a-f-]+)/g)].map(match => match[1]);
        const correlationId = ids[ids.length - 1]!;
        const answered = repliedTo.has(correlationId);
        if (answered) {
          // The follow-up turn after the tool result: nothing left to say.
          return {
            stream: convertArrayToReadableStream([
              { type: 'stream-start', warnings: [] },
              { type: 'response-metadata', id: 'conversation-done', modelId: 'remind-model', timestamp: new Date() },
              { type: 'finish', finishReason: 'stop', usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 } },
            ]),
            rawCall: { rawPrompt: null, rawSettings: {} },
            warnings: [],
          };
        }
        const index = streamCalls++;
        if (index === 0) await firstGate;
        repliedTo.add(correlationId);
        // The conversation thread carries every earlier question too, so the answer is chosen from the
        // question that owns the OPEN correlation id — not from whatever text is in scrollback.
        const asked = new RegExp(`correlationId: ${correlationId}[^:]*: (first|second) question`).exec(transcript)?.[1];
        const text = `answer-${asked}`;
        return {
          stream: convertArrayToReadableStream([
            { type: 'stream-start', warnings: [] },
            { type: 'response-metadata', id: `conversation-${index}`, modelId: 'remind-model', timestamp: new Date() },
            { type: 'text-start', id: 'text-1' },
            { type: 'text-delta', id: 'text-1', delta: text },
            { type: 'text-end', id: 'text-1' },
            {
              type: 'tool-call',
              toolCallId: `reply-${index}`,
              toolName: 'reply_to_memory_question',
              input: JSON.stringify({ correlationId, answer: text }),
            },
            {
              type: 'finish',
              finishReason: 'tool-calls',
              usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 },
            },
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
    const sent: any[] = [];
    const sourceAgent = {
      sendSignal: vi.fn((signal: any) => {
        sent.push(signal);
        return { accepted: Promise.resolve({ action: 'deliver' }) };
      }),
    };
    const context = () => {
      const requestContext = new RequestContext();
      requestContext.set('organizationId', 'acme');
      return {
        agent: { agentId: 'main', threadId: 'alpha', resourceId: 'user-42' },
        requestContext,
        mastra: { getAgentById: vi.fn(async () => sourceAgent) },
      } as any;
    };

    const first = tools.ask_memory.execute!({ question: 'first question' } as any, context());
    // Wait for the first run to actually reach the model (run active on the conversation thread).
    await vi.waitFor(() => expect(streamCalls).toBeGreaterThan(0), { timeout: 10_000 });
    const second = tools.ask_memory.execute!({ question: 'second question' } as any, context());
    // Give the runtime a beat to route the second ask while the first is mid-stream, then
    // release the first turn.
    await new Promise(resolve => setTimeout(resolve, 25));
    expect(streamCalls).toBe(1); // second must be queued, not running concurrently
    releaseFirst();

    const [firstResult, secondResult] = (await Promise.all([first, second])) as any[];
    expect(firstResult).toEqual(expect.objectContaining({ ok: true, accepted: true, status: 'pending' }));
    expect(secondResult).toEqual(expect.objectContaining({ ok: true, accepted: true, status: 'pending' }));
    await vi.waitFor(() => expect(sent).toHaveLength(2), { timeout: 10_000 });
    const answers = new Map(sent.map(signal => [signal.attributes.correlationId, signal.contents]));
    expect(answers.get(firstResult.correlationId)).toBe('answer-first');
    expect(answers.get(secondResult.correlationId)).toBe('answer-second');

    // The persisted transcript is the contract: question, its answer, next question, its answer.
    // Queued conversation entries persist with the runtime's signal role rather than user — the causal
    // pairing, not the role label, is what the concurrency bug corrupted.
    const memoryStore = await (
      remindMemory as unknown as { getMemoryStore(): Promise<MemoryStorage> }
    ).getMemoryStore();
    // The reply tool settles the asker before the conversation run finishes writing its own turn, so the
    // transcript lands slightly after the answers do — wait for the run's persistence, not a sleep.
    const messages = await vi.waitFor(
      async () => {
        const listed = await memoryStore.listMessages({ threadId: 'subconscious:alpha:remind' });
        expect(listed.messages.length).toBeGreaterThanOrEqual(4);
        return listed.messages;
      },
      { timeout: 10000 },
    );
    const transcript = messages.map(message => {
      const parts = (message.content as { parts?: Array<{ type: string; text?: string }> })?.parts ?? [];
      const text = parts
        .filter(part => part.type === 'text')
        .map(part => part.text ?? '')
        .join('');
      return `${message.role}:${text.includes('first question') ? 'first' : text.includes('second question') ? 'second' : text}`;
    });
    expect(transcript).toEqual(['signal:first', 'assistant:answer-first', 'signal:second', 'assistant:answer-second']);
  }, 30_000);
});

describe('correlated request lifecycle (real runtime)', () => {
  // These cases drive the REAL Agent + thread-stream runtime over shared storage. The only scripted
  // piece is the model, because the contract under test is request identity, not provider behaviour.
  type ScriptedStream = (args: { prompt: unknown }) => Promise<any>;

  const openIds = (transcript: string) =>
    [...transcript.matchAll(/correlationId: (remind-ask-[0-9a-f-]+)/g)].map(m => m[1]!);

  let conversationSeq = 0;

  const silentTurn = (id: string) => ({
    stream: convertArrayToReadableStream([
      { type: 'stream-start', warnings: [] },
      { type: 'response-metadata', id, modelId: 'remind-model', timestamp: new Date() },
      { type: 'finish', finishReason: 'stop', usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 } },
    ]),
    rawCall: { rawPrompt: null, rawSettings: {} },
    warnings: [],
  });

  const replyTurn = (id: string, correlationId: string, answer: string) => ({
    stream: convertArrayToReadableStream([
      { type: 'stream-start', warnings: [] },
      { type: 'response-metadata', id, modelId: 'remind-model', timestamp: new Date() },
      { type: 'text-start', id: 'text-1' },
      { type: 'text-delta', id: 'text-1', delta: answer },
      { type: 'text-end', id: 'text-1' },
      {
        type: 'tool-call',
        toolCallId: `reply-${id}`,
        toolName: 'reply_to_memory_question',
        input: JSON.stringify({ correlationId, answer }),
      },
      { type: 'finish', finishReason: 'tool-calls', usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 } },
    ]),
    rawCall: { rawPrompt: null, rawSettings: {} },
    warnings: [],
  });

  async function currentInputTools(agent: Agent, input: any) {
    let tools: Record<string, any> = {};
    for (const processor of await agent.listConfiguredInputProcessors()) {
      if (!('processInputStep' in processor) || !processor.processInputStep) continue;
      const result = await processor.processInputStep({
        messages: [{ metadata: input?.metadata, content: input?.contents ?? input?.content }],
        tools,
      } as any);
      if (result && !Array.isArray(result) && 'tools' in result && result.tools)
        tools = result.tools as Record<string, any>;
    }
    return tools;
  }

  async function reminderConversation(options: {
    doStream: ScriptedStream;
    registry?: RemindRequestRegistry;
    maxSteps?: number;
  }) {
    const { Memory } = await import('../../../index');
    // Each case gets its own parent thread: reminder agents are keyed by it, so sharing one would let
    // a previous case's still-live conversation run answer this case's questions.
    conversationSeq += 1;
    const parentThreadId = `alpha-${conversationSeq}`;
    const remindMemory = new Memory({ storage: new InMemoryStore() });
    const tools = createRemindAskTool({
      memory: { storage: new InMemoryStore(), getKnowledgeSemanticIndex: vi.fn() } as any,
      config: { name: 'remind', maxSteps: options.maxSteps ?? 3, builtIn: true },
      omModel: new MockLanguageModelV2({ doStream: options.doStream as any }) as any,
      createRemindMemory: () => remindMemory as any,
      ...(options.registry ? { registry: options.registry } : {}),
    });
    const sent: any[] = [];
    const signalAgent = {
      sendSignal: (signal: any) => {
        sent.push(signal);
        return { accepted: Promise.resolve({ action: 'deliver' }), persisted: Promise.resolve() };
      },
    };
    const context = (extra: Record<string, unknown> = {}) => {
      const requestContext = new RequestContext();
      requestContext.set('organizationId', 'acme');
      return {
        agent: { agentId: 'main', threadId: parentThreadId, resourceId: 'user-42' },
        requestContext,
        mastra: { getAgentById: () => signalAgent },
        ...extra,
      } as any;
    };
    return {
      tools,
      context,
      sent,
      remindMemory,
      parentThreadId,
      remindThreadId: `subconscious:${parentThreadId}:remind`,
    };
  }

  it('gives each question delivered to one active run the answer for its own correlation id', async () => {
    // The invariant is co-residency: both questions open inside ONE run, answered out of order, so a
    // registry leaning on arrival order or on the run's final text would cross the wires. A model
    // step only ever sees the prompt it was handed, so waiting inside a step cannot make a later
    // delivery appear in it — the run has to take another step before the second question is visible.
    // Until both are visible this poking turn keeps the run alive without answering anything, and the
    // count of what was open when the first answer went out is asserted below: a run that only ever
    // saw one question at a time fails here instead of passing on the weaker property.
    let release!: () => void;
    const gate = new Promise<void>(resolve => (release = resolve));
    const replied = new Set<string>();
    let reachedModel = false;
    let openWhenAnswered = 0;
    let pokes = 0;
    let step = 0;
    const { tools, context, sent } = await reminderConversation({
      maxSteps: 12,
      doStream: async ({ prompt }: any) => {
        const open = openIds(JSON.stringify(prompt)).filter(id => !replied.has(id));
        if (!reachedModel) {
          reachedModel = true;
          await gate;
        }
        if (open.length === 0) return silentTurn(`idle-${step++}`);
        if (open.length === 1 && openWhenAnswered === 0 && pokes < 6) {
          pokes += 1;
          // A reply naming a question that does not exist is refused without settling anything, so it
          // costs the protocol nothing and buys the run another step to receive the second question.
          return replyTurn(`poke-${pokes}`, 'remind-ask-00000000-0000-4000-8000-000000000000', 'ignored');
        }
        if (open.length > 1) openWhenAnswered = open.length;
        // Answer the LAST open question first once both are in hand.
        const id = openWhenAnswered > 0 ? open[open.length - 1]! : open[0]!;
        replied.add(id);
        return replyTurn(`t-${step++}`, id, `answer-for-${id}`);
      },
    });

    const first = tools.ask_memory.execute!({ question: 'first question' } as any, context());
    await vi.waitFor(() => expect(reachedModel).toBe(true), { timeout: 10_000 });
    const second = tools.ask_memory.execute!({ question: 'second question' } as any, context());
    release();

    const [a, b] = (await Promise.all([first, second])) as any[];
    expect(a).toEqual(expect.objectContaining({ ok: true, accepted: true, status: 'pending' }));
    expect(b).toEqual(expect.objectContaining({ ok: true, accepted: true, status: 'pending' }));
    await vi.waitFor(() => expect(sent).toHaveLength(2), { timeout: 10_000 });
    // Without this the rest of the assertions also hold when the two questions never met in one run.
    expect(openWhenAnswered).toBe(2);
    const answers = new Map(sent.map(signal => [signal.attributes.correlationId, signal.contents]));
    expect(answers.get(a.correlationId)).toBe(`answer-for-${a.correlationId}`);
    expect(answers.get(b.correlationId)).toBe(`answer-for-${b.correlationId}`);
    expect(a.correlationId).not.toBe(b.correlationId);
  }, 30_000);

  it('settles delivery_failed instead of leaking a pending request when building the conversation agent throws', async () => {
    // `createRemindMemory` touches real storage, so it can throw before anything is dispatched. The
    // correlation id is minted first by design, which means a throw on the way to the transport must
    // still land on that id — otherwise the caller gets an error while the registry holds a pending
    // record nobody can answer until the deadline reaps it.
    const registry = new RemindRequestRegistry();
    // The id is captured at registration rather than read off the result: when the throw escapes the
    // guard the caller gets a bare failure with no correlation id at all, and an assertion that leans
    // on the result would fail on the missing id and never reach the record it is supposed to inspect.
    const registered: string[] = [];
    const create = registry.create.bind(registry);
    vi.spyOn(registry, 'create').mockImplementation((args: any) => {
      registered.push(args.correlationId);
      return create(args);
    });
    const tools = createRemindAskTool({
      memory: { storage: new InMemoryStore(), getKnowledgeSemanticIndex: vi.fn() } as any,
      config: { name: 'remind', maxSteps: 3, builtIn: true },
      omModel: new MockLanguageModelV2({ doStream: (async () => silentTurn('unused')) as any }) as any,
      createRemindMemory: () => {
        throw new Error('remind memory unavailable');
      },
      registry,
    });
    const requestContext = new RequestContext();
    requestContext.set('organizationId', 'acme');

    const result: any = await tools.ask_memory.execute!(
      { question: 'anything' } as any,
      {
        agent: { agentId: 'main', threadId: 'leak-thread', resourceId: 'user-42' },
        requestContext,
        mastra: { getAgentById: () => ({ sendSignal: () => ({ persisted: Promise.resolve() }) }) },
      } as any,
    );

    // The leak assertion comes first and stands on its own: the registered id reached a terminal
    // state rather than sitting pending on a two-minute timer. (Settled records are retained briefly
    // for idempotent retries, so the registry is legitimately non-empty here — pending is the bug.)
    expect(registered).toHaveLength(1);
    expect(registry.get(registered[0]!)?.status).toBe('delivery_failed');
    // And the caller is told, on the same id.
    expect(result.ok).toBe(false);
    expect(result.status).toBe('delivery_failed');
    expect(result.correlationId).toBe(registered[0]);
    expect(result.error).toContain('remind memory unavailable');
  });

  it('tells a detached caller the truth when dispatch already failed instead of acknowledging pending', async () => {
    // Both modes share one dispatch, so a construction failure settles the request before the
    // detached branch gets to acknowledge it. Reporting `pending` there would leave the caller
    // holding an id that already died, waiting on a signal for an answer that is never coming.
    const registry = new RemindRequestRegistry();
    const tools = createRemindAskTool({
      memory: { storage: new InMemoryStore(), getKnowledgeSemanticIndex: vi.fn() } as any,
      config: { name: 'remind', maxSteps: 3, builtIn: true },
      omModel: new MockLanguageModelV2({ doStream: (async () => silentTurn('unused')) as any }) as any,
      createRemindMemory: () => {
        throw new Error('remind memory unavailable');
      },
      registry,
    });
    const requestContext = new RequestContext();
    requestContext.set('organizationId', 'acme');
    const sent: any[] = [];

    const result: any = await tools.ask_memory.execute!(
      { question: 'anything' } as any,
      {
        agent: { agentId: 'main', threadId: 'detached-dead', resourceId: 'user-42' },
        requestContext,
        mastra: {
          getAgentById: () => ({
            sendSignal: (signal: any) => {
              sent.push(signal);
              return { persisted: Promise.resolve() };
            },
          }),
        },
      } as any,
    );

    expect(result.ok).toBe(false);
    expect(result.status).toBe('delivery_failed');
    expect(result.accepted).toBeUndefined();
    expect(result.error).toContain('remind memory unavailable');
    // Nothing is promised over the signal channel for a failure the caller was handed directly.
    expect(sent).toHaveLength(0);
  });

  it('sends every accepted question down the same dispatch path', async () => {
    const seen: string[] = [];
    const { tools, context, sent, parentThreadId, remindThreadId } = await reminderConversation({
      doStream: async ({ prompt }: any) => {
        const transcript = JSON.stringify(prompt);
        const ids = openIds(transcript);
        const id = ids[ids.length - 1]!;
        if (seen.includes(id)) return silentTurn(`idle-${id}`);
        seen.push(id);
        return replyTurn(`t-${seen.length}`, id, `answer-${seen.length}`);
      },
    });
    const sendSpy = vi.spyOn(Agent.prototype, 'sendMessage');
    try {
      const first: any = await tools.ask_memory.execute!({ question: 'first' } as any, context());
      const second: any = await tools.ask_memory.execute!({ question: 'second' } as any, context());

      // Both modes went through sendMessage with the same shape: identity in the visible content AND
      // the structured metadata, addressed to the shared conversation.
      expect(sendSpy).toHaveBeenCalledTimes(2);
      for (const [input, target] of sendSpy.mock.calls as any[]) {
        expect(input.metadata).toEqual(expect.objectContaining({ kind: 'remind-ask', parentThreadId, remindThreadId }));
        expect(input.contents).toContain(input.metadata.correlationId);
        expect(target).toEqual(expect.objectContaining({ threadId: remindThreadId, resourceId: 'user-42' }));
      }
      expect(first).toEqual(
        expect.objectContaining({ ok: true, accepted: true, status: 'pending', correlationId: expect.any(String) }),
      );
      expect(second).toEqual(
        expect.objectContaining({ ok: true, accepted: true, status: 'pending', correlationId: expect.any(String) }),
      );
      // Both answers land later on their own ids — one delivery each, no fabricated answer up front.
      await vi.waitFor(
        () => {
          expect(sent.filter(s => s.attributes?.correlationId === first.correlationId)).toHaveLength(1);
          expect(sent.filter(s => s.attributes?.correlationId === second.correlationId)).toHaveLength(1);
        },
        { timeout: 10_000 },
      );
    } finally {
      sendSpy.mockRestore();
    }
  }, 30_000);

  it('keeps one terminal result when the model replies twice, and rejects unknown or completed ids', async () => {
    const replies: Record<string, number> = {};
    const { tools, context, sent } = await reminderConversation({
      doStream: async ({ prompt }: any) => {
        const transcript = JSON.stringify(prompt);
        const id = openIds(transcript).pop()!;
        replies[id] = (replies[id] ?? 0) + 1;
        // Answer the SAME question a second time with the same answer: an exact retry must be
        // idempotent rather than a second terminal event.
        if (replies[id] <= 2) return replyTurn(`t-${id}-${replies[id]}`, id, 'the answer');
        return silentTurn(`idle-${id}`);
      },
    });

    const detached: any = await tools.ask_memory.execute!({ question: 'twice' } as any, context());
    await vi.waitFor(
      () => expect(sent.filter(s => s.attributes?.correlationId === detached.correlationId).length).toBeGreaterThan(0),
      { timeout: 10_000 },
    );

    // Barrier: a full round trip through the same runtime AFTER the first delivery. A delayed second
    // terminal event would have to land before this completes, so silence afterwards is real.
    const barrier: any = await tools.ask_memory.execute!({ question: 'barrier' } as any, context());
    expect(barrier.status).toBe('pending');
    await vi.waitFor(
      () => expect(sent.filter(s => s.attributes?.correlationId === barrier.correlationId)).toHaveLength(1),
      { timeout: 10_000 },
    );
    expect(sent.filter(s => s.attributes?.correlationId === detached.correlationId)).toHaveLength(1);
    expect(replies[detached.correlationId]).toBeGreaterThan(1); // the model really did try twice
  }, 30_000);

  it('times out a question the conversation never answers and refuses the late reply', async () => {
    // Long enough for the conversation run to actually reach the model, short enough to expire in-test: the
    // deadline must fire on a question the runtime really carried, not on one that never left.
    const registry = new RemindRequestRegistry({ deadlineMs: 2_000 });
    let sawQuestion = false;
    const { tools, context } = await reminderConversation({
      registry,
      doStream: async ({ prompt }: any) => {
        sawQuestion = openIds(JSON.stringify(prompt)).length > 0;
        // A run that produces text but never calls the reply tool settles nothing.
        return silentTurn('mute');
      },
    });

    const result: any = await tools.ask_memory.execute!({ question: 'never answered' } as any, context());
    await vi.waitFor(() => expect(sawQuestion).toBe(true), { timeout: 10_000 });
    expect(result).toEqual(
      expect.objectContaining({ ok: true, accepted: true, status: 'pending', correlationId: expect.any(String) }),
    );
    await vi.waitFor(() => expect(registry.get(result.correlationId)?.status).toBe('timed_out'), { timeout: 10_000 });

    // The late reply arrives after the deadline: the recorded terminal result stands.
    const record = registry.get(result.correlationId)!;
    const late = registry.reserveTerminal(result.correlationId, record.conversation);
    expect(late.outcome).toBe('rejected');
    expect(registry.get(result.correlationId)?.status).toBe('timed_out');
  }, 30_000);

  it('records model failure after an accepted question without fabricating an answer', async () => {
    const registry = new RemindRequestRegistry();
    const { tools, context, sent } = await reminderConversation({
      registry,
      doStream: async () => {
        throw new Error('model exploded');
      },
    });
    const result: any = await tools.ask_memory.execute!({ question: 'boom' } as any, context());
    expect(result).toEqual(
      expect.objectContaining({ ok: true, accepted: true, status: 'pending', correlationId: expect.any(String) }),
    );
    await vi.waitFor(() => expect(registry.get(result.correlationId)?.status).toBe('model_failed'), {
      timeout: 10_000,
    });
    expect(registry.get(result.correlationId)?.failure?.message).toContain('model exploded');
    expect(sent).toHaveLength(0);
  }, 30_000);

  it('refuses a reply that comes from outside the reminder conversation that owns the question', async () => {
    // Trusted identity is the execution context, not the model's input: the same well-formed answer
    // is rejected under a foreign thread and accepted under the owning one.
    const { tools, context, remindThreadId, sent } = await reminderConversation({
      doStream: async () => silentTurn('never'),
    });
    let rejected: any;
    const sendSpy = vi.spyOn(Agent.prototype, 'sendMessage' as any);
    sendSpy.mockImplementation(function (this: any, input: any, opts: any) {
      const accepted = (async () => {
        const agentTools = await currentInputTools(this, input);
        const correlationId = input?.metadata?.correlationId;
        rejected = await agentTools.reply_to_memory_question.execute(
          { correlationId, answer: 'from the wrong room' },
          { agent: { threadId: 'subconscious:someone-else:remind', resourceId: 'user-99' } },
        );
        await agentTools.reply_to_memory_question.execute(
          { correlationId, answer: 'from the right room' },
          { agent: { threadId: opts?.threadId, resourceId: opts?.resourceId } },
        );
        return { action: 'wake', runId: 'run-stub' };
      })();
      return { accepted };
    } as any);
    try {
      const result: any = await tools.ask_memory.execute!({ question: 'whose question is this' } as any, context());
      expect(result).toEqual(expect.objectContaining({ ok: true, accepted: true, status: 'pending' }));
      expect(rejected).toEqual(expect.objectContaining({ ok: false }));
      expect(rejected.error).toMatch(/another conversation/);
      await vi.waitFor(() => expect(sent).toHaveLength(1), { timeout: 10_000 });
      expect(sent[0]).toEqual(
        expect.objectContaining({
          contents: 'from the right room',
          attributes: expect.objectContaining({ correlationId: result.correlationId, status: 'replied' }),
        }),
      );
      expect(remindThreadId).toContain(':remind');
    } finally {
      sendSpy.mockRestore();
    }
  }, 30_000);

  it('keeps accepted reminder work alive when the calling turn aborts', async () => {
    let release!: () => void;
    const gate = new Promise<void>(resolve => (release = resolve));
    const replied = new Set<string>();
    const { tools, context, sent } = await reminderConversation({
      doStream: async ({ prompt }: any) => {
        const open = openIds(JSON.stringify(prompt)).filter(id => !replied.has(id));
        if (open.length === 0) return silentTurn('idle');
        await gate;
        const id = open[open.length - 1]!;
        replied.add(id);
        return replyTurn('t-1', id, `answer-for-${id}`);
      },
    });

    const controller = new AbortController();
    const accepted: any = await tools.ask_memory.execute!(
      { question: 'abandoned question' } as any,
      context({ abortSignal: controller.signal }),
    );
    expect(accepted).toEqual(expect.objectContaining({ ok: true, accepted: true, status: 'pending' }));
    controller.abort();
    release();
    await vi.waitFor(
      () => expect(sent.some(signal => signal.attributes?.correlationId === accepted.correlationId)).toBe(true),
      { timeout: 10_000 },
    );

    // Aborting the source turn did not cancel the reminder runtime or its accepted work.
    const next: any = await tools.ask_memory.execute!({ question: 'still working' } as any, context());
    expect(next).toEqual(expect.objectContaining({ ok: true, accepted: true }));
    expect(next.correlationId).not.toBe(accepted.correlationId);
  }, 30_000);

  it('fails the question when the run dies before sendMessage finishes handing back its run id', async () => {
    // The failure beats `accepted` home. Without the stashed run token the request would sit pending
    // until the deadline instead of reporting the failure that already happened.
    const { tools, context } = await reminderConversation({ doStream: async () => silentTurn('never') });
    const sendSpy = vi.spyOn(Agent.prototype, 'sendMessage' as any);
    sendSpy.mockImplementation(function (this: any, _input: any, opts: any) {
      opts?.ifIdle?.streamOptions?.onError?.({ error: new Error('died on the way out') });
      return {
        accepted: new Promise(resolve => setTimeout(() => resolve({ action: 'wake', runId: 'run-late' }), 20)),
      };
    } as any);
    try {
      const result: any = await tools.ask_memory.execute!({ question: 'fast failure' } as any, context());
      expect(result).toEqual(
        expect.objectContaining({ ok: false, status: 'model_failed', correlationId: expect.any(String) }),
      );
    } finally {
      sendSpy.mockRestore();
    }
  }, 30_000);

  it('lets a detached request outlive an aborted caller turn', async () => {
    let release!: () => void;
    const gate = new Promise<void>(resolve => (release = resolve));
    const replied = new Set<string>();
    const { tools, context, sent } = await reminderConversation({
      doStream: async ({ prompt }: any) => {
        const open = openIds(JSON.stringify(prompt)).filter(id => !replied.has(id));
        if (open.length === 0) return silentTurn('idle');
        await gate;
        const id = open[open.length - 1]!;
        replied.add(id);
        return replyTurn('t-1', id, 'answered after the caller left');
      },
    });

    const controller = new AbortController();
    const ack: any = await tools.ask_memory.execute!(
      { question: 'detached and abandoned' } as any,
      context({ abortSignal: controller.signal }),
    );
    expect(ack.status).toBe('pending');
    // The asking turn ends. Detached work is supposed to survive that, unlike a blocking wait.
    controller.abort();
    release();

    await vi.waitFor(
      () => expect(sent.filter(s => s.attributes?.correlationId === ack.correlationId)).toHaveLength(1),
      { timeout: 10_000 },
    );
    const delivered = sent.find(s => s.attributes?.correlationId === ack.correlationId);
    expect(delivered?.attributes?.status).toBe('replied');
  }, 30_000);

  it('rejects unknown replies and deduplicates terminal retries without retaining answer payloads', async () => {
    const outcomes: any[] = [];
    const { tools, context, sent } = await reminderConversation({ doStream: async () => silentTurn('never') });
    const sendSpy = vi.spyOn(Agent.prototype, 'sendMessage' as any);
    sendSpy.mockImplementation(function (this: any, input: any, opts: any) {
      const accepted = (async () => {
        const agentTools = await currentInputTools(this, input);
        const correlationId = input?.metadata?.correlationId;
        const conversationContext = { agent: { threadId: opts?.threadId, resourceId: opts?.resourceId } };
        outcomes.push([
          'unknown',
          await agentTools.reply_to_memory_question.execute(
            { correlationId: 'remind-ask-00000000-0000-4000-8000-000000000000', answer: 'nobody asked' },
            conversationContext,
          ),
        ]);
        outcomes.push([
          'first',
          await agentTools.reply_to_memory_question.execute(
            { correlationId, answer: 'the answer' },
            conversationContext,
          ),
        ]);
        outcomes.push([
          'retry',
          await agentTools.reply_to_memory_question.execute(
            { correlationId, answer: 'a different answer' },
            conversationContext,
          ),
        ]);
        return { action: 'wake', runId: 'run-stub' };
      })();
      return { accepted };
    } as any);
    try {
      const result: any = await tools.ask_memory.execute!({ question: 'protocol errors' } as any, context());
      expect(result).toEqual(expect.objectContaining({ ok: true, accepted: true, status: 'pending' }));
      await vi.waitFor(() => expect(outcomes).toHaveLength(3), { timeout: 10_000 });
      const byName = Object.fromEntries(outcomes);
      expect(byName.unknown).toEqual(expect.objectContaining({ ok: false }));
      expect(byName.unknown.error).toMatch(/not part of the current reminder input/);
      expect(byName.first).toEqual(expect.objectContaining({ ok: true, delivered: true }));
      expect(byName.retry).toEqual(expect.objectContaining({ ok: true, duplicate: true }));
      expect(sent).toHaveLength(1);
      expect(sent[0].contents).toBe('the answer');
    } finally {
      sendSpy.mockRestore();
    }
  }, 30_000);

  it('reports delivery_failed when the conversation refuses the message outright', async () => {
    const { tools, context } = await reminderConversation({ doStream: async () => silentTurn('never') });
    const sendSpy = vi.spyOn(Agent.prototype, 'sendMessage').mockReturnValue({
      accepted: Promise.resolve({ action: 'blocked', reason: 'thread-blocked' }),
    } as any);
    try {
      const result: any = await tools.ask_memory.execute!({ question: 'refused' } as any, context());
      expect(result).toEqual(
        expect.objectContaining({ ok: false, status: 'delivery_failed', correlationId: expect.any(String) }),
      );
    } finally {
      sendSpy.mockRestore();
    }
  }, 30_000);

  it('persists the correlation id in both the visible message and its metadata', async () => {
    const answered = new Set<string>();
    const { tools, context, remindMemory, remindThreadId } = await reminderConversation({
      doStream: async ({ prompt }: any) => {
        const id = openIds(JSON.stringify(prompt)).pop();
        if (!id || answered.has(id)) return silentTurn('idle');
        answered.add(id);
        return replyTurn('t-1', id, 'persisted answer');
      },
    });
    const result: any = await tools.ask_memory.execute!({ question: 'remember me' } as any, context());
    expect(result).toEqual(expect.objectContaining({ ok: true, accepted: true, status: 'pending' }));

    const store = await (remindMemory as unknown as { getMemoryStore(): Promise<MemoryStorage> }).getMemoryStore();
    const listed = await vi.waitFor(
      async () => {
        const messages = await store.listMessages({ threadId: remindThreadId });
        expect(messages.messages.length).toBeGreaterThan(0);
        return messages.messages;
      },
      { timeout: 10_000 },
    );
    const question = listed.find(message => JSON.stringify(message.content).includes(result.correlationId));
    expect(question).toBeDefined();
    expect((question!.content as any)?.metadata?.signal?.metadata).toEqual(
      expect.objectContaining({ correlationId: result.correlationId, kind: 'remind-ask' }),
    );
  }, 30_000);
});
