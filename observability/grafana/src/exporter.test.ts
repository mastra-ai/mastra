import { SpanType, TracingEventType } from '@mastra/core/observability';
import type { AnyExportedSpan, TracingEvent } from '@mastra/core/observability';
import type { ExportedLog, LogEvent } from '@mastra/core/observability';
import type { ExportedMetric, MetricEvent } from '@mastra/core/observability';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { grafana, grafanaCloud } from './config-helpers';
import { GrafanaExporter } from './exporter';

// Mock fetch globally
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

function makeSpan(overrides: Partial<AnyExportedSpan> = {}): AnyExportedSpan {
  return {
    id: 'span-1',
    traceId: 'trace-1',
    name: 'test-span',
    type: SpanType.AGENT_RUN,
    startTime: new Date('2026-01-15T10:00:00Z'),
    endTime: new Date('2026-01-15T10:00:01Z'),
    isRootSpan: true,
    isEvent: false,
    ...overrides,
  } as AnyExportedSpan;
}

function makeTracingEvent(
  type: TracingEventType = TracingEventType.SPAN_ENDED,
  span?: AnyExportedSpan,
): TracingEvent {
  return {
    type,
    exportedSpan: span ?? makeSpan(),
  };
}

function makeLogEvent(overrides: Partial<ExportedLog> = {}): LogEvent {
  return {
    type: 'log',
    log: {
      timestamp: new Date('2026-01-15T10:00:00Z'),
      level: 'info',
      message: 'Test log message',
      ...overrides,
    },
  };
}

function makeMetricEvent(overrides: Partial<ExportedMetric> = {}): MetricEvent {
  return {
    type: 'metric',
    metric: {
      timestamp: new Date('2026-01-15T10:00:00Z'),
      name: 'mastra_test_counter',
      metricType: 'counter',
      value: 1,
      labels: {},
      ...overrides,
    },
  };
}

const mockLogger = () =>
  ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }) as any;

function createCloudExporter(config?: Record<string, unknown>) {
  return new GrafanaExporter({
    ...grafanaCloud({
      instanceId: 'test-instance-id',
      apiKey: 'test-api-key',
      zone: 'prod-us-central-0',
    }),
    batchSize: 2,
    flushIntervalMs: 60000, // Long interval so we control flushing manually
    logger: mockLogger(),
    ...config,
  });
}

function createSelfHostedExporter(config?: Record<string, unknown>) {
  return new GrafanaExporter({
    ...grafana({
      tempoEndpoint: 'http://localhost:4318',
      mimirEndpoint: 'http://localhost:9090',
      lokiEndpoint: 'http://localhost:3100',
    }),
    batchSize: 2,
    flushIntervalMs: 60000,
    logger: mockLogger(),
    ...config,
  });
}

