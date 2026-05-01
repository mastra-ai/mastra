import type { StepResult } from '@internal/ai-sdk-v5';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { MessageList } from '../../agent/message-list';
import { TripWire } from '../../agent/trip-wire';
import { RequestContext, MASTRA_RESOURCE_ID_KEY, MASTRA_THREAD_ID_KEY } from '../../request-context';
import type { ObservabilityStorage } from '../../storage/domains';
import type { ProcessInputStepArgs } from '../index';
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

function createInputStepArgs(overrides: Partial<ProcessInputStepArgs> = {}): ProcessInputStepArgs {
  return {
    steps: [],
    stepNumber: 0,
    messages: [
      {
        id: 'msg-1',
        role: 'user',
        content: { format: 2, parts: [{ type: 'text' as const, text: 'hello' }] },
        createdAt: new Date(),
      },
    ],
    messageList: {} as MessageList,
    abort: ((reason?: string, options?: any) => {
      throw new TripWire(reason ?? 'abort', options ?? {});
    }) as any,
    retryCount: 0,
    model: { modelId: 'test', provider: 'test', specificationVersion: 'v2' } as any,
    systemMessages: [],
    state: {},
    ...overrides,
  };
}

function createMockObservabilityStorage(
  inputTokens: number = 0,
  outputTokens: number = 0,
  options?: { inputCost?: number; outputCost?: number; costUnit?: string },
): ObservabilityStorage {
  return {
    getMetricAggregate: vi.fn().mockImplementation(async (args: { name: string[] }) => {
      if (args.name[0] === 'mastra_model_total_input_tokens') {
        return {
          value: inputTokens,
          estimatedCost: options?.inputCost ?? null,
          costUnit: options?.costUnit ?? null,
        };
      }
      if (args.name[0] === 'mastra_model_total_output_tokens') {
        return {
          value: outputTokens,
          estimatedCost: options?.outputCost ?? null,
          costUnit: options?.costUnit ?? null,
        };
      }
      return { value: null, estimatedCost: null, costUnit: null };
    }),
  } as unknown as ObservabilityStorage;
}

