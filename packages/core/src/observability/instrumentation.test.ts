import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  createLogContext,
  AgentRunTracker,
  WorkflowRunTracker,
  ModelCallTracker,
  HttpRequestTracker,
  trackOutboundRequest,
  trackInboundRequest,
  logHttpRequest,
  setGlobalMetricsCollector,
  getGlobalMetricsCollector,
} from './instrumentation';
import { InMemoryMetricsCollector, NoOpMetricsCollector } from './metrics';
import { ConsoleLogger } from '../logger';
import { LogLevel } from '../logger/constants';

describe('Instrumentation Helpers', () => {
  describe('createLogContext', () => {
    it('should create empty context when no options provided', () => {
      const context = createLogContext({});
      expect(context).toEqual({
        traceId: undefined,
        spanId: undefined,
        parentSpanId: undefined,
        agentId: undefined,
        workflowId: undefined,
        runId: undefined,
        threadId: undefined,
        resourceId: undefined,
        sessionId: undefined,
      });
    });

    it('should populate context from options', () => {
      const context = createLogContext({
        agentId: 'agent-123',
        runId: 'run-456',
        threadId: 'thread-789',
        resourceId: 'user-abc',
      });

      expect(context.agentId).toBe('agent-123');
      expect(context.runId).toBe('run-456');
      expect(context.threadId).toBe('thread-789');
      expect(context.resourceId).toBe('user-abc');
    });

    it('should extract context from span', () => {
      const mockSpan = {
        id: 'span-123',
        traceId: 'trace-456',
        parent: { id: 'parent-789' },
      };

      const context = createLogContext({
        span: mockSpan as any,
      });

      expect(context.spanId).toBe('span-123');
      expect(context.traceId).toBe('trace-456');
      expect(context.parentSpanId).toBe('parent-789');
    });

    it('should prefer explicit span over tracingContext', () => {
      const mockSpan = { id: 'explicit-span', traceId: 'trace-1' };
      const mockTracingContext = { currentSpan: { id: 'context-span', traceId: 'trace-2' } };

      const context = createLogContext({
        span: mockSpan as any,
        tracingContext: mockTracingContext as any,
      });

      expect(context.spanId).toBe('explicit-span');
    });
  });

  describe('AgentRunTracker', () => {
    let logger: ConsoleLogger;
    let metrics: InMemoryMetricsCollector;
    let tracker: AgentRunTracker;

    beforeEach(() => {
      logger = new ConsoleLogger({ level: LogLevel.DEBUG });
      metrics = new InMemoryMetricsCollector();
      tracker = new AgentRunTracker({
        logger,
        metrics,
        agentId: 'test-agent',
        agentName: 'Test Agent',
        runId: 'run-123',
      });
    });

    it('should create tracker with correct context', () => {
      const context = tracker.getContext();
      expect(context.agentId).toBe('test-agent');
      expect(context.runId).toBe('run-123');
    });

    it('should track steps', () => {
      tracker.recordStep();
      tracker.recordStep();

      const metrics = tracker.completed({ finishReason: 'stop' });
      expect(metrics.stepCount).toBe(2);
    });

    it('should track tool calls', () => {
      tracker.recordToolCall(true, 100, 'tool1');
      tracker.recordToolCall(false, 50, 'tool2');
      tracker.recordToolCall(true, 75, 'tool3');

      const runMetrics = tracker.completed({ finishReason: 'stop' });
      expect(runMetrics.toolCallCount).toBe(3);
      expect(runMetrics.toolSuccessCount).toBe(2);
      expect(runMetrics.toolFailureCount).toBe(1);
    });

    it('should track token usage', () => {
      tracker.recordTokens({ inputTokens: 100, outputTokens: 50 });
      tracker.recordTokens({ inputTokens: 50, outputTokens: 25, cachedTokens: 10 });

      const runMetrics = tracker.completed({ finishReason: 'stop' });
      expect(runMetrics.tokenUsage.inputTokens).toBe(150);
      expect(runMetrics.tokenUsage.outputTokens).toBe(75);
      expect(runMetrics.tokenUsage.cachedTokens).toBe(10);
    });

    it('should calculate duration on completion', async () => {
      // Wait a small amount of time
      await new Promise(resolve => setTimeout(resolve, 10));

      const runMetrics = tracker.completed({ finishReason: 'stop' });
      // Use >= 5 to avoid flakiness - setTimeout isn't precise
      expect(runMetrics.durationMs).toBeGreaterThanOrEqual(5);
      expect(runMetrics.success).toBe(true);
    });

    it('should record metrics on completion', () => {
      tracker.completed({ finishReason: 'stop' });

      const agentRuns = metrics.getAgentRuns();
      expect(agentRuns).toHaveLength(1);
      expect(agentRuns[0]!.agentId).toBe('test-agent');
    });

    it('should handle errors', () => {
      const error = new Error('Test error');
      (error as any).id = 'TEST_ERROR';

      const runMetrics = tracker.error(error as any);
      expect(runMetrics.success).toBe(false);
      expect(runMetrics.errorType).toBe('Error');
    });
  });

  describe('WorkflowRunTracker', () => {
    let logger: ConsoleLogger;
    let metrics: InMemoryMetricsCollector;
    let tracker: WorkflowRunTracker;

    beforeEach(() => {
      logger = new ConsoleLogger({ level: LogLevel.DEBUG });
      metrics = new InMemoryMetricsCollector();
      tracker = new WorkflowRunTracker({
        logger,
        metrics,
        workflowId: 'test-workflow',
        workflowName: 'Test Workflow',
        runId: 'wf-run-123',
      });
    });

    it('should track step completions', () => {
      tracker.stepCompleted('step1', 'Step 1', 'success', 100);
      tracker.stepCompleted('step2', 'Step 2', 'success', 150);
      tracker.stepCompleted('step3', 'Step 3', 'failed', 50);

      const runMetrics = tracker.completed('completed');
      expect(runMetrics.stepsExecuted).toBe(3);
      expect(runMetrics.stepsSucceeded).toBe(2);
      expect(runMetrics.stepsFailed).toBe(1);
    });

    it('should handle suspended workflows', () => {
      tracker.stepCompleted('step1', 'Step 1', 'success', 100);
      tracker.stepCompleted('step2', 'Step 2', 'suspended', 50);

      const runMetrics = tracker.completed('suspended');
      expect(runMetrics.status).toBe('suspended');
      expect(runMetrics.success).toBe(false);
      expect(runMetrics.stepsSuspended).toBe(1);
    });

    it('should record metrics on completion', () => {
      tracker.completed('completed');

      const workflowRuns = metrics.getWorkflowRuns();
      expect(workflowRuns).toHaveLength(1);
    });
  });

  describe('ModelCallTracker', () => {
    let logger: ConsoleLogger;
    let metrics: InMemoryMetricsCollector;
    let tracker: ModelCallTracker;

    beforeEach(() => {
      logger = new ConsoleLogger({ level: LogLevel.DEBUG });
      metrics = new InMemoryMetricsCollector();
      tracker = new ModelCallTracker({
        logger,
        metrics,
        model: 'gpt-4',
        provider: 'openai',
        agentId: 'test-agent',
      });
    });

    it('should track first token time', async () => {
      await new Promise(resolve => setTimeout(resolve, 10));
      tracker.recordFirstToken();

      const callMetrics = tracker.response({
        inputTokens: 100,
        outputTokens: 50,
      });

      expect(callMetrics.timeToFirstTokenMs).toBeGreaterThanOrEqual(10);
    });

    it('should only record first token time once', async () => {
      await new Promise(resolve => setTimeout(resolve, 5));
      tracker.recordFirstToken();

      await new Promise(resolve => setTimeout(resolve, 20));
      tracker.recordFirstToken(); // Second call should be ignored

      const callMetrics = tracker.response({
        inputTokens: 100,
        outputTokens: 50,
      });

      // Should be around 5ms, not 25ms
      expect(callMetrics.timeToFirstTokenMs).toBeLessThan(20);
    });

    it('should track retries and fallbacks', () => {
      const callMetrics = tracker.response({
        inputTokens: 100,
        outputTokens: 50,
        isRetry: true,
        retryAttempt: 2,
        isFallback: true,
        fallbackFrom: 'gpt-4-turbo',
      });

      expect(callMetrics.isRetry).toBe(true);
      expect(callMetrics.retryAttempt).toBe(2);
      expect(callMetrics.isFallback).toBe(true);
      expect(callMetrics.fallbackFrom).toBe('gpt-4-turbo');
    });

    it('should record metrics on completion', () => {
      tracker.response({ inputTokens: 100, outputTokens: 50 });

      const modelCalls = metrics.getModelCalls();
      expect(modelCalls).toHaveLength(1);
      expect(modelCalls[0]!.model).toBe('gpt-4');
      expect(modelCalls[0]!.provider).toBe('openai');
    });
  });

  describe('Global Metrics Collector', () => {
    it('should default to NoOpMetricsCollector', () => {
      const collector = getGlobalMetricsCollector();
      expect(collector).toBeInstanceOf(NoOpMetricsCollector);
    });

    it('should allow setting custom collector', () => {
      const customCollector = new InMemoryMetricsCollector();
      setGlobalMetricsCollector(customCollector);

      expect(getGlobalMetricsCollector()).toBe(customCollector);

      // Reset to default
      setGlobalMetricsCollector(new NoOpMetricsCollector());
    });
  });

  describe('HttpRequestTracker', () => {
    let logger: ConsoleLogger;
    let metrics: InMemoryMetricsCollector;
    let tracker: HttpRequestTracker;

    beforeEach(() => {
      logger = new ConsoleLogger({ level: LogLevel.DEBUG });
      metrics = new InMemoryMetricsCollector();
      tracker = new HttpRequestTracker(
        {
          logger,
          metrics,
          direction: 'outbound',
          source: 'tool',
          agentId: 'test-agent',
        },
        { method: 'GET', url: 'https://api.example.com/users' },
      );
    });

    it('should log request event', () => {
      const logEventSpy = vi.spyOn(logger, 'logEvent');

      tracker.logRequest();

      expect(logEventSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          category: 'http',
          event: 'http.request',
          data: expect.objectContaining({
            method: 'GET',
            url: 'https://api.example.com/users',
            host: 'api.example.com',
            direction: 'outbound',
            source: 'tool',
          }),
        }),
      );
    });

    it('should track successful response', () => {
      const result = tracker.response({ statusCode: 200, statusText: 'OK' });

      expect(result.success).toBe(true);
      expect(result.statusCode).toBe(200);
      expect(result.method).toBe('GET');
      expect(result.url).toBe('https://api.example.com/users');
    });

    it('should track failed response', () => {
      const result = tracker.response({ statusCode: 500, statusText: 'Internal Server Error' });

      expect(result.success).toBe(false);
      expect(result.statusCode).toBe(500);
    });

    it('should track errors', () => {
      const result = tracker.error(new Error('Connection refused'));

      expect(result.success).toBe(false);
      expect(result.statusCode).toBe(0);
      expect(result.errorType).toBe('Error');
    });

    it('should record metrics on response', () => {
      tracker.response({ statusCode: 200 });

      const httpRequests = metrics.getHttpRequests();
      expect(httpRequests).toHaveLength(1);
      expect(httpRequests[0]!.method).toBe('GET');
      expect(httpRequests[0]!.success).toBe(true);
    });

    it('should record metrics on error', () => {
      tracker.error(new Error('Timeout'));

      const httpRequests = metrics.getHttpRequests();
      expect(httpRequests).toHaveLength(1);
      expect(httpRequests[0]!.success).toBe(false);
      expect(httpRequests[0]!.errorType).toBe('Error');
    });

    it('should parse URL correctly', () => {
      const result = tracker.response({ statusCode: 200 });

      expect(result.host).toBe('api.example.com');
    });
  });

  describe('trackOutboundRequest', () => {
    it('should create outbound tracker', () => {
      const logger = new ConsoleLogger({ level: LogLevel.DEBUG });
      const tracker = trackOutboundRequest(logger, { method: 'POST', url: 'https://api.example.com/data' });

      const result = tracker.response({ statusCode: 201 });
      expect(result.direction).toBe('outbound');
    });
  });

  describe('trackInboundRequest', () => {
    it('should create inbound tracker', () => {
      const logger = new ConsoleLogger({ level: LogLevel.DEBUG });
      const tracker = trackInboundRequest(logger, { method: 'GET', url: '/api/agents' });

      const result = tracker.response({ statusCode: 200 });
      expect(result.direction).toBe('inbound');
      expect(result.source).toBe('server');
    });
  });

  describe('logHttpRequest', () => {
    it('should log and record HTTP request directly', () => {
      const logger = new ConsoleLogger({ level: LogLevel.DEBUG });
      const metrics = new InMemoryMetricsCollector();
      const logEventSpy = vi.spyOn(logger, 'logEvent');

      logHttpRequest(logger, metrics, {}, {
        method: 'PUT',
        url: 'https://api.example.com/update',
        statusCode: 200,
        durationMs: 150,
        direction: 'outbound',
        source: 'integration',
      });

      expect(logEventSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          category: 'http',
          event: 'http.response',
          data: expect.objectContaining({
            method: 'PUT',
            statusCode: 200,
            durationMs: 150,
          }),
        }),
      );

      const httpRequests = metrics.getHttpRequests();
      expect(httpRequests).toHaveLength(1);
      expect(httpRequests[0]!.method).toBe('PUT');
    });
  });
});
