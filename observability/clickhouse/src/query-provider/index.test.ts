import type { ClickHouseClient } from '@clickhouse/client';

import { describe, it, expect, vi } from 'vitest';

import { TABLE_NAMES } from '../schema/tables.js';

import { ClickHouseQueryProvider } from './index.js';

// Mock ClickHouse client that returns configurable results
function createMockClickHouseClient(mockData: {
  traces?: Record<string, unknown>[];
  spans?: Record<string, unknown>[];
  logs?: Record<string, unknown>[];
  metrics?: Record<string, unknown>[];
  scores?: Record<string, unknown>[];
  tables?: string[];
} = {}) {
  const queries: Array<{ query: string; params: Record<string, unknown> }> = [];
  const commands: string[] = [];

  return {
    queries,
    commands,
    async query(options: { query: string; query_params?: Record<string, unknown>; format?: string }) {
      queries.push({ query: options.query, params: options.query_params || {} });

      // Return count result
      if (options.query.includes('count()')) {
        const tableMatch = options.query.match(/FROM\s+(\w+)/);
        const table = tableMatch?.[1];
        let count = 0;
        if (table === TABLE_NAMES.TRACES) count = mockData.traces?.length || 0;
        if (table === TABLE_NAMES.SPANS) count = mockData.spans?.length || 0;
        if (table === TABLE_NAMES.LOGS) count = mockData.logs?.length || 0;
        if (table === TABLE_NAMES.METRICS) count = mockData.metrics?.length || 0;
        if (table === TABLE_NAMES.SCORES) count = mockData.scores?.length || 0;

        return {
          async json() {
            return [{ total: count }];
          },
        };
      }

      // Return table list for schema check
      if (options.query.includes('system.tables')) {
        return {
          async json() {
            return (mockData.tables || []).map(name => ({ name }));
          },
        };
      }

      // Return data based on table
      const tableMatch = options.query.match(/FROM\s+(\w+)/);
      const table = tableMatch?.[1];

      return {
        async json() {
          if (table === TABLE_NAMES.TRACES) return mockData.traces || [];
          if (table === TABLE_NAMES.SPANS) return mockData.spans || [];
          if (table === TABLE_NAMES.LOGS) return mockData.logs || [];
          if (table === TABLE_NAMES.METRICS) return mockData.metrics || [];
          if (table === TABLE_NAMES.SCORES) return mockData.scores || [];
          return [];
        },
      };
    },
    async command(options: { query: string }) {
      commands.push(options.query);
    },
    async close() {},
  };
}

