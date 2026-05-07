import { convertArrayToReadableStream, MockLanguageModelV2 } from '@internal/ai-sdk-v5/test';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { InMemoryServerCache } from '../../cache';
import type { MastraCache } from '../../cache';
import { Mastra } from '../../mastra';
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

function createMemoryCache(): MastraCache & { store: Map<string, unknown>; sets: number; gets: number } {
  const store = new Map<string, unknown>();
  let sets = 0;
  let gets = 0;
  return {
    store,
    get sets() {
      return sets;
    },
    get gets() {
      return gets;
    },
    async get<T>(key: string): Promise<T | undefined> {
      gets++;
      return store.get(key) as T | undefined;
    },
    async set<T>(key: string, value: T): Promise<void> {
      sets++;
      store.set(key, value);
    },
  };
}

describe('Agent response cache', () => {
  let model: ReturnType<typeof createRecordingModel>;
  let cache: ReturnType<typeof createMemoryCache>;
  let agent: Agent;

  beforeEach(() => {
    model = createRecordingModel('test-model', 'Cached response text');
    cache = createMemoryCache();
    agent = new Agent({
      id: 'response-cache-agent',
      name: 'Response Cache Agent',
      instructions: 'You are a test agent',
      model,
      responseCache: { cache },
    });
  });

  describe('generate()', () => {
    it('returns the cached FullOutput on the second identical call', async () => {
      const first = await agent.generate('Hello');
      expect(first.text).toBe('Cached response text');
      expect(model.doGenerateCalls).toHaveLength(1);

      // Wait for background cache write to settle.
      await new Promise(resolve => setTimeout(resolve, 10));
      expect(cache.sets).toBe(1);

      const second = await agent.generate('Hello');
      expect(second.text).toBe('Cached response text');
      // No new LLM call.
      expect(model.doGenerateCalls).toHaveLength(1);
    });

    it('does not cache when responseCache is opted out per call', async () => {
      await agent.generate('Hello', { responseCache: false });
      await new Promise(resolve => setTimeout(resolve, 10));
      expect(cache.sets).toBe(0);

      await agent.generate('Hello', { responseCache: false });
      expect(model.doGenerateCalls).toHaveLength(2);
    });

    it('different prompts produce different cache entries', async () => {
      await agent.generate('Hello');
      await new Promise(resolve => setTimeout(resolve, 10));
      await agent.generate('Goodbye');
      await new Promise(resolve => setTimeout(resolve, 10));

      expect(cache.store.size).toBe(2);
      expect(model.doGenerateCalls).toHaveLength(2);
    });

    it('bust=true forces a fresh LLM call but still updates the cache', async () => {
      await agent.generate('Hello');
      await new Promise(resolve => setTimeout(resolve, 10));
      expect(model.doGenerateCalls).toHaveLength(1);
      expect(cache.sets).toBe(1);

      await agent.generate('Hello', { responseCache: { bust: true } });
      await new Promise(resolve => setTimeout(resolve, 10));
      expect(model.doGenerateCalls).toHaveLength(2);
      expect(cache.sets).toBe(2);
    });

    it('per-call key override shares cache across different prompts', async () => {
      const sharedKey = 'manual-shared-key';
      await agent.generate('first prompt', { responseCache: { key: sharedKey } });
      await new Promise(resolve => setTimeout(resolve, 10));

      const second = await agent.generate('totally different prompt', {
        responseCache: { key: sharedKey },
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

      await agent.generate('first', { responseCache: { key: keyFn } });
      await new Promise(resolve => setTimeout(resolve, 10));
      const second = await agent.generate('second different prompt', {
        responseCache: { key: keyFn },
      });

      expect(keyFn).toHaveBeenCalledTimes(2);
      expect(second.text).toBe('Cached response text');
      expect(model.doGenerateCalls).toHaveLength(1);
      // Inputs include the agentId, model, prompt, and stepNumber so users
      // can derive partial keys from any subset of them.
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
      await new Promise(resolve => setTimeout(resolve, 10));
      expect(cache.sets).toBe(1);
      const generateCallsBefore = model.doGenerateCalls.length;

      const throwing = vi.fn(() => {
        throw new Error('intentional');
      });
      const second = await agent.generate('Hello', { responseCache: { key: throwing } });

      // Even though the key fn threw, the call still benefits from caching
      // because we fell back to the default key, which matches the first call.
      expect(throwing).toHaveBeenCalledOnce();
      expect(second.text).toBe('Cached response text');
      expect(model.doGenerateCalls).toHaveLength(generateCallsBefore);
    });

    it('async key function is awaited', async () => {
      const keyFn = vi.fn(async () => {
        await Promise.resolve();
        return 'async-derived-key';
      });

      await agent.generate('first', { responseCache: { key: keyFn } });
      await new Promise(resolve => setTimeout(resolve, 10));
      const second = await agent.generate('second', { responseCache: { key: keyFn } });

      expect(keyFn).toHaveBeenCalledTimes(2);
      expect(second.text).toBe('Cached response text');
      expect(model.doGenerateCalls).toHaveLength(1);
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
        responseCache: { cache },
      });

      await expect(failingAgent.generate('please')).rejects.toThrow();
      await new Promise(resolve => setTimeout(resolve, 10));
      expect(cache.sets).toBe(0);
    });
  });

  describe('stream()', () => {
    it('returns the cached chunks on the second identical call', async () => {
      const firstStream = await agent.stream('Stream me');
      const firstText = await firstStream.text;
      expect(firstText).toBe('Cached response text');
      expect(model.doStreamCalls).toHaveLength(1);

      // Wait for background cache write to settle.
      await new Promise(resolve => setTimeout(resolve, 50));
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
      await new Promise(resolve => setTimeout(resolve, 50));

      const second = await agent.stream('test');
      const finishReason = await second.finishReason;
      const usage = await second.usage;

      expect(finishReason).toBe('stop');
      expect(usage).toMatchObject({ inputTokens: 5, outputTokens: 10, totalTokens: 15 });
    });
  });

  describe('agent default vs per-call', () => {
    it('per-call false overrides agent-level default true', async () => {
      const noCacheModel = createRecordingModel('always-fresh', 'fresh');
      const cacheByDefault = new Agent({
        id: 'cached-default',
        name: 'Cached Default',
        instructions: 'You are a test agent',
        model: noCacheModel,
        responseCache: { cache },
      });

      await cacheByDefault.generate('Hello', { responseCache: false });
      await new Promise(resolve => setTimeout(resolve, 10));
      await cacheByDefault.generate('Hello', { responseCache: false });

      expect(noCacheModel.doGenerateCalls).toHaveLength(2);
      expect(cache.sets).toBe(0);
    });

    it('per-call ttl overrides agent-level ttl', async () => {
      let lastTtl: number | undefined;
      const ttlCache: MastraCache = {
        async get() {
          return undefined;
        },
        async set(_key, _value, ttlSeconds) {
          lastTtl = ttlSeconds;
        },
      };
      const a = new Agent({
        id: 'ttl-agent',
        name: 'TTL',
        instructions: 'You are a test agent',
        model: createRecordingModel('ttl-model', 'hi'),
        responseCache: { cache: ttlCache, ttl: 60 },
      });

      await a.generate('Hi', { responseCache: { ttl: 999 } });
      await new Promise(resolve => setTimeout(resolve, 10));
      expect(lastTtl).toBe(999);
    });
  });

  describe('Mastra server cache fallback', () => {
    it('uses the Mastra instance server cache when no custom cache is configured', async () => {
      const serverCache = new InMemoryServerCache();
      const recording = createRecordingModel('server-cache-model', 'shared');
      const a = new Agent({
        id: 'server-cache-agent',
        name: 'Server Cache Agent',
        instructions: 'You are a test agent',
        model: recording,
        responseCache: true,
      });
      new Mastra({ agents: { a }, cache: serverCache });

      await a.generate('shared prompt');
      await new Promise(resolve => setTimeout(resolve, 10));
      const second = await a.generate('shared prompt');

      expect(second.text).toBe('shared');
      expect(recording.doGenerateCalls).toHaveLength(1);
    });

    it('disables caching gracefully when no cache is available', async () => {
      const recording = createRecordingModel('no-cache-model', 'still works');
      // Standalone agent (no Mastra instance, no custom cache).
      const a = new Agent({
        id: 'no-cache-agent',
        name: 'No Cache Agent',
        instructions: 'You are a test agent',
        model: recording,
        responseCache: true,
      });

      const result = await a.generate('hello');
      expect(result.text).toBe('still works');
      expect(recording.doGenerateCalls).toHaveLength(1);
      // Second call also hits the model since caching couldn't initialize.
      await a.generate('hello');
      expect(recording.doGenerateCalls).toHaveLength(2);
    });
  });
});
