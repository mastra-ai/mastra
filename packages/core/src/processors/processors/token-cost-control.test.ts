import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { MessageList } from '../../agent/message-list';
import { TripWire } from '../../agent/trip-wire';
import type { IMastraLogger } from '../../logger';
import { EntityType } from '../../observability';
import { RequestContext, MASTRA_RESOURCE_ID_KEY, MASTRA_THREAD_ID_KEY } from '../../request-context';
import type { ObservabilityStorage } from '../../storage/domains';
import type { ProcessInputStepArgs } from '../index';
import { CostGuardProcessor, TokenCostControl } from './token-cost-control';

// Mock logger that implements all required methods
const mockLogger: IMastraLogger = {
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  trackException: vi.fn(),
  getTransports: vi.fn(() => []),
  listLogs: vi.fn(() => []),
  listLogsByRunId: vi.fn(() => []),
} as any;

function createMockMastra(obsStorage: ObservabilityStorage) {
  return {
    getStorage: () => ({ stores: { observability: obsStorage } }),
    getLogger: () => mockLogger,
  } as any;
}

function createMockObservabilityStorage(options?: {
  inputCost?: number;
  outputCost?: number;
  costUnit?: string;
}): ObservabilityStorage {
  return {
    getMetricAggregate: vi.fn().mockImplementation(async (args: { name: string[] }) => {
      // The guard queries both token totals in one call; sum the configured costs.
      let estimatedCost: number | null = null;
      if (args.name.includes('mastra_model_total_input_tokens') && options?.inputCost !== undefined) {
        estimatedCost = (estimatedCost ?? 0) + options.inputCost;
      }
      if (args.name.includes('mastra_model_total_output_tokens') && options?.outputCost !== undefined) {
        estimatedCost = (estimatedCost ?? 0) + options.outputCost;
      }
      return {
        value: 0,
        estimatedCost,
        costUnit: options?.costUnit ?? null,
      };
    }),
  } as unknown as ObservabilityStorage;
}

