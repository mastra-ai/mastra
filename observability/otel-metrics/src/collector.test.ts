import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { metrics } from '@opentelemetry/api';
import { OtelMetricsCollector } from './collector';

describe('OtelMetricsCollector', () => {
  let collector: OtelMetricsCollector;
  let mockMeter: any;
  let mockCounters: Map<string, { add: ReturnType<typeof vi.fn> }>;
  let mockHistograms: Map<string, { record: ReturnType<typeof vi.fn> }>;
  let mockGauges: Map<string, { addCallback: ReturnType<typeof vi.fn> }>;

  beforeEach(() => {
    mockCounters = new Map();
    mockHistograms = new Map();
    mockGauges = new Map();

    mockMeter = {
      createCounter: vi.fn((name: string) => {
        const counter = { add: vi.fn() };
        mockCounters.set(name, counter);
        return counter;
      }),
      createHistogram: vi.fn((name: string) => {
        const histogram = { record: vi.fn() };
        mockHistograms.set(name, histogram);
        return histogram;
      }),
      createObservableGauge: vi.fn((name: string) => {
        const gauge = { addCallback: vi.fn() };
        mockGauges.set(name, gauge);
        return gauge;
      }),
    };

    vi.spyOn(metrics, 'getMeter').mockReturnValue(mockMeter);
  });

  afterEach(async () => {
    if (collector) {
      await collector.shutdown();
    }
    vi.restoreAllMocks();
  });

  describe('initialization', () => {
    it('should create a meter with default options', () => {
      collector = new OtelMetricsCollector();

      expect(metrics.getMeter).toHaveBeenCalledWith('@mastra/otel-metrics', '1.0.0');
    });

    it('should create a meter with custom options', () => {
      collector = new OtelMetricsCollector({
        meterName: 'my-app',
        meterVersion: '2.0.0',
        prefix: 'myapp_',
      });

      expect(metrics.getMeter).toHaveBeenCalledWith('my-app', '2.0.0');
    });

    it('should register core metrics on construction', () => {
      collector = new OtelMetricsCollector();

      // Should have created counters for core metrics
      expect(mockMeter.createCounter).toHaveBeenCalled();
      expect(mockMeter.createHistogram).toHaveBeenCalled();
    });
  });

  describe('incrementCounter', () => {
    beforeEach(() => {
      collector = new OtelMetricsCollector({ prefix: 'test_' });
    });

    it('should increment a counter with default value', () => {
      collector.incrementCounter('my_counter', { label: 'value' });

      const counter = mockCounters.get('test_my_counter');
      expect(counter).toBeDefined();
      expect(counter!.add).toHaveBeenCalledWith(1, { label: 'value' });
    });

    it('should increment a counter with custom value', () => {
      collector.incrementCounter('my_counter', { label: 'value' }, 5);

      const counter = mockCounters.get('test_my_counter');
      expect(counter!.add).toHaveBeenCalledWith(5, { label: 'value' });
    });

    it('should handle empty labels', () => {
      collector.incrementCounter('my_counter');

      const counter = mockCounters.get('test_my_counter');
      expect(counter!.add).toHaveBeenCalledWith(1, {});
    });

    it('should reuse existing counters', () => {
      collector.incrementCounter('my_counter', { a: '1' });
      collector.incrementCounter('my_counter', { b: '2' });

      // Counter should be created only once
      const createCounterCalls = mockMeter.createCounter.mock.calls;
      const myCounterCalls = createCounterCalls.filter((call: any[]) => call[0] === 'test_my_counter');
      expect(myCounterCalls).toHaveLength(1);
    });
  });

  describe('recordHistogram', () => {
    beforeEach(() => {
      collector = new OtelMetricsCollector({ prefix: 'test_' });
    });

    it('should record a histogram value', () => {
      collector.recordHistogram('my_histogram', { operation: 'read' }, 42.5);

      const histogram = mockHistograms.get('test_my_histogram');
      expect(histogram).toBeDefined();
      expect(histogram!.record).toHaveBeenCalledWith(42.5, { operation: 'read' });
    });

    it('should reuse existing histograms', () => {
      collector.recordHistogram('latency', { a: '1' }, 10);
      collector.recordHistogram('latency', { b: '2' }, 20);

      const createHistogramCalls = mockMeter.createHistogram.mock.calls;
      const latencyCalls = createHistogramCalls.filter((call: any[]) => call[0] === 'test_latency');
      expect(latencyCalls).toHaveLength(1);
    });
  });

  describe('setGauge', () => {
    beforeEach(() => {
      collector = new OtelMetricsCollector({ prefix: 'test_' });
    });

    it('should create an observable gauge', () => {
      collector.setGauge('active_connections', { server: 'main' }, 10);

      expect(mockMeter.createObservableGauge).toHaveBeenCalledWith('test_active_connections', expect.any(Object));
    });

    it('should register a callback for the gauge', () => {
      collector.setGauge('temperature', { sensor: 'cpu' }, 65.5);

      const gauge = mockGauges.get('test_temperature');
      expect(gauge).toBeDefined();
      expect(gauge!.addCallback).toHaveBeenCalled();
    });

    it('should update gauge values without creating new gauges', () => {
      collector.setGauge('memory_usage', { host: 'server1' }, 50);
      collector.setGauge('memory_usage', { host: 'server1' }, 75);

      // Only one gauge should be created
      const createGaugeCalls = mockMeter.createObservableGauge.mock.calls;
      const memoryCalls = createGaugeCalls.filter((call: any[]) => call[0] === 'test_memory_usage');
      expect(memoryCalls).toHaveLength(1);
    });
  });

  describe('BaseMetricsCollector inherited methods', () => {
    beforeEach(() => {
      collector = new OtelMetricsCollector({ prefix: 'test_' });
    });

    it('should record agent run via inherited method', () => {
      collector.recordAgentRun({
        agentId: 'agent-1',
        runId: 'run-1',
        durationMs: 1500,
        stepCount: 3,
        toolCallCount: 2,
        toolSuccessCount: 2,
        toolFailureCount: 0,
        tokenUsage: {
          inputTokens: 100,
          outputTokens: 50,
        },
        success: true,
      });

      // Should have called the counter and histogram
      const runsCounter = mockCounters.get('test_agent_runs_total');
      expect(runsCounter!.add).toHaveBeenCalled();

      const durationHistogram = mockHistograms.get('test_agent_run_duration_ms');
      expect(durationHistogram!.record).toHaveBeenCalled();
    });

    it('should record tool execution via inherited method', () => {
      collector.recordToolExecution({
        toolName: 'searchTool',
        toolType: 'external',
        agentId: 'agent-1',
        durationMs: 250,
        success: true,
      });

      const toolCounter = mockCounters.get('test_tool_calls_total');
      expect(toolCounter!.add).toHaveBeenCalled();
    });

    it('should record model call via inherited method', () => {
      collector.recordModelCall({
        model: 'gpt-4',
        provider: 'openai',
        durationMs: 500,
        tokenUsage: {
          inputTokens: 100,
          outputTokens: 50,
        },
        success: true,
      });

      const modelCounter = mockCounters.get('test_model_calls_total');
      expect(modelCounter!.add).toHaveBeenCalled();
    });

    it('should record guardrail trigger via inherited method', () => {
      collector.recordGuardrailTrigger({
        agentId: 'agent-1',
        runId: 'run-1',
        guardrailId: 'content-filter',
        guardrailName: 'ContentFilter',
        action: 'blocked',
        reason: 'Inappropriate content',
        willRetry: false,
        timestamp: Date.now(),
      });

      const guardrailCounter = mockCounters.get('test_agent_guardrail_triggers_total');
      expect(guardrailCounter!.add).toHaveBeenCalled();
    });

    it('should record human intervention via inherited method', () => {
      collector.recordHumanIntervention({
        agentId: 'agent-1',
        runId: 'run-1',
        toolName: 'dangerousTool',
        type: 'approval_requested',
        timestamp: Date.now(),
      });

      const interventionCounter = mockCounters.get('test_agent_human_approvals_requested_total');
      expect(interventionCounter!.add).toHaveBeenCalled();
    });
  });

  describe('flush and shutdown', () => {
    it('should not throw on flush', async () => {
      collector = new OtelMetricsCollector();
      await expect(collector.flush()).resolves.not.toThrow();
    });

    it('should clear internal state on shutdown', async () => {
      collector = new OtelMetricsCollector({ prefix: 'test_' });

      // Record some metrics
      collector.incrementCounter('counter1');
      collector.recordHistogram('hist1', {}, 10);
      collector.setGauge('gauge1', {}, 5);

      await collector.shutdown();

      // Verify shutdown doesn't throw
      expect(true).toBe(true);
    });
  });

  describe('label handling', () => {
    beforeEach(() => {
      collector = new OtelMetricsCollector({ prefix: 'test_' });
    });

    it('should convert labels to OTEL attributes', () => {
      collector.incrementCounter('test', {
        stringLabel: 'value',
        numberLabel: 42,
        boolLabel: true,
      });

      const counter = mockCounters.get('test_test');
      expect(counter!.add).toHaveBeenCalledWith(1, {
        stringLabel: 'value',
        numberLabel: '42',
        boolLabel: 'true',
      });
    });

    it('should filter out undefined and null labels', () => {
      collector.incrementCounter('test', {
        valid: 'value',
        nullValue: null,
        undefinedValue: undefined,
      } as any);

      const counter = mockCounters.get('test_test');
      expect(counter!.add).toHaveBeenCalledWith(1, {
        valid: 'value',
      });
    });
  });
});
