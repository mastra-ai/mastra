import { convertArrayToReadableStream, MockLanguageModelV2 } from '@internal/ai-sdk-v5/test';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MastraServerCache } from '../../cache';
import { ResponseCache } from '../../processors/processors/response-cache';
import { MASTRA_RESOURCE_ID_KEY, RequestContext } from '../../request-context';
import { Agent } from '../agent';

function createRecordingModel(modelId: string, responseText: string) {
  return new MockLanguageModelV2({
    modelId,
    doStream: async () => ({
      rawCall: { rawPrompt: null, rawSettings: {} },
      warnings: [],
      stream: convertArrayToReadableStream([
        { type: 'stream-start', warnings: [] },
        { type: 'response-metadata', id: 'id-0', modelId, timestamp: new Date(0) },
        { type: 'text-start', id: 'text-1' },
        { type: 'text-delta', id: 'text-1', delta: responseText },
        { type: 'text-end', id: 'text-1' },
        {
          type: 'finish',
          finishReason: 'stop',
          usage: { inputTokens: 5, outputTokens: 10, totalTokens: 15 },
        },
      ]),
    }),
    doGenerate: async () => ({
      rawCall: { rawPrompt: null, rawSettings: {} },
      warnings: [],
      finishReason: 'stop',
      usage: { inputTokens: 5, outputTokens: 10, totalTokens: 15 },
      content: [{ type: 'text', text: responseText }],
    }),
  });
}

async function waitForSets(cache: { sets: number }, expected: number) {
  // Cache writes happen asynchronously after the LLM call returns, so poll
  // instead of using fixed sleeps that can race on slow CI workers.
  const deadline = Date.now() + 1_000;
  while (cache.sets < expected) {
    if (Date.now() > deadline) {
      throw new Error(`Timed out waiting for ${expected} cache writes (saw ${cache.sets})`);
    }
    await new Promise(resolve => setTimeout(resolve, 5));
  }
}

class RecordingServerCache extends MastraServerCache {
  readonly store = new Map<string, unknown>();
  readonly ttls: Array<number | undefined> = [];
  sets = 0;
  gets = 0;

  constructor() {
    super({ name: 'RecordingServerCache' });
  }

  async get(key: string): Promise<unknown> {
    this.gets++;
    return this.store.get(key);
  }

  async set(key: string, value: unknown, ttlMs?: number): Promise<void> {
    this.sets++;
    this.ttls.push(ttlMs);
    this.store.set(key, value);
  }

  async listLength(): Promise<number> {
    return 0;
  }

  async listPush(): Promise<void> {}

  async listFromTo(): Promise<unknown[]> {
    return [];
  }

  async delete(key: string): Promise<void> {
    this.store.delete(key);
  }

  async clear(): Promise<void> {
    this.store.clear();
  }

  async increment(): Promise<number> {
    return 0;
  }
}

function createMemoryCache(): RecordingServerCache {
  return new RecordingServerCache();
}

function createAgent(args: {
  cache: MastraServerCache;
  agentId?: string;
  ttl?: number;
  scope?: string | null;
  modelId?: string;
  responseText?: string;
}) {
  const model = createRecordingModel(args.modelId ?? 'test-model', args.responseText ?? 'Cached response text');
  const agentId = args.agentId ?? 'response-cache-agent';
  const agent = new Agent({
    id: agentId,
    name: 'Response Cache Agent',
    instructions: 'You are a test agent',
    model,
    inputProcessors: [
      new ResponseCache({
        cache: args.cache,
        agentId,
        ttl: args.ttl,
        scope: args.scope,
      }),
    ],
  });
  return { agent, model };
}

