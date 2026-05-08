import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { MessageList } from '../../agent/message-list';
import { TripWire } from '../../agent/trip-wire';
import { RequestContext, MASTRA_RESOURCE_ID_KEY, MASTRA_THREAD_ID_KEY } from '../../request-context';
import type { ObservabilityStorage } from '../../storage/domains';
import type { ProcessInputStepArgs } from '../index';
import { CostGuardProcessor } from './cost-guard';

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
  const guard = new CostGuardProcessor({ maxCost, scope: 'run', ...opts });
  (guard as any).observabilityStorage = obsStorage;
  return guard;
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

    it('defaults scope to resource', () => {
      const guard = new CostGuardProcessor({ maxCost: 1.0 });
      expect((guard as any).scope).toBe('resource');
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
        expect(tripwire.options.metadata.processorId).toBe('cost-guard');
        expect(tripwire.options.metadata.scope).toBe('run');
        expect(tripwire.options.metadata.maxCost).toBe(0.5);
        expect(tripwire.options.metadata.usage.estimatedCost).toBeCloseTo(0.6, 10);
        expect(tripwire.options.metadata.usage.costUnit).toBe('usd');
      }
    });
  });

  describe('warn strategy', () => {
    it('logs warning instead of throwing', async () => {
      const spy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const obsStorage = createMockObservabilityStorage({ inputCost: 0.4, outputCost: 0.2, costUnit: 'usd' });
      const guard = createRunScopeGuard(0.5, obsStorage, { strategy: 'warn' });

      const args = createInputStepArgs({
        stepNumber: 1,
        tracing: createMockTracing('trace-warn') as any,
      });

      await expect(guard.processInputStep(args)).resolves.toBeUndefined();
      expect(spy).toHaveBeenCalledWith(expect.stringContaining('[CostGuardProcessor]'));

      spy.mockRestore();
    });
  });

  describe('custom message', () => {
    it('uses custom message template', async () => {
      const obsStorage = createMockObservabilityStorage({ inputCost: 0.4, outputCost: 0.2, costUnit: 'usd' });

      const guard = new CostGuardProcessor({
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

      const guard = new CostGuardProcessor({
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

      const guard = new CostGuardProcessor({
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

      const guard = new CostGuardProcessor({
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

      const guard = new CostGuardProcessor({
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

      const guard = new CostGuardProcessor({
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

      const guard = new CostGuardProcessor({
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

      const guard = new CostGuardProcessor({
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

      const guard = new CostGuardProcessor({
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
      const mockMastra = {
        getStorage: () => ({ stores: { observability: mockObsStorage } }),
      } as any;

      for (const scope of ['run', 'resource', 'thread'] as const) {
        const guard = new CostGuardProcessor({ maxCost: 1.0, scope });
        guard.__registerMastra(mockMastra);
        expect((guard as any).observabilityStorage).toBe(mockObsStorage);
      }
    });

    it('throws when observability storage is not available', () => {
      const mockMastra = {
        getStorage: () => ({ stores: {} }),
      } as any;

      const guard = new CostGuardProcessor({ maxCost: 1.0 });
      expect(() => guard.__registerMastra(mockMastra)).toThrow('observability storage');
    });

    it('throws when storage is not configured', () => {
      const mockMastra = {
        getStorage: () => undefined,
      } as any;

      const guard = new CostGuardProcessor({ maxCost: 1.0, scope: 'thread' });
      expect(() => guard.__registerMastra(mockMastra)).toThrow('observability storage');
    });

    it('throws when observability storage lacks getMetricAggregate', () => {
      const mockMastra = {
        getStorage: () => ({ stores: { observability: { listMetrics: vi.fn() } } }),
      } as any;

      const guard = new CostGuardProcessor({ maxCost: 1.0 });
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
      expect(violation.processorId).toBe('cost-guard');
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

      const guard = new CostGuardProcessor({
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

      const spy = vi.spyOn(console, 'warn').mockImplementation(() => {
        callOrder.push('warn');
      });

      const args = createInputStepArgs({
        stepNumber: 1,
        tracing: createMockTracing('trace-async') as any,
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
          metadata: expect.objectContaining({ processorId: 'cost-guard' }),
        }),
      );
    });
  });

  describe('edge cases', () => {
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

      const guard = new CostGuardProcessor({
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

    it('no observability storage set → query returns null (fail-open for run scope)', async () => {
      const guard = new CostGuardProcessor({ maxCost: 0.01, scope: 'run' });
      // Not registered → no observability storage

      const args = createInputStepArgs({
        stepNumber: 1,
        tracing: createMockTracing('trace-no-obs') as any,
      });

      // queryCost returns null when no obs storage → allows
      await expect(guard.processInputStep(args)).resolves.toBeUndefined();
    });
  });
});
