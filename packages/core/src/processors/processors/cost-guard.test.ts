import type { StepResult } from '@internal/ai-sdk-v5';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { MessageList } from '../../agent/message-list';
import { TripWire } from '../../agent/trip-wire';
import { RequestContext, MASTRA_RESOURCE_ID_KEY, MASTRA_THREAD_ID_KEY } from '../../request-context';
import type { ObservabilityStorage } from '../../storage/domains';
import type { ProcessInputStepArgs } from '../index';
import { CostGuardProcessor } from './cost-guard';

function createStep(
  inputTokens: number,
  outputTokens: number,
  costInfo?: { estimatedCost: number; costUnit: string },
): StepResult<any> {
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
    providerMetadata: costInfo ? { mastra: { cost: costInfo } } : undefined,
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

function createMockObservabilityStorage(options?: {
  inputCost?: number;
  outputCost?: number;
  costUnit?: string;
}): ObservabilityStorage {
  return {
    getMetricAggregate: vi.fn().mockImplementation(async (args: { name: string[] }) => {
      if (args.name[0] === 'mastra_model_total_input_tokens') {
        return {
          value: 0,
          estimatedCost: options?.inputCost ?? null,
          costUnit: options?.costUnit ?? null,
        };
      }
      if (args.name[0] === 'mastra_model_total_output_tokens') {
        return {
          value: 0,
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
    it('throws if maxCost is not positive', () => {
      expect(() => new CostGuardProcessor({ maxCost: 0 })).toThrow('positive number');
      expect(() => new CostGuardProcessor({ maxCost: -1 })).toThrow('positive number');
    });

    it('accepts valid maxCost', () => {
      const guard = new CostGuardProcessor({ maxCost: 1.0 });
      expect(guard.id).toBe('cost-guard');
      expect(guard.name).toBe('Cost Guard');
    });

    it('defaults scope to run', () => {
      const guard = new CostGuardProcessor({ maxCost: 1.0 });
      expect((guard as any).scope).toBe('run');
    });

    it('defaults window to 7d', () => {
      const guard = new CostGuardProcessor({ maxCost: 1.0 });
      expect((guard as any).window).toBe('7d');
    });

    it('defaults strategy to block', () => {
      const guard = new CostGuardProcessor({ maxCost: 1.0 });
      expect((guard as any).strategy).toBe('block');
    });
  });

  describe('processInputStep - run scope', () => {
    it('allows step when no cost data is available', async () => {
      const guard = new CostGuardProcessor({ maxCost: 1.0 });

      const args = createInputStepArgs({
        steps: [createStep(100, 50)],
        stepNumber: 1,
      });

      await expect(guard.processInputStep(args)).resolves.toBeUndefined();
    });

    it('blocks when estimated cost exceeds maxCost', async () => {
      const guard = new CostGuardProcessor({ maxCost: 0.5 });

      const args = createInputStepArgs({
        steps: [
          createStep(100, 50, { estimatedCost: 0.3, costUnit: 'usd' }),
          createStep(100, 50, { estimatedCost: 0.25, costUnit: 'usd' }),
        ],
        stepNumber: 2,
      });

      // Total: 0.30 + 0.25 = 0.55 > 0.50
      await expect(guard.processInputStep(args)).rejects.toThrow(TripWire);
    });

    it('allows when estimated cost is under maxCost', async () => {
      const guard = new CostGuardProcessor({ maxCost: 1.0 });

      const args = createInputStepArgs({
        steps: [
          createStep(100, 50, { estimatedCost: 0.1, costUnit: 'usd' }),
          createStep(100, 50, { estimatedCost: 0.05, costUnit: 'usd' }),
        ],
        stepNumber: 2,
      });

      // Total: 0.15 < 1.00
      await expect(guard.processInputStep(args)).resolves.toBeUndefined();
    });

    it('sums cost across multiple steps', async () => {
      const guard = new CostGuardProcessor({ maxCost: 0.5 });

      const args = createInputStepArgs({
        steps: [
          createStep(10, 10, { estimatedCost: 0.2, costUnit: 'usd' }),
          createStep(10, 10, { estimatedCost: 0.2, costUnit: 'usd' }),
          createStep(10, 10, { estimatedCost: 0.15, costUnit: 'usd' }),
        ],
        stepNumber: 3,
      });

      // Total: 0.55 > 0.50
      await expect(guard.processInputStep(args)).rejects.toThrow(TripWire);
    });

    it('allows first step with empty steps array', async () => {
      const guard = new CostGuardProcessor({ maxCost: 0.01 });

      const args = createInputStepArgs({ steps: [], stepNumber: 0 });
      await expect(guard.processInputStep(args)).resolves.toBeUndefined();
    });

    it('includes correct metadata in TripWire', async () => {
      const guard = new CostGuardProcessor({ maxCost: 0.5 });

      const args = createInputStepArgs({
        steps: [createStep(100, 50, { estimatedCost: 0.6, costUnit: 'usd' })],
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
          maxCost: 0.5,
          usage: {
            estimatedCost: 0.6,
            costUnit: 'usd',
          },
        });
      }
    });
  });

  describe('warn strategy', () => {
    it('logs warning instead of throwing', async () => {
      const spy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const guard = new CostGuardProcessor({
        maxCost: 0.5,
        strategy: 'warn',
      });

      const args = createInputStepArgs({
        steps: [createStep(100, 50, { estimatedCost: 0.6, costUnit: 'usd' })],
        stepNumber: 1,
      });

      await expect(guard.processInputStep(args)).resolves.toBeUndefined();
      expect(spy).toHaveBeenCalledWith(expect.stringContaining('[CostGuardProcessor]'));

      spy.mockRestore();
    });
  });

  describe('custom message', () => {
    it('uses custom message template', async () => {
      const guard = new CostGuardProcessor({
        maxCost: 0.5,
        message: 'Budget exceeded: ${usage} of ${limit} allowed',
      });

      const args = createInputStepArgs({
        steps: [createStep(100, 50, { estimatedCost: 0.6, costUnit: 'usd' })],
        stepNumber: 1,
      });

      try {
        await guard.processInputStep(args);
        expect.fail('Expected TripWire to be thrown');
      } catch (error) {
        const tripwire = error as TripWire<any>;
        expect(tripwire.message).toContain('0.6');
        expect(tripwire.message).toContain('0.5');
      }
    });
  });

  describe('resource scope', () => {
    it('combines observability cost and run cost', async () => {
      const obsStorage = createMockObservabilityStorage({
        inputCost: 0.3,
        outputCost: 0.15,
        costUnit: 'usd',
      });

      const guard = new CostGuardProcessor({
        maxCost: 0.5,
        scope: 'resource',
      });
      (guard as any).observabilityStorage = obsStorage;

      const requestContext = new RequestContext();
      requestContext.set(MASTRA_RESOURCE_ID_KEY, 'user-123');

      const args = createInputStepArgs({
        steps: [createStep(10, 10, { estimatedCost: 0.1, costUnit: 'usd' })],
        stepNumber: 1,
        requestContext,
      });

      // Persisted: 0.45, run: 0.10, total: 0.55 > 0.50
      await expect(guard.processInputStep(args)).rejects.toThrow(TripWire);
    });

    it('queries with correct resourceId filter', async () => {
      const obsStorage = createMockObservabilityStorage();

      const guard = new CostGuardProcessor({
        maxCost: 10.0,
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

    it('passes timestamp filter for time window', async () => {
      const obsStorage = createMockObservabilityStorage();

      const guard = new CostGuardProcessor({
        maxCost: 10.0,
        scope: 'resource',
        window: '24h',
      });
      (guard as any).observabilityStorage = obsStorage;

      const requestContext = new RequestContext();
      requestContext.set(MASTRA_RESOURCE_ID_KEY, 'user-window');

      const args = createInputStepArgs({
        steps: [createStep(10, 10)],
        stepNumber: 1,
        requestContext,
      });

      const before = Date.now();
      await guard.processInputStep(args);

      expect(obsStorage.getMetricAggregate).toHaveBeenCalledWith(
        expect.objectContaining({
          filters: expect.objectContaining({
            timestamp: expect.objectContaining({
              start: expect.any(Date),
            }),
          }),
        }),
      );

      // Verify the timestamp is approximately 24h ago
      const call = (obsStorage.getMetricAggregate as any).mock.calls[0][0];
      const windowStart = call.filters.timestamp.start.getTime();
      const expectedStart = before - 24 * 60 * 60 * 1000;
      expect(Math.abs(windowStart - expectedStart)).toBeLessThan(1000);
    });

    it('uses default 7d window', async () => {
      const obsStorage = createMockObservabilityStorage();

      const guard = new CostGuardProcessor({
        maxCost: 10.0,
        scope: 'resource',
      });
      (guard as any).observabilityStorage = obsStorage;

      const requestContext = new RequestContext();
      requestContext.set(MASTRA_RESOURCE_ID_KEY, 'user-default-window');

      const args = createInputStepArgs({
        steps: [createStep(10, 10)],
        stepNumber: 1,
        requestContext,
      });

      const before = Date.now();
      await guard.processInputStep(args);

      const call = (obsStorage.getMetricAggregate as any).mock.calls[0][0];
      const windowStart = call.filters.timestamp.start.getTime();
      const expectedStart = before - 7 * 24 * 60 * 60 * 1000;
      expect(Math.abs(windowStart - expectedStart)).toBeLessThan(1000);
    });

    it('falls back to run scope when no resourceId', async () => {
      const obsStorage = createMockObservabilityStorage({
        inputCost: 10.0,
        outputCost: 10.0,
        costUnit: 'usd',
      });

      const guard = new CostGuardProcessor({
        maxCost: 1.0,
        scope: 'resource',
      });
      (guard as any).observabilityStorage = obsStorage;

      const args = createInputStepArgs({
        steps: [createStep(10, 10)],
        stepNumber: 1,
      });

      // No resourceId → falls back to run scope, run cost is null → allows
      await expect(guard.processInputStep(args)).resolves.toBeUndefined();
      expect(obsStorage.getMetricAggregate).not.toHaveBeenCalled();
    });

    it('falls back to run scope when no observability storage', async () => {
      const guard = new CostGuardProcessor({
        maxCost: 1.0,
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
    it('combines observability cost and run cost for thread', async () => {
      const obsStorage = createMockObservabilityStorage({
        inputCost: 0.4,
        outputCost: 0.2,
        costUnit: 'usd',
      });

      const guard = new CostGuardProcessor({
        maxCost: 0.5,
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

      // Persisted: 0.60, run: 0, total: 0.60 > 0.50
      await expect(guard.processInputStep(args)).rejects.toThrow(TripWire);
    });

    it('queries with correct threadId filter', async () => {
      const obsStorage = createMockObservabilityStorage();

      const guard = new CostGuardProcessor({
        maxCost: 10.0,
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
      const obsStorage = createMockObservabilityStorage({
        inputCost: 1.0,
        outputCost: 1.0,
        costUnit: 'usd',
      });

      const guard = new CostGuardProcessor({
        maxCost: 1.0,
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
        maxCost: 1.0,
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
        maxCost: 1.0,
        scope: 'resource',
      });

      expect(() => guard.__registerMastra(mockMastra)).toThrow('observability storage');
    });

    it('throws when storage is not configured for non-run scopes', () => {
      const mockMastra = {
        getStorage: () => undefined,
      } as any;

      const guard = new CostGuardProcessor({
        maxCost: 1.0,
        scope: 'thread',
      });

      expect(() => guard.__registerMastra(mockMastra)).toThrow('observability storage');
    });

    it('throws when observability storage lacks getMetricAggregate', () => {
      const mockMastra = {
        getStorage: () => ({ stores: { observability: { listMetrics: vi.fn() } } }),
      } as any;

      const guard = new CostGuardProcessor({
        maxCost: 1.0,
        scope: 'resource',
      });

      expect(() => guard.__registerMastra(mockMastra)).toThrow('getMetricAggregate');
    });

    it('does not require observability storage for run scope', () => {
      const mockMastra = {
        getStorage: () => undefined,
      } as any;

      const guard = new CostGuardProcessor({
        maxCost: 1.0,
        scope: 'run',
      });

      guard.__registerMastra(mockMastra);
      expect((guard as any).observabilityStorage).toBeUndefined();
    });
  });

  describe('onViolation callback', () => {
    it('calls onViolation when cost limit is exceeded with block strategy', async () => {
      const onViolation = vi.fn();

      const guard = new CostGuardProcessor({
        maxCost: 0.5,
        onViolation,
      });

      const args = createInputStepArgs({
        steps: [createStep(100, 50, { estimatedCost: 0.6, costUnit: 'usd' })],
        stepNumber: 1,
      });

      await expect(guard.processInputStep(args)).rejects.toThrow(TripWire);
      expect(onViolation).toHaveBeenCalledWith({
        processorId: 'cost-guard',
        message: expect.stringContaining('cost limit exceeded'),
        detail: expect.objectContaining({
          usage: 0.6,
          limit: 0.5,
          totalUsage: expect.objectContaining({ estimatedCost: 0.6, costUnit: 'usd' }),
          scope: 'run',
        }),
      });
    });

    it('calls onViolation when cost limit is exceeded with warn strategy', async () => {
      const spy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const onViolation = vi.fn();

      const guard = new CostGuardProcessor({
        maxCost: 0.5,
        strategy: 'warn',
        onViolation,
      });

      const args = createInputStepArgs({
        steps: [createStep(100, 50, { estimatedCost: 0.6, costUnit: 'usd' })],
        stepNumber: 1,
      });

      await guard.processInputStep(args);
      expect(onViolation).toHaveBeenCalledOnce();

      spy.mockRestore();
    });

    it('does not call onViolation when under limit', async () => {
      const onViolation = vi.fn();

      const guard = new CostGuardProcessor({
        maxCost: 10.0,
        onViolation,
      });

      const args = createInputStepArgs({
        steps: [createStep(10, 10, { estimatedCost: 0.01, costUnit: 'usd' })],
        stepNumber: 1,
      });

      await guard.processInputStep(args);
      expect(onViolation).not.toHaveBeenCalled();
    });

    it('continues even if onViolation throws', async () => {
      const onViolation = vi.fn().mockRejectedValue(new Error('notification failed'));

      const guard = new CostGuardProcessor({
        maxCost: 0.5,
        onViolation,
      });

      const args = createInputStepArgs({
        steps: [createStep(100, 50, { estimatedCost: 0.6, costUnit: 'usd' })],
        stepNumber: 1,
      });

      await expect(guard.processInputStep(args)).rejects.toThrow(TripWire);
      expect(onViolation).toHaveBeenCalled();
    });

    it('can be set via the Processor interface onViolation property', async () => {
      const onViolation = vi.fn();

      const guard = new CostGuardProcessor({ maxCost: 0.5 });
      guard.onViolation = onViolation;

      const args = createInputStepArgs({
        steps: [createStep(100, 50, { estimatedCost: 0.6, costUnit: 'usd' })],
        stepNumber: 1,
      });

      await expect(guard.processInputStep(args)).rejects.toThrow(TripWire);
      expect(onViolation).toHaveBeenCalledWith(
        expect.objectContaining({
          processorId: 'cost-guard',
          message: expect.any(String),
          detail: expect.objectContaining({ usage: 0.6, limit: 0.5 }),
        }),
      );
    });

    it('includes scope key for scoped violations', async () => {
      const onViolation = vi.fn();
      const obsStorage = createMockObservabilityStorage({
        inputCost: 1.0,
        outputCost: 1.0,
        costUnit: 'usd',
      });

      const guard = new CostGuardProcessor({
        maxCost: 1.0,
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
          detail: expect.objectContaining({
            scope: 'thread',
            scopeKey: 'thread:thread-callback',
          }),
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
        maxCost: 0.5,
        strategy: 'warn',
        onViolation,
      });

      const spy = vi.spyOn(console, 'warn').mockImplementation(() => {
        callOrder.push('warn');
      });

      const args = createInputStepArgs({
        steps: [createStep(100, 50, { estimatedCost: 0.6, costUnit: 'usd' })],
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

      const guard = new CostGuardProcessor({ maxCost: 0.5 });

      const args = createInputStepArgs({
        steps: [createStep(100, 50, { estimatedCost: 0.6, costUnit: 'usd' })],
        stepNumber: 1,
        abort: abortFn,
      });

      await expect(guard.processInputStep(args)).rejects.toThrow(TripWire);
      expect(abortFn).toHaveBeenCalledWith(
        expect.stringContaining('cost limit exceeded'),
        expect.objectContaining({
          retry: false,
          metadata: expect.objectContaining({ processorId: 'cost-guard' }),
        }),
      );
    });
  });

  describe('edge cases', () => {
    it('handles steps with missing usage data', async () => {
      const guard = new CostGuardProcessor({ maxCost: 1.0 });

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
        maxCost: 1.0,
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

      // Observability query fails → persisted = null, run = null → allows
      await expect(guard.processInputStep(args)).resolves.toBeUndefined();
    });

    it('handles null values from observability aggregate', async () => {
      const obsStorage = {
        getMetricAggregate: vi.fn().mockResolvedValue({ value: null, estimatedCost: null, costUnit: null }),
      } as unknown as ObservabilityStorage;

      const guard = new CostGuardProcessor({
        maxCost: 1.0,
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

      // null values → no cost → allows
      await expect(guard.processInputStep(args)).resolves.toBeUndefined();
    });

    it('exact boundary: blocks at exactly the limit', async () => {
      const guard = new CostGuardProcessor({ maxCost: 0.5 });

      const args = createInputStepArgs({
        steps: [createStep(100, 50, { estimatedCost: 0.5, costUnit: 'usd' })],
        stepNumber: 1,
      });

      // 0.50 >= 0.50 → blocks
      await expect(guard.processInputStep(args)).rejects.toThrow(TripWire);
    });

    it('just under limit: allows', async () => {
      const guard = new CostGuardProcessor({ maxCost: 0.5 });

      const args = createInputStepArgs({
        steps: [createStep(100, 50, { estimatedCost: 0.49, costUnit: 'usd' })],
        stepNumber: 1,
      });

      // 0.49 < 0.50 → allows
      await expect(guard.processInputStep(args)).resolves.toBeUndefined();
    });

    it('time windows produce correct timestamp ranges', () => {
      const windows = ['1h', '6h', '24h', '7d', '30d', '365d'] as const;
      const expectedMs = [
        60 * 60 * 1000,
        6 * 60 * 60 * 1000,
        24 * 60 * 60 * 1000,
        7 * 24 * 60 * 60 * 1000,
        30 * 24 * 60 * 60 * 1000,
        365 * 24 * 60 * 60 * 1000,
      ];

      for (let i = 0; i < windows.length; i++) {
        const guard = new CostGuardProcessor({
          maxCost: 1.0,
          window: windows[i],
        });
        const before = Date.now();
        const timestamp = (guard as any).getWindowTimestamp();
        const diff = before - timestamp.start.getTime();
        expect(Math.abs(diff - expectedMs[i]!)).toBeLessThan(100);
      }
    });
  });
});
