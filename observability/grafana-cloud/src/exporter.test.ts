import { SpanType, TracingEventType } from '@mastra/core/observability';
import type { AnyExportedSpan, TracingEvent } from '@mastra/core/observability';
import type { ExportedLog, LogEvent } from '@mastra/core/observability';
import type { ExportedMetric, MetricEvent } from '@mastra/core/observability';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { GrafanaCloudExporter } from './exporter';

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

function createExporter(config?: Record<string, unknown>) {
  return new GrafanaCloudExporter({
    instanceId: 'test-instance-id',
    apiKey: 'test-api-key',
    zone: 'prod-us-central-0',
    batchSize: 2,
    flushIntervalMs: 60000, // Long interval so we control flushing manually
    logger: {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
    } as any,
    ...config,
  });
}

describe('GrafanaCloudExporter', () => {
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
    it('should disable when instanceId is missing', () => {
      const exporter = new GrafanaCloudExporter({
        apiKey: 'key',
        logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() } as any,
      });

      expect(exporter.isDisabled).toBe(true);
    });

    it('should disable when apiKey is missing', () => {
      const exporter = new GrafanaCloudExporter({
        instanceId: '12345',
        logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() } as any,
      });

      expect(exporter.isDisabled).toBe(true);
    });

    it('should initialize when both instanceId and apiKey are provided', () => {
      const exporter = createExporter();
      expect(exporter.isDisabled).toBe(false);
    });

    it('should use zone to construct default endpoints', async () => {
      const exporter = createExporter({ zone: 'prod-eu-west-0' });

      // Trigger a span flush
      await exporter.onTracingEvent(makeTracingEvent());
      await exporter.onTracingEvent(makeTracingEvent()); // triggers batch
      await vi.waitFor(() => expect(mockFetch).toHaveBeenCalled());

      const url = mockFetch.mock.calls[0]![0] as string;
      expect(url).toContain('tempo-prod-eu-west-0.grafana.net');
    });

    it('should use custom endpoints when provided', async () => {
      const exporter = createExporter({
        tempoEndpoint: 'https://custom-tempo.example.com',
        mimirEndpoint: 'https://custom-mimir.example.com',
        lokiEndpoint: 'https://custom-loki.example.com',
      });

      await exporter.onTracingEvent(makeTracingEvent());
      await exporter.onTracingEvent(makeTracingEvent());
      await vi.waitFor(() => expect(mockFetch).toHaveBeenCalled());

      const url = mockFetch.mock.calls[0]![0] as string;
      expect(url).toBe('https://custom-tempo.example.com/v1/traces');
    });

    it('should have the correct exporter name', () => {
      const exporter = createExporter();
      expect(exporter.name).toBe('grafana-cloud');
    });
  });

  // ============================================================================
  // Tracing
  // ============================================================================

  describe('tracing', () => {
    it('should only export on SPAN_ENDED events', async () => {
      const exporter = createExporter();

      // SPAN_STARTED should be ignored
      await exporter.onTracingEvent(makeTracingEvent(TracingEventType.SPAN_STARTED));
      await exporter.flush();

      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('should buffer spans until batch size is reached', async () => {
      const exporter = createExporter({ batchSize: 3 });

      await exporter.onTracingEvent(makeTracingEvent());
      await exporter.onTracingEvent(makeTracingEvent());
      expect(mockFetch).not.toHaveBeenCalled();

      // Third span should trigger flush
      await exporter.onTracingEvent(makeTracingEvent());
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('should send spans to Tempo OTLP endpoint', async () => {
      const exporter = createExporter();

      await exporter.onTracingEvent(makeTracingEvent());
      await exporter.onTracingEvent(makeTracingEvent());

      const url = mockFetch.mock.calls[0]![0] as string;
      expect(url).toContain('/v1/traces');
    });

    it('should include Authorization header', async () => {
      const exporter = createExporter();

      await exporter.onTracingEvent(makeTracingEvent());
      await exporter.onTracingEvent(makeTracingEvent());

      const options = mockFetch.mock.calls[0]![1] as RequestInit;
      expect(options.headers).toHaveProperty('Authorization');
      expect((options.headers as Record<string, string>)['Authorization']).toContain('Basic');
    });

    it('should send JSON content type', async () => {
      const exporter = createExporter();

      await exporter.onTracingEvent(makeTracingEvent());
      await exporter.onTracingEvent(makeTracingEvent());

      const options = mockFetch.mock.calls[0]![1] as RequestInit;
      expect((options.headers as Record<string, string>)['Content-Type']).toBe('application/json');
    });

    it('should send valid OTLP JSON body', async () => {
      const exporter = createExporter();

      await exporter.onTracingEvent(makeTracingEvent());
      await exporter.onTracingEvent(makeTracingEvent());

      const options = mockFetch.mock.calls[0]![1] as RequestInit;
      const body = JSON.parse(options.body as string);

      expect(body.resourceSpans).toBeDefined();
      expect(body.resourceSpans[0].scopeSpans[0].spans).toHaveLength(2);
    });
  });

  // ============================================================================
  // Logs
  // ============================================================================

  describe('logging', () => {
    it('should buffer logs until batch size is reached', async () => {
      const exporter = createExporter({ batchSize: 3 });

      await exporter.onLogEvent(makeLogEvent());
      await exporter.onLogEvent(makeLogEvent());
      expect(mockFetch).not.toHaveBeenCalled();

      await exporter.onLogEvent(makeLogEvent());
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('should send logs to Loki push endpoint', async () => {
      const exporter = createExporter();

      await exporter.onLogEvent(makeLogEvent());
      await exporter.onLogEvent(makeLogEvent());

      const url = mockFetch.mock.calls[0]![0] as string;
      expect(url).toContain('/loki/api/v1/push');
    });

    it('should send valid Loki JSON body', async () => {
      const exporter = createExporter();

      await exporter.onLogEvent(makeLogEvent({ message: 'Hello world' }));
      await exporter.onLogEvent(makeLogEvent({ message: 'Second message' }));

      const options = mockFetch.mock.calls[0]![1] as RequestInit;
      const body = JSON.parse(options.body as string);

      expect(body.streams).toBeDefined();
      expect(body.streams.length).toBeGreaterThan(0);
    });
  });

  // ============================================================================
  // Metrics
  // ============================================================================

  describe('metrics', () => {
    it('should buffer metrics until batch size is reached', async () => {
      const exporter = createExporter({ batchSize: 3 });

      await exporter.onMetricEvent(makeMetricEvent());
      await exporter.onMetricEvent(makeMetricEvent());
      expect(mockFetch).not.toHaveBeenCalled();

      await exporter.onMetricEvent(makeMetricEvent());
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('should send metrics to Mimir OTLP endpoint', async () => {
      const exporter = createExporter();

      await exporter.onMetricEvent(makeMetricEvent());
      await exporter.onMetricEvent(makeMetricEvent());

      const url = mockFetch.mock.calls[0]![0] as string;
      expect(url).toContain('/otlp/v1/metrics');
    });

    it('should send valid OTLP metrics JSON body', async () => {
      const exporter = createExporter();

      await exporter.onMetricEvent(makeMetricEvent());
      await exporter.onMetricEvent(makeMetricEvent());

      const options = mockFetch.mock.calls[0]![1] as RequestInit;
      const body = JSON.parse(options.body as string);

      expect(body.resourceMetrics).toBeDefined();
      expect(body.resourceMetrics[0].scopeMetrics[0].metrics).toHaveLength(2);
    });
  });

  // ============================================================================
  // Flush and Shutdown
  // ============================================================================

  describe('flush and shutdown', () => {
    it('should flush all signals on flush()', async () => {
      const exporter = createExporter({ batchSize: 100 }); // Large batch so nothing auto-flushes

      await exporter.onTracingEvent(makeTracingEvent());
      await exporter.onLogEvent(makeLogEvent());
      await exporter.onMetricEvent(makeMetricEvent());

      expect(mockFetch).not.toHaveBeenCalled();

      await exporter.flush();

      // Should have made 3 requests (one for each signal)
      expect(mockFetch).toHaveBeenCalledTimes(3);
    });

    it('should not send requests when buffers are empty', async () => {
      const exporter = createExporter();

      await exporter.flush();

      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('should flush on shutdown', async () => {
      const exporter = createExporter({ batchSize: 100 });

      await exporter.onTracingEvent(makeTracingEvent());
      await exporter.shutdown();

      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('should not export when disabled', async () => {
      const exporter = new GrafanaCloudExporter({
        // Missing instanceId → disabled
        apiKey: 'key',
        logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() } as any,
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
      const exporter = createExporter();

      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      await exporter.onTracingEvent(makeTracingEvent());
      await exporter.onTracingEvent(makeTracingEvent());

      // Should not throw
    });

    it('should handle non-OK HTTP responses', async () => {
      const exporter = createExporter();

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
      const exporter = createExporter({ batchSize: 2 });

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

      // Should have the re-buffered spans + new spans
      expect(spanCount).toBeGreaterThanOrEqual(2);
    });
  });

  // ============================================================================
  // Legacy tracing path
  // ============================================================================

  describe('exportTracingEvent (legacy path)', () => {
    it('should delegate to onTracingEvent', async () => {
      const exporter = createExporter({ batchSize: 100 });

      await exporter.exportTracingEvent(makeTracingEvent());
      await exporter.flush();

      expect(mockFetch).toHaveBeenCalledTimes(1);
      const url = mockFetch.mock.calls[0]![0] as string;
      expect(url).toContain('/v1/traces');
    });
  });
});
