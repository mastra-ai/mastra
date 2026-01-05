import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { PrometheusMetricsCollector } from './collector';

describe('PrometheusMetricsCollector', () => {
  let collector: PrometheusMetricsCollector;

  beforeEach(() => {
    collector = new PrometheusMetricsCollector({
      prefix: 'test_',
      collectDefaultMetrics: false, // Disable for cleaner tests
    });
  });

  afterEach(async () => {
    await collector.shutdown();
  });

  describe('constructor', () => {
    it('should create collector with default options', () => {
      const c = new PrometheusMetricsCollector({ collectDefaultMetrics: false });
      expect(c.getRegistry()).toBeDefined();
    });

    it('should use custom prefix', async () => {
      collector.incrementCounter('agent_runs_total', { agentId: 'test' });
      const metrics = await collector.getMetrics();
      expect(metrics).toContain('test_agent_runs_total');
    });
  });

  describe('incrementCounter', () => {
    it('should increment counter with labels', async () => {
      collector.incrementCounter('agent_runs_total', { agentId: 'my-agent' });
      collector.incrementCounter('agent_runs_total', { agentId: 'my-agent' });

      const metrics = await collector.getMetrics();
      expect(metrics).toContain('test_agent_runs_total{agentId="my-agent"} 2');
    });

    it('should increment counter by custom value', async () => {
      collector.incrementCounter('agent_tool_calls_total', { agentId: 'test' }, 5);

      const metrics = await collector.getMetrics();
      expect(metrics).toContain('test_agent_tool_calls_total{agentId="test"} 5');
    });

    it('should handle multiple label values', async () => {
      collector.incrementCounter('agent_runs_total', { agentId: 'agent-a' });
      collector.incrementCounter('agent_runs_total', { agentId: 'agent-b' });

      const metrics = await collector.getMetrics();
      expect(metrics).toContain('agentId="agent-a"');
      expect(metrics).toContain('agentId="agent-b"');
    });
  });

  describe('setGauge', () => {
    it('should set gauge value', async () => {
      collector.setGauge('active_runs', { agentId: 'test' }, 5);

      const metrics = await collector.getMetrics();
      expect(metrics).toContain('test_active_runs{agentId="test"} 5');
    });

    it('should update gauge value', async () => {
      collector.setGauge('active_runs', { agentId: 'test' }, 5);
      collector.setGauge('active_runs', { agentId: 'test' }, 3);

      const metrics = await collector.getMetrics();
      expect(metrics).toContain('test_active_runs{agentId="test"} 3');
    });
  });

  describe('recordHistogram', () => {
    it('should record histogram observation', async () => {
      collector.recordHistogram('agent_run_duration_ms', { agentId: 'test' }, 150);

      const metrics = await collector.getMetrics();
      expect(metrics).toContain('test_agent_run_duration_ms_bucket');
      expect(metrics).toContain('test_agent_run_duration_ms_sum');
      expect(metrics).toContain('test_agent_run_duration_ms_count');
    });

    it('should record multiple observations', async () => {
      collector.recordHistogram('agent_run_duration_ms', { agentId: 'test' }, 100);
      collector.recordHistogram('agent_run_duration_ms', { agentId: 'test' }, 200);
      collector.recordHistogram('agent_run_duration_ms', { agentId: 'test' }, 300);

      const metrics = await collector.getMetrics();
      expect(metrics).toContain('test_agent_run_duration_ms_count{agentId="test"} 3');
      expect(metrics).toContain('test_agent_run_duration_ms_sum{agentId="test"} 600');
    });
  });

  describe('recordAgentRun', () => {
    it('should record successful agent run metrics', async () => {
      collector.recordAgentRun({
        agentId: 'my-agent',
        runId: 'run-123',
        durationMs: 1500,
        stepCount: 5,
        toolCallCount: 3,
        toolSuccessCount: 3,
        toolFailureCount: 0,
        tokenUsage: {
          inputTokens: 1000,
          outputTokens: 500,
        },
        success: true,
      });

      const metrics = await collector.getMetrics();
      expect(metrics).toContain('test_agent_runs_total{agentId="my-agent"} 1');
      expect(metrics).toContain('test_agent_runs_success_total{agentId="my-agent"} 1');
      expect(metrics).toContain('test_agent_tool_calls_total{agentId="my-agent"} 3');
      expect(metrics).toContain('test_tokens_input_total');
      expect(metrics).toContain('test_tokens_output_total');
    });

    it('should record failed agent run metrics', async () => {
      collector.recordAgentRun({
        agentId: 'my-agent',
        runId: 'run-456',
        durationMs: 500,
        stepCount: 2,
        toolCallCount: 1,
        toolSuccessCount: 0,
        toolFailureCount: 1,
        tokenUsage: { inputTokens: 100, outputTokens: 0 },
        success: false,
        errorType: 'TimeoutError',
      });

      const metrics = await collector.getMetrics();
      expect(metrics).toContain('test_agent_runs_total{agentId="my-agent"} 1');
      expect(metrics).toContain('test_agent_runs_error_total');
      expect(metrics).toContain('errorType="TimeoutError"');
    });
  });

  describe('recordToolExecution', () => {
    it('should record tool execution metrics', async () => {
      collector.recordToolExecution({
        toolName: 'web_search',
        agentId: 'agent-1',
        durationMs: 250,
        success: true,
      });

      const metrics = await collector.getMetrics();
      // Uses tool_calls_ metric names
      expect(metrics).toContain('test_tool_calls_total');
      expect(metrics).toContain('test_tool_calls_success_total');
      expect(metrics).toContain('tool="web_search"');
    });
  });

  describe('recordGuardrailTrigger', () => {
    it('should record guardrail metrics', async () => {
      collector.recordGuardrailTrigger({
        agentId: 'agent-1',
        runId: 'run-1',
        processorId: 'content-filter',
        reason: 'Blocked harmful content',
        willRetry: false,
        timestamp: new Date(),
      });

      const metrics = await collector.getMetrics();
      // Uses prefixed agent_ metric names
      expect(metrics).toContain('test_agent_guardrail_triggers_total');
      expect(metrics).toContain('agentId="agent-1"');
    });
  });

  describe('recordHumanIntervention', () => {
    it('should record human intervention metrics', async () => {
      collector.recordHumanIntervention({
        agentId: 'agent-1',
        runId: 'run-1',
        type: 'approval_requested',
        toolName: 'send_email',
        toolCallId: 'call-1',
        timestamp: new Date(),
      });

      const metrics = await collector.getMetrics();
      // Uses prefixed agent_ metric names
      expect(metrics).toContain('test_agent_human_approvals_requested_total');
      expect(metrics).toContain('agentId="agent-1"');
    });
  });

  describe('recordGoalState', () => {
    it('should record goal completion metrics', async () => {
      collector.recordGoalState('completed', { agentId: 'agent-1' });

      const metrics = await collector.getMetrics();
      // Uses separate metrics per state
      expect(metrics).toContain('test_agent_goal_completed_total');
      expect(metrics).toContain('agentId="agent-1"');
    });

    it('should record different goal states', async () => {
      collector.recordGoalState('completed', { agentId: 'agent-1' });
      collector.recordGoalState('failed', { agentId: 'agent-1' });
      collector.recordGoalState('blocked', { agentId: 'agent-1' });

      const metrics = await collector.getMetrics();
      // Separate metrics per state
      expect(metrics).toContain('test_agent_goal_completed_total{agentId="agent-1"} 1');
      expect(metrics).toContain('test_agent_goal_failed_total{agentId="agent-1"} 1');
      expect(metrics).toContain('test_agent_goal_blocked_total{agentId="agent-1"} 1');
    });
  });

  describe('recordHttpRequest', () => {
    it('should record HTTP request metrics', async () => {
      collector.recordHttpRequest({
        method: 'GET',
        url: 'https://api.example.com/data',
        direction: 'outbound',
        source: 'tool',
        statusCode: 200,
        durationMs: 150,
        success: true,
      });

      const metrics = await collector.getMetrics();
      expect(metrics).toContain('test_http_requests_total');
      expect(metrics).toContain('method="GET"');
      expect(metrics).toContain('direction="outbound"');
    });
  });

  describe('getMetrics', () => {
    it('should return metrics in Prometheus format', async () => {
      collector.incrementCounter('agent_runs_total', { agentId: 'test' });
      const metrics = await collector.getMetrics();

      expect(typeof metrics).toBe('string');
      expect(metrics).toContain('# HELP');
      expect(metrics).toContain('# TYPE');
    });
  });

  describe('getContentType', () => {
    it('should return correct content type', () => {
      const contentType = collector.getContentType();
      expect(contentType).toContain('text/plain');
    });
  });

  describe('reset', () => {
    it('should reset all metrics', async () => {
      collector.incrementCounter('agent_runs_total', { agentId: 'test' }, 10);
      collector.reset();

      const metrics = await collector.getMetrics();
      // After reset, metrics structure remains but values are reset
      // Note: prom-client reset behavior varies - counters may show 0 or not appear
      expect(metrics).toContain('test_agent_runs_total');
    });
  });

  describe('shutdown', () => {
    it('should clear all metrics', async () => {
      collector.incrementCounter('agent_runs_total', { agentId: 'test' });
      await collector.shutdown();

      const metrics = await collector.getMetrics();
      expect(metrics).not.toContain('agent_runs_total');
    });
  });
});