function createMockTracing(traceId: string) {
  return {
    currentSpan: { traceId },
  };
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

function createRunScopeGuard(
  maxCost: number,
  obsStorage: ObservabilityStorage,
  opts?: { strategy?: 'block' | 'warn'; message?: string },
) {
  const guard = new TokenCostControl({ maxCost, scope: 'run', ...opts });
  (guard as any).observabilityStorage = obsStorage;
  return guard;
}

describe('TokenCostControl', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.clearAllMocks();
  });

  describe('constructor', () => {
    it('throws if maxCost is not positive', () => {
      expect(() => new TokenCostControl({ maxCost: 0 })).toThrow('positive number');
      expect(() => new TokenCostControl({ maxCost: -1 })).toThrow('positive number');
    });

    it('accepts valid maxCost', () => {
      const guard = new TokenCostControl({ maxCost: 1.0 });
      expect(guard.id).toBe('token-cost-control');
      expect(guard.name).toBe('Token Cost Control');
    });

    it('defaults scope to resource', () => {
      const guard = new TokenCostControl({ maxCost: 1.0 });
      expect((guard as any).scope).toBe('resource');
    });

    it('defaults window to 7d', () => {
      const guard = new TokenCostControl({ maxCost: 1.0 });
      expect((guard as any).window).toBe('7d');
    });

    it('defaults strategy to block', () => {
      const guard = new TokenCostControl({ maxCost: 1.0 });
      expect((guard as any).strategy).toBe('block');
    });
  });

  describe('processInputStep - run scope', () => {
    it('allows step when no traceId is available (no tracing context)', async () => {
      const obsStorage = createMockObservabilityStorage({ inputCost: 10, outputCost: 10, costUnit: 'usd' });
      const guard = createRunScopeGuard(0.5, obsStorage);

      const args = createInputStepArgs({ stepNumber: 1 });
      // No tracing context → no traceId → cannot query → allows
      await expect(guard.processInputStep(args)).resolves.toBeUndefined();
      expect(obsStorage.getMetricAggregate).not.toHaveBeenCalled();
    });

    it('blocks when estimated cost exceeds maxCost', async () => {
      const obsStorage = createMockObservabilityStorage({ inputCost: 0.3, outputCost: 0.25, costUnit: 'usd' });
      const guard = createRunScopeGuard(0.5, obsStorage);

      const args = createInputStepArgs({
        stepNumber: 2,
        tracing: createMockTracing('trace-run-1') as any,
      });

      // Total: 0.30 + 0.25 = 0.55 > 0.50
      await expect(guard.processInputStep(args)).rejects.toThrow(TripWire);
    });

    it('allows when estimated cost is under maxCost', async () => {
      const obsStorage = createMockObservabilityStorage({ inputCost: 0.05, outputCost: 0.03, costUnit: 'usd' });
      const guard = createRunScopeGuard(1.0, obsStorage);

      const args = createInputStepArgs({
        stepNumber: 2,
        tracing: createMockTracing('trace-run-2') as any,
      });

      // Total: 0.08 < 1.00
      await expect(guard.processInputStep(args)).resolves.toBeUndefined();
    });

    it('queries with traceId filter for run scope', async () => {
      const obsStorage = createMockObservabilityStorage();
      const guard = createRunScopeGuard(10.0, obsStorage);

      const args = createInputStepArgs({
        stepNumber: 1,
        tracing: createMockTracing('trace-abc-123') as any,
      });

      await guard.processInputStep(args);

      expect(obsStorage.getMetricAggregate).toHaveBeenCalledWith(
        expect.objectContaining({
          filters: expect.objectContaining({ traceId: 'trace-abc-123' }),
        }),
      );
    });

    it('does not apply time window filter for run scope', async () => {
      const obsStorage = createMockObservabilityStorage();
      const guard = createRunScopeGuard(10.0, obsStorage);

      const args = createInputStepArgs({
        stepNumber: 1,
        tracing: createMockTracing('trace-no-window') as any,
      });

      await guard.processInputStep(args);

      const call = (obsStorage.getMetricAggregate as any).mock.calls[0][0];
      expect(call.filters.timestamp).toBeUndefined();
    });

    it('allows first step with empty steps array', async () => {
      const obsStorage = createMockObservabilityStorage();
      const guard = createRunScopeGuard(0.01, obsStorage);

      const args = createInputStepArgs({
        steps: [],
        stepNumber: 0,
        tracing: createMockTracing('trace-first') as any,
      });
      await expect(guard.processInputStep(args)).resolves.toBeUndefined();
    });

    it('includes correct metadata in TripWire', async () => {
      const obsStorage = createMockObservabilityStorage({ inputCost: 0.4, outputCost: 0.2, costUnit: 'usd' });
      const guard = createRunScopeGuard(0.5, obsStorage);

      const args = createInputStepArgs({
        stepNumber: 1,
        tracing: createMockTracing('trace-meta') as any,
      });

      try {
        await guard.processInputStep(args);
        expect.fail('Expected TripWire to be thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(TripWire);
        const tripwire = error as TripWire<any>;
        expect(tripwire.options.retry).toBe(false);
        expect(tripwire.options.metadata.processorId).toBe('token-cost-control');
        expect(tripwire.options.metadata.scope).toBe('run');
        expect(tripwire.options.metadata.maxCost).toBe(0.5);
        expect(tripwire.options.metadata.usage.estimatedCost).toBeCloseTo(0.6, 10);
        expect(tripwire.options.metadata.usage.costUnit).toBe('usd');
      }
    });
  });

  describe('warn strategy', () => {
    it('logs warning through the Mastra logger instead of throwing', async () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const obsStorage = createMockObservabilityStorage({ inputCost: 0.4, outputCost: 0.2, costUnit: 'usd' });
      const guard = new TokenCostControl({ maxCost: 0.5, scope: 'run', strategy: 'warn' });
      guard.__registerMastra(createMockMastra(obsStorage));

      const args = createInputStepArgs({
        stepNumber: 1,
        tracing: createMockTracing('trace-warn') as any,
      });

      await expect(guard.processInputStep(args)).resolves.toBeUndefined();
      expect(mockLogger.warn).toHaveBeenCalledWith(expect.stringContaining('TokenCostControl'));
      expect(consoleSpy).not.toHaveBeenCalled();

      consoleSpy.mockRestore();
    });
  });

  describe('custom message', () => {
    it('uses custom message template', async () => {
      const obsStorage = createMockObservabilityStorage({ inputCost: 0.4, outputCost: 0.2, costUnit: 'usd' });

      const guard = new TokenCostControl({
        maxCost: 0.5,
        scope: 'run',
        message: 'Budget exceeded: ${usage} of ${limit} allowed',
      });
      (guard as any).observabilityStorage = obsStorage;

      const args = createInputStepArgs({
        stepNumber: 1,
        tracing: createMockTracing('trace-msg') as any,
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
    it('blocks when resource cost exceeds limit', async () => {
      const obsStorage = createMockObservabilityStorage({
        inputCost: 0.3,
        outputCost: 0.25,
        costUnit: 'usd',
      });

      const guard = new TokenCostControl({
        maxCost: 0.5,
        scope: 'resource',
      });
      (guard as any).observabilityStorage = obsStorage;

      const requestContext = new RequestContext();
      requestContext.set(MASTRA_RESOURCE_ID_KEY, 'user-123');

      const args = createInputStepArgs({
        stepNumber: 1,
        requestContext,
      });

      // Persisted: 0.55 > 0.50
      await expect(guard.processInputStep(args)).rejects.toThrow(TripWire);
    });

    it('queries with correct resourceId filter', async () => {
      const obsStorage = createMockObservabilityStorage();

      const guard = new TokenCostControl({
        maxCost: 10.0,
        scope: 'resource',
      });
      (guard as any).observabilityStorage = obsStorage;

      const requestContext = new RequestContext();
      requestContext.set(MASTRA_RESOURCE_ID_KEY, 'user-456');

      const args = createInputStepArgs({
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

      const guard = new TokenCostControl({
        maxCost: 10.0,
        scope: 'resource',
        window: '24h',
      });
      (guard as any).observabilityStorage = obsStorage;

      const requestContext = new RequestContext();
      requestContext.set(MASTRA_RESOURCE_ID_KEY, 'user-window');

      const args = createInputStepArgs({
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

      const guard = new TokenCostControl({
        maxCost: 10.0,
        scope: 'resource',
      });
      (guard as any).observabilityStorage = obsStorage;

      const requestContext = new RequestContext();
      requestContext.set(MASTRA_RESOURCE_ID_KEY, 'user-default-window');

      const args = createInputStepArgs({
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

    it('allows when no resourceId available (scope filter unresolvable)', async () => {
      const obsStorage = createMockObservabilityStorage({
        inputCost: 10.0,
        outputCost: 10.0,
        costUnit: 'usd',
      });

      const guard = new TokenCostControl({
        maxCost: 1.0,
        scope: 'resource',
      });
      (guard as any).observabilityStorage = obsStorage;

      const args = createInputStepArgs({ stepNumber: 1 });

      // No resourceId → scope filter unresolvable → allows
      await expect(guard.processInputStep(args)).resolves.toBeUndefined();
      expect(obsStorage.getMetricAggregate).not.toHaveBeenCalled();
    });
  });

  describe('thread scope', () => {
    it('blocks when thread cost exceeds limit', async () => {
      const obsStorage = createMockObservabilityStorage({
        inputCost: 0.4,
        outputCost: 0.2,
        costUnit: 'usd',
      });

      const guard = new TokenCostControl({
        maxCost: 0.5,
        scope: 'thread',
      });
      (guard as any).observabilityStorage = obsStorage;

      const requestContext = new RequestContext();
      requestContext.set(MASTRA_THREAD_ID_KEY, 'thread-abc');

      const args = createInputStepArgs({
        stepNumber: 1,
        requestContext,
      });

      // Persisted: 0.60 > 0.50
      await expect(guard.processInputStep(args)).rejects.toThrow(TripWire);
    });

    it('queries with correct threadId filter', async () => {
      const obsStorage = createMockObservabilityStorage();

      const guard = new TokenCostControl({
        maxCost: 10.0,
        scope: 'thread',
      });
      (guard as any).observabilityStorage = obsStorage;

      const requestContext = new RequestContext();
      requestContext.set(MASTRA_THREAD_ID_KEY, 'thread-xyz');

      const args = createInputStepArgs({
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

      const guard = new TokenCostControl({
        maxCost: 1.0,
        scope: 'thread',
      });
      (guard as any).observabilityStorage = obsStorage;

      const requestContext = new RequestContext();
      requestContext.set(MASTRA_THREAD_ID_KEY, 'thread-meta');

      const args = createInputStepArgs({
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
    it('resolves observability storage for all scopes', () => {
      const mockObsStorage = createMockObservabilityStorage();
      const mockMastra = createMockMastra(mockObsStorage);

      for (const scope of ['run', 'resource', 'thread'] as const) {
        const guard = new TokenCostControl({ maxCost: 1.0, scope });
        guard.__registerMastra(mockMastra);
        expect((guard as any).observabilityStorage).toBe(mockObsStorage);
      }
    });

    it('throws when observability storage is not available', () => {
      const mockMastra = {
        getStorage: () => ({ stores: {} }),
      } as any;

      const guard = new TokenCostControl({ maxCost: 1.0 });
      expect(() => guard.__registerMastra(mockMastra)).toThrow('observability storage');
    });

    it('throws when storage is not configured', () => {
      const mockMastra = {
        getStorage: () => undefined,
      } as any;

      const guard = new TokenCostControl({ maxCost: 1.0, scope: 'thread' });
      expect(() => guard.__registerMastra(mockMastra)).toThrow('observability storage');
    });

    it('throws when observability storage lacks getMetricAggregate', () => {
      const mockMastra = {
        getStorage: () => ({ stores: { observability: { listMetrics: vi.fn() } } }),
      } as any;

      const guard = new TokenCostControl({ maxCost: 1.0 });
      expect(() => guard.__registerMastra(mockMastra)).toThrow('getMetricAggregate');
    });
  });

  describe('onViolation callback', () => {
    it('does not call onViolation directly for block strategy (runner handles it)', async () => {
      const onViolation = vi.fn();
      const obsStorage = createMockObservabilityStorage({ inputCost: 0.4, outputCost: 0.2, costUnit: 'usd' });
      const guard = createRunScopeGuard(0.5, obsStorage);
      guard.onViolation = onViolation;

      const args = createInputStepArgs({
        stepNumber: 1,
        tracing: createMockTracing('trace-block') as any,
      });

      await expect(guard.processInputStep(args)).rejects.toThrow(TripWire);
      expect(onViolation).not.toHaveBeenCalled();
    });

    it('calls onViolation when cost limit is exceeded with warn strategy', async () => {
      const spy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const onViolation = vi.fn();
      const obsStorage = createMockObservabilityStorage({ inputCost: 0.4, outputCost: 0.2, costUnit: 'usd' });
      const guard = createRunScopeGuard(0.5, obsStorage, { strategy: 'warn' });
      guard.onViolation = onViolation;

      const args = createInputStepArgs({
        stepNumber: 1,
        tracing: createMockTracing('trace-warn-cb') as any,
      });

      await guard.processInputStep(args);
      expect(onViolation).toHaveBeenCalledOnce();

      spy.mockRestore();
    });

    it('does not call onViolation when under limit', async () => {
      const onViolation = vi.fn();
      const obsStorage = createMockObservabilityStorage({ inputCost: 0.005, outputCost: 0.005, costUnit: 'usd' });
      const guard = createRunScopeGuard(10.0, obsStorage);
      guard.onViolation = onViolation;

      const args = createInputStepArgs({
        stepNumber: 1,
        tracing: createMockTracing('trace-under') as any,
      });

      await guard.processInputStep(args);
      expect(onViolation).not.toHaveBeenCalled();
    });

    it('continues even if onViolation throws (warn strategy)', async () => {
      const spy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const onViolation = vi.fn().mockRejectedValue(new Error('notification failed'));
      const obsStorage = createMockObservabilityStorage({ inputCost: 0.4, outputCost: 0.2, costUnit: 'usd' });
      const guard = createRunScopeGuard(0.5, obsStorage, { strategy: 'warn' });
      guard.onViolation = onViolation;

      const args = createInputStepArgs({
        stepNumber: 1,
        tracing: createMockTracing('trace-err-cb') as any,
      });

      await guard.processInputStep(args);
      expect(onViolation).toHaveBeenCalled();

      spy.mockRestore();
    });

    it('includes violation detail for warn strategy', async () => {
      const spy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const onViolation = vi.fn();
      const obsStorage = createMockObservabilityStorage({ inputCost: 0.4, outputCost: 0.2, costUnit: 'usd' });
      const guard = createRunScopeGuard(0.5, obsStorage, { strategy: 'warn' });
      guard.onViolation = onViolation;

      const args = createInputStepArgs({
        stepNumber: 1,
        tracing: createMockTracing('trace-detail') as any,
      });

      await guard.processInputStep(args);
      expect(onViolation).toHaveBeenCalledOnce();
      const violation = onViolation.mock.calls[0]![0];
      expect(violation.processorId).toBe('token-cost-control');
      expect(violation.message).toContain('cost limit exceeded');
      expect(violation.detail.limit).toBe(0.5);
      expect(violation.detail.usage).toBeCloseTo(0.6, 10);
      expect(violation.detail.totalUsage.estimatedCost).toBeCloseTo(0.6, 10);
      expect(violation.detail.totalUsage.costUnit).toBe('usd');
      expect(violation.detail.scope).toBe('run');

      spy.mockRestore();
    });

    it('includes scope key for scoped violations (warn strategy)', async () => {
      const spy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const onViolation = vi.fn();
      const obsStorage = createMockObservabilityStorage({
        inputCost: 1.0,
        outputCost: 1.0,
        costUnit: 'usd',
      });

      const guard = new TokenCostControl({
        maxCost: 1.0,
        scope: 'thread',
        strategy: 'warn',
      });
      guard.onViolation = onViolation;
      (guard as any).observabilityStorage = obsStorage;

      const requestContext = new RequestContext();
      requestContext.set(MASTRA_THREAD_ID_KEY, 'thread-callback');

      const args = createInputStepArgs({
        stepNumber: 1,
        requestContext,
      });

      await guard.processInputStep(args);
      expect(onViolation).toHaveBeenCalledWith(
        expect.objectContaining({
          detail: expect.objectContaining({
            scope: 'thread',
            scopeKey: 'thread:thread-callback',
          }),
        }),
      );

      spy.mockRestore();
    });

    it('awaits async onViolation before continuing', async () => {
      const callOrder: string[] = [];
      const onViolation = vi.fn().mockImplementation(async () => {
        await new Promise(resolve => setTimeout(resolve, 10));
        callOrder.push('violation');
      });

      const obsStorage = createMockObservabilityStorage({ inputCost: 0.4, outputCost: 0.2, costUnit: 'usd' });
      const guard = createRunScopeGuard(0.5, obsStorage, { strategy: 'warn' });
      guard.onViolation = onViolation;
      (guard as any).logger = {
        warn: () => {
          callOrder.push('warn');
        },
      };

      const args = createInputStepArgs({
        stepNumber: 1,
        tracing: createMockTracing('trace-async') as any,
      });

      await guard.processInputStep(args);
      expect(callOrder).toEqual(['violation', 'warn']);
    });
  });

  describe('abort() usage', () => {
    it('uses abort() from args instead of manually throwing TripWire', async () => {
      const abortFn = vi.fn(((reason?: string, options?: any) => {
        throw new TripWire(reason ?? 'abort', options ?? {});
      }) as any);

      const obsStorage = createMockObservabilityStorage({ inputCost: 0.4, outputCost: 0.2, costUnit: 'usd' });
      const guard = createRunScopeGuard(0.5, obsStorage);

      const args = createInputStepArgs({
        stepNumber: 1,
        abort: abortFn,
        tracing: createMockTracing('trace-abort') as any,
      });

      await expect(guard.processInputStep(args)).rejects.toThrow(TripWire);
      expect(abortFn).toHaveBeenCalledWith(
        expect.stringContaining('cost limit exceeded'),
        expect.objectContaining({
          retry: false,
          metadata: expect.objectContaining({ processorId: 'token-cost-control' }),
        }),
      );
    });
  });

  describe('edge cases', () => {
    it('observability query failure falls back to zero (fail-open)', async () => {
      const obsStorage = {
        getMetricAggregate: vi.fn().mockRejectedValue(new Error('observability unavailable')),
      } as unknown as ObservabilityStorage;

      const guard = new TokenCostControl({
        maxCost: 1.0,
        scope: 'resource',
      });
      (guard as any).observabilityStorage = obsStorage;

      const requestContext = new RequestContext();
      requestContext.set(MASTRA_RESOURCE_ID_KEY, 'user-fail');

      const args = createInputStepArgs({
        stepNumber: 1,
        requestContext,
      });

      // Observability query fails → cost = null → allows
      await expect(guard.processInputStep(args)).resolves.toBeUndefined();
    });

    it('handles null values from observability aggregate', async () => {
      const obsStorage = {
        getMetricAggregate: vi.fn().mockResolvedValue({ value: null, estimatedCost: null, costUnit: null }),
      } as unknown as ObservabilityStorage;

      const guard = new TokenCostControl({
        maxCost: 1.0,
        scope: 'resource',
      });
      (guard as any).observabilityStorage = obsStorage;

      const requestContext = new RequestContext();
      requestContext.set(MASTRA_RESOURCE_ID_KEY, 'user-null');

      const args = createInputStepArgs({
        stepNumber: 1,
        requestContext,
      });

      // null values → no cost → allows
      await expect(guard.processInputStep(args)).resolves.toBeUndefined();
    });

    it('exact boundary: blocks at exactly the limit', async () => {
      const obsStorage = createMockObservabilityStorage({ inputCost: 0.3, outputCost: 0.2, costUnit: 'usd' });
      const guard = createRunScopeGuard(0.5, obsStorage);

      const args = createInputStepArgs({
        stepNumber: 1,
        tracing: createMockTracing('trace-exact') as any,
      });

      // 0.50 >= 0.50 → blocks
      await expect(guard.processInputStep(args)).rejects.toThrow(TripWire);
    });

    it('just under limit: allows', async () => {
      const obsStorage = createMockObservabilityStorage({ inputCost: 0.29, outputCost: 0.2, costUnit: 'usd' });
      const guard = createRunScopeGuard(0.5, obsStorage);

      const args = createInputStepArgs({
        stepNumber: 1,
        tracing: createMockTracing('trace-just-under') as any,
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
        const guard = new TokenCostControl({
          maxCost: 1.0,
          window: windows[i],
        });
        const before = Date.now();
        const timestamp = (guard as any).getWindowTimestamp();
        const diff = before - timestamp.start.getTime();
        expect(Math.abs(diff - expectedMs[i]!)).toBeLessThan(1000);
      }
    });

    it('no observability storage set → query returns null (fail-open for run scope)', async () => {
      const guard = new TokenCostControl({ maxCost: 0.01, scope: 'run' });
      // Not registered → no observability storage

      const args = createInputStepArgs({
        stepNumber: 1,
        tracing: createMockTracing('trace-no-obs') as any,
      });

      // queryCost returns null when no obs storage → allows
      await expect(guard.processInputStep(args)).resolves.toBeUndefined();
    });
  });

  describe('MastraMemory fallback (no auth middleware)', () => {
    it('thread scope resolves threadId from MastraMemory context', async () => {
      const obsStorage = createMockObservabilityStorage({
        inputCost: 0.4,
        outputCost: 0.2,
        costUnit: 'usd',
      });

      const guard = new TokenCostControl({
        maxCost: 0.5,
        scope: 'thread',
      });
      (guard as any).observabilityStorage = obsStorage;

      // Simulate prepare-memory-step setting MastraMemory (no reserved keys)
      const requestContext = new RequestContext();
      requestContext.set('MastraMemory', {
        thread: { id: 'memory-thread-1' },
        resourceId: 'memory-resource-1',
      });

      const args = createInputStepArgs({
        stepNumber: 1,
        requestContext,
      });

      // Total: 0.60 > 0.50 → blocks
      await expect(guard.processInputStep(args)).rejects.toThrow(TripWire);

      expect(obsStorage.getMetricAggregate).toHaveBeenCalledWith(
        expect.objectContaining({
          filters: expect.objectContaining({ threadId: 'memory-thread-1' }),
        }),
      );
    });

    it('resource scope resolves resourceId from MastraMemory context', async () => {
      const obsStorage = createMockObservabilityStorage({
        inputCost: 0.4,
        outputCost: 0.2,
        costUnit: 'usd',
      });

      const guard = new TokenCostControl({
        maxCost: 0.5,
        scope: 'resource',
      });
      (guard as any).observabilityStorage = obsStorage;

      // Simulate prepare-memory-step setting MastraMemory (no reserved keys)
      const requestContext = new RequestContext();
      requestContext.set('MastraMemory', {
        thread: { id: 'memory-thread-2' },
        resourceId: 'memory-resource-2',
      });

      const args = createInputStepArgs({
        stepNumber: 1,
        requestContext,
      });

      // Total: 0.60 > 0.50 → blocks
      await expect(guard.processInputStep(args)).rejects.toThrow(TripWire);

      expect(obsStorage.getMetricAggregate).toHaveBeenCalledWith(
        expect.objectContaining({
          filters: expect.objectContaining({ resourceId: 'memory-resource-2' }),
        }),
      );
    });

    it('reserved keys take precedence over MastraMemory context', async () => {
      const obsStorage = createMockObservabilityStorage();

      const guard = new TokenCostControl({
        maxCost: 10.0,
        scope: 'thread',
      });
      (guard as any).observabilityStorage = obsStorage;

      const requestContext = new RequestContext();
      requestContext.set(MASTRA_THREAD_ID_KEY, 'auth-thread');
      requestContext.set('MastraMemory', {
        thread: { id: 'memory-thread' },
        resourceId: 'memory-resource',
      });

      const args = createInputStepArgs({
        stepNumber: 1,
        requestContext,
      });

      await guard.processInputStep(args);

      // Should use the auth-middleware key, not the MastraMemory fallback
      expect(obsStorage.getMetricAggregate).toHaveBeenCalledWith(
        expect.objectContaining({
          filters: expect.objectContaining({ threadId: 'auth-thread' }),
        }),
      );
    });

    it('resource reserved key takes precedence over MastraMemory resourceId', async () => {
      const obsStorage = createMockObservabilityStorage();

      const guard = new TokenCostControl({
        maxCost: 10.0,
        scope: 'resource',
      });
      (guard as any).observabilityStorage = obsStorage;

      const requestContext = new RequestContext();
      requestContext.set(MASTRA_RESOURCE_ID_KEY, 'auth-resource');
      requestContext.set('MastraMemory', {
        thread: { id: 'memory-thread' },
        resourceId: 'memory-resource',
      });

      const args = createInputStepArgs({
        stepNumber: 1,
        requestContext,
      });

      await guard.processInputStep(args);

      // Should use the auth-middleware key, not the MastraMemory fallback
      expect(obsStorage.getMetricAggregate).toHaveBeenCalledWith(
        expect.objectContaining({
          filters: expect.objectContaining({ resourceId: 'auth-resource' }),
        }),
      );
    });

    it('thread scope includes correct scopeKey from MastraMemory', async () => {
      const obsStorage = createMockObservabilityStorage({
        inputCost: 1.0,
        outputCost: 1.0,
        costUnit: 'usd',
      });

      const guard = new TokenCostControl({
        maxCost: 1.0,
        scope: 'thread',
      });
      (guard as any).observabilityStorage = obsStorage;

      const requestContext = new RequestContext();
      requestContext.set('MastraMemory', {
        thread: { id: 'scoped-thread' },
        resourceId: 'scoped-resource',
      });

      const args = createInputStepArgs({
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
          scopeKey: 'thread:scoped-thread',
        });
      }
    });

    it('resource scope includes correct scopeKey from MastraMemory', async () => {
      const obsStorage = createMockObservabilityStorage({
        inputCost: 1.0,
        outputCost: 1.0,
        costUnit: 'usd',
      });

      const guard = new TokenCostControl({
        maxCost: 1.0,
        scope: 'resource',
      });
      (guard as any).observabilityStorage = obsStorage;

      const requestContext = new RequestContext();
      requestContext.set('MastraMemory', {
        thread: { id: 'scoped-thread' },
        resourceId: 'scoped-resource',
      });

      const args = createInputStepArgs({
        stepNumber: 1,
        requestContext,
      });

      try {
        await guard.processInputStep(args);
        expect.fail('Expected TripWire to be thrown');
      } catch (error) {
        const tripwire = error as TripWire<any>;
        expect(tripwire.options.metadata).toMatchObject({
          scope: 'resource',
          scopeKey: 'resource:scoped-resource',
        });
      }
    });

    it('still allows when neither reserved keys nor MastraMemory are set', async () => {
      const obsStorage = createMockObservabilityStorage({
        inputCost: 10.0,
        outputCost: 10.0,
        costUnit: 'usd',
      });

      const guard = new TokenCostControl({
        maxCost: 1.0,
        scope: 'thread',
      });
      (guard as any).observabilityStorage = obsStorage;

      const args = createInputStepArgs({ stepNumber: 1 });

      // No threadId from any source → scope filter unresolvable → allows
      await expect(guard.processInputStep(args)).resolves.toBeUndefined();
      expect(obsStorage.getMetricAggregate).not.toHaveBeenCalled();
    });

    it('run scope is unaffected by MastraMemory (uses traceId only)', async () => {
      const obsStorage = createMockObservabilityStorage({
        inputCost: 0.4,
        outputCost: 0.2,
        costUnit: 'usd',
      });

      const guard = new TokenCostControl({
        maxCost: 0.5,
        scope: 'run',
      });
      (guard as any).observabilityStorage = obsStorage;

      const requestContext = new RequestContext();
      requestContext.set('MastraMemory', {
        thread: { id: 'memory-thread' },
        resourceId: 'memory-resource',
      });

      const args = createInputStepArgs({
        stepNumber: 1,
        requestContext,
        tracing: createMockTracing('trace-run-memory') as any,
      });

      // Total: 0.60 > 0.50 → blocks (uses traceId, not MastraMemory)
      await expect(guard.processInputStep(args)).rejects.toThrow(TripWire);

      expect(obsStorage.getMetricAggregate).toHaveBeenCalledWith(
        expect.objectContaining({
          filters: expect.objectContaining({ traceId: 'trace-run-memory' }),
        }),
      );
    });
  });

  describe('soft threshold (warnAtPercent) and once-per-run dedup', () => {
    it('constructor rejects invalid warnAtPercent values', () => {
      for (const warnAtPercent of [0, 100, 150, NaN]) {
        expect(() => new TokenCostControl({ maxCost: 1.0, warnAtPercent })).toThrow('warnAtPercent');
      }
    });

    it('constructor accepts valid warnAtPercent', () => {
      expect(() => new TokenCostControl({ maxCost: 1.0, warnAtPercent: 80 })).not.toThrow();
    });

    it('soft threshold fires onViolation with threshold soft and does not abort (block strategy)', async () => {
      // cost 0.45 >= 80% of 0.5 (0.4) but < 0.5
      const obsStorage = createMockObservabilityStorage({ inputCost: 0.25, outputCost: 0.2, costUnit: 'usd' });
      const guard = new TokenCostControl({ maxCost: 0.5, scope: 'run', strategy: 'block', warnAtPercent: 80 });
      guard.__registerMastra(createMockMastra(obsStorage));
      const onViolation = vi.fn();
      guard.onViolation = onViolation;

      const args = createInputStepArgs({
        stepNumber: 1,
        tracing: createMockTracing('trace-soft-block') as any,
      });

      await expect(guard.processInputStep(args)).resolves.toBeUndefined();
      expect(onViolation).toHaveBeenCalledTimes(1);
      expect(onViolation.mock.calls[0]![0].detail.threshold).toBe('soft');
      expect(mockLogger.warn).toHaveBeenCalledWith(expect.stringContaining('80%'));
    });

    it('soft threshold fires onViolation with threshold soft and does not abort (warn strategy)', async () => {
      const obsStorage = createMockObservabilityStorage({ inputCost: 0.25, outputCost: 0.2, costUnit: 'usd' });
      const guard = new TokenCostControl({ maxCost: 0.5, scope: 'run', strategy: 'warn', warnAtPercent: 80 });
      guard.__registerMastra(createMockMastra(obsStorage));
      const onViolation = vi.fn();
      guard.onViolation = onViolation;

      const args = createInputStepArgs({
        stepNumber: 1,
        tracing: createMockTracing('trace-soft-warn') as any,
      });

      await expect(guard.processInputStep(args)).resolves.toBeUndefined();
      expect(onViolation).toHaveBeenCalledTimes(1);
      expect(onViolation.mock.calls[0]![0].detail.threshold).toBe('soft');
    });

    it('soft warning fires once across multiple steps sharing the same state object', async () => {
      const obsStorage = createMockObservabilityStorage({ inputCost: 0.25, outputCost: 0.2, costUnit: 'usd' });
      const guard = new TokenCostControl({ maxCost: 0.5, scope: 'run', warnAtPercent: 80 });
      guard.__registerMastra(createMockMastra(obsStorage));
      const onViolation = vi.fn();
      guard.onViolation = onViolation;

      const sharedState: Record<string, unknown> = {};
      for (let step = 1; step <= 3; step++) {
        const args = createInputStepArgs({
          stepNumber: step,
          state: sharedState,
          tracing: createMockTracing('trace-soft-dedup') as any,
        });
        await expect(guard.processInputStep(args)).resolves.toBeUndefined();
      }

      expect(onViolation).toHaveBeenCalledTimes(1);
    });

    it('hard warn-strategy violation fires log + onViolation once across steps sharing state', async () => {
      const obsStorage = createMockObservabilityStorage({ inputCost: 0.4, outputCost: 0.2, costUnit: 'usd' });
      const guard = new TokenCostControl({ maxCost: 0.5, scope: 'run', strategy: 'warn' });
      guard.__registerMastra(createMockMastra(obsStorage));
      const onViolation = vi.fn();
      guard.onViolation = onViolation;

      const sharedState: Record<string, unknown> = {};
      for (let step = 1; step <= 3; step++) {
        const args = createInputStepArgs({
          stepNumber: step,
          state: sharedState,
          tracing: createMockTracing('trace-hard-dedup') as any,
        });
        // Step still proceeds every time
        await expect(guard.processInputStep(args)).resolves.toBeUndefined();
      }

      expect(onViolation).toHaveBeenCalledTimes(1);
      expect(onViolation.mock.calls[0]![0].detail.threshold).toBe('hard');
      const violationLogs = (mockLogger.warn as any).mock.calls.filter((c: any[]) =>
        String(c[0]).includes('cost limit exceeded'),
      );
      expect(violationLogs).toHaveLength(1);
    });

    it('cost below soft threshold: no callbacks, no logs', async () => {
      // cost 0.3 < 80% of 0.5 (0.4)
      const obsStorage = createMockObservabilityStorage({ inputCost: 0.1, outputCost: 0.2, costUnit: 'usd' });
      const guard = new TokenCostControl({ maxCost: 0.5, scope: 'run', warnAtPercent: 80 });
      guard.__registerMastra(createMockMastra(obsStorage));
      const onViolation = vi.fn();
      guard.onViolation = onViolation;

      const args = createInputStepArgs({
        stepNumber: 1,
        tracing: createMockTracing('trace-under-soft') as any,
      });

      await expect(guard.processInputStep(args)).resolves.toBeUndefined();
      expect(onViolation).not.toHaveBeenCalled();
      expect(mockLogger.warn).not.toHaveBeenCalled();
    });

    it('at exactly maxCost only the hard path fires', async () => {
      const obsStorage = createMockObservabilityStorage({ inputCost: 0.3, outputCost: 0.2, costUnit: 'usd' });
      const guard = new TokenCostControl({ maxCost: 0.5, scope: 'run', strategy: 'warn', warnAtPercent: 80 });
      guard.__registerMastra(createMockMastra(obsStorage));
      const onViolation = vi.fn();
      guard.onViolation = onViolation;

      const args = createInputStepArgs({
        stepNumber: 1,
        tracing: createMockTracing('trace-exact-limit') as any,
      });

      await expect(guard.processInputStep(args)).resolves.toBeUndefined();
      expect(onViolation).toHaveBeenCalledTimes(1);
      expect(onViolation.mock.calls[0]![0].detail.threshold).toBe('hard');
    });
  });

  describe('includeBreakdown', () => {
    const breakdownGroups = [
      { dimensions: { provider: 'openai', model: 'gpt-5' }, value: 1000, estimatedCost: 0.4, costUnit: 'usd' },
      {
        dimensions: { provider: 'anthropic', model: 'claude-sonnet-4-5' },
        value: 500,
        estimatedCost: 0.2,
        costUnit: 'usd',
      },
    ];

    const expectedBreakdown = [
      { provider: 'openai', model: 'gpt-5', estimatedCost: 0.4, costUnit: 'usd' },
      { provider: 'anthropic', model: 'claude-sonnet-4-5', estimatedCost: 0.2, costUnit: 'usd' },
    ];

    function withBreakdown(obsStorage: ObservabilityStorage, impl?: () => Promise<{ groups: typeof breakdownGroups }>) {
      (obsStorage as any).getMetricBreakdown = vi
        .fn()
        .mockImplementation(impl ?? (async () => ({ groups: breakdownGroups })));
      return obsStorage;
    }

    it('violation detail carries the mapped breakdown (warn strategy)', async () => {
      const obsStorage = withBreakdown(
        createMockObservabilityStorage({ inputCost: 0.4, outputCost: 0.2, costUnit: 'usd' }),
      );
      const guard = new TokenCostControl({ maxCost: 0.5, scope: 'run', strategy: 'warn', includeBreakdown: true });
      guard.__registerMastra(createMockMastra(obsStorage));
      const onViolation = vi.fn();
      guard.onViolation = onViolation;

      const args = createInputStepArgs({ stepNumber: 1, tracing: createMockTracing('trace-bd-warn') as any });
      await expect(guard.processInputStep(args)).resolves.toBeUndefined();

      expect(onViolation.mock.calls[0]![0].detail.breakdown).toEqual(expectedBreakdown);
    });

    it('block-strategy tripwire metadata carries the mapped breakdown', async () => {
      const obsStorage = withBreakdown(
        createMockObservabilityStorage({ inputCost: 0.4, outputCost: 0.2, costUnit: 'usd' }),
      );
      const guard = new TokenCostControl({ maxCost: 0.5, scope: 'run', includeBreakdown: true });
      (guard as any).observabilityStorage = obsStorage;

      const args = createInputStepArgs({ stepNumber: 1, tracing: createMockTracing('trace-bd-block') as any });
      try {
        await guard.processInputStep(args);
        expect.fail('Expected TripWire to be thrown');
      } catch (error) {
        const tripwire = error as TripWire<any>;
        expect(tripwire.options.metadata.breakdown).toEqual(expectedBreakdown);
      }
    });

    it('soft-threshold violation carries the breakdown', async () => {
      const obsStorage = withBreakdown(
        createMockObservabilityStorage({ inputCost: 0.3, outputCost: 0.1, costUnit: 'usd' }),
      );
      const guard = new TokenCostControl({
        maxCost: 0.5,
        scope: 'run',
        warnAtPercent: 80,
        includeBreakdown: true,
      });
      guard.__registerMastra(createMockMastra(obsStorage));
      const onViolation = vi.fn();
      guard.onViolation = onViolation;

      const args = createInputStepArgs({ stepNumber: 1, tracing: createMockTracing('trace-bd-soft') as any });
      await expect(guard.processInputStep(args)).resolves.toBeUndefined();

      expect(onViolation.mock.calls[0]![0].detail.threshold).toBe('soft');
      expect(onViolation.mock.calls[0]![0].detail.breakdown).toEqual(expectedBreakdown);
    });

    it('breakdown query uses the same filters as the cost query', async () => {
      const obsStorage = withBreakdown(
        createMockObservabilityStorage({ inputCost: 0.4, outputCost: 0.2, costUnit: 'usd' }),
      );
      const guard = new TokenCostControl({ maxCost: 0.5, scope: 'run', strategy: 'warn', includeBreakdown: true });
      (guard as any).observabilityStorage = obsStorage;

      const args = createInputStepArgs({ stepNumber: 1, tracing: createMockTracing('trace-bd-filters') as any });
      await guard.processInputStep(args);

      const aggregateFilters = (obsStorage.getMetricAggregate as any).mock.calls[0][0].filters;
      const breakdownCall = (obsStorage as any).getMetricBreakdown.mock.calls[0][0];
      expect(breakdownCall.filters).toEqual(aggregateFilters);
      expect(breakdownCall.name).toEqual(['mastra_model_total_input_tokens', 'mastra_model_total_output_tokens']);
      expect(breakdownCall.groupBy).toEqual(['provider', 'model']);
      expect(breakdownCall.aggregation).toBe('sum');
      expect(breakdownCall.limit).toBe(10);
    });

    it('includeBreakdown unset → getMetricBreakdown never called on violation', async () => {
      const obsStorage = withBreakdown(
        createMockObservabilityStorage({ inputCost: 0.4, outputCost: 0.2, costUnit: 'usd' }),
      );
      const guard = new TokenCostControl({ maxCost: 0.5, scope: 'run', strategy: 'warn' });
      guard.__registerMastra(createMockMastra(obsStorage));

      const args = createInputStepArgs({ stepNumber: 1, tracing: createMockTracing('trace-bd-off') as any });
      await guard.processInputStep(args);

      expect((obsStorage as any).getMetricBreakdown).not.toHaveBeenCalled();
    });

    it('no violation → getMetricBreakdown never called even when enabled', async () => {
      const obsStorage = withBreakdown(
        createMockObservabilityStorage({ inputCost: 0.01, outputCost: 0.01, costUnit: 'usd' }),
      );
      const guard = new TokenCostControl({ maxCost: 10.0, scope: 'run', includeBreakdown: true });
      (guard as any).observabilityStorage = obsStorage;

      const args = createInputStepArgs({ stepNumber: 1, tracing: createMockTracing('trace-bd-happy') as any });
      await expect(guard.processInputStep(args)).resolves.toBeUndefined();

      expect((obsStorage as any).getMetricBreakdown).not.toHaveBeenCalled();
    });

    it('getMetricBreakdown throwing → violation fires without breakdown, debug logged', async () => {
      const obsStorage = withBreakdown(
        createMockObservabilityStorage({ inputCost: 0.4, outputCost: 0.2, costUnit: 'usd' }),
        async () => {
          throw new Error('getMetricBreakdown not implemented');
        },
      );
      const guard = new TokenCostControl({ maxCost: 0.5, scope: 'run', strategy: 'warn', includeBreakdown: true });
      guard.__registerMastra(createMockMastra(obsStorage));
      const onViolation = vi.fn();
      guard.onViolation = onViolation;

      const args = createInputStepArgs({ stepNumber: 1, tracing: createMockTracing('trace-bd-err') as any });
      await expect(guard.processInputStep(args)).resolves.toBeUndefined();

      expect(onViolation).toHaveBeenCalledTimes(1);
      expect(onViolation.mock.calls[0]![0].detail.breakdown).toBeUndefined();
      expect(mockLogger.debug).toHaveBeenCalledWith(
        'TokenCostControl: breakdown query failed; omitting breakdown',
        expect.objectContaining({ error: expect.any(Error) }),
      );
    });

    it('getMetricBreakdown throwing on block strategy → still aborts, no breakdown in metadata', async () => {
      const obsStorage = withBreakdown(
        createMockObservabilityStorage({ inputCost: 0.4, outputCost: 0.2, costUnit: 'usd' }),
        async () => {
          throw new Error('not implemented');
        },
      );
      const guard = new TokenCostControl({ maxCost: 0.5, scope: 'run', includeBreakdown: true });
      (guard as any).observabilityStorage = obsStorage;

      const args = createInputStepArgs({ stepNumber: 1, tracing: createMockTracing('trace-bd-err-block') as any });
      try {
        await guard.processInputStep(args);
        expect.fail('Expected TripWire to be thrown');
      } catch (error) {
        const tripwire = error as TripWire<any>;
        expect(tripwire.options.metadata.breakdown).toBeUndefined();
        expect(tripwire.options.metadata.processorId).toBe('token-cost-control');
      }
    });

    it('null dimensions map to null provider/model entries', async () => {
      const obsStorage = withBreakdown(
        createMockObservabilityStorage({ inputCost: 0.4, outputCost: 0.2, costUnit: 'usd' }),
        async () =>
          ({
            groups: [{ dimensions: {}, value: 100, estimatedCost: null, costUnit: null }],
          }) as any,
      );
      const guard = new TokenCostControl({ maxCost: 0.5, scope: 'run', strategy: 'warn', includeBreakdown: true });
      (guard as any).observabilityStorage = obsStorage;
      const onViolation = vi.fn();
      guard.onViolation = onViolation;

      const args = createInputStepArgs({ stepNumber: 1, tracing: createMockTracing('trace-bd-null') as any });
      await guard.processInputStep(args);

      expect(onViolation.mock.calls[0]![0].detail.breakdown).toEqual([
        { provider: null, model: null, estimatedCost: null, costUnit: null },
      ]);
    });
  });

  describe('user, organization, and session scopes', () => {
    const scopeCases = [
      { scope: 'user' as const, contextKey: 'userId', filterKey: 'userId', id: 'user-123' },
      { scope: 'organization' as const, contextKey: 'organizationId', filterKey: 'organizationId', id: 'org-456' },
      { scope: 'session' as const, contextKey: 'sessionId', filterKey: 'sessionId', id: 'session-789' },
    ];

    it.each(scopeCases)(
      '$scope scope passes the $filterKey filter from RequestContext key $contextKey',
      async ({ scope, contextKey, filterKey, id }) => {
        const obsStorage = createMockObservabilityStorage({ inputCost: 0.05, outputCost: 0.05, costUnit: 'usd' });
        const guard = new TokenCostControl({ maxCost: 10.0, scope });
        (guard as any).observabilityStorage = obsStorage;

        const requestContext = new RequestContext();
        requestContext.set(contextKey, id);
        const args = createInputStepArgs({ stepNumber: 1, requestContext });

        await expect(guard.processInputStep(args)).resolves.toBeUndefined();
        expect(obsStorage.getMetricAggregate).toHaveBeenCalledWith(
          expect.objectContaining({
            filters: expect.objectContaining({ [filterKey]: id }),
          }),
        );
      },
    );

    it.each(scopeCases)('$scope scope applies the time window filter', async ({ scope, contextKey, id }) => {
      const obsStorage = createMockObservabilityStorage();
      const guard = new TokenCostControl({ maxCost: 10.0, scope, window: '24h' });
      (guard as any).observabilityStorage = obsStorage;

      const requestContext = new RequestContext();
      requestContext.set(contextKey, id);
      const args = createInputStepArgs({ stepNumber: 1, requestContext });

      await guard.processInputStep(args);

      const call = (obsStorage.getMetricAggregate as any).mock.calls[0][0];
      expect(call.filters.timestamp).toBeDefined();
      expect(call.filters.timestamp.start).toBeInstanceOf(Date);
    });

    it.each(scopeCases)(
      '$scope scope: missing RequestContext key → fail-open, no query, no onViolation',
      async ({ scope }) => {
        const obsStorage = createMockObservabilityStorage({ inputCost: 5, outputCost: 5, costUnit: 'usd' });
        const guard = new TokenCostControl({ maxCost: 0.5, scope });
        (guard as any).observabilityStorage = obsStorage;
        const onViolation = vi.fn();
        guard.onViolation = onViolation;

        const args = createInputStepArgs({ stepNumber: 1, requestContext: new RequestContext() });

        await expect(guard.processInputStep(args)).resolves.toBeUndefined();
        expect(obsStorage.getMetricAggregate).not.toHaveBeenCalled();
        expect(onViolation).not.toHaveBeenCalled();
      },
    );

    it('non-string RequestContext value → fail-open, no query', async () => {
      const obsStorage = createMockObservabilityStorage({ inputCost: 5, outputCost: 5, costUnit: 'usd' });
      const guard = new TokenCostControl({ maxCost: 0.5, scope: 'user' });
      (guard as any).observabilityStorage = obsStorage;

      const requestContext = new RequestContext();
      requestContext.set('userId', 42);
      const args = createInputStepArgs({ stepNumber: 1, requestContext });

      await expect(guard.processInputStep(args)).resolves.toBeUndefined();
      expect(obsStorage.getMetricAggregate).not.toHaveBeenCalled();
    });

    it('tripwire metadata carries the new scope and scopeKey', async () => {
      const obsStorage = createMockObservabilityStorage({ inputCost: 0.4, outputCost: 0.2, costUnit: 'usd' });
      const guard = new TokenCostControl({ maxCost: 0.5, scope: 'user' });
      (guard as any).observabilityStorage = obsStorage;

      const requestContext = new RequestContext();
      requestContext.set('userId', 'user-meta');
      const args = createInputStepArgs({ stepNumber: 1, requestContext });

      try {
        await guard.processInputStep(args);
        expect.fail('Expected TripWire to be thrown');
      } catch (error) {
        const tripwire = error as TripWire<any>;
        expect(tripwire.options.metadata.scope).toBe('user');
        expect(tripwire.options.metadata.scopeKey).toBe('user:user-meta');
      }
    });

    it('violation detail carries the new scope and scopeKey (warn strategy)', async () => {
      const obsStorage = createMockObservabilityStorage({ inputCost: 0.4, outputCost: 0.2, costUnit: 'usd' });
      const guard = new TokenCostControl({ maxCost: 0.5, scope: 'organization', strategy: 'warn' });
      guard.__registerMastra(createMockMastra(obsStorage));
      const onViolation = vi.fn();
      guard.onViolation = onViolation;

      const requestContext = new RequestContext();
      requestContext.set('organizationId', 'org-detail');
      const args = createInputStepArgs({ stepNumber: 1, requestContext });

      await expect(guard.processInputStep(args)).resolves.toBeUndefined();
      const detail = onViolation.mock.calls[0]![0].detail;
      expect(detail.scope).toBe('organization');
      expect(detail.scopeKey).toBe('organization:org-detail');
    });

    it('live-fire: user scope blocks the over-budget user and allows another user (real ObservabilityInMemory)', async () => {
      const { InMemoryStore } = await import('../../storage/mock');
      const observability = new InMemoryStore().stores.observability!;

      await observability.batchCreateMetrics({
        metrics: [
          {
            metricId: 'metric-user-a-input',
            timestamp: new Date(),
            name: 'mastra_model_total_input_tokens',
            value: 1000,
            traceId: 'trace-live-a',
            entityType: EntityType.AGENT,
            userId: 'user-a',
            estimatedCost: 0.4,
            costUnit: 'usd',
            labels: {},
          },
          {
            metricId: 'metric-user-a-output',
            timestamp: new Date(),
            name: 'mastra_model_total_output_tokens',
            value: 500,
            traceId: 'trace-live-a',
            entityType: EntityType.AGENT,
            userId: 'user-a',
            estimatedCost: 0.3,
            costUnit: 'usd',
            labels: {},
          },
          {
            metricId: 'metric-user-b-input',
            timestamp: new Date(),
            name: 'mastra_model_total_input_tokens',
            value: 100,
            traceId: 'trace-live-b',
            entityType: EntityType.AGENT,
            userId: 'user-b',
            estimatedCost: 0.01,
            costUnit: 'usd',
            labels: {},
          },
        ],
      });

      const guard = new TokenCostControl({ maxCost: 0.5, scope: 'user' });
      (guard as any).observabilityStorage = observability;

      // user-a: 0.4 + 0.3 = 0.7 >= 0.5 → blocks
      const contextA = new RequestContext();
      contextA.set('userId', 'user-a');
      await expect(
        guard.processInputStep(createInputStepArgs({ stepNumber: 1, requestContext: contextA })),
      ).rejects.toThrow(TripWire);

      // user-b: 0.01 < 0.5 → allows
      const contextB = new RequestContext();
      contextB.set('userId', 'user-b');
      await expect(
        guard.processInputStep(createInputStepArgs({ stepNumber: 1, requestContext: contextB })),
      ).resolves.toBeUndefined();
    });
  });

  describe('dynamic maxCost', () => {
    it('function maxCost receives the requestContext and drives block/allow', async () => {
      const obsStorage = createMockObservabilityStorage({ inputCost: 0.4, outputCost: 0.2, costUnit: 'usd' });
      const maxCostFn = vi.fn((requestContext?: RequestContext) =>
        requestContext?.get('tier') === 'pro' ? 10.0 : 0.5,
      );
      const guard = new TokenCostControl({ maxCost: maxCostFn, scope: 'run' });
      guard.__registerMastra(createMockMastra(obsStorage));

      const requestContext = new RequestContext();
      requestContext.set('tier', 'free');
      const args = createInputStepArgs({
        stepNumber: 1,
        requestContext,
        tracing: createMockTracing('trace-dyn-block') as any,
      });

      // cost 0.6 >= free-tier limit 0.5 → blocks
      await expect(guard.processInputStep(args)).rejects.toThrow(TripWire);
      expect(maxCostFn).toHaveBeenCalledWith(requestContext);
    });

    it('two requests with different context-derived limits produce different outcomes', async () => {
      const obsStorage = createMockObservabilityStorage({ inputCost: 0.4, outputCost: 0.2, costUnit: 'usd' });
      const guard = new TokenCostControl({
        maxCost: (requestContext?: RequestContext) => (requestContext?.get('tier') === 'pro' ? 10.0 : 0.5),
        scope: 'run',
      });
      guard.__registerMastra(createMockMastra(obsStorage));

      const proContext = new RequestContext();
      proContext.set('tier', 'pro');
      const proArgs = createInputStepArgs({
        stepNumber: 1,
        requestContext: proContext,
        tracing: createMockTracing('trace-dyn-pro') as any,
      });
      // Same cost 0.6 < pro-tier limit 10 → allows
      await expect(guard.processInputStep(proArgs)).resolves.toBeUndefined();

      const freeContext = new RequestContext();
      freeContext.set('tier', 'free');
      const freeArgs = createInputStepArgs({
        stepNumber: 1,
        requestContext: freeContext,
        tracing: createMockTracing('trace-dyn-free') as any,
      });
      // cost 0.6 >= free-tier limit 0.5 → blocks
      await expect(guard.processInputStep(freeArgs)).rejects.toThrow(TripWire);
    });

    it('tripwire metadata maxCost reflects the resolved value', async () => {
      const obsStorage = createMockObservabilityStorage({ inputCost: 0.4, outputCost: 0.2, costUnit: 'usd' });
      const guard = new TokenCostControl({ maxCost: () => 0.25, scope: 'run' });
      guard.__registerMastra(createMockMastra(obsStorage));

      const args = createInputStepArgs({
        stepNumber: 1,
        tracing: createMockTracing('trace-dyn-meta') as any,
      });

      try {
        await guard.processInputStep(args);
        expect.fail('Expected TripWire to be thrown');
      } catch (error) {
        const tripwire = error as TripWire<any>;
        expect(tripwire.options.metadata.maxCost).toBe(0.25);
      }
    });

    it.each([0, -1, NaN])('function returning %s → step proceeds, logger warned, no onViolation', async invalid => {
      const obsStorage = createMockObservabilityStorage({ inputCost: 0.4, outputCost: 0.2, costUnit: 'usd' });
      const guard = new TokenCostControl({ maxCost: () => invalid, scope: 'run' });
      guard.__registerMastra(createMockMastra(obsStorage));
      const onViolation = vi.fn();
      guard.onViolation = onViolation;

      const args = createInputStepArgs({
        stepNumber: 1,
        tracing: createMockTracing('trace-dyn-invalid') as any,
      });

      await expect(guard.processInputStep(args)).resolves.toBeUndefined();
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('dynamic maxCost resolved to an invalid value'),
        expect.objectContaining({ value: invalid }),
      );
      expect(onViolation).not.toHaveBeenCalled();
    });
  });

  describe('hardening (single query, logger, precision)', () => {
    it('queries both token metric names in a single getMetricAggregate call', async () => {
      const obsStorage = createMockObservabilityStorage({ inputCost: 0.1, outputCost: 0.1, costUnit: 'usd' });
      const guard = createRunScopeGuard(10.0, obsStorage);

      const args = createInputStepArgs({
        stepNumber: 1,
        tracing: createMockTracing('trace-single-query') as any,
      });

      await guard.processInputStep(args);

      expect(obsStorage.getMetricAggregate).toHaveBeenCalledTimes(1);
      expect(obsStorage.getMetricAggregate).toHaveBeenCalledWith(
        expect.objectContaining({
          name: ['mastra_model_total_input_tokens', 'mastra_model_total_output_tokens'],
          aggregation: 'sum',
        }),
      );
    });

    it('logs through the Mastra logger when the cost query fails (fail-open)', async () => {
      const obsStorage = {
        getMetricAggregate: vi.fn().mockRejectedValue(new Error('storage down')),
      } as unknown as ObservabilityStorage;
      const guard = new TokenCostControl({ maxCost: 0.5, scope: 'run' });
      guard.__registerMastra(createMockMastra(obsStorage));

      const args = createInputStepArgs({
        stepNumber: 1,
        tracing: createMockTracing('trace-query-fail') as any,
      });

      // Fail-open: step proceeds
      await expect(guard.processInputStep(args)).resolves.toBeUndefined();
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('cost query failed'),
        expect.objectContaining({ error: expect.any(Error) }),
      );
    });

    it('normalizes float precision artifacts in violation messages', async () => {
      // 0.1 + 0.2 = 0.30000000000000004 in IEEE 754
      const obsStorage = createMockObservabilityStorage({ inputCost: 0.1, outputCost: 0.2, costUnit: 'usd' });
      const guard = createRunScopeGuard(0.25, obsStorage);

      const args = createInputStepArgs({
        stepNumber: 1,
        tracing: createMockTracing('trace-precision') as any,
      });

      try {
        await guard.processInputStep(args);
        expect.fail('Expected TripWire to be thrown');
      } catch (error) {
        const tripwire = error as TripWire<any>;
        expect(tripwire.message).toContain('0.3');
        expect(tripwire.message).not.toContain('0.30000000000000004');
      }
    });

    it('logs a warning when onViolation throws and still logs the violation warning', async () => {
      const obsStorage = createMockObservabilityStorage({ inputCost: 0.4, outputCost: 0.2, costUnit: 'usd' });
      const guard = new TokenCostControl({ maxCost: 0.5, scope: 'run', strategy: 'warn' });
      guard.__registerMastra(createMockMastra(obsStorage));
      guard.onViolation = vi.fn().mockRejectedValue(new Error('callback boom'));

      const args = createInputStepArgs({
        stepNumber: 1,
        tracing: createMockTracing('trace-cb-throw') as any,
      });

      await expect(guard.processInputStep(args)).resolves.toBeUndefined();
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('onViolation callback threw'),
        expect.objectContaining({ error: expect.any(Error) }),
      );
      expect(mockLogger.warn).toHaveBeenCalledWith(expect.stringContaining('cost limit exceeded'));
    });
  });

  describe('review fixes', () => {
    it('constructor rejects NaN and Infinity maxCost', () => {
      expect(() => new TokenCostControl({ maxCost: NaN })).toThrow('finite positive number');
      expect(() => new TokenCostControl({ maxCost: Infinity })).toThrow('finite positive number');
    });

    it('two guard instances sharing one state bag each fire their own warning', async () => {
      // The runner keys per-processor state by processor.id, which is
      // hardcoded 'token-cost-control' — two instances in one pipeline share a state
      // bag. Their dedup keys must not collide.
      const obsStorage = createMockObservabilityStorage({ inputCost: 0.4, outputCost: 0.2, costUnit: 'usd' });
      const lowGuard = new TokenCostControl({ maxCost: 0.5, scope: 'run', strategy: 'warn' });
      const highGuard = new TokenCostControl({ maxCost: 0.55, scope: 'run', strategy: 'warn' });
      lowGuard.__registerMastra(createMockMastra(obsStorage));
      highGuard.__registerMastra(createMockMastra(obsStorage));
      const lowViolation = vi.fn();
      const highViolation = vi.fn();
      lowGuard.onViolation = lowViolation;
      highGuard.onViolation = highViolation;

      const sharedState: Record<string, unknown> = {};
      const tracing = createMockTracing('trace-shared-state') as any;
      await lowGuard.processInputStep(createInputStepArgs({ stepNumber: 1, tracing, state: sharedState }));
      await highGuard.processInputStep(createInputStepArgs({ stepNumber: 1, tracing, state: sharedState }));

      expect(lowViolation).toHaveBeenCalledTimes(1);
      expect(highViolation).toHaveBeenCalledTimes(1);
    });

    it('two instances with the same limit but different warnAtPercent each fire their soft warning', async () => {
      // Cost 0.6 against maxCost 1.0 crosses both the 50% and 55% soft
      // thresholds; each instance must fire despite the shared state bag.
      const obsStorage = createMockObservabilityStorage({ inputCost: 0.4, outputCost: 0.2, costUnit: 'usd' });
      const fiftyGuard = new TokenCostControl({ maxCost: 1.0, scope: 'run', warnAtPercent: 50 });
      const fiftyFiveGuard = new TokenCostControl({ maxCost: 1.0, scope: 'run', warnAtPercent: 55 });
      fiftyGuard.__registerMastra(createMockMastra(obsStorage));
      fiftyFiveGuard.__registerMastra(createMockMastra(obsStorage));
      const fiftyViolation = vi.fn();
      const fiftyFiveViolation = vi.fn();
      fiftyGuard.onViolation = fiftyViolation;
      fiftyFiveGuard.onViolation = fiftyFiveViolation;

      const sharedState: Record<string, unknown> = {};
      const tracing = createMockTracing('trace-soft-shared') as any;
      await fiftyGuard.processInputStep(createInputStepArgs({ stepNumber: 1, tracing, state: sharedState }));
      await fiftyFiveGuard.processInputStep(createInputStepArgs({ stepNumber: 1, tracing, state: sharedState }));

      expect(fiftyViolation).toHaveBeenCalledTimes(1);
      expect(fiftyFiveViolation).toHaveBeenCalledTimes(1);
    });

    it('dedup stays once-per-request when a dynamic maxCost resolves differently per step', async () => {
      const obsStorage = createMockObservabilityStorage({ inputCost: 0.4, outputCost: 0.2, costUnit: 'usd' });
      let call = 0;
      const guard = new TokenCostControl({
        // Varies per step but always below the queried cost of 0.6
        maxCost: () => 0.5 + call++ * 0.01,
        scope: 'run',
        strategy: 'warn',
      });
      guard.__registerMastra(createMockMastra(obsStorage));
      const onViolation = vi.fn();
      guard.onViolation = onViolation;

      const sharedState: Record<string, unknown> = {};
      const tracing = createMockTracing('trace-varying-limit') as any;
      for (let step = 1; step <= 3; step++) {
        await guard.processInputStep(createInputStepArgs({ stepNumber: step, tracing, state: sharedState }));
      }

      expect(onViolation).toHaveBeenCalledTimes(1);
    });

    it('two distinct state objects (two requests) each fire the warning once', async () => {
      const obsStorage = createMockObservabilityStorage({ inputCost: 0.4, outputCost: 0.2, costUnit: 'usd' });
      const guard = new TokenCostControl({ maxCost: 0.5, scope: 'run', strategy: 'warn' });
      guard.__registerMastra(createMockMastra(obsStorage));
      const onViolation = vi.fn();
      guard.onViolation = onViolation;

      const tracing = createMockTracing('trace-two-requests') as any;
      const stateA: Record<string, unknown> = {};
      await guard.processInputStep(createInputStepArgs({ stepNumber: 1, tracing, state: stateA }));
      await guard.processInputStep(createInputStepArgs({ stepNumber: 2, tracing, state: stateA }));
      expect(onViolation).toHaveBeenCalledTimes(1);

      const stateB: Record<string, unknown> = {};
      await guard.processInputStep(createInputStepArgs({ stepNumber: 1, tracing, state: stateB }));
      expect(onViolation).toHaveBeenCalledTimes(2);
    });

    it('block tripwire metadata carries threshold: hard', async () => {
      const obsStorage = createMockObservabilityStorage({ inputCost: 0.4, outputCost: 0.2, costUnit: 'usd' });
      const guard = new TokenCostControl({ maxCost: 0.5, scope: 'run' });
      guard.__registerMastra(createMockMastra(obsStorage));

      const args = createInputStepArgs({
        stepNumber: 1,
        tracing: createMockTracing('trace-threshold-meta') as any,
      });

      try {
        await guard.processInputStep(args);
        expect.fail('Expected TripWire');
      } catch (error) {
        expect((error as TripWire<any>).options.metadata.threshold).toBe('hard');
      }
    });

    it('throwing dynamic maxCost function fails open with a logged warning', async () => {
      const obsStorage = createMockObservabilityStorage({ inputCost: 0.4, outputCost: 0.2, costUnit: 'usd' });
      const guard = new TokenCostControl({
        maxCost: () => {
          throw new Error('tier lookup failed');
        },
        scope: 'run',
      });
      guard.__registerMastra(createMockMastra(obsStorage));
      const onViolation = vi.fn();
      guard.onViolation = onViolation;

      const args = createInputStepArgs({
        stepNumber: 1,
        tracing: createMockTracing('trace-maxcost-throw') as any,
      });

      await expect(guard.processInputStep(args)).resolves.toBeUndefined();
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('dynamic maxCost function threw'),
        expect.objectContaining({ error: expect.any(Error) }),
      );
      expect(onViolation).not.toHaveBeenCalled();
      expect(obsStorage.getMetricAggregate).not.toHaveBeenCalled();
    });

    it('live-fire: input and output totals on one run sum without double counting (real ObservabilityInMemory)', async () => {
      const { InMemoryStore } = await import('../../storage/mock');
      const observability = new InMemoryStore().stores.observability!;
      await observability.batchCreateMetrics({
        metrics: [
          {
            metricId: 'metric-dc-input',
            timestamp: new Date(),
            name: 'mastra_model_total_input_tokens',
            value: 1000,
            traceId: 'trace-double-count',
            entityType: EntityType.AGENT,
            estimatedCost: 0.1,
            costUnit: 'usd',
            labels: {},
          },
          {
            metricId: 'metric-dc-output',
            timestamp: new Date(),
            name: 'mastra_model_total_output_tokens',
            value: 500,
            traceId: 'trace-double-count',
            entityType: EntityType.AGENT,
            estimatedCost: 0.2,
            costUnit: 'usd',
            labels: {},
          },
        ],
      });

      // Total is 0.3 exactly — a double-counting bug would report 0.6.
      const allowGuard = new TokenCostControl({ maxCost: 0.35, scope: 'run' });
      (allowGuard as any).observabilityStorage = observability;
      await expect(
        allowGuard.processInputStep(
          createInputStepArgs({ stepNumber: 1, tracing: createMockTracing('trace-double-count') as any }),
        ),
      ).resolves.toBeUndefined();

      const blockGuard = new TokenCostControl({ maxCost: 0.25, scope: 'run' });
      (blockGuard as any).observabilityStorage = observability;
      try {
        await blockGuard.processInputStep(
          createInputStepArgs({ stepNumber: 1, tracing: createMockTracing('trace-double-count') as any }),
        );
        expect.fail('Expected TripWire');
      } catch (error) {
        expect((error as TripWire<any>).message).toContain('0.3/0.25');
        expect((error as TripWire<any>).options.metadata.usage.estimatedCost).toBeCloseTo(0.3, 10);
      }
    });
  });

  describe('deprecated alias', () => {
    it('CostGuardProcessor is the same class as TokenCostControl with the token-cost-control id', async () => {
      expect(CostGuardProcessor).toBe(TokenCostControl);

      const obsStorage = createMockObservabilityStorage({ inputCost: 0.4, outputCost: 0.4 });
      const guard = new CostGuardProcessor({ maxCost: 0.5, scope: 'run' });
      guard.__registerMastra(createMockMastra(obsStorage));
      expect(guard.id).toBe('token-cost-control');
      expect(guard).toBeInstanceOf(TokenCostControl);

      const tracing = createMockTracing('trace-alias');
      await expect(
        guard.processInputStep(createInputStepArgs({ stepNumber: 1, tracing: tracing as any })),
      ).rejects.toThrow('0.8/0.5');
    });
  });
});
