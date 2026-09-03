import { MockLanguageModelV2, convertArrayToReadableStream } from '@internal/ai-sdk-v5/test';
import { Knowledge } from '@mastra/core/knowledge';
import { RequestContext } from '@mastra/core/request-context';
import { InMemoryStore } from '@mastra/core/storage';
import { describe, expect, it, vi } from 'vitest';

import { applyExtractorHooks } from '../extracted-values';
import { buildExtractorOutputSections, Extractor } from '../extractor';
import { SubconsciousRemindExtractor } from '../subconscious';
import { resolveKnowledgeScopeIds } from '../subconscious/knowledge-tools';

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
  const storage = new InMemoryStore();
  const knowledge = new Knowledge({ id: 'default', storage });
  const memory = {
    storage,
    getKnowledgeInstance: () => knowledge,
    getKnowledgeStore: async () => (await storage.getStore('knowledge'))!,
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

async function getResourceScopeIds(context: ReturnType<typeof createContext>) {
  const scopeIds = await resolveKnowledgeScopeIds(context.memory, {
    agent: { threadId: context.threadId, resourceId: context.resourceId },
    requestContext: context.requestContext,
  });
  return [scopeIds[1]!];
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
    const knowledge = context.memory.getKnowledgeInstance();
    const search = vi.spyOn(knowledge, 'search');
    const getRecord = vi.spyOn(knowledge, 'getRecord');
    const store = await context.memory.storage.getStore('knowledge');
    const scopeIds = await resolveKnowledgeScopeIds(context.memory, {
      agent: { threadId: context.threadId, resourceId: context.resourceId },
      requestContext: context.requestContext,
    });
    const companionScope = [scopeIds[3]!];
    const node = await store.createNode({
      name: 'Project Atlas',
      kind: 'project',
      scopeIds: companionScope,
    });
    const record = await store.createRecord({
      node,
      text: 'Project Atlas launches January 15.',
      scopeIds: companionScope,
      source: 'beta',
      metadata: { sourceThreadId: 'beta' },
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
    expect(search).toHaveBeenCalled();
    expect(getRecord).toHaveBeenCalledWith(expect.objectContaining({ id: record.id, scopeIds: scopeIds.slice(1) }));
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
        scopeIds: await getResourceScopeIds(context),
      });
      await store.createRecord({
        node,
        text: 'Project Atlas launches January 15.',
        scopeIds: await getResourceScopeIds(context),
        source: 'alpha',
        metadata: { sourceThreadId: 'alpha' },
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
      scopeIds: await getResourceScopeIds(context),
    });
    const item = await store.createRecord({
      id: recordId,
      node: node.id,
      text: 'Project Atlas launches January 15.',
      scopeIds: await getResourceScopeIds(context),
      source: 'beta',
      metadata: { sourceThreadId: 'beta' },
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

  it("does not echo the thread's own freshly captured or learned records back as reminders", async () => {
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
      scopeIds: await getResourceScopeIds(context),
    });
    // Learned by THIS thread moments ago without legacy source metadata: the reminder must not whisper it back.
    await store.createRecord({
      node: node.id,
      text: 'The launch happens January 15.',
      scopeIds: await getResourceScopeIds(context),
      source: 'subconscious:alpha:learn',
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
      scopeIds: await getResourceScopeIds(context),
    });
    // Written moments ago by this thread's own curator sub-thread.
    await store.createRecord({
      node: node.id,
      text: 'The launch happens January 15.',
      scopeIds: await getResourceScopeIds(context),
      source: 'subconscious:alpha:curate',
      metadata: { sourceThreadId: 'subconscious:alpha:curate' },
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
        scopeIds: await getResourceScopeIds(context),
      });
      const item = await store.createRecord({
        node: node.id,
        text: 'The launch happens January 15.',
        scopeIds: await getResourceScopeIds(context),
        source: 'alpha',
        metadata: { sourceThreadId: 'alpha' },
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
        scopeIds: await getResourceScopeIds(context),
      });
      await store.createRecord({
        node: node.id,
        text: 'The moon has no weather to speak of.',
        scopeIds: await getResourceScopeIds(context),
        source: 'beta',
        metadata: { sourceThreadId: 'beta' },
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
      scopeIds: await getResourceScopeIds(context),
    });
    await store.createRecord({
      node: node.id,
      text: 'Project Atlas launches January 15.',
      scopeIds: await getResourceScopeIds(context),
      source: 'beta',
      metadata: { sourceThreadId: 'beta' },
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