describe('CostGuardProcessor', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
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

    it('accepts maxCost limit', () => {
      const guard = new CostGuardProcessor({ limits: { maxCost: 1.0 } });
      expect(guard.name).toBe('Cost Guard');
    });

    it('accepts multiple limits', () => {
      const guard = new CostGuardProcessor({
        limits: { maxTotalTokens: 1000, maxInputTokens: 500, maxCost: 2.0 },
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
    it('combines observability data and run usage', async () => {
      const obsStorage = createMockObservabilityStorage(40, 30);

      const guard = new CostGuardProcessor({
        limits: { maxTotalTokens: 100 },
        scope: 'resource',
      });
      (guard as any).observabilityStorage = obsStorage;

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

    it('queries with correct resourceId filter', async () => {
      const obsStorage = createMockObservabilityStorage(0, 0);

      const guard = new CostGuardProcessor({
        limits: { maxTotalTokens: 1000 },
        scope: 'resource',
      });
      (guard as any).observabilityStorage = obsStorage;

      const requestContext = new RequestContext();
      requestContext.set(MASTRA_RESOURCE_ID_KEY, 'user-456');

      const args = createInputStepArgs({
        steps: [createStep(10, 10)],
        stepNumber: 1,
        requestContext,
      });

      await guard.processInputStep(args);

      expect(obsStorage.getMetricAggregate).toHaveBeenCalledWith(
        expect.objectContaining({
          filters: expect.objectContaining({ resourceId: 'user-456' }),
        }),
      );
    });

    it('falls back to run scope when no resourceId', async () => {
      const obsStorage = createMockObservabilityStorage(90, 90);

      const guard = new CostGuardProcessor({
        limits: { maxTotalTokens: 100 },
        scope: 'resource',
      });
      (guard as any).observabilityStorage = obsStorage;

      const args = createInputStepArgs({
        steps: [createStep(10, 10)],
        stepNumber: 1,
      });

      // No resourceId → falls back to run scope, run usage is 20 < 100
      await expect(guard.processInputStep(args)).resolves.toBeUndefined();
      // Should NOT have queried observability since there's no resourceId
      expect(obsStorage.getMetricAggregate).not.toHaveBeenCalled();
    });

    it('falls back to run scope when no observability storage', async () => {
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
    it('combines observability data and run usage for thread', async () => {
      const obsStorage = createMockObservabilityStorage(80, 15);

      const guard = new CostGuardProcessor({
        limits: { maxTotalTokens: 100 },
        scope: 'thread',
      });
      (guard as any).observabilityStorage = obsStorage;

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

    it('queries with correct threadId filter', async () => {
      const obsStorage = createMockObservabilityStorage(0, 0);

      const guard = new CostGuardProcessor({
        limits: { maxTotalTokens: 1000 },
        scope: 'thread',
      });
      (guard as any).observabilityStorage = obsStorage;

      const requestContext = new RequestContext();
      requestContext.set(MASTRA_THREAD_ID_KEY, 'thread-xyz');

      const args = createInputStepArgs({
        steps: [createStep(10, 10)],
        stepNumber: 1,
        requestContext,
      });

      await guard.processInputStep(args);

      expect(obsStorage.getMetricAggregate).toHaveBeenCalledWith(
        expect.objectContaining({
          filters: expect.objectContaining({ threadId: 'thread-xyz' }),
        }),
      );
    });

    it('includes scope key in TripWire metadata', async () => {
      const obsStorage = createMockObservabilityStorage(80, 80);

      const guard = new CostGuardProcessor({
        limits: { maxTotalTokens: 100 },
        scope: 'thread',
      });
      (guard as any).observabilityStorage = obsStorage;

      const requestContext = new RequestContext();
      requestContext.set(MASTRA_THREAD_ID_KEY, 'thread-meta');

      const args = createInputStepArgs({
        steps: [createStep(1, 1)],
        stepNumber: 1,
        requestContext,
      });

      try {
        await guard.processInputStep(args);
        expect.fail('Expected TripWire to be thrown');
      } catch (error) {
        const tripwire = error as TripWire<any>;
        expect(tripwire.options.metadata).toMatchObject({
          scope: 'thread',
          scopeKey: 'thread:thread-meta',
        });
      }
    });
  });

  describe('__registerMastra', () => {
    it('resolves observability storage for non-run scopes', () => {
      const mockObsStorage = createMockObservabilityStorage();
      const mockMastra = {
        getStorage: () => ({ stores: { observability: mockObsStorage } }),
      } as any;

      const guard = new CostGuardProcessor({
        limits: { maxTotalTokens: 100 },
        scope: 'thread',
      });

      guard.__registerMastra(mockMastra);
      expect((guard as any).observabilityStorage).toBe(mockObsStorage);
    });

    it('throws when observability storage is not available for non-run scopes', () => {
      const mockMastra = {
        getStorage: () => ({ stores: {} }),
      } as any;

      const guard = new CostGuardProcessor({
        limits: { maxTotalTokens: 100 },
        scope: 'resource',
      });

      expect(() => guard.__registerMastra(mockMastra)).toThrow('observability storage');
    });

    it('throws when storage is not configured for non-run scopes', () => {
      const mockMastra = {
        getStorage: () => undefined,
      } as any;

      const guard = new CostGuardProcessor({
        limits: { maxTotalTokens: 100 },
        scope: 'thread',
      });

      expect(() => guard.__registerMastra(mockMastra)).toThrow('observability storage');
    });

    it('throws when observability storage lacks getMetricAggregate', () => {
      const mockMastra = {
        getStorage: () => ({ stores: { observability: { listMetrics: vi.fn() } } }),
      } as any;

      const guard = new CostGuardProcessor({
        limits: { maxTotalTokens: 100 },
        scope: 'resource',
      });

      expect(() => guard.__registerMastra(mockMastra)).toThrow('getMetricAggregate');
    });

    it('does not require observability storage for run scope', () => {
      const mockMastra = {
        getStorage: () => undefined,
      } as any;

      const guard = new CostGuardProcessor({
        limits: { maxTotalTokens: 100 },
        scope: 'run',
      });

      guard.__registerMastra(mockMastra);
      expect((guard as any).observabilityStorage).toBeUndefined();
    });
  });

  describe('maxCost limit', () => {
    it('blocks when estimated cost exceeds maxCost', async () => {
      const obsStorage = createMockObservabilityStorage(1000, 500, {
        inputCost: 0.3,
        outputCost: 0.25,
        costUnit: 'usd',
      });

      const guard = new CostGuardProcessor({
        limits: { maxCost: 0.5 },
        scope: 'resource',
      });
      (guard as any).observabilityStorage = obsStorage;

      const requestContext = new RequestContext();
      requestContext.set(MASTRA_RESOURCE_ID_KEY, 'user-cost');

      const args = createInputStepArgs({
        steps: [createStep(10, 10)],
        stepNumber: 1,
        requestContext,
      });

      // Total cost: 0.30 + 0.25 = 0.55 > 0.50
      await expect(guard.processInputStep(args)).rejects.toThrow(TripWire);
    });

    it('allows when estimated cost is under maxCost', async () => {
      const obsStorage = createMockObservabilityStorage(100, 50, {
        inputCost: 0.1,
        outputCost: 0.05,
        costUnit: 'usd',
      });

      const guard = new CostGuardProcessor({
        limits: { maxCost: 0.5 },
        scope: 'resource',
      });
      (guard as any).observabilityStorage = obsStorage;

      const requestContext = new RequestContext();
      requestContext.set(MASTRA_RESOURCE_ID_KEY, 'user-cheap');

      const args = createInputStepArgs({
        steps: [createStep(10, 10)],
        stepNumber: 1,
        requestContext,
      });

      // Total cost: 0.10 + 0.05 = 0.15 < 0.50
      await expect(guard.processInputStep(args)).resolves.toBeUndefined();
    });

    it('includes cost info in TripWire metadata', async () => {
      const obsStorage = createMockObservabilityStorage(1000, 500, {
        inputCost: 0.6,
        outputCost: 0.5,
        costUnit: 'usd',
      });

      const guard = new CostGuardProcessor({
        limits: { maxCost: 1.0 },
        scope: 'thread',
      });
      (guard as any).observabilityStorage = obsStorage;

      const requestContext = new RequestContext();
      requestContext.set(MASTRA_THREAD_ID_KEY, 'thread-cost');

      const args = createInputStepArgs({
        steps: [createStep(1, 1)],
        stepNumber: 1,
        requestContext,
      });

      try {
        await guard.processInputStep(args);
        expect.fail('Expected TripWire to be thrown');
      } catch (error) {
        const tripwire = error as TripWire<any>;
        expect(tripwire.message).toContain('maxCost');
        expect(tripwire.options.metadata.usage.estimatedCost).toBe(1.1);
        expect(tripwire.options.metadata.usage.costUnit).toBe('usd');
      }
    });

    it('skips maxCost check when no cost data available', async () => {
      const obsStorage = createMockObservabilityStorage(10, 10);

      const guard = new CostGuardProcessor({
        limits: { maxCost: 0.01 },
        scope: 'resource',
      });
      (guard as any).observabilityStorage = obsStorage;

      const requestContext = new RequestContext();
      requestContext.set(MASTRA_RESOURCE_ID_KEY, 'user-no-cost');

      const args = createInputStepArgs({
        steps: [createStep(10, 10)],
        stepNumber: 1,
        requestContext,
      });

      // No cost data returned → maxCost check is skipped
      await expect(guard.processInputStep(args)).resolves.toBeUndefined();
    });

    it('maxCost only works with observability scopes (not run scope)', async () => {
      const guard = new CostGuardProcessor({
        limits: { maxCost: 0.01 },
      });

      const args = createInputStepArgs({
        steps: [createStep(10000, 10000)],
        stepNumber: 1,
      });

      // Run scope doesn't have cost data, so maxCost check is skipped
      await expect(guard.processInputStep(args)).resolves.toBeUndefined();
    });
  });

  describe('onViolation callback', () => {
    it('calls onViolation when a limit is exceeded with block strategy', async () => {
      const onViolation = vi.fn();

      const guard = new CostGuardProcessor({
        limits: { maxTotalTokens: 50 },
        onViolation,
      });

      const args = createInputStepArgs({
        steps: [createStep(30, 30)],
        stepNumber: 1,
      });

      await expect(guard.processInputStep(args)).rejects.toThrow(TripWire);
      expect(onViolation).toHaveBeenCalledWith({
        limitType: 'maxTotalTokens',
        usage: 60,
        limit: 50,
        totalUsage: expect.objectContaining({ inputTokens: 30, outputTokens: 30, totalTokens: 60 }),
        scope: 'run',
        scopeKey: undefined,
      });
    });

    it('calls onViolation when a limit is exceeded with warn strategy', async () => {
      const spy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const onViolation = vi.fn();

      const guard = new CostGuardProcessor({
        limits: { maxTotalTokens: 50 },
        strategy: 'warn',
        onViolation,
      });

      const args = createInputStepArgs({
        steps: [createStep(30, 30)],
        stepNumber: 1,
      });

      await guard.processInputStep(args);
      expect(onViolation).toHaveBeenCalledOnce();

      spy.mockRestore();
    });

    it('does not call onViolation when under limits', async () => {
      const onViolation = vi.fn();

      const guard = new CostGuardProcessor({
        limits: { maxTotalTokens: 1000 },
        onViolation,
      });

      const args = createInputStepArgs({
        steps: [createStep(10, 10)],
        stepNumber: 1,
      });

      await guard.processInputStep(args);
      expect(onViolation).not.toHaveBeenCalled();
    });

    it('continues even if onViolation throws', async () => {
      const onViolation = vi.fn().mockRejectedValue(new Error('notification failed'));

      const guard = new CostGuardProcessor({
        limits: { maxTotalTokens: 50 },
        onViolation,
      });

      const args = createInputStepArgs({
        steps: [createStep(30, 30)],
        stepNumber: 1,
      });

      // Should still throw TripWire even though onViolation failed
      await expect(guard.processInputStep(args)).rejects.toThrow(TripWire);
      expect(onViolation).toHaveBeenCalled();
    });

    it('includes scope key for scoped violations', async () => {
      const onViolation = vi.fn();
      const obsStorage = createMockObservabilityStorage(80, 80);

      const guard = new CostGuardProcessor({
        limits: { maxTotalTokens: 100 },
        scope: 'thread',
        onViolation,
      });
      (guard as any).observabilityStorage = obsStorage;

      const requestContext = new RequestContext();
      requestContext.set(MASTRA_THREAD_ID_KEY, 'thread-callback');

      const args = createInputStepArgs({
        steps: [createStep(1, 1)],
        stepNumber: 1,
        requestContext,
      });

      await expect(guard.processInputStep(args)).rejects.toThrow(TripWire);
      expect(onViolation).toHaveBeenCalledWith(
        expect.objectContaining({
          scope: 'thread',
          scopeKey: 'thread:thread-callback',
        }),
      );
    });

    it('awaits async onViolation before continuing', async () => {
      const callOrder: string[] = [];
      const onViolation = vi.fn().mockImplementation(async () => {
        await new Promise(resolve => setTimeout(resolve, 10));
        callOrder.push('violation');
      });

      const guard = new CostGuardProcessor({
        limits: { maxTotalTokens: 50 },
        strategy: 'warn',
        onViolation,
      });

      const spy = vi.spyOn(console, 'warn').mockImplementation(() => {
        callOrder.push('warn');
      });

      const args = createInputStepArgs({
        steps: [createStep(30, 30)],
        stepNumber: 1,
      });

      await guard.processInputStep(args);
      expect(callOrder).toEqual(['violation', 'warn']);

      spy.mockRestore();
    });
  });

  describe('abort() usage', () => {
    it('uses abort() from args instead of manually throwing TripWire', async () => {
      const abortFn = vi.fn(((reason?: string, options?: any) => {
        throw new TripWire(reason ?? 'abort', options ?? {});
      }) as any);

      const guard = new CostGuardProcessor({
        limits: { maxTotalTokens: 50 },
      });

      const args = createInputStepArgs({
        steps: [createStep(30, 30)],
        stepNumber: 1,
        abort: abortFn,
      });

      await expect(guard.processInputStep(args)).rejects.toThrow(TripWire);
      expect(abortFn).toHaveBeenCalledWith(
        expect.stringContaining('maxTotalTokens'),
        expect.objectContaining({
          retry: false,
          metadata: expect.objectContaining({ processorId: 'cost-guard' }),
        }),
      );
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

    it('observability query failure falls back to zero (fail-open)', async () => {
      const obsStorage = {
        getMetricAggregate: vi.fn().mockRejectedValue(new Error('observability unavailable')),
      } as unknown as ObservabilityStorage;

      const guard = new CostGuardProcessor({
        limits: { maxTotalTokens: 100 },
        scope: 'resource',
      });
      (guard as any).observabilityStorage = obsStorage;

      const requestContext = new RequestContext();
      requestContext.set(MASTRA_RESOURCE_ID_KEY, 'user-fail');

      const args = createInputStepArgs({
        steps: [createStep(10, 10)],
        stepNumber: 1,
        requestContext,
      });

      // Observability query fails → persisted = 0, run = 20 < 100 → allows
      await expect(guard.processInputStep(args)).resolves.toBeUndefined();
    });

    it('handles null values from observability aggregate', async () => {
      const obsStorage = {
        getMetricAggregate: vi.fn().mockResolvedValue({ value: null, estimatedCost: null, costUnit: null }),
      } as unknown as ObservabilityStorage;

      const guard = new CostGuardProcessor({
        limits: { maxTotalTokens: 100 },
        scope: 'resource',
      });
      (guard as any).observabilityStorage = obsStorage;

      const requestContext = new RequestContext();
      requestContext.set(MASTRA_RESOURCE_ID_KEY, 'user-null');

      const args = createInputStepArgs({
        steps: [createStep(10, 10)],
        stepNumber: 1,
        requestContext,
      });

      // null values → persisted = 0, run = 20 < 100 → allows
      await expect(guard.processInputStep(args)).resolves.toBeUndefined();
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
