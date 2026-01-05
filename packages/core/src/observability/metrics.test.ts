import { describe, it, expect, beforeEach } from 'vitest';
import {
  InMemoryMetricsCollector,
  NoOpMetricsCollector,
  MetricNames,
  type AgentRunMetrics,
  type WorkflowRunMetrics,
  type ToolExecutionMetrics,
  type ModelCallMetrics,
} from './metrics';

describe('Metrics Collector', () => {
  describe('NoOpMetricsCollector', () => {
    it('should not throw on any operation', () => {
      const collector = new NoOpMetricsCollector();

      expect(() => collector.incrementCounter('test')).not.toThrow();
      expect(() => collector.setGauge('test', {}, 1)).not.toThrow();
      expect(() => collector.recordHistogram('test', {}, 1)).not.toThrow();
      expect(() =>
        collector.recordAgentRun({
          agentId: 'test',
          runId: 'run-1',
          durationMs: 100,
          stepCount: 1,
          toolCallCount: 0,
          toolSuccessCount: 0,
          toolFailureCount: 0,
          tokenUsage: { inputTokens: 10, outputTokens: 20 },
          success: true,
        }),
      ).not.toThrow();
    });

    it('should shutdown without error', async () => {
      const collector = new NoOpMetricsCollector();
      await expect(collector.shutdown()).resolves.toBeUndefined();
    });
  });

  describe('InMemoryMetricsCollector', () => {
    let collector: InMemoryMetricsCollector;

    beforeEach(() => {
      collector = new InMemoryMetricsCollector();
    });

    describe('Counter operations', () => {
      it('should increment counter with default value', () => {
        collector.incrementCounter('test_counter');
        expect(collector.getCounter('test_counter')).toBe(1);
      });

      it('should increment counter with custom value', () => {
        collector.incrementCounter('test_counter', {}, 5);
        expect(collector.getCounter('test_counter')).toBe(5);
      });

      it('should accumulate counter values', () => {
        collector.incrementCounter('test_counter', {}, 3);
        collector.incrementCounter('test_counter', {}, 2);
        expect(collector.getCounter('test_counter')).toBe(5);
      });

      it('should track counters with labels separately', () => {
        collector.incrementCounter('test_counter', { agentId: 'agent-1' });
        collector.incrementCounter('test_counter', { agentId: 'agent-2' }, 2);
        collector.incrementCounter('test_counter', { agentId: 'agent-1' });

        expect(collector.getCounter('test_counter', { agentId: 'agent-1' })).toBe(2);
        expect(collector.getCounter('test_counter', { agentId: 'agent-2' })).toBe(2);
      });
    });

    describe('Gauge operations', () => {
      it('should set gauge value', () => {
        collector.setGauge('test_gauge', {}, 42);
        expect(collector.getGauge('test_gauge', {})).toBe(42);
      });

      it('should overwrite previous gauge value', () => {
        collector.setGauge('test_gauge', {}, 10);
        collector.setGauge('test_gauge', {}, 20);
        expect(collector.getGauge('test_gauge', {})).toBe(20);
      });
    });

    describe('Histogram operations', () => {
      it('should record histogram values', () => {
        collector.recordHistogram('test_histogram', {}, 10);
        collector.recordHistogram('test_histogram', {}, 20);
        collector.recordHistogram('test_histogram', {}, 15);

        const values = collector.getHistogram('test_histogram', {});
        expect(values).toEqual([10, 20, 15]);
      });
    });

    describe('Agent run metrics', () => {
      it('should record agent run metrics', () => {
        const metrics: AgentRunMetrics = {
          agentId: 'test-agent',
          runId: 'run-123',
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
          finishReason: 'stop',
        };

        collector.recordAgentRun(metrics);

        // Check recorded runs
        const runs = collector.getAgentRuns();
        expect(runs).toHaveLength(1);
        expect(runs[0]).toEqual(metrics);

        // Check derived counters
        expect(collector.getCounter(MetricNames.AGENT_RUNS_TOTAL, { agentId: 'test-agent' })).toBe(1);
        expect(collector.getCounter(MetricNames.AGENT_RUNS_SUCCESS, { agentId: 'test-agent' })).toBe(1);

        // Check token counters
        expect(collector.getCounter(MetricNames.TOKENS_INPUT, { agentId: 'test-agent' })).toBe(100);
        expect(collector.getCounter(MetricNames.TOKENS_OUTPUT, { agentId: 'test-agent' })).toBe(50);
      });

      it('should record failed agent runs', () => {
        const metrics: AgentRunMetrics = {
          agentId: 'test-agent',
          runId: 'run-456',
          durationMs: 500,
          stepCount: 1,
          toolCallCount: 0,
          toolSuccessCount: 0,
          toolFailureCount: 0,
          tokenUsage: { inputTokens: 10, outputTokens: 0 },
          success: false,
          errorType: 'RateLimitError',
        };

        collector.recordAgentRun(metrics);

        expect(collector.getCounter('agent_runs_error_total', { agentId: 'test-agent', errorType: 'RateLimitError' })).toBe(1);
      });
    });

    describe('Workflow run metrics', () => {
      it('should record workflow run metrics', () => {
        const metrics: WorkflowRunMetrics = {
          workflowId: 'test-workflow',
          runId: 'wf-run-123',
          durationMs: 2000,
          stepsExecuted: 5,
          stepsSucceeded: 4,
          stepsFailed: 1,
          stepsSuspended: 0,
          status: 'completed',
          success: true,
        };

        collector.recordWorkflowRun(metrics);

        const runs = collector.getWorkflowRuns();
        expect(runs).toHaveLength(1);
        expect(runs[0]).toEqual(metrics);

        expect(collector.getCounter(MetricNames.WORKFLOW_RUNS_TOTAL, { workflowId: 'test-workflow' })).toBe(1);
      });
    });

    describe('Tool execution metrics', () => {
      it('should record successful tool executions', () => {
        const metrics: ToolExecutionMetrics = {
          toolName: 'searchWeb',
          toolType: 'local',
          durationMs: 250,
          success: true,
          agentId: 'test-agent',
        };

        collector.recordToolExecution(metrics);

        const executions = collector.getToolExecutions();
        expect(executions).toHaveLength(1);

        expect(collector.getCounter(MetricNames.TOOL_CALLS_TOTAL, { tool: 'searchWeb', toolType: 'local', agentId: 'test-agent' })).toBe(1);
        expect(collector.getCounter(MetricNames.TOOL_CALLS_SUCCESS, { tool: 'searchWeb', toolType: 'local', agentId: 'test-agent' })).toBe(1);
      });

      it('should record failed tool executions', () => {
        const metrics: ToolExecutionMetrics = {
          toolName: 'searchWeb',
          durationMs: 5000,
          success: false,
          errorMessage: 'Timeout',
        };

        collector.recordToolExecution(metrics);

        expect(collector.getCounter('tool_calls_error_total', { tool: 'searchWeb' })).toBe(1);
      });
    });

    describe('Model call metrics', () => {
      it('should record model call metrics', () => {
        const metrics: ModelCallMetrics = {
          model: 'gpt-4',
          provider: 'openai',
          durationMs: 800,
          timeToFirstTokenMs: 150,
          tokenUsage: { inputTokens: 200, outputTokens: 100 },
          finishReason: 'stop',
          success: true,
          isRetry: false,
          isFallback: false,
          agentId: 'test-agent',
        };

        collector.recordModelCall(metrics);

        const calls = collector.getModelCalls();
        expect(calls).toHaveLength(1);

        expect(collector.getCounter(MetricNames.MODEL_CALLS_TOTAL, { model: 'gpt-4', provider: 'openai', agentId: 'test-agent' })).toBe(1);
      });

      it('should record retries and fallbacks', () => {
        collector.recordModelCall({
          model: 'gpt-4',
          provider: 'openai',
          durationMs: 100,
          tokenUsage: { inputTokens: 10, outputTokens: 0 },
          success: false,
          isRetry: true,
          retryAttempt: 2,
          isFallback: false,
        });

        expect(collector.getCounter(MetricNames.MODEL_RETRIES, { model: 'gpt-4', provider: 'openai' })).toBe(1);

        collector.recordModelCall({
          model: 'gpt-3.5-turbo',
          provider: 'openai',
          durationMs: 200,
          tokenUsage: { inputTokens: 10, outputTokens: 20 },
          success: true,
          isRetry: false,
          isFallback: true,
          fallbackFrom: 'gpt-4',
        });

        expect(collector.getCounter(MetricNames.MODEL_FALLBACKS, { model: 'gpt-3.5-turbo', provider: 'openai', fallbackFrom: 'gpt-4' })).toBe(1);
      });
    });

    describe('Token and cost tracking', () => {
      it('should track token usage', () => {
        collector.recordTokenUsage(
          { inputTokens: 100, outputTokens: 50, cachedTokens: 20, reasoningTokens: 10 },
          { model: 'gpt-4' },
        );

        expect(collector.getCounter(MetricNames.TOKENS_INPUT, { model: 'gpt-4' })).toBe(100);
        expect(collector.getCounter(MetricNames.TOKENS_OUTPUT, { model: 'gpt-4' })).toBe(50);
        expect(collector.getCounter(MetricNames.TOKENS_TOTAL, { model: 'gpt-4' })).toBe(150);
        expect(collector.getCounter(MetricNames.TOKENS_CACHED, { model: 'gpt-4' })).toBe(20);
        expect(collector.getCounter(MetricNames.TOKENS_REASONING, { model: 'gpt-4' })).toBe(10);
      });

      it('should track costs', () => {
        collector.recordCost(
          { totalCostUSD: 0.05, modelCostUSD: 0.04, toolCostUSD: 0.01 },
          { agentId: 'test-agent' },
        );

        expect(collector.getCounter(MetricNames.COST_USD, { agentId: 'test-agent' })).toBe(0.05);
        expect(collector.getCounter(MetricNames.COST_MODEL_USD, { agentId: 'test-agent' })).toBe(0.04);
        expect(collector.getCounter(MetricNames.COST_TOOL_USD, { agentId: 'test-agent' })).toBe(0.01);
      });
    });

    describe('Utility methods', () => {
      it('should clear all data', () => {
        collector.incrementCounter('test');
        collector.recordAgentRun({
          agentId: 'test',
          runId: 'run-1',
          durationMs: 100,
          stepCount: 1,
          toolCallCount: 0,
          toolSuccessCount: 0,
          toolFailureCount: 0,
          tokenUsage: { inputTokens: 10, outputTokens: 20 },
          success: true,
        });

        collector.clear();

        expect(collector.getAllCounters().size).toBe(0);
        expect(collector.getAgentRuns()).toHaveLength(0);
      });

      it('should return all counters', () => {
        collector.incrementCounter('counter1');
        collector.incrementCounter('counter2', { label: 'value' });

        const allCounters = collector.getAllCounters();
        expect(allCounters.size).toBe(2);
      });
    });
  });
});
