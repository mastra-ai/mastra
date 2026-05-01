import type { StepResult } from '@internal/ai-sdk-v5';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { MastraDBMessage, MessageList } from '../../agent/message-list';
import { TripWire } from '../../agent/trip-wire';
import { InMemoryServerCache } from '../../cache/inmemory';
import { RequestContext, MASTRA_RESOURCE_ID_KEY, MASTRA_THREAD_ID_KEY } from '../../request-context';
import type { ProcessInputStepArgs, ProcessOutputStepArgs } from '../index';
import { CostGuardProcessor } from './cost-guard';

function createStep(inputTokens: number, outputTokens: number): StepResult<any> {
  return {
    usage: { inputTokens, outputTokens },
    text: '',
    toolCalls: [],
    toolResults: [],
    finishReason: 'stop',
    content: [],
    request: { body: undefined },
    response: { messages: [] },
    reasoning: [],
    files: [],
    sources: [],
    reasoningText: undefined,
    providerMetadata: undefined,
  } as unknown as StepResult<any>;
}

function createMessage(text: string): MastraDBMessage {
  return {
    id: `msg-${Math.random()}`,
    role: 'user',
    content: { format: 2, parts: [{ type: 'text' as const, text }] },
    createdAt: new Date(),
  };
}

function createInputStepArgs(overrides: Partial<ProcessInputStepArgs> = {}): ProcessInputStepArgs {
  return {
    steps: [],
    stepNumber: 0,
    messages: [createMessage('hello')],
    messageList: {} as MessageList,
    abort: (() => {
      throw new Error('abort');
    }) as any,
    retryCount: 0,
    model: { modelId: 'test', provider: 'test', specificationVersion: 'v2' } as any,
    systemMessages: [],
    state: {},
    ...overrides,
  };
}

function createOutputStepArgs(
  inputTokens: number,
  outputTokens: number,
  overrides: Partial<ProcessOutputStepArgs> = {},
): ProcessOutputStepArgs {
  const messages = [createMessage('response')];
  return {
    stepNumber: 0,
    steps: [],
    messages,
    messageList: {} as MessageList,
    abort: (() => {
      throw new Error('abort');
    }) as any,
    retryCount: 0,
    systemMessages: [],
    state: {},
    finishReason: 'stop',
    usage: { inputTokens, outputTokens },
    ...overrides,
  };
}

