import type { ExportedMetric } from '@mastra/core/observability';
import SnappyJS from 'snappyjs';
import { describe, expect, it } from 'vitest';

import { formatMetricsForMimir, formatMetricsForMimirBinary } from './metrics';
import { encodeWriteRequest } from './protobuf';

function makeMetric(overrides: Partial<ExportedMetric> = {}): ExportedMetric {
  return {
    timestamp: new Date('2026-01-15T10:00:00.000Z'),
    name: 'mastra_agent_runs_ended',
    metricType: 'counter',
    value: 1,
    labels: { agent: 'support', status: 'ok' },
    ...overrides,
  };
}

describe('formatMetricsForMimir (Prometheus Remote Write)', () => {
  it('should produce a WriteRequest with timeseries', () => {
    const result = formatMetricsForMimir([makeMetric()], 'my-service');

    expect(result.timeseries).toBeDefined();
    expect(result.timeseries.length).toBeGreaterThan(0);
  });

  it('should include __name__ label with metric name', () => {
    const result = formatMetricsForMimir([makeMetric()], 'svc');
    const ts = result.timeseries[0]!;

    const nameLabel = ts.labels.find(l => l.name === '__name__');
    expect(nameLabel?.value).toBe('mastra_agent_runs_ended');
  });

  it('should include job label with service name', () => {
    const result = formatMetricsForMimir([makeMetric()], 'my-service');
    const ts = result.timeseries[0]!;

    const jobLabel = ts.labels.find(l => l.name === 'job');
    expect(jobLabel?.value).toBe('my-service');
  });

  it('should include metric labels', () => {
    const metric = makeMetric({
      labels: { agent: 'support', status: 'error' },
    });

    const result = formatMetricsForMimir([metric], 'svc');
    const ts = result.timeseries[0]!;

    const agentLabel = ts.labels.find(l => l.name === 'agent');
    expect(agentLabel?.value).toBe('support');

    const statusLabel = ts.labels.find(l => l.name === 'status');
    expect(statusLabel?.value).toBe('error');
  });

  it('should sort labels by name', () => {
    const metric = makeMetric({
      labels: { zebra: 'z', alpha: 'a' },
    });

    const result = formatMetricsForMimir([metric], 'svc');
    const ts = result.timeseries[0]!;
    const names = ts.labels.map(l => l.name);

    // Should be sorted: __name__, alpha, job, zebra
    expect(names).toEqual(['__name__', 'alpha', 'job', 'zebra']);
  });

  it('should use millisecond timestamps', () => {
    const metric = makeMetric({ timestamp: new Date('2026-01-15T10:00:00.000Z') });
    const result = formatMetricsForMimir([metric], 'svc');
    const ts = result.timeseries[0]!;

    expect(ts.samples[0]!.timestampMs).toBe(new Date('2026-01-15T10:00:00.000Z').getTime());
  });

  // Counter
  it('should format counter as a single time series', () => {
    const metric = makeMetric({
      metricType: 'counter',
      value: 5,
    });

    const result = formatMetricsForMimir([metric], 'svc');
    expect(result.timeseries).toHaveLength(1);
    expect(result.timeseries[0]!.samples[0]!.value).toBe(5);
  });

  // Gauge
  it('should format gauge as a single time series', () => {
    const metric = makeMetric({
      metricType: 'gauge',
      name: 'mastra_active_runs',
      value: 42,
      labels: {},
    });

    const result = formatMetricsForMimir([metric], 'svc');
    expect(result.timeseries).toHaveLength(1);

    const nameLabel = result.timeseries[0]!.labels.find(l => l.name === '__name__');
    expect(nameLabel?.value).toBe('mastra_active_runs');
    expect(result.timeseries[0]!.samples[0]!.value).toBe(42);
  });

  // Histogram
  it('should decompose histogram into _bucket, _sum, _count series', () => {
    const metric = makeMetric({
      metricType: 'histogram',
      name: 'mastra_agent_duration_ms',
      value: 250,
      labels: { agent: 'support' },
    });

    const result = formatMetricsForMimir([metric], 'svc');

    // Should have: N bucket series + 1 (+Inf) + _sum + _count
    const bucketSeries = result.timeseries.filter(ts =>
      ts.labels.some(l => l.name === '__name__' && l.value.endsWith('_bucket')),
    );
    const sumSeries = result.timeseries.filter(ts =>
      ts.labels.some(l => l.name === '__name__' && l.value.endsWith('_sum')),
    );
    const countSeries = result.timeseries.filter(ts =>
      ts.labels.some(l => l.name === '__name__' && l.value.endsWith('_count')),
    );

    expect(bucketSeries.length).toBeGreaterThan(0);
    expect(sumSeries).toHaveLength(1);
    expect(countSeries).toHaveLength(1);

    // _sum should be the observed value
    expect(sumSeries[0]!.samples[0]!.value).toBe(250);

    // _count should be 1 for a single observation
    expect(countSeries[0]!.samples[0]!.value).toBe(1);
  });

  it('should use cumulative bucket counts for histogram', () => {
    const metric = makeMetric({
      metricType: 'histogram',
      name: 'mastra_agent_duration_ms',
      value: 250, // Should be in bucket 500 (between 100 and 500)
      labels: {},
    });

    const result = formatMetricsForMimir([metric], 'svc');
    const bucketSeries = result.timeseries.filter(ts =>
      ts.labels.some(l => l.name === 'le'),
    );

    // Find specific buckets
    const bucket100 = bucketSeries.find(ts =>
      ts.labels.some(l => l.name === 'le' && l.value === '100'),
    );
    const bucket500 = bucketSeries.find(ts =>
      ts.labels.some(l => l.name === 'le' && l.value === '500'),
    );
    const bucketInf = bucketSeries.find(ts =>
      ts.labels.some(l => l.name === 'le' && l.value === '+Inf'),
    );

    // 250 > 100, so le=100 bucket should be 0
    expect(bucket100!.samples[0]!.value).toBe(0);
    // 250 <= 500, so le=500 bucket should be 1 (cumulative)
    expect(bucket500!.samples[0]!.value).toBe(1);
    // +Inf is always 1
    expect(bucketInf!.samples[0]!.value).toBe(1);
  });

  it('should use duration buckets for duration metrics', () => {
    const metric = makeMetric({
      metricType: 'histogram',
      name: 'mastra_agent_duration_ms',
      value: 250,
      labels: {},
    });

    const result = formatMetricsForMimir([metric], 'svc');
    const bucketSeries = result.timeseries.filter(ts =>
      ts.labels.some(l => l.name === 'le' && l.value !== '+Inf'),
    );

    const leValues = bucketSeries
      .map(ts => ts.labels.find(l => l.name === 'le')!.value)
      .map(Number);

    // Duration buckets should include 100, 500, 1000
    expect(leValues).toContain(100);
    expect(leValues).toContain(500);
    expect(leValues).toContain(1000);
  });

  it('should use token buckets for token metrics', () => {
    const metric = makeMetric({
      metricType: 'histogram',
      name: 'mastra_model_input_tokens',
      value: 1024,
      labels: {},
    });

    const result = formatMetricsForMimir([metric], 'svc');
    const bucketSeries = result.timeseries.filter(ts =>
      ts.labels.some(l => l.name === 'le' && l.value !== '+Inf'),
    );

    const leValues = bucketSeries
      .map(ts => ts.labels.find(l => l.name === 'le')!.value)
      .map(Number);

    // Token buckets should include 512, 2048
    expect(leValues).toContain(512);
    expect(leValues).toContain(2048);
  });

  it('should handle multiple metrics in a batch', () => {
    const metrics = [
      makeMetric({ name: 'metric_1', value: 1, labels: {} }),
      makeMetric({ name: 'metric_2', value: 2, labels: {} }),
      makeMetric({ name: 'metric_3', value: 3, labels: {} }),
    ];

    const result = formatMetricsForMimir(metrics, 'svc');
    // 3 counters = 3 time series
    expect(result.timeseries).toHaveLength(3);
  });

  // Binary encoding
  it('should produce snappy-compressed protobuf binary', () => {
    const metrics = [makeMetric()];
    const binary = formatMetricsForMimirBinary(metrics, 'svc');

    expect(binary).toBeInstanceOf(Uint8Array);
    expect(binary.length).toBeGreaterThan(0);

    // Should be decompressible with snappy
    const decompressed = new Uint8Array(SnappyJS.uncompress(binary));
    expect(decompressed.length).toBeGreaterThan(0);
  });

  it('should produce valid protobuf that round-trips through encode', () => {
    const metrics = [makeMetric({ value: 42, labels: { env: 'prod' } })];
    const request = formatMetricsForMimir(metrics, 'test-svc');

    // Encode to protobuf
    const protobuf = encodeWriteRequest(request);
    expect(protobuf).toBeInstanceOf(Uint8Array);
    expect(protobuf.length).toBeGreaterThan(0);

    // Compress and decompress should round-trip
    const compressed = SnappyJS.compress(protobuf);
    const decompressed = new Uint8Array(SnappyJS.uncompress(compressed));
    expect(decompressed).toEqual(protobuf);
  });
});
