import { MockLanguageModelV2, convertArrayToReadableStream } from '@internal/ai-sdk-v5/test';
import type { MastraDBMessage } from '@mastra/core/agent';
import { RequestContext } from '@mastra/core/request-context';
import { InMemoryStore } from '@mastra/core/storage';
import { describe, expect, it, vi } from 'vitest';

import { Memory, Subconscious } from '../../..';
import { applyExtractorHooks } from '../extracted-values';
import { buildExtractorOutputSections, Extractor } from '../extractor';
import { ObservationStrategy } from '../observation-strategies';
import { formatMessagesForObserver } from '../observer-agent';
import { SubconsciousRemindExtractor } from '../subconscious';
import {
  getRemindMessageMetadata,
  getRemindMessageText,
  getRemindThreadId,
  REMIND_PARENT_THREAD_METADATA_KEY,
} from '../subconscious/remind-protocol';
import { DEFAULT_OBSERVER_TOOL_RESULT_MAX_TOKENS, formatToolResultForObserver } from '../tool-result-helpers';

function createModel(response: string, prompts?: string[], repeatToolCall = false) {
  let streamCall = 0;
  return new MockLanguageModelV2({
    doGenerate: async () => ({
      rawCall: { rawPrompt: null, rawSettings: {} },
      finishReason: 'stop',
      usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 },
      warnings: [],
      content: [{ type: 'text', text: response }],
    }),
    doStream: async options => {
      streamCall += 1;
      prompts?.push(JSON.stringify(options.prompt));
      const sourceId = response.match(/Source(?: KnowledgeRecord)?:\s*([A-Za-z0-9_-]+)/)?.[1];
      const eventId = JSON.stringify(options.prompt).match(
        /Passive reminder check (subconscious:remind:[^"\\\\]+:event)/,
      )?.[1];
      if (streamCall <= (repeatToolCall ? 2 : 1) && sourceId && eventId) {
        const input = JSON.stringify({ eventId, reminder: response, sourceIds: [sourceId] });
        const callId = `call-${streamCall}`;
        return {
          stream: convertArrayToReadableStream([
            { type: 'stream-start', warnings: [] },
            { type: 'response-metadata', id: 'remind-1', modelId: 'remind-model', timestamp: new Date() },
            { type: 'tool-input-start', id: callId, toolName: 'send_reminder' },
            { type: 'tool-input-delta', id: callId, delta: input },
            { type: 'tool-call', toolCallId: callId, toolName: 'send_reminder', input },
            {
              type: 'finish',
              finishReason: 'tool-calls',
              usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 },
            },
          ]),
          rawCall: { rawPrompt: null, rawSettings: {} },
          warnings: [],
        };
      }
      return {
        stream: convertArrayToReadableStream([
          { type: 'stream-start', warnings: [] },
          { type: 'response-metadata', id: 'remind-2', modelId: 'remind-model', timestamp: new Date() },
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
}

function createContext(response: string, storage = new InMemoryStore()) {
  const requestContext = new RequestContext();
  requestContext.set('organizationId', 'acme');
  const memory = new Memory({ storage });
  const sendSignal = vi.fn(async () => undefined) as any;
  return {
    threadId: 'alpha',
    resourceId: 'user-42',
    mainAgent: {
      id: 'main-agent',
      getModel: vi.fn(async () => createModel(response)),
      getMastraInstance: vi.fn(),
      getPubSub: vi.fn(),
      sendSignal: vi.fn((signal: unknown, options: { ifActive: { behavior: string } }) => {
        if (options.ifActive.behavior === 'persist') {
          return { signal, accepted: Promise.resolve({ action: 'persist' }), persisted: Promise.resolve() };
        }
        void sendSignal(signal);
        return {
          signal,
          accepted: Promise.resolve({ action: 'deliver', runId: 'parent-run' }),
        };
      }),
    } as any,
    memory,
    requestContext,
    sendSignal,
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
      createModel(`Project Atlas launches January 15. Source: ${record.id}`, undefined, true),
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
    vi.useFakeTimers({ toFake: ['Date'] });
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

  it.each([
    // No accumulated memory at all, accumulated memory that mentions the candidate, and accumulated
    // memory that does not. Only the middle case can produce an excerpt.
    [undefined, false],
    ['The user already knows the moon has no weather worth planning around.', true],
    ['OLDER_VISIBLE_FACT', false],
  ])(
    'projects what the parent already knows about the candidates (%s) for the reminder agent',
    async (activeObservations, expectActiveExcerpt) => {
      const extractor = new SubconsciousRemindExtractor({
        name: 'remind',
        maxSteps: 3,
        builtIn: true,
      });
      const context = createContext('<no-reminder />');
      const prompts: string[] = [];
      context.mainAgent.getModel = vi.fn(async () => createModel('<no-reminder />', prompts));
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
        activeObservations,
        ...context,
      });

      expect(prompts[0]).toContain('user: what is the weather like on the moon?');
      expect(prompts[0]).toContain('already visible');
      expect(prompts[0]).toContain("What the parent's accumulated observations already say about these candidates:");
      if (expectActiveExcerpt) {
        expect(prompts[0]).toContain('no weather worth planning around');
      } else {
        // Unrelated or absent accumulated memory is reported as such, and is never carried wholesale
        // into the prompt just because it exists.
        expect(prompts[0]).toMatch(/no accumulated observations?[^\n]*(available|references it)/i);
        expect(prompts[0]).not.toContain('OLDER_VISIBLE_FACT');
      }
      expect(prompts[0]).toContain('Newly extracted observations:');
      expect(prompts[0]).toContain('compare each proposed fact against ALL supplied parent context');
      expect(prompts[0]).toContain('A different source ID or another conversation');
      expect(prompts[0]).toContain('For a memory question, call reply_to_memory_question');
    },
  );

  it.each([
    ['sync', 'text'],
    ['sync', 'tool-result'],
    ['async-buffer', 'text'],
    ['async-buffer', 'tool-result'],
    ['resource', 'text'],
    ['resource', 'tool-result'],
    ...['sync', 'async-buffer', 'resource'].flatMap(strategy =>
      ['large-text', 'large-tool-result', 'reasoning', 'tool-args', 'many-messages'].map(kind => [strategy, kind]),
    ),
  ])('forwards active observations and bounded %s %s tails through strategy hooks', async (strategyName, kind) => {
    const oversized = !['text', 'tool-result'].includes(kind);
    const text =
      'HEAD_ONLY_APPROVAL ' +
      'Deployment inventory reviewed. '.repeat(oversized && kind !== 'many-messages' ? 1_000 : 30) +
      'TAIL_ONLY_APPROVAL';
    const message: MastraDBMessage = {
      id: 'tail-message',
      role: kind === 'text' ? 'user' : 'assistant',
      createdAt: new Date(),
      threadId: 'alpha',
      resourceId: 'user-42',
      content: {
        format: 2,
        parts:
          kind === 'text' || kind === 'large-text' || kind === 'many-messages'
            ? [{ type: 'text', text }]
            : kind === 'reasoning'
              ? [{ type: 'reasoning', reasoning: text, details: [] }]
              : kind === 'tool-args'
                ? [
                    {
                      type: 'tool-invocation',
                      toolInvocation: {
                        state: 'call',
                        toolCallId: 'inventory',
                        toolName: 'read_inventory',
                        args: { text },
                      },
                    },
                  ]
                : [
                    {
                      type: 'tool-invocation',
                      toolInvocation: {
                        state: 'result',
                        toolCallId: 'inventory',
                        toolName: 'read_inventory',
                        args: {},
                        result: text,
                      },
                    },
                  ],
      },
    };
    const onExtracted = vi.fn();
    const extractor = new Extractor({ name: 'capture-context', mode: 'hook', onExtracted });
    const memory = new Memory({
      storage: new InMemoryStore(),
      options: {
        observationalMemory: {
          scope: strategyName === 'resource' ? 'resource' : 'thread',
          model: createModel('unused'),
          observation: { messageTokens: 100_000, extract: [extractor] },
        },
      },
    });
    await memory.createThread({ threadId: 'alpha', resourceId: 'user-42' });
    const engine = await memory.omEngine;
    if (!engine) throw new Error('Expected observational memory engine');
    const record = await engine.getOrCreateRecord('alpha', 'user-42');
    const { mainAgent } = createContext('unused');
    if (strategyName === 'resource') {
      await memory.createThread({ threadId: 'beta', resourceId: 'user-42' });
      await memory.createThread({ threadId: 'foreign', resourceId: 'other-resource' });
      await engine.getStorage().saveMessages({
        messages: [
          {
            ...message,
            id: 'beta-message',
            threadId: 'beta',
            content: { format: 2, parts: [{ type: 'text', text: 'BETA_ONLY_MESSAGE' }] },
          },
          {
            ...message,
            id: 'foreign-message',
            threadId: 'foreign',
            resourceId: 'other-resource',
            content: { format: 2, parts: [{ type: 'text', text: 'FOREIGN_RESOURCE_MESSAGE' }] },
          },
        ],
      });
    }
    await engine.getStorage().updateActiveObservations({
      id: record.id,
      observations: 'OLDER_VISIBLE_FACT',
      tokenCount: 5,
      lastObservedAt: new Date(0),
    });
    await engine.getStorage().updateBufferedObservations({
      id: record.id,
      chunk: {
        cycleId: 'previous-buffer',
        observations: 'PENDING_NOT_VISIBLE',
        tokenCount: 5,
        messageIds: ['prior'],
        messageTokens: 100,
        lastObservedAt: new Date(1),
      },
    });
    const parentContext = await engine.buildContextSystemMessages({ threadId: 'alpha', resourceId: 'user-42', record });
    expect(parentContext?.join('\n')).toContain('OLDER_VISIBLE_FACT');
    expect(parentContext?.join('\n')).not.toContain('PENDING_NOT_VISIBLE');
    const output = { observations: 'NEW_DELTA', extractors: [extractor] };
    vi.spyOn(engine.observer, 'call').mockImplementation(async () => {
      // Simulate shared-record activation during inference; the hook must retain the earlier snapshot.
      record.activeObservations = 'OLDER_VISIBLE_FACT\nPENDING_NOT_VISIBLE';
      return output;
    });
    vi.spyOn(engine.observer, 'callMultiThread').mockResolvedValue({
      results: new Map([
        ['alpha', output],
        ['beta', output],
      ]),
    });
    const strategy = ObservationStrategy.create(engine, {
      threadId: 'alpha',
      resourceId: 'user-42',
      record,
      messages:
        kind === 'many-messages'
          ? Array.from({ length: 100 }, (_, index) => ({ ...message, id: `window-${index}` }))
          : [message],
      agent: mainAgent,
      ...(strategyName === 'async-buffer' ? { cycleId: 'new-buffer' } : {}),
    });
    const prepared = await strategy.prepare();
    if (strategyName === 'async-buffer') expect(prepared.existingObservations).toContain('PENDING_NOT_VISIBLE');
    const result = await strategy.observe(prepared.existingObservations, prepared.messages);
    await strategy.process(result, prepared.existingObservations);
    expect(onExtracted).toHaveBeenCalledTimes(strategyName === 'resource' ? 2 : 1);
    const contexts = onExtracted.mock.calls.map(([context]) => context);
    const alpha = contexts.find(context => context.threadId === 'alpha');
    expect(alpha).toMatchObject({
      activeObservations: 'OLDER_VISIBLE_FACT',
      rawObservations: 'NEW_DELTA',
      recentMessages: expect.stringContaining('TAIL_ONLY_APPROVAL'),
      threadId: 'alpha',
      resourceId: 'user-42',
    });
    expect(alpha.recentMessages).not.toContain('OLDER_VISIBLE_FACT');
    expect(alpha.recentMessages).toContain('HEAD_ONLY_APPROVAL');
    expect(alpha.recentMessages.length).toBeLessThanOrEqual(11 * 1024);
    if (oversized) expect(alpha.recentMessages).toContain('[middle context omitted]');
    if (strategyName === 'resource') {
      const beta = contexts.find(context => context.threadId === 'beta');
      expect(beta).toMatchObject({ activeObservations: 'OLDER_VISIBLE_FACT', resourceId: 'user-42', mainAgent });
      expect(beta.recentMessages).toContain('BETA_ONLY_MESSAGE');
      expect(beta.recentMessages).not.toContain('TAIL_ONLY_APPROVAL');
      expect(JSON.stringify(contexts.map(context => context.recentMessages))).not.toContain('FOREIGN_RESOURCE_MESSAGE');
      await beta.sendSignal({ contents: 'routing probe' });
      expect(mainAgent.sendSignal).toHaveBeenCalledWith(
        { contents: 'routing probe' },
        expect.objectContaining({
          threadId: 'beta',
          resourceId: 'user-42',
        }),
      );
    }
  });

  it('retains the default observer tool-result token budget without a character cap', () => {
    const result = 'deployment inventory '.repeat(30_000) + 'BEYOND_TOKEN_BUDGET';
    const message: MastraDBMessage = {
      id: 'large-result',
      role: 'assistant',
      createdAt: new Date(),
      threadId: 'alpha',
      resourceId: 'user-42',
      content: {
        format: 2,
        parts: [
          {
            type: 'tool-invocation',
            toolInvocation: {
              state: 'result',
              toolCallId: 'inventory',
              toolName: 'read_inventory',
              args: {},
              result,
            },
          },
        ],
      },
    };
    const bounded = formatToolResultForObserver(result, { maxTokens: DEFAULT_OBSERVER_TOOL_RESULT_MAX_TOKENS });
    expect(DEFAULT_OBSERVER_TOOL_RESULT_MAX_TOKENS).toBe(10_000);
    expect(bounded.length).toBeGreaterThan(500);
    expect(formatMessagesForObserver([message])).toContain(bounded);
    expect(formatMessagesForObserver([message])).not.toContain('BEYOND_TOKEN_BUDGET');
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

  it('reuses durable sidekick history across reconstructed Memory instances', async () => {
    const storage = new InMemoryStore();
    const first = createContext('unused', storage);
    const knowledge = await storage.getStore('knowledge');
    const node = await knowledge.createNode({
      name: 'Project Atlas',
      kind: 'project',
      scope: ['org:acme', 'resource:user-42'],
    });
    const record = await knowledge.appendKnowledge({
      node,
      text: 'Project Atlas launches January 15.',
      scope: ['org:acme', 'resource:user-42'],
      sourceThreadId: 'beta',
      resolutionScope: ['org:acme', 'resource:user-42', 'thread:beta'],
      defaultScope: ['org:acme', 'resource:user-42'],
    });
    const prompts: string[] = [];
    first.mainAgent.getModel = vi.fn(async () =>
      createModel(`Project Atlas launches January 15. Source: ${record.id}`, prompts),
    );
    const extractor = new SubconsciousRemindExtractor({ name: 'remind', maxSteps: 3, builtIn: true });

    await applyExtractorHooks({
      source: 'observer',
      extractors: [extractor],
      rawObservations: 'The user is scheduling Project Atlas.',
      ...first,
    });

    const second = createContext('unused', storage);
    second.mainAgent.getModel = vi.fn(async () =>
      createModel(`Project Atlas launches January 15. Source: ${record.id}`, prompts),
    );
    await applyExtractorHooks({
      source: 'observer',
      extractors: [extractor],
      rawObservations: 'The user is still scheduling Project Atlas.',
      ...second,
    });

    expect(first.sendSignal).toHaveBeenCalledOnce();
    expect(second.sendSignal).not.toHaveBeenCalled();
    const memoryStore = await storage.getStore('memory');
    const stored = await memoryStore.listMessages({
      threadId: getRemindThreadId('alpha'),
      resourceId: 'user-42',
      perPage: false,
    });
    const passiveChecks = stored.messages.filter(message =>
      getRemindMessageText(message).startsWith('Passive reminder check'),
    );
    expect(passiveChecks).toHaveLength(2);
    expect(prompts.at(-1)).toContain('Passive reminder check');
  });

  it('creates isolated sidekick memory and propagates the parent runtime', async () => {
    const original = Memory.prototype.createSubconsciousMemory;
    let sidekickMemory: Memory | undefined;
    const memorySpy = vi.spyOn(Memory.prototype, 'createSubconsciousMemory').mockImplementation(function () {
      sidekickMemory = original.call(this);
      return sidekickMemory;
    });
    try {
      const context = createContext('<no-reminder />');
      const knowledge = await context.memory.storage.getStore('knowledge');
      const node = await knowledge.createNode({
        name: 'Moon weather',
        kind: 'topic',
        scope: ['org:acme', 'resource:user-42'],
      });
      await knowledge.appendKnowledge({
        node,
        text: 'The moon has no weather.',
        scope: ['org:acme', 'resource:user-42'],
        sourceThreadId: 'beta',
        resolutionScope: ['org:acme', 'resource:user-42', 'thread:beta'],
        defaultScope: ['org:acme', 'resource:user-42'],
      });

      await applyExtractorHooks({
        source: 'observer',
        extractors: [new SubconsciousRemindExtractor({ name: 'remind', maxSteps: 3, builtIn: true })],
        rawObservations: 'The user asks about moon weather.',
        ...context,
      });

      expect(sidekickMemory).toBeDefined();
      await expect(sidekickMemory!.omEngine).resolves.toBeNull();
      expect(context.mainAgent.getMastraInstance).toHaveBeenCalledOnce();
      expect(context.mainAgent.getPubSub).toHaveBeenCalledOnce();
    } finally {
      memorySpy.mockRestore();
    }
  });

  it('copies observational, vector, and embedding configuration without recursive Subconscious agents', async () => {
    const vector = { id: 'vector' } as any;
    const embedder = { specificationVersion: 'v2', modelId: 'embedder' } as any;
    const embedderOptions = { providerOptions: { test: { dimensions: 16 } } };
    const memory = new Memory({
      storage: new InMemoryStore(),
      vector,
      embedder,
      embedderOptions,
      options: {
        observationalMemory: {
          model: createModel('observed'),
          experimental_subconscious: new Subconscious({ observation: ['remind'] }),
        },
      },
    });

    const sidekick = memory.createSubconsciousMemory();
    const sidekickConfig = (sidekick as any).threadConfig.observationalMemory;

    expect((sidekick as any).vector).toBe(vector);
    expect((sidekick as any).embedder).toBe(embedder);
    expect((sidekick as any).embedderOptions).toBe(embedderOptions);
    expect(sidekickConfig).toBeTruthy();
    expect(sidekickConfig.experimental_subconscious).toBeUndefined();
    await expect(sidekick.omEngine).resolves.not.toBeNull();
  });

  it.each([
    ['wrong parent provenance', 'other-parent', 'user-42'],
    ['wrong resource', 'alpha', 'other-resource'],
  ])('rejects a derived-thread collision with %s', async (_case, provenance, resourceId) => {
    const context = createContext('Project Atlas launches January 15.');
    await context.memory.createThread({
      threadId: getRemindThreadId('alpha'),
      resourceId,
      metadata: { [REMIND_PARENT_THREAD_METADATA_KEY]: provenance },
    });
    const knowledge = await context.memory.storage.getStore('knowledge');
    const node = await knowledge.createNode({
      name: 'Project Atlas',
      kind: 'project',
      scope: ['org:acme', 'resource:user-42'],
    });
    await knowledge.appendKnowledge({
      node,
      text: 'Project Atlas launches January 15.',
      scope: ['org:acme', 'resource:user-42'],
      sourceThreadId: 'beta',
      resolutionScope: ['org:acme', 'resource:user-42', 'thread:beta'],
      defaultScope: ['org:acme', 'resource:user-42'],
    });

    const result = await applyExtractorHooks({
      source: 'observer',
      extractors: [new SubconsciousRemindExtractor({ name: 'remind', maxSteps: 3, builtIn: true })],
      rawObservations: 'The user is scheduling Project Atlas.',
      ...context,
    });

    expect(result.failures?.[0]?.error).toMatch(/ownership metadata does not match/);
    expect(context.sendSignal).not.toHaveBeenCalled();
  });

  it('cascades parent deletion only to an owned reminder sidekick', async () => {
    const memory = new Memory({ storage: new InMemoryStore() });
    await memory.createThread({ threadId: 'parent', resourceId: 'resource' });
    const sidekickId = getRemindThreadId('parent');
    await memory.createThread({
      threadId: sidekickId,
      resourceId: 'resource',
      metadata: { [REMIND_PARENT_THREAD_METADATA_KEY]: 'parent' },
    });
    await memory.saveMessages({
      messages: [
        {
          id: 'sidekick-message',
          role: 'user',
          threadId: sidekickId,
          resourceId: 'resource',
          createdAt: new Date(),
          content: { format: 2, parts: [{ type: 'text', text: 'canonical event' }] },
        },
      ],
    });

    await memory.deleteThread('parent');

    expect(await memory.getThreadById({ threadId: 'parent' })).toBeNull();
    expect(await memory.getThreadById({ threadId: sidekickId })).toBeNull();
    const store = await memory.storage.getStore('memory');
    await expect(store.listMessagesById({ messageIds: ['sidekick-message'] })).resolves.toMatchObject({ messages: [] });
  });

  it('keeps the parent thread available when owned reminder-sidekick deletion fails', async () => {
    const memory = new Memory({ storage: new InMemoryStore() });
    await memory.createThread({ threadId: 'parent', resourceId: 'resource' });
    const sidekickId = getRemindThreadId('parent');
    await memory.createThread({
      threadId: sidekickId,
      resourceId: 'resource',
      metadata: { [REMIND_PARENT_THREAD_METADATA_KEY]: 'parent' },
    });
    const store = await memory.storage.getStore('memory');
    const deleteThread = vi.spyOn(store, 'deleteThread').mockRejectedValueOnce(new Error('sidekick deletion failed'));

    await expect(memory.deleteThread('parent')).rejects.toThrow('sidekick deletion failed');

    expect(deleteThread).toHaveBeenCalledWith({ threadId: sidekickId });
    expect(await memory.getThreadById({ threadId: 'parent' })).not.toBeNull();
    deleteThread.mockRestore();

    await memory.deleteThread('parent');
    expect(await memory.getThreadById({ threadId: 'parent' })).toBeNull();
    expect(await memory.getThreadById({ threadId: sidekickId })).toBeNull();
  });

  it.each([
    ['missing parent', false, 'resource', 'parent'],
    ['unmarked collision', true, 'resource', undefined],
    ['foreign collision', true, 'foreign-resource', 'parent'],
    ['wrong-parent collision', true, 'resource', 'other-parent'],
  ])('preserves a reminder-thread-shaped %s during deletion', async (_case, createParent, resourceId, provenance) => {
    const memory = new Memory({ storage: new InMemoryStore() });
    if (createParent) await memory.createThread({ threadId: 'parent', resourceId: 'resource' });
    const sidekickId = getRemindThreadId('parent');
    await memory.createThread({
      threadId: sidekickId,
      resourceId,
      metadata: provenance ? { [REMIND_PARENT_THREAD_METADATA_KEY]: provenance } : undefined,
    });

    await memory.deleteThread('parent');

    expect(await memory.getThreadById({ threadId: sidekickId })).not.toBeNull();
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