describe('GrafanaExporter', () => {
  beforeEach(() => {
    mockFetch.mockResolvedValue({ ok: true, text: () => Promise.resolve('') });
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.restoreAllMocks();
  });

  // ============================================================================
  // Configuration
  // ============================================================================

  describe('configuration', () => {
    it('should disable when no endpoints are configured', () => {
      const exporter = new GrafanaExporter({
        logger: mockLogger(),
      });

      expect(exporter.isDisabled).toBe(true);
    });

    it('should initialize with grafanaCloud() helper', () => {
      const exporter = createCloudExporter();
      expect(exporter.isDisabled).toBe(false);
    });

    it('should initialize with grafana() helper (self-hosted)', () => {
      const exporter = createSelfHostedExporter();
      expect(exporter.isDisabled).toBe(false);
    });

    it('should have the correct exporter name', () => {
      const exporter = createCloudExporter();
      expect(exporter.name).toBe('grafana');
    });
  });

  // ============================================================================
  // Config Helpers
  // ============================================================================

  describe('grafanaCloud() helper', () => {
    it('should construct zone-based endpoints', () => {
      const config = grafanaCloud({
        instanceId: '123',
        apiKey: 'key',
        zone: 'prod-eu-west-0',
      });

      expect(config.tempoEndpoint).toBe('https://otlp-gateway-prod-eu-west-0.grafana.net/otlp');
      expect(config.mimirEndpoint).toBe('https://otlp-gateway-prod-eu-west-0.grafana.net/otlp');
      expect(config.lokiEndpoint).toBe('https://logs-prod-eu-west-0.grafana.net');
    });

    it('should set Basic auth with instanceId:apiKey', () => {
      const config = grafanaCloud({
        instanceId: '123',
        apiKey: 'my-api-key',
      });

      expect(config.auth).toEqual({
        type: 'basic',
        username: '123',
        password: 'my-api-key',
      });
    });

    it('should set tenantId to instanceId', () => {
      const config = grafanaCloud({
        instanceId: '123',
        apiKey: 'key',
      });

      expect(config.tenantId).toBe('123');
    });

    it('should set per-service auth when per-service instance IDs differ', () => {
      const config = grafanaCloud({
        tempoInstanceId: '111',
        mimirInstanceId: '222',
        lokiInstanceId: '333',
        apiKey: 'my-api-key',
      });

      // Should NOT have shared auth when IDs differ
      expect(config.auth).toBeUndefined();
      expect(config.tenantId).toBeUndefined();

      // Should have per-service auth
      expect(config.tempoAuth).toEqual({ type: 'basic', username: '111', password: 'my-api-key' });
      expect(config.mimirAuth).toEqual({ type: 'basic', username: '222', password: 'my-api-key' });
      expect(config.lokiAuth).toEqual({ type: 'basic', username: '333', password: 'my-api-key' });

      // Should have per-service tenant IDs
      expect(config.tempoTenantId).toBe('111');
      expect(config.mimirTenantId).toBe('222');
      expect(config.lokiTenantId).toBe('333');
    });

    it('should use shared auth when all per-service instance IDs are the same', () => {
      const config = grafanaCloud({
        tempoInstanceId: '123',
        mimirInstanceId: '123',
        lokiInstanceId: '123',
        apiKey: 'my-api-key',
      });

      // Should use shared auth
      expect(config.auth).toEqual({ type: 'basic', username: '123', password: 'my-api-key' });
      expect(config.tenantId).toBe('123');

      // Per-service auth should NOT be set
      expect(config.tempoAuth).toBeUndefined();
      expect(config.mimirAuth).toBeUndefined();
      expect(config.lokiAuth).toBeUndefined();
    });

    it('should fall back per-service instance IDs to default instanceId', () => {
      const config = grafanaCloud({
        instanceId: '999',
        tempoInstanceId: '111',
        apiKey: 'key',
      });

      // Tempo uses its own ID, Mimir and Loki fall back to instanceId
      // Since they differ, per-service auth should be set
      expect(config.tempoAuth).toEqual({ type: 'basic', username: '111', password: 'key' });
      expect(config.mimirAuth).toEqual({ type: 'basic', username: '999', password: 'key' });
      expect(config.lokiAuth).toEqual({ type: 'basic', username: '999', password: 'key' });
    });

    it('should allow endpoint overrides', () => {
      const config = grafanaCloud({
        instanceId: '123',
        apiKey: 'key',
        tempoEndpoint: 'https://custom-tempo.example.com',
      });

      expect(config.tempoEndpoint).toBe('https://custom-tempo.example.com');
    });

    it('should use default zone when not specified', () => {
      const config = grafanaCloud({
        instanceId: '123',
        apiKey: 'key',
      });

      expect(config.tempoEndpoint).toContain('prod-us-central-0');
    });
  });

  describe('grafana() helper', () => {
    it('should pass through endpoints directly', () => {
      const config = grafana({
        tempoEndpoint: 'http://tempo:4318',
        mimirEndpoint: 'http://mimir:9090',
        lokiEndpoint: 'http://loki:3100',
      });

      expect(config.tempoEndpoint).toBe('http://tempo:4318');
      expect(config.mimirEndpoint).toBe('http://mimir:9090');
      expect(config.lokiEndpoint).toBe('http://loki:3100');
    });

    it('should default to no auth', () => {
      const config = grafana({
        tempoEndpoint: 'http://localhost:4318',
      });

      expect(config.auth).toEqual({ type: 'none' });
    });

    it('should support bearer auth', () => {
      const config = grafana({
        tempoEndpoint: 'http://localhost:4318',
        auth: { type: 'bearer', token: 'my-token' },
      });

      expect(config.auth).toEqual({ type: 'bearer', token: 'my-token' });
    });

    it('should support custom headers auth', () => {
      const config = grafana({
        tempoEndpoint: 'http://localhost:4318',
        auth: { type: 'custom', headers: { 'X-Custom-Auth': 'secret' } },
      });

      expect(config.auth).toEqual({
        type: 'custom',
        headers: { 'X-Custom-Auth': 'secret' },
      });
    });

    it('should support tenantId for multi-tenant', () => {
      const config = grafana({
        tempoEndpoint: 'http://localhost:4318',
        tenantId: 'my-org',
      });

      expect(config.tenantId).toBe('my-org');
    });
  });

  // ============================================================================
  // Auth Headers
  // ============================================================================

  describe('auth headers', () => {
    it('should send Basic auth for grafanaCloud config', async () => {
      const exporter = createCloudExporter();

      await exporter.onTracingEvent(makeTracingEvent());
      await exporter.onTracingEvent(makeTracingEvent());

      const options = mockFetch.mock.calls[0]![1] as RequestInit;
      const headers = options.headers as Record<string, string>;
      expect(headers['Authorization']).toContain('Basic');
    });

    it('should send Bearer auth when configured', async () => {
      const exporter = new GrafanaExporter({
        ...grafana({
          tempoEndpoint: 'http://localhost:4318',
          auth: { type: 'bearer', token: 'my-token' },
        }),
        batchSize: 2,
        flushIntervalMs: 60000,
        logger: mockLogger(),
      });

      await exporter.onTracingEvent(makeTracingEvent());
      await exporter.onTracingEvent(makeTracingEvent());

      const options = mockFetch.mock.calls[0]![1] as RequestInit;
      const headers = options.headers as Record<string, string>;
      expect(headers['Authorization']).toBe('Bearer my-token');
    });

    it('should send no auth header when auth is none', async () => {
      const exporter = createSelfHostedExporter();

      await exporter.onTracingEvent(makeTracingEvent());
      await exporter.onTracingEvent(makeTracingEvent());

      const options = mockFetch.mock.calls[0]![1] as RequestInit;
      const headers = options.headers as Record<string, string>;
      expect(headers['Authorization']).toBeUndefined();
    });

    it('should send X-Scope-OrgID when tenantId is set', async () => {
      const exporter = createCloudExporter();

      await exporter.onTracingEvent(makeTracingEvent());
      await exporter.onTracingEvent(makeTracingEvent());

      const options = mockFetch.mock.calls[0]![1] as RequestInit;
      const headers = options.headers as Record<string, string>;
      expect(headers['X-Scope-OrgID']).toBe('test-instance-id');
    });

    it('should not send X-Scope-OrgID when tenantId is not set', async () => {
      const exporter = createSelfHostedExporter();

      await exporter.onTracingEvent(makeTracingEvent());
      await exporter.onTracingEvent(makeTracingEvent());

      const options = mockFetch.mock.calls[0]![1] as RequestInit;
      const headers = options.headers as Record<string, string>;
      expect(headers['X-Scope-OrgID']).toBeUndefined();
    });

    it('should send per-service auth headers and tenant IDs', async () => {
      const exporter = new GrafanaExporter({
        ...grafanaCloud({
          tempoInstanceId: '111',
          mimirInstanceId: '222',
          lokiInstanceId: '333',
          apiKey: 'test-key',
        }),
        batchSize: 1,
        flushIntervalMs: 60000,
        logger: mockLogger(),
      });

      // Send one of each signal type to trigger flushes
      await exporter.onTracingEvent(makeTracingEvent());
      await exporter.onMetricEvent(makeMetricEvent());
      await exporter.onLogEvent(makeLogEvent());

      expect(mockFetch).toHaveBeenCalledTimes(3);

      // Find each call by URL
      const calls = mockFetch.mock.calls.map((c: unknown[]) => ({
        url: c[0] as string,
        headers: (c[1] as RequestInit).headers as Record<string, string>,
      }));

      const tempoCall = calls.find(c => c.url.includes('/v1/traces'));
      const mimirCall = calls.find(c => c.url.includes('/v1/metrics'));
      const lokiCall = calls.find(c => c.url.includes('/loki/api/v1/push'));

      // Verify per-service tenant IDs
      expect(tempoCall!.headers['X-Scope-OrgID']).toBe('111');
      expect(mimirCall!.headers['X-Scope-OrgID']).toBe('222');
      expect(lokiCall!.headers['X-Scope-OrgID']).toBe('333');

      // Verify per-service Basic auth (each uses its own instance ID as username)
      expect(tempoCall!.headers['Authorization']).toBe(`Basic ${btoa('111:test-key')}`);
      expect(mimirCall!.headers['Authorization']).toBe(`Basic ${btoa('222:test-key')}`);
      expect(lokiCall!.headers['Authorization']).toBe(`Basic ${btoa('333:test-key')}`);
    });
  });

  // ============================================================================
  // URL Construction
  // ============================================================================

  describe('URL construction', () => {
    it('should normalize endpoints without protocol by adding https://', async () => {
      const exporter = new GrafanaExporter({
        tempoEndpoint: 'tempo-prod-30.grafana.net:443',
        batchSize: 1,
        flushIntervalMs: 60000,
        logger: mockLogger(),
      });

      await exporter.onTracingEvent(makeTracingEvent());

      const url = mockFetch.mock.calls[0]![0] as string;
      expect(url).toBe('https://tempo-prod-30.grafana.net:443/v1/traces');
    });

    it('should strip trailing slashes from endpoints', async () => {
      const exporter = new GrafanaExporter({
        tempoEndpoint: 'https://tempo.example.com/',
        batchSize: 1,
        flushIntervalMs: 60000,
        logger: mockLogger(),
      });

      await exporter.onTracingEvent(makeTracingEvent());

      const url = mockFetch.mock.calls[0]![0] as string;
      expect(url).toBe('https://tempo.example.com/v1/traces');
    });

    it('should not double-append /v1/traces if endpoint already includes it', async () => {
      const exporter = new GrafanaExporter({
        tempoEndpoint: 'https://tempo.example.com/v1/traces',
        batchSize: 1,
        flushIntervalMs: 60000,
        logger: mockLogger(),
      });

      await exporter.onTracingEvent(makeTracingEvent());

      const url = mockFetch.mock.calls[0]![0] as string;
      expect(url).toBe('https://tempo.example.com/v1/traces');
    });

    it('should not double-append /v1/metrics if endpoint already includes it', async () => {
      const exporter = new GrafanaExporter({
        mimirEndpoint: 'https://mimir.example.com/otlp/v1/metrics',
        batchSize: 1,
        flushIntervalMs: 60000,
        logger: mockLogger(),
      });

      await exporter.onMetricEvent(makeMetricEvent());

      const url = mockFetch.mock.calls[0]![0] as string;
      expect(url).toBe('https://mimir.example.com/otlp/v1/metrics');
    });

    it('should not double-append /loki/api/v1/push if endpoint already includes it', async () => {
      const exporter = new GrafanaExporter({
        lokiEndpoint: 'https://logs-prod-042.grafana.net/loki/api/v1/push',
        batchSize: 1,
        flushIntervalMs: 60000,
        logger: mockLogger(),
      });

      await exporter.onLogEvent(makeLogEvent());

      const url = mockFetch.mock.calls[0]![0] as string;
      expect(url).toBe('https://logs-prod-042.grafana.net/loki/api/v1/push');
    });

    it('should handle real Grafana Cloud direct endpoints correctly', async () => {
      const exporter = new GrafanaExporter({
        tempoEndpoint: 'tempo-prod-30-prod-us-east-3.grafana.net:443',
        lokiEndpoint: 'logs-prod-042.grafana.net',
        mimirEndpoint: 'https://otlp-gateway-prod-us-east-3.grafana.net/otlp',
        auth: { type: 'basic', username: '123', password: 'key' },
        batchSize: 1,
        flushIntervalMs: 60000,
        logger: mockLogger(),
      });

      await exporter.onTracingEvent(makeTracingEvent());
      await exporter.onLogEvent(makeLogEvent());
      await exporter.onMetricEvent(makeMetricEvent());

      const urls = mockFetch.mock.calls.map((c: unknown[]) => c[0] as string);

      expect(urls).toContain('https://tempo-prod-30-prod-us-east-3.grafana.net:443/v1/traces');
      expect(urls).toContain('https://logs-prod-042.grafana.net/loki/api/v1/push');
      expect(urls).toContain('https://otlp-gateway-prod-us-east-3.grafana.net/otlp/v1/metrics');
    });
  });

  // ============================================================================
  // Tracing
  // ============================================================================

  describe('tracing', () => {
    it('should only export on SPAN_ENDED events', async () => {
      const exporter = createCloudExporter();

      await exporter.onTracingEvent(makeTracingEvent(TracingEventType.SPAN_STARTED));
      await exporter.flush();

      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('should buffer spans until batch size is reached', async () => {
      const exporter = createCloudExporter({ batchSize: 3 });

      await exporter.onTracingEvent(makeTracingEvent());
      await exporter.onTracingEvent(makeTracingEvent());
      expect(mockFetch).not.toHaveBeenCalled();

      await exporter.onTracingEvent(makeTracingEvent());
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('should send spans to Tempo OTLP endpoint', async () => {
      const exporter = createCloudExporter();

      await exporter.onTracingEvent(makeTracingEvent());
      await exporter.onTracingEvent(makeTracingEvent());

      const url = mockFetch.mock.calls[0]![0] as string;
      expect(url).toContain('/v1/traces');
    });

    it('should send JSON content type', async () => {
      const exporter = createCloudExporter();

      await exporter.onTracingEvent(makeTracingEvent());
      await exporter.onTracingEvent(makeTracingEvent());

      const options = mockFetch.mock.calls[0]![1] as RequestInit;
      expect((options.headers as Record<string, string>)['Content-Type']).toBe('application/json');
    });

    it('should send valid OTLP JSON body', async () => {
      const exporter = createCloudExporter();

      await exporter.onTracingEvent(makeTracingEvent());
      await exporter.onTracingEvent(makeTracingEvent());

      const options = mockFetch.mock.calls[0]![1] as RequestInit;
      const body = JSON.parse(options.body as string);

      expect(body.resourceSpans).toBeDefined();
      expect(body.resourceSpans[0].scopeSpans[0].spans).toHaveLength(2);
    });

    it('should skip traces when tempoEndpoint is not set', async () => {
      const exporter = new GrafanaExporter({
        ...grafana({ lokiEndpoint: 'http://localhost:3100' }),
        batchSize: 1,
        flushIntervalMs: 60000,
        logger: mockLogger(),
      });

      await exporter.onTracingEvent(makeTracingEvent());
      await exporter.flush();

      expect(mockFetch).not.toHaveBeenCalled();
    });
  });

  // ============================================================================
  // Logs
  // ============================================================================

  describe('logging', () => {
    it('should buffer logs until batch size is reached', async () => {
      const exporter = createCloudExporter({ batchSize: 3 });

      await exporter.onLogEvent(makeLogEvent());
      await exporter.onLogEvent(makeLogEvent());
      expect(mockFetch).not.toHaveBeenCalled();

      await exporter.onLogEvent(makeLogEvent());
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('should send logs to Loki push endpoint', async () => {
      const exporter = createCloudExporter();

      await exporter.onLogEvent(makeLogEvent());
      await exporter.onLogEvent(makeLogEvent());

      const url = mockFetch.mock.calls[0]![0] as string;
      expect(url).toContain('/loki/api/v1/push');
    });

    it('should send valid Loki JSON body', async () => {
      const exporter = createCloudExporter();

      await exporter.onLogEvent(makeLogEvent({ message: 'Hello world' }));
      await exporter.onLogEvent(makeLogEvent({ message: 'Second message' }));

      const options = mockFetch.mock.calls[0]![1] as RequestInit;
      const body = JSON.parse(options.body as string);

      expect(body.streams).toBeDefined();
      expect(body.streams.length).toBeGreaterThan(0);
    });

    it('should skip logs when lokiEndpoint is not set', async () => {
      const exporter = new GrafanaExporter({
        ...grafana({ tempoEndpoint: 'http://localhost:4318' }),
        batchSize: 1,
        flushIntervalMs: 60000,
        logger: mockLogger(),
      });

      await exporter.onLogEvent(makeLogEvent());
      await exporter.flush();

      expect(mockFetch).not.toHaveBeenCalled();
    });
  });

  // ============================================================================
  // Metrics
  // ============================================================================

  describe('metrics', () => {
    it('should buffer metrics until batch size is reached', async () => {
      const exporter = createCloudExporter({ batchSize: 3 });

      await exporter.onMetricEvent(makeMetricEvent());
      await exporter.onMetricEvent(makeMetricEvent());
      expect(mockFetch).not.toHaveBeenCalled();

      await exporter.onMetricEvent(makeMetricEvent());
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('should send metrics to Mimir OTLP endpoint', async () => {
      const exporter = createCloudExporter();

      await exporter.onMetricEvent(makeMetricEvent());
      await exporter.onMetricEvent(makeMetricEvent());

      const url = mockFetch.mock.calls[0]![0] as string;
      expect(url).toContain('/v1/metrics');
    });

    it('should send valid OTLP metrics JSON body', async () => {
      const exporter = createCloudExporter();

      await exporter.onMetricEvent(makeMetricEvent());
      await exporter.onMetricEvent(makeMetricEvent());

      const options = mockFetch.mock.calls[0]![1] as RequestInit;
      const body = JSON.parse(options.body as string);

      expect(body.resourceMetrics).toBeDefined();
      expect(body.resourceMetrics[0].scopeMetrics[0].metrics).toHaveLength(2);
    });

    it('should skip metrics when mimirEndpoint is not set', async () => {
      const exporter = new GrafanaExporter({
        ...grafana({ tempoEndpoint: 'http://localhost:4318' }),
        batchSize: 1,
        flushIntervalMs: 60000,
        logger: mockLogger(),
      });

      await exporter.onMetricEvent(makeMetricEvent());
      await exporter.flush();

      expect(mockFetch).not.toHaveBeenCalled();
    });
  });

  // ============================================================================
  // Flush and Shutdown
  // ============================================================================

  describe('flush and shutdown', () => {
    it('should flush all signals on flush()', async () => {
      const exporter = createCloudExporter({ batchSize: 100 });

      await exporter.onTracingEvent(makeTracingEvent());
      await exporter.onLogEvent(makeLogEvent());
      await exporter.onMetricEvent(makeMetricEvent());

      expect(mockFetch).not.toHaveBeenCalled();

      await exporter.flush();

      // Should have made 3 requests (one for each signal)
      expect(mockFetch).toHaveBeenCalledTimes(3);
    });

    it('should not send requests when buffers are empty', async () => {
      const exporter = createCloudExporter();

      await exporter.flush();

      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('should flush on shutdown', async () => {
      const exporter = createCloudExporter({ batchSize: 100 });

      await exporter.onTracingEvent(makeTracingEvent());
      await exporter.shutdown();

      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('should not export when disabled', async () => {
      const exporter = new GrafanaExporter({
        // No endpoints → disabled
        logger: mockLogger(),
      });

      await exporter.onTracingEvent(makeTracingEvent());
      await exporter.onLogEvent(makeLogEvent());
      await exporter.onMetricEvent(makeMetricEvent());
      await exporter.flush();

      expect(mockFetch).not.toHaveBeenCalled();
    });
  });

  // ============================================================================
  // Error Handling
  // ============================================================================

  describe('error handling', () => {
    it('should handle fetch errors gracefully', async () => {
      const exporter = createCloudExporter();

      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      await exporter.onTracingEvent(makeTracingEvent());
      await exporter.onTracingEvent(makeTracingEvent());

      // Should not throw
    });

    it('should handle non-OK HTTP responses', async () => {
      const exporter = createCloudExporter();

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 429,
        statusText: 'Too Many Requests',
        text: () => Promise.resolve('rate limited'),
      });

      await exporter.onTracingEvent(makeTracingEvent());
      await exporter.onTracingEvent(makeTracingEvent());

      // Should not throw - error is logged internally
    });

    it('should re-buffer spans on export failure (up to limit)', async () => {
      const exporter = createCloudExporter({ batchSize: 2 });

      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      // First batch fails
      await exporter.onTracingEvent(makeTracingEvent());
      await exporter.onTracingEvent(makeTracingEvent());

      // Spans should be re-buffered. Next successful flush should include them.
      mockFetch.mockResolvedValueOnce({ ok: true, text: () => Promise.resolve('') });

      await exporter.onTracingEvent(makeTracingEvent());
      await exporter.onTracingEvent(makeTracingEvent());

      // The second call should include the re-buffered spans + new spans
      const lastCallOptions = mockFetch.mock.calls[mockFetch.mock.calls.length - 1]![1] as RequestInit;
      const body = JSON.parse(lastCallOptions.body as string);
      const spanCount = body.resourceSpans[0].scopeSpans[0].spans.length;

      expect(spanCount).toBeGreaterThanOrEqual(2);
    });
  });

  // ============================================================================
  // Legacy tracing path
  // ============================================================================

  describe('exportTracingEvent (legacy path)', () => {
    it('should delegate to onTracingEvent', async () => {
      const exporter = createCloudExporter({ batchSize: 100 });

      await exporter.exportTracingEvent(makeTracingEvent());
      await exporter.flush();

      expect(mockFetch).toHaveBeenCalledTimes(1);
      const url = mockFetch.mock.calls[0]![0] as string;
      expect(url).toContain('/v1/traces');
    });
  });
});
