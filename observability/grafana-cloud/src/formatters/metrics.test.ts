import type { ExportedMetric } from '@mastra/core/observability';
import { describe, expect, it } from 'vitest';

import { formatMetricsForMimir } from './metrics';

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

describe('formatMetricsForMimir', () => {
  it('should produce valid OTLP JSON metrics structure', () => {
    const result = formatMetricsForMimir([makeMetric()], 'my-service');

    expect(result.resourceMetrics).toHaveLength(1);
    const rm = result.resourceMetrics[0]!;

    const serviceNameAttr = rm.resource.attributes.find(a => a.key === 'service.name');
    expect(serviceNameAttr?.value.stringValue).toBe('my-service');

    expect(rm.scopeMetrics).toHaveLength(1);
    expect(rm.scopeMetrics[0]!.scope.name).toBe('@mastra/grafana-cloud');
  });

  it('should format counter metrics as Sum', () => {
    const metric = makeMetric({
      metricType: 'counter',
      name: 'mastra_agent_runs_ended',
      value: 5,
      labels: { agent: 'support' },
    });

    const result = formatMetricsForMimir([metric], 'svc');
    const otlpMetric = result.resourceMetrics[0]!.scopeMetrics[0]!.metrics[0]!;

    expect(otlpMetric.name).toBe('mastra_agent_runs_ended');
    expect(otlpMetric.sum).toBeDefined();
    expect(otlpMetric.sum!.isMonotonic).toBe(true);
    expect(otlpMetric.sum!.dataPoints).toHaveLength(1);
    expect(otlpMetric.sum!.dataPoints[0]!.asDouble).toBe(5);

    const agentLabel = otlpMetric.sum!.dataPoints[0]!.attributes.find(a => a.key === 'agent');
    expect(agentLabel?.value.stringValue).toBe('support');
  });

  it('should format gauge metrics as Gauge', () => {
    const metric = makeMetric({
      metricType: 'gauge',
      name: 'mastra_active_runs',
      value: 42,
      labels: {},
    });

    const result = formatMetricsForMimir([metric], 'svc');
    const otlpMetric = result.resourceMetrics[0]!.scopeMetrics[0]!.metrics[0]!;

    expect(otlpMetric.name).toBe('mastra_active_runs');
    expect(otlpMetric.gauge).toBeDefined();
    expect(otlpMetric.gauge!.dataPoints).toHaveLength(1);
    expect(otlpMetric.gauge!.dataPoints[0]!.asDouble).toBe(42);
  });

  it('should format histogram metrics with correct buckets for duration', () => {
    const metric = makeMetric({
      metricType: 'histogram',
      name: 'mastra_agent_duration_ms',
      value: 250,
      labels: { agent: 'support' },
    });

    const result = formatMetricsForMimir([metric], 'svc');
    const otlpMetric = result.resourceMetrics[0]!.scopeMetrics[0]!.metrics[0]!;

    expect(otlpMetric.name).toBe('mastra_agent_duration_ms');
    expect(otlpMetric.histogram).toBeDefined();

    const dp = otlpMetric.histogram!.dataPoints[0]!;
    expect(dp.count).toBe('1');
    expect(dp.sum).toBe(250);

    // Duration buckets should be used
    expect(dp.explicitBounds).toContain(100);
    expect(dp.explicitBounds).toContain(500);
    expect(dp.explicitBounds).toContain(1000);

    // Value 250 should be in bucket [100, 500)
    const bucket500Idx = dp.explicitBounds.indexOf(500);
    expect(dp.bucketCounts[bucket500Idx]).toBe('1');
  });

  it('should format histogram metrics with token buckets for token metrics', () => {
    const metric = makeMetric({
      metricType: 'histogram',
      name: 'mastra_model_input_tokens',
      value: 1024,
      labels: {},
    });

    const result = formatMetricsForMimir([metric], 'svc');
    const otlpMetric = result.resourceMetrics[0]!.scopeMetrics[0]!.metrics[0]!;
    const dp = otlpMetric.histogram!.dataPoints[0]!;

    // Token buckets should be used
    expect(dp.explicitBounds).toContain(512);
    expect(dp.explicitBounds).toContain(2048);
  });

  it('should handle labels as OTLP attributes', () => {
    const metric = makeMetric({
      labels: { workflow: 'support', status: 'error', env: 'production' },
    });

    const result = formatMetricsForMimir([metric], 'svc');
    const otlpMetric = result.resourceMetrics[0]!.scopeMetrics[0]!.metrics[0]!;
    const dp = otlpMetric.sum!.dataPoints[0]!;

    const workflowAttr = dp.attributes.find(a => a.key === 'workflow');
    expect(workflowAttr?.value.stringValue).toBe('support');

    const statusAttr = dp.attributes.find(a => a.key === 'status');
    expect(statusAttr?.value.stringValue).toBe('error');
  });

  it('should handle multiple metrics in a batch', () => {
    const metrics = [
      makeMetric({ name: 'metric_1', value: 1 }),
      makeMetric({ name: 'metric_2', value: 2 }),
      makeMetric({ name: 'metric_3', value: 3 }),
    ];

    const result = formatMetricsForMimir(metrics, 'svc');
    expect(result.resourceMetrics[0]!.scopeMetrics[0]!.metrics).toHaveLength(3);
  });

  it('should convert timestamps to nanosecond strings', () => {
    const metric = makeMetric({ timestamp: new Date('2026-01-15T10:00:00.000Z') });

    const result = formatMetricsForMimir([metric], 'svc');
    const dp = result.resourceMetrics[0]!.scopeMetrics[0]!.metrics[0]!.sum!.dataPoints[0]!;

    const expectedMs = new Date('2026-01-15T10:00:00.000Z').getTime();
    expect(dp.timeUnixNano).toBe(`${BigInt(expectedMs) * 1_000_000n}`);
  });
});