describe('ClickHouseQueryProvider', () => {
  describe('constructor', () => {
    it('should create provider with client config', () => {
      const client = createMockClickHouseClient();
      const provider = new ClickHouseQueryProvider({
        clickhouse: { client: client as unknown as ClickHouseClient },
      });

      expect(provider).toBeInstanceOf(ClickHouseQueryProvider);
    });
  });

  describe('init', () => {
    it('should run migrations if schema is not initialized', async () => {
      const client = createMockClickHouseClient({ tables: [] });
      const provider = new ClickHouseQueryProvider({
        clickhouse: { client: client as unknown as ClickHouseClient },
      });

      await provider.init();

      expect(client.commands.length).toBeGreaterThan(0);
    });

    it('should skip migrations if schema is already initialized', async () => {
      const client = createMockClickHouseClient({
        tables: [
          'mastra_admin_traces',
          'mastra_admin_spans',
          'mastra_admin_logs',
          'mastra_admin_metrics',
          'mastra_admin_scores',
          'mastra_admin_traces_hourly_stats',
          'mastra_admin_spans_hourly_stats',
          'mastra_admin_logs_hourly_stats',
          'mastra_admin_metrics_hourly_stats',
          'mastra_admin_scores_hourly_stats',
        ],
      });
      const provider = new ClickHouseQueryProvider({
        clickhouse: { client: client as unknown as ClickHouseClient },
      });

      await provider.init();

      expect(client.commands.length).toBe(0);
    });
  });

  describe('listTraces', () => {
    it('should return empty result when no traces', async () => {
      const client = createMockClickHouseClient({ traces: [] });
      const provider = new ClickHouseQueryProvider({
        clickhouse: { client: client as unknown as ClickHouseClient },
      });

      const result = await provider.listTraces();

      expect(result.traces).toHaveLength(0);
      expect(result.pagination.total).toBe(0);
      expect(result.pagination.hasMore).toBe(false);
    });

    it('should return traces with correct transformation', async () => {
      const mockTraces = [
        {
          trace_id: 't1',
          project_id: 'p1',
          deployment_id: 'd1',
          name: 'test-trace',
          status: 'ok',
          start_time: '2025-01-23T12:00:00.000Z',
          end_time: '2025-01-23T12:00:01.000Z',
          duration_ms: 1000,
          metadata: '{"key":"value"}',
        },
      ];
      const client = createMockClickHouseClient({ traces: mockTraces });
      const provider = new ClickHouseQueryProvider({
        clickhouse: { client: client as unknown as ClickHouseClient },
      });

      const result = await provider.listTraces();

      expect(result.traces).toHaveLength(1);
      expect(result.traces[0]?.traceId).toBe('t1');
      expect(result.traces[0]?.projectId).toBe('p1');
      expect(result.traces[0]?.deploymentId).toBe('d1');
      expect(result.traces[0]?.name).toBe('test-trace');
      expect(result.traces[0]?.status).toBe('ok');
      expect(result.traces[0]?.startTime).toBeInstanceOf(Date);
      expect(result.traces[0]?.endTime).toBeInstanceOf(Date);
      expect(result.traces[0]?.durationMs).toBe(1000);
      expect(result.traces[0]?.metadata).toEqual({ key: 'value' });
    });

    it('should apply filters correctly', async () => {
      const client = createMockClickHouseClient({ traces: [] });
      const provider = new ClickHouseQueryProvider({
        clickhouse: { client: client as unknown as ClickHouseClient },
      });

      await provider.listTraces({
        projectId: 'p1',
        deploymentId: 'd1',
        status: 'error',
        name: 'test',
        timeRange: {
          start: new Date('2025-01-01'),
          end: new Date('2025-01-31'),
        },
      });

      // Check that queries include the filter conditions
      const listQuery = client.queries.find(q => !q.query.includes('count()'));
      expect(listQuery?.query).toContain('project_id =');
      expect(listQuery?.query).toContain('deployment_id =');
      expect(listQuery?.query).toContain('status =');
      expect(listQuery?.query).toContain('name LIKE');
      expect(listQuery?.query).toContain('start_time >=');
      expect(listQuery?.query).toContain('start_time <=');
    });

    it('should apply pagination correctly', async () => {
      const mockTraces = Array.from({ length: 100 }, (_, i) => ({
        trace_id: `t${i}`,
        project_id: 'p1',
        deployment_id: 'd1',
        name: `trace-${i}`,
        status: 'ok',
        start_time: '2025-01-23T12:00:00.000Z',
        end_time: null,
        duration_ms: null,
        metadata: '{}',
      }));
      const client = createMockClickHouseClient({ traces: mockTraces });
      const provider = new ClickHouseQueryProvider({
        clickhouse: { client: client as unknown as ClickHouseClient },
      });

      const result = await provider.listTraces({
        pagination: { page: 0, perPage: 10 },
      });

      expect(result.pagination.page).toBe(0);
      expect(result.pagination.perPage).toBe(10);
      expect(result.pagination.total).toBe(100);
      expect(result.pagination.hasMore).toBe(true);
    });
  });

  describe('getTrace', () => {
    it('should return null when trace not found', async () => {
      const client = createMockClickHouseClient({ traces: [] });
      const provider = new ClickHouseQueryProvider({
        clickhouse: { client: client as unknown as ClickHouseClient },
      });

      const result = await provider.getTrace('nonexistent');

      expect(result).toBeNull();
    });

    it('should return trace when found', async () => {
      const mockTraces = [
        {
          trace_id: 't1',
          project_id: 'p1',
          deployment_id: 'd1',
          name: 'test-trace',
          status: 'ok',
          start_time: '2025-01-23T12:00:00.000Z',
          end_time: null,
          duration_ms: null,
          metadata: '{}',
        },
      ];
      const client = createMockClickHouseClient({ traces: mockTraces });
      const provider = new ClickHouseQueryProvider({
        clickhouse: { client: client as unknown as ClickHouseClient },
      });

      const result = await provider.getTrace('t1');

      expect(result).not.toBeNull();
      expect(result?.traceId).toBe('t1');
    });
  });

  describe('listSpans', () => {
    it('should return spans with correct transformation', async () => {
      const mockSpans = [
        {
          span_id: 's1',
          trace_id: 't1',
          parent_span_id: null,
          project_id: 'p1',
          deployment_id: 'd1',
          name: 'test-span',
          kind: 'server',
          status: 'ok',
          start_time: '2025-01-23T12:00:00.000Z',
          end_time: '2025-01-23T12:00:01.000Z',
          duration_ms: 1000,
          attributes: '{"http.method":"GET"}',
          events: '[]',
        },
      ];
      const client = createMockClickHouseClient({ spans: mockSpans });
      const provider = new ClickHouseQueryProvider({
        clickhouse: { client: client as unknown as ClickHouseClient },
      });

      const result = await provider.listSpans();

      expect(result.spans).toHaveLength(1);
      expect(result.spans[0]?.spanId).toBe('s1');
      expect(result.spans[0]?.traceId).toBe('t1');
      expect(result.spans[0]?.parentSpanId).toBeNull();
      expect(result.spans[0]?.kind).toBe('server');
      expect(result.spans[0]?.attributes).toEqual({ 'http.method': 'GET' });
      expect(result.spans[0]?.events).toEqual([]);
    });

    it('should apply span-specific filters', async () => {
      const client = createMockClickHouseClient({ spans: [] });
      const provider = new ClickHouseQueryProvider({
        clickhouse: { client: client as unknown as ClickHouseClient },
      });

      await provider.listSpans({
        traceId: 't1',
        spanId: 's1',
        parentSpanId: 'ps1',
        kind: 'server',
      });

      const listQuery = client.queries.find(q => !q.query.includes('count()'));
      expect(listQuery?.query).toContain('trace_id =');
      expect(listQuery?.query).toContain('span_id =');
      expect(listQuery?.query).toContain('parent_span_id =');
      expect(listQuery?.query).toContain('kind =');
    });
  });

  describe('getSpansForTrace', () => {
    it('should return all spans for a trace', async () => {
      const mockSpans = [
        {
          span_id: 's1',
          trace_id: 't1',
          parent_span_id: null,
          project_id: 'p1',
          deployment_id: 'd1',
          name: 'root-span',
          kind: 'server',
          status: 'ok',
          start_time: '2025-01-23T12:00:00.000Z',
          end_time: '2025-01-23T12:00:01.000Z',
          duration_ms: 1000,
          attributes: '{}',
          events: '[]',
        },
        {
          span_id: 's2',
          trace_id: 't1',
          parent_span_id: 's1',
          project_id: 'p1',
          deployment_id: 'd1',
          name: 'child-span',
          kind: 'internal',
          status: 'ok',
          start_time: '2025-01-23T12:00:00.100Z',
          end_time: '2025-01-23T12:00:00.500Z',
          duration_ms: 400,
          attributes: '{}',
          events: '[]',
        },
      ];
      const client = createMockClickHouseClient({ spans: mockSpans });
      const provider = new ClickHouseQueryProvider({
        clickhouse: { client: client as unknown as ClickHouseClient },
      });

      const result = await provider.getSpansForTrace('t1');

      expect(result).toHaveLength(2);
      expect(result[0]?.spanId).toBe('s1');
      expect(result[1]?.spanId).toBe('s2');
    });
  });

  describe('listLogs', () => {
    it('should return logs with correct transformation', async () => {
      const mockLogs = [
        {
          id: 'l1',
          project_id: 'p1',
          deployment_id: 'd1',
          trace_id: 't1',
          span_id: 's1',
          level: 'error',
          message: 'Something went wrong',
          timestamp: '2025-01-23T12:00:00.000Z',
          attributes: '{"error_code":500}',
        },
      ];
      const client = createMockClickHouseClient({ logs: mockLogs });
      const provider = new ClickHouseQueryProvider({
        clickhouse: { client: client as unknown as ClickHouseClient },
      });

      const result = await provider.listLogs();

      expect(result.logs).toHaveLength(1);
      expect(result.logs[0]?.id).toBe('l1');
      expect(result.logs[0]?.level).toBe('error');
      expect(result.logs[0]?.message).toBe('Something went wrong');
      expect(result.logs[0]?.traceId).toBe('t1');
      expect(result.logs[0]?.spanId).toBe('s1');
      expect(result.logs[0]?.attributes).toEqual({ error_code: 500 });
    });

    it('should apply log-specific filters', async () => {
      const client = createMockClickHouseClient({ logs: [] });
      const provider = new ClickHouseQueryProvider({
        clickhouse: { client: client as unknown as ClickHouseClient },
      });

      await provider.listLogs({
        level: 'error',
        traceId: 't1',
        spanId: 's1',
        message: 'error',
      });

      const listQuery = client.queries.find(q => !q.query.includes('count()'));
      expect(listQuery?.query).toContain('level =');
      expect(listQuery?.query).toContain('trace_id =');
      expect(listQuery?.query).toContain('span_id =');
      expect(listQuery?.query).toContain('message LIKE');
    });
  });

  describe('listMetrics', () => {
    it('should return metrics with correct transformation', async () => {
      const mockMetrics = [
        {
          id: 'm1',
          project_id: 'p1',
          deployment_id: 'd1',
          name: 'cpu_usage',
          type: 'gauge',
          value: 0.75,
          unit: 'percent',
          timestamp: '2025-01-23T12:00:00.000Z',
          labels: '{"host":"server-1"}',
        },
      ];
      const client = createMockClickHouseClient({ metrics: mockMetrics });
      const provider = new ClickHouseQueryProvider({
        clickhouse: { client: client as unknown as ClickHouseClient },
      });

      const result = await provider.listMetrics();

      expect(result.metrics).toHaveLength(1);
      expect(result.metrics[0]?.id).toBe('m1');
      expect(result.metrics[0]?.name).toBe('cpu_usage');
      expect(result.metrics[0]?.type).toBe('gauge');
      expect(result.metrics[0]?.value).toBe(0.75);
      expect(result.metrics[0]?.unit).toBe('percent');
      expect(result.metrics[0]?.labels).toEqual({ host: 'server-1' });
    });

    it('should apply metric-specific filters', async () => {
      const client = createMockClickHouseClient({ metrics: [] });
      const provider = new ClickHouseQueryProvider({
        clickhouse: { client: client as unknown as ClickHouseClient },
      });

      await provider.listMetrics({
        name: 'cpu_usage',
        type: 'gauge',
      });

      const listQuery = client.queries.find(q => !q.query.includes('count()'));
      expect(listQuery?.query).toContain('name =');
      expect(listQuery?.query).toContain('type =');
    });
  });

  describe('listScores', () => {
    it('should return scores with correct transformation', async () => {
      const mockScores = [
        {
          id: 'sc1',
          project_id: 'p1',
          deployment_id: 'd1',
          trace_id: 't1',
          name: 'quality_score',
          value: 0.95,
          normalized_value: 95,
          comment: 'High quality',
          timestamp: '2025-01-23T12:00:00.000Z',
          metadata: '{"evaluator":"gpt-4"}',
        },
      ];
      const client = createMockClickHouseClient({ scores: mockScores });
      const provider = new ClickHouseQueryProvider({
        clickhouse: { client: client as unknown as ClickHouseClient },
      });

      const result = await provider.listScores();

      expect(result.scores).toHaveLength(1);
      expect(result.scores[0]?.id).toBe('sc1');
      expect(result.scores[0]?.name).toBe('quality_score');
      expect(result.scores[0]?.value).toBe(0.95);
      expect(result.scores[0]?.normalizedValue).toBe(95);
      expect(result.scores[0]?.comment).toBe('High quality');
      expect(result.scores[0]?.traceId).toBe('t1');
      expect(result.scores[0]?.metadata).toEqual({ evaluator: 'gpt-4' });
    });

    it('should apply score-specific filters', async () => {
      const client = createMockClickHouseClient({ scores: [] });
      const provider = new ClickHouseQueryProvider({
        clickhouse: { client: client as unknown as ClickHouseClient },
      });

      await provider.listScores({
        name: 'quality',
        traceId: 't1',
        minValue: 0.5,
        maxValue: 1.0,
      });

      const listQuery = client.queries.find(q => !q.query.includes('count()'));
      expect(listQuery?.query).toContain('name =');
      expect(listQuery?.query).toContain('trace_id =');
      expect(listQuery?.query).toContain('value >=');
      expect(listQuery?.query).toContain('value <=');
    });
  });

  describe('getTraceCountTimeSeries', () => {
    it('should return time series data', async () => {
      const client = createMockClickHouseClient({ traces: [] });
      // Override query to return time series data
      client.query = vi.fn().mockResolvedValue({
        json: vi.fn().mockResolvedValue([
          { timestamp: '2025-01-23T12:00:00.000Z', count: 10 },
          { timestamp: '2025-01-23T13:00:00.000Z', count: 15 },
        ]),
      });

      const provider = new ClickHouseQueryProvider({
        clickhouse: { client: client as unknown as ClickHouseClient },
      });

      const result = await provider.getTraceCountTimeSeries({
        intervalSeconds: 3600,
        timeRange: {
          start: new Date('2025-01-23T00:00:00.000Z'),
          end: new Date('2025-01-23T23:59:59.999Z'),
        },
      });

      expect(result).toHaveLength(2);
      expect(result[0]?.count).toBe(10);
      expect(result[1]?.count).toBe(15);
      expect(result[0]?.timestamp).toBeInstanceOf(Date);
    });
  });

  describe('getErrorRateTimeSeries', () => {
    it('should return error rate time series data', async () => {
      const client = createMockClickHouseClient({ traces: [] });
      // Override query to return time series data
      client.query = vi.fn().mockResolvedValue({
        json: vi.fn().mockResolvedValue([
          { timestamp: '2025-01-23T12:00:00.000Z', count: 100, error_count: 5, error_rate: 0.05 },
          { timestamp: '2025-01-23T13:00:00.000Z', count: 200, error_count: 20, error_rate: 0.1 },
        ]),
      });

      const provider = new ClickHouseQueryProvider({
        clickhouse: { client: client as unknown as ClickHouseClient },
      });

      const result = await provider.getErrorRateTimeSeries({
        intervalSeconds: 3600,
        timeRange: {
          start: new Date('2025-01-23T00:00:00.000Z'),
          end: new Date('2025-01-23T23:59:59.999Z'),
        },
      });

      expect(result).toHaveLength(2);
      expect(result[0]?.count).toBe(100);
      expect(result[0]?.values?.errorCount).toBe(5);
      expect(result[0]?.values?.errorRate).toBe(0.05);
      expect(result[1]?.values?.errorRate).toBe(0.1);
    });
  });
});