describe('ResponseCache processor (integration via Agent)', () => {
  let cache: ReturnType<typeof createMemoryCache>;
  let agent: Agent;
  let model: ReturnType<typeof createRecordingModel>;

  beforeEach(() => {
    cache = createMemoryCache();
    const built = createAgent({ cache });
    agent = built.agent;
    model = built.model;
  });

  describe('generate()', () => {
    it('returns the cached FullOutput on the second identical call', async () => {
      const first = await agent.generate('Hello');
      expect(first.text).toBe('Cached response text');
      expect(model.doGenerateCalls).toHaveLength(1);

      await waitForSets(cache, 1);
      expect(cache.sets).toBe(1);

      const second = await agent.generate('Hello');
      expect(second.text).toBe('Cached response text');
      // No new LLM call.
      expect(model.doGenerateCalls).toHaveLength(1);
    });

    it('different prompts produce different cache entries', async () => {
      await agent.generate('Hello');
      await waitForSets(cache, 1);
      await agent.generate('Goodbye');
      await waitForSets(cache, 2);

      expect(cache.store.size).toBe(2);
      expect(model.doGenerateCalls).toHaveLength(2);
    });

    it('does not cache failed runs (errors are not replayed)', async () => {
      const failingModel = new MockLanguageModelV2({
        modelId: 'failing',
        doGenerate: async () => {
          throw new Error('boom');
        },
      });
      const failingAgent = new Agent({
        id: 'failing-agent',
        name: 'Failing',
        instructions: 'fail',
        model: failingModel,
        inputProcessors: [new ResponseCache({ cache, agentId: 'failing-agent' })],
      });

      await expect(failingAgent.generate('please')).rejects.toThrow();
      // Failed runs should never write; give the (non-existent) write a chance to happen and assert it didn't.
      await new Promise(resolve => setTimeout(resolve, 10));
      expect(cache.sets).toBe(0);
    });

    it('writes the configured TTL on cache writes (converts seconds to ms)', async () => {
      const ttlAgent = createAgent({ cache, ttl: 999, agentId: 'ttl-agent' });
      await ttlAgent.agent.generate('Hi');
      await waitForSets(cache, 1);
      // ResponseCache.ttl is seconds; MastraServerCache.set takes ms.
      expect(cache.ttls).toEqual([999_000]);
    });
  });

  describe('per-call overrides via RequestContext', () => {
    it('ResponseCache.context() bust forces a fresh LLM call but still updates the cache', async () => {
      await agent.generate('Hello');
      await waitForSets(cache, 1);
      expect(model.doGenerateCalls).toHaveLength(1);
      expect(cache.sets).toBe(1);

      await agent.generate('Hello', {
        requestContext: ResponseCache.context({ bust: true }),
      });
      await waitForSets(cache, 2);
      expect(model.doGenerateCalls).toHaveLength(2);
      expect(cache.sets).toBe(2);
    });

    it('ResponseCache.applyContext() merges into an existing RequestContext', async () => {
      const ctx = new RequestContext();
      ctx.set('caller-meta', { foo: 'bar' });
      ResponseCache.applyContext(ctx, { key: 'shared-key' });

      await agent.generate('first prompt', { requestContext: ctx });
      await waitForSets(cache, 1);

      const ctx2 = new RequestContext();
      ResponseCache.applyContext(ctx2, { key: 'shared-key' });
      const second = await agent.generate('totally different prompt', { requestContext: ctx2 });

      expect(second.text).toBe('Cached response text');
      expect(model.doGenerateCalls).toHaveLength(1);
    });

    it('per-call key string is used verbatim across different prompts', async () => {
      await agent.generate('first prompt', {
        requestContext: ResponseCache.context({ key: 'manual-shared-key' }),
      });
      await waitForSets(cache, 1);

      const second = await agent.generate('totally different prompt', {
        requestContext: ResponseCache.context({ key: 'manual-shared-key' }),
      });

      expect(second.text).toBe('Cached response text');
      expect(model.doGenerateCalls).toHaveLength(1);
    });

    it('per-call key function receives inputs and is used as the cache key', async () => {
      const seenInputs: unknown[] = [];
      const keyFn = vi.fn((inputs: unknown) => {
        seenInputs.push(inputs);
        return 'fn-derived-key';
      });

      await agent.generate('first', {
        requestContext: ResponseCache.context({ key: keyFn }),
      });
      await waitForSets(cache, 1);
      const second = await agent.generate('second different prompt', {
        requestContext: ResponseCache.context({ key: keyFn }),
      });

      expect(keyFn).toHaveBeenCalledTimes(2);
      expect(second.text).toBe('Cached response text');
      expect(model.doGenerateCalls).toHaveLength(1);
      const firstInputs = seenInputs[0] as {
        agentId: string;
        model: { modelId?: string };
        prompt: unknown;
        stepNumber: number;
      };
      expect(firstInputs.agentId).toBe('response-cache-agent');
      expect(firstInputs.model.modelId).toBeDefined();
      expect(firstInputs.prompt).toBeDefined();
      expect(firstInputs.stepNumber).toBe(0);
    });

    it('falls back to default key derivation when key function throws', async () => {
      await agent.generate('Hello');
      await waitForSets(cache, 1);
      expect(cache.sets).toBe(1);
      const generateCallsBefore = model.doGenerateCalls.length;

      const throwing = vi.fn(() => {
        throw new Error('intentional');
      });
      const second = await agent.generate('Hello', {
        requestContext: ResponseCache.context({ key: throwing }),
      });

      expect(throwing).toHaveBeenCalledOnce();
      expect(second.text).toBe('Cached response text');
      expect(model.doGenerateCalls).toHaveLength(generateCallsBefore);
    });

    it('async key function is awaited', async () => {
      const keyFn = vi.fn(async () => {
        await Promise.resolve();
        return 'async-derived-key';
      });

      await agent.generate('first', {
        requestContext: ResponseCache.context({ key: keyFn }),
      });
      await waitForSets(cache, 1);
      const second = await agent.generate('second', {
        requestContext: ResponseCache.context({ key: keyFn }),
      });

      expect(keyFn).toHaveBeenCalledTimes(2);
      expect(second.text).toBe('Cached response text');
      expect(model.doGenerateCalls).toHaveLength(1);
    });

    it('per-call scope override changes the cache key', async () => {
      const scopedAgent = createAgent({ cache, scope: null, agentId: 'scope-agent' });

      await scopedAgent.agent.generate('Hello', {
        requestContext: ResponseCache.context({ scope: 'tenant-a' }),
      });
      await waitForSets(cache, 1);

      // Different scope = different key, so the second call still hits the model.
      await scopedAgent.agent.generate('Hello', {
        requestContext: ResponseCache.context({ scope: 'tenant-b' }),
      });

      expect(scopedAgent.model.doGenerateCalls).toHaveLength(2);
      expect(cache.store.size).toBe(2);
    });
  });

  describe('default scope from request context', () => {
    it('uses MASTRA_RESOURCE_ID_KEY from request context as default scope', async () => {
      const scopedAgent = createAgent({ cache, agentId: 'multi-tenant' });

      const ctxA = new RequestContext();
      ctxA.set(MASTRA_RESOURCE_ID_KEY, 'user-a');
      await scopedAgent.agent.generate('shared prompt', { requestContext: ctxA });
      await waitForSets(cache, 1);

      // Different resource id -> different scope -> different cache key.
      const ctxB = new RequestContext();
      ctxB.set(MASTRA_RESOURCE_ID_KEY, 'user-b');
      const second = await scopedAgent.agent.generate('shared prompt', { requestContext: ctxB });

      expect(second.text).toBe('Cached response text');
      expect(scopedAgent.model.doGenerateCalls).toHaveLength(2);
      expect(cache.store.size).toBe(2);
    });

    it('explicit scope: null disables scoping even when MASTRA_RESOURCE_ID_KEY is set', async () => {
      const noScopeAgent = createAgent({ cache, scope: null, agentId: 'no-scope' });

      const ctxA = new RequestContext();
      ctxA.set(MASTRA_RESOURCE_ID_KEY, 'user-a');
      await noScopeAgent.agent.generate('shared prompt', { requestContext: ctxA });
      await waitForSets(cache, 1);

      // scope: null on the constructor opts out of all scoping, so the second
      // call hits the cache regardless of the resource id in context.
      const ctxB = new RequestContext();
      ctxB.set(MASTRA_RESOURCE_ID_KEY, 'user-b');
      const second = await noScopeAgent.agent.generate('shared prompt', { requestContext: ctxB });

      expect(second.text).toBe('Cached response text');
      expect(noScopeAgent.model.doGenerateCalls).toHaveLength(1);
    });
  });

  describe('stream()', () => {
    it('returns the cached chunks on the second identical call', async () => {
      const firstStream = await agent.stream('Stream me');
      const firstText = await firstStream.text;
      expect(firstText).toBe('Cached response text');
      expect(model.doStreamCalls).toHaveLength(1);

      await waitForSets(cache, 1);
      expect(cache.sets).toBe(1);

      const secondStream = await agent.stream('Stream me');
      const collectedChunks: unknown[] = [];
      for await (const chunk of secondStream.fullStream) {
        collectedChunks.push(chunk);
      }
      const secondText = await secondStream.text;

      expect(secondText).toBe('Cached response text');
      expect(model.doStreamCalls).toHaveLength(1);
      expect(collectedChunks.length).toBeGreaterThan(0);
    });

    it('preserves finishReason and usage on cache hit', async () => {
      const first = await agent.stream('test');
      await first.text;
      await waitForSets(cache, 1);

      const second = await agent.stream('test');
      const finishReason = await second.finishReason;
      const usage = await second.usage;

      expect(finishReason).toBe('stop');
      expect(usage).toMatchObject({ inputTokens: 5, outputTokens: 10, totalTokens: 15 });
    });
  });
});

describe('ResponseCache.context() / applyContext()', () => {
  it('context() returns a fresh RequestContext with the override set', () => {
    const ctx = ResponseCache.context({ bust: true });
    expect(ctx).toBeInstanceOf(RequestContext);
    expect(ctx.get('mastra__response_cache_context')).toEqual({ bust: true });
  });

  it('applyContext() returns the same context for chaining', () => {
    const ctx = new RequestContext();
    const returned = ResponseCache.applyContext(ctx, { key: 'k' });
    expect(returned).toBe(ctx);
    expect(ctx.get('mastra__response_cache_context')).toEqual({ key: 'k' });
  });

  it('applyContext() overwrites a previous override', () => {
    const ctx = ResponseCache.context({ key: 'first' });
    ResponseCache.applyContext(ctx, { key: 'second' });
    expect(ctx.get('mastra__response_cache_context')).toEqual({ key: 'second' });
  });
});