describe('CostGuardProcessor', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('constructor', () => {
    it('throws if no limits are set', () => {
      expect(() => new CostGuardProcessor({ limits: {} })).toThrow(
        'CostGuardProcessor requires at least one limit to be set',
      );
    });

    it('accepts maxTotalTokens limit', () => {
      const guard = new CostGuardProcessor({ limits: { maxTotalTokens: 1000 } });
      expect(guard.id).toBe('cost-guard');
    });

    it('accepts maxSteps limit', () => {
      const guard = new CostGuardProcessor({ limits: { maxSteps: 5 } });
      expect(guard.name).toBe('Cost Guard');
    });

    it('accepts multiple limits', () => {
      const guard = new CostGuardProcessor({
        limits: { maxTotalTokens: 1000, maxInputTokens: 500, maxSteps: 10 },
      });
      expect(guard.id).toBe('cost-guard');
    });
  });

  describe('processInputStep - run scope', () => {
    it('allows step when under all limits', async () => {
      const guard = new CostGuardProcessor({
        limits: { maxTotalTokens: 1000 },
      });

      const args = createInputStepArgs({
        steps: [createStep(100, 50)],
        stepNumber: 1,
      });

      await expect(guard.processInputStep(args)).resolves.toBeUndefined();
    });

    it('blocks when maxTotalTokens exceeded', async () => {
      const guard = new CostGuardProcessor({
        limits: { maxTotalTokens: 100 },
      });

      const args = createInputStepArgs({
        steps: [createStep(60, 50)],
        stepNumber: 1,
      });

      await expect(guard.processInputStep(args)).rejects.toThrow(TripWire);
    });

    it('blocks when maxInputTokens exceeded', async () => {
      const guard = new CostGuardProcessor({
        limits: { maxInputTokens: 50 },
      });

      const args = createInputStepArgs({
        steps: [createStep(60, 10)],
        stepNumber: 1,
      });

      await expect(guard.processInputStep(args)).rejects.toThrow(TripWire);
    });

    it('blocks when maxOutputTokens exceeded', async () => {
      const guard = new CostGuardProcessor({
        limits: { maxOutputTokens: 50 },
      });

      const args = createInputStepArgs({
        steps: [createStep(10, 60)],
        stepNumber: 1,
      });

      await expect(guard.processInputStep(args)).rejects.toThrow(TripWire);
    });

    it('blocks when maxSteps exceeded', async () => {
      const guard = new CostGuardProcessor({
        limits: { maxSteps: 3 },
      });

      const args = createInputStepArgs({
        steps: [createStep(10, 10), createStep(10, 10), createStep(10, 10)],
        stepNumber: 3,
      });

      await expect(guard.processInputStep(args)).rejects.toThrow(TripWire);
    });

    it('sums tokens across multiple steps', async () => {
      const guard = new CostGuardProcessor({
        limits: { maxTotalTokens: 100 },
      });

      const args = createInputStepArgs({
        steps: [createStep(20, 10), createStep(30, 15), createStep(20, 10)],
        stepNumber: 3,
      });

      // Total: 70 + 35 = 105 > 100
      await expect(guard.processInputStep(args)).rejects.toThrow(TripWire);
    });

    it('allows first step with empty steps array', async () => {
      const guard = new CostGuardProcessor({
        limits: { maxTotalTokens: 100 },
      });

      const args = createInputStepArgs({ steps: [], stepNumber: 0 });
      await expect(guard.processInputStep(args)).resolves.toBeUndefined();
    });

    it('includes correct metadata in TripWire', async () => {
      const guard = new CostGuardProcessor({
        limits: { maxTotalTokens: 50 },
      });

      const args = createInputStepArgs({
        steps: [createStep(30, 30)],
        stepNumber: 1,
      });

      try {
        await guard.processInputStep(args);
        expect.fail('Expected TripWire to be thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(TripWire);
        const tripwire = error as TripWire<any>;
        expect(tripwire.options.retry).toBe(false);
        expect(tripwire.options.metadata).toMatchObject({
          processorId: 'cost-guard',
          scope: 'run',
          usage: {
            inputTokens: 30,
            outputTokens: 30,
            totalTokens: 60,
            steps: 1,
          },
          limit: { maxTotalTokens: 50 },
        });
      }
    });

    it('checks first violated limit in priority order', async () => {
      const guard = new CostGuardProcessor({
        limits: { maxTotalTokens: 50, maxInputTokens: 20 },
      });

      const args = createInputStepArgs({
        steps: [createStep(30, 30)],
        stepNumber: 1,
      });

      try {
        await guard.processInputStep(args);
        expect.fail('Expected TripWire to be thrown');
      } catch (error) {
        const tripwire = error as TripWire<any>;
        expect(tripwire.message).toContain('maxTotalTokens');
      }
    });
  });

  describe('warn strategy', () => {
    it('logs warning instead of throwing', async () => {
      const spy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const guard = new CostGuardProcessor({
        limits: { maxTotalTokens: 50 },
        strategy: 'warn',
      });

      const args = createInputStepArgs({
        steps: [createStep(30, 30)],
        stepNumber: 1,
      });

      await expect(guard.processInputStep(args)).resolves.toBeUndefined();
      expect(spy).toHaveBeenCalledWith(expect.stringContaining('[CostGuardProcessor]'));
      expect(spy).toHaveBeenCalledWith(expect.stringContaining('maxTotalTokens'));

      spy.mockRestore();
    });
  });

  describe('custom message', () => {
    it('uses custom message template', async () => {
      const guard = new CostGuardProcessor({
        limits: { maxTotalTokens: 50 },
        message: 'Budget exceeded: {limitType} at {usage} of {limit} allowed',
      });

      const args = createInputStepArgs({
        steps: [createStep(30, 30)],
        stepNumber: 1,
      });

      try {
        await guard.processInputStep(args);
        expect.fail('Expected TripWire to be thrown');
      } catch (error) {
        const tripwire = error as TripWire<any>;
        expect(tripwire.message).toBe('Budget exceeded: maxTotalTokens at 60 of 50 allowed');
      }
    });
  });

  describe('resource scope', () => {
    it('combines persisted and run usage', async () => {
      const cache = new InMemoryServerCache({ ttlMs: 60000 });
      // Pre-seed cached usage for a resource
      await cache.set('cost-guard:resource:user-123', {
        inputTokens: 40,
        outputTokens: 30,
        totalTokens: 70,
        steps: 2,
      });

      const guard = new CostGuardProcessor({
        limits: { maxTotalTokens: 100 },
        scope: 'resource',
      });
      // Simulate __registerMastra
      (guard as any).cache = cache;

      const requestContext = new RequestContext();
      requestContext.set(MASTRA_RESOURCE_ID_KEY, 'user-123');

      const args = createInputStepArgs({
        steps: [createStep(15, 20)],
        stepNumber: 1,
        requestContext,
      });

      // Persisted: 70, run: 35, total: 105 > 100
      await expect(guard.processInputStep(args)).rejects.toThrow(TripWire);
    });

    it('falls back to run scope when no resourceId', async () => {
      const guard = new CostGuardProcessor({
        limits: { maxTotalTokens: 100 },
        scope: 'resource',
      });
      (guard as any).cache = new InMemoryServerCache();

      const args = createInputStepArgs({
        steps: [createStep(10, 10)],
        stepNumber: 1,
      });

      await expect(guard.processInputStep(args)).resolves.toBeUndefined();
    });

    it('falls back to run scope when no cache', async () => {
      const guard = new CostGuardProcessor({
        limits: { maxTotalTokens: 100 },
        scope: 'resource',
      });

      const requestContext = new RequestContext();
      requestContext.set(MASTRA_RESOURCE_ID_KEY, 'user-123');

      const args = createInputStepArgs({
        steps: [createStep(10, 10)],
        stepNumber: 1,
        requestContext,
      });

      await expect(guard.processInputStep(args)).resolves.toBeUndefined();
    });
  });

  describe('thread scope', () => {
    it('combines persisted and run usage for thread', async () => {
      const cache = new InMemoryServerCache({ ttlMs: 60000 });
      await cache.set('cost-guard:thread:thread-abc', {
        inputTokens: 80,
        outputTokens: 15,
        totalTokens: 95,
        steps: 5,
      });

      const guard = new CostGuardProcessor({
        limits: { maxTotalTokens: 100 },
        scope: 'thread',
      });
      (guard as any).cache = cache;

      const requestContext = new RequestContext();
      requestContext.set(MASTRA_THREAD_ID_KEY, 'thread-abc');

      const args = createInputStepArgs({
        steps: [createStep(3, 3)],
        stepNumber: 1,
        requestContext,
      });

      // Persisted: 95, run: 6, total: 101 > 100
      await expect(guard.processInputStep(args)).rejects.toThrow(TripWire);
    });
  });

  describe('processOutputStep - usage persistence', () => {
    it('persists step usage for resource scope', async () => {
      const cache = new InMemoryServerCache({ ttlMs: 60000 });

      const guard = new CostGuardProcessor({
        limits: { maxTotalTokens: 1000 },
        scope: 'resource',
      });
      (guard as any).cache = cache;

      const requestContext = new RequestContext();
      requestContext.set(MASTRA_RESOURCE_ID_KEY, 'user-456');

      const args = createOutputStepArgs(100, 50, { requestContext });
      await guard.processOutputStep(args);

      const stored = (await cache.get('cost-guard:resource:user-456')) as any;
      expect(stored).toMatchObject({
        inputTokens: 100,
        outputTokens: 50,
        totalTokens: 150,
        steps: 1,
      });
    });

    it('accumulates usage across multiple steps', async () => {
      const cache = new InMemoryServerCache({ ttlMs: 60000 });

      const guard = new CostGuardProcessor({
        limits: { maxTotalTokens: 1000 },
        scope: 'resource',
      });
      (guard as any).cache = cache;

      const requestContext = new RequestContext();
      requestContext.set(MASTRA_RESOURCE_ID_KEY, 'user-789');

      await guard.processOutputStep(createOutputStepArgs(50, 30, { requestContext }));
      await guard.processOutputStep(createOutputStepArgs(40, 20, { requestContext }));

      const stored = (await cache.get('cost-guard:resource:user-789')) as any;
      expect(stored).toMatchObject({
        inputTokens: 90,
        outputTokens: 50,
        totalTokens: 140,
        steps: 2,
      });
    });

    it('no-ops for run scope', async () => {
      const guard = new CostGuardProcessor({
        limits: { maxTotalTokens: 1000 },
        scope: 'run',
      });

      const args = createOutputStepArgs(100, 50);
      const result = await guard.processOutputStep(args);
      expect(result).toEqual(args.messages);
    });

    it('returns messages unchanged', async () => {
      const cache = new InMemoryServerCache({ ttlMs: 60000 });
      const guard = new CostGuardProcessor({
        limits: { maxTotalTokens: 1000 },
        scope: 'resource',
      });
      (guard as any).cache = cache;

      const requestContext = new RequestContext();
      requestContext.set(MASTRA_RESOURCE_ID_KEY, 'user-x');

      const args = createOutputStepArgs(10, 10, { requestContext });
      const result = await guard.processOutputStep(args);
      expect(result).toBe(args.messages);
    });
  });

  describe('__registerMastra', () => {
    it('resolves cache from Mastra instance for non-run scopes', () => {
      const mockCache = new InMemoryServerCache();
      const mockMastra = { getServerCache: () => mockCache } as any;

      const guard = new CostGuardProcessor({
        limits: { maxTotalTokens: 100 },
        scope: 'thread',
      });

      guard.__registerMastra(mockMastra);
      expect((guard as any).cache).toBe(mockCache);
    });

    it('does not resolve cache for run scope', () => {
      const mockCache = new InMemoryServerCache();
      const mockMastra = { getServerCache: () => mockCache } as any;

      const guard = new CostGuardProcessor({
        limits: { maxTotalTokens: 100 },
        scope: 'run',
      });

      guard.__registerMastra(mockMastra);
      expect((guard as any).cache).toBeUndefined();
    });
  });

  describe('edge cases', () => {
    it('handles steps with missing usage data', async () => {
      const guard = new CostGuardProcessor({
        limits: { maxTotalTokens: 100 },
      });

      const badStep = { text: '', toolCalls: [] } as unknown as StepResult<any>;
      const args = createInputStepArgs({
        steps: [badStep, createStep(10, 10)],
        stepNumber: 2,
      });

      await expect(guard.processInputStep(args)).resolves.toBeUndefined();
    });

    it('cache read failure falls back to zero (fail-open)', async () => {
      const cache = new InMemoryServerCache();
      vi.spyOn(cache, 'get').mockRejectedValue(new Error('cache unavailable'));

      const guard = new CostGuardProcessor({
        limits: { maxTotalTokens: 100 },
        scope: 'resource',
      });
      (guard as any).cache = cache;

      const requestContext = new RequestContext();
      requestContext.set(MASTRA_RESOURCE_ID_KEY, 'user-fail');

      const args = createInputStepArgs({
        steps: [createStep(10, 10)],
        stepNumber: 1,
        requestContext,
      });

      await expect(guard.processInputStep(args)).resolves.toBeUndefined();
    });

    it('cache write failure does not throw (fail-open)', async () => {
      const cache = new InMemoryServerCache();
      vi.spyOn(cache, 'set').mockRejectedValue(new Error('cache write fail'));

      const guard = new CostGuardProcessor({
        limits: { maxTotalTokens: 1000 },
        scope: 'resource',
      });
      (guard as any).cache = cache;

      const requestContext = new RequestContext();
      requestContext.set(MASTRA_RESOURCE_ID_KEY, 'user-write-fail');

      const args = createOutputStepArgs(10, 10, { requestContext });
      await expect(guard.processOutputStep(args)).resolves.toEqual(args.messages);
    });

    it('exact boundary: blocks at exactly the limit', async () => {
      const guard = new CostGuardProcessor({
        limits: { maxTotalTokens: 100 },
      });

      const args = createInputStepArgs({
        steps: [createStep(50, 50)],
        stepNumber: 1,
      });

      // 50 + 50 = 100 >= 100 → blocks
      await expect(guard.processInputStep(args)).rejects.toThrow(TripWire);
    });

    it('just under limit: allows', async () => {
      const guard = new CostGuardProcessor({
        limits: { maxTotalTokens: 100 },
      });

      const args = createInputStepArgs({
        steps: [createStep(49, 50)],
        stepNumber: 1,
      });

      // 49 + 50 = 99 < 100 → allows
      await expect(guard.processInputStep(args)).resolves.toBeUndefined();
    });
  });
});
