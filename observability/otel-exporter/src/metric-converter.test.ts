import type { ExportedMetric } from '@mastra/core/observability';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import { MetricInstrumentCache, convertLabels, getOtelInstrumentType } from './metric-converter';

describe('metric-converter', () => {
  describe('convertLabels', () => {
    it('should convert string labels to OTEL Attributes', () => {
      const labels = { agent: 'weather-bot', model: 'gpt-4' };
      const attrs = convertLabels(labels);
      expect(attrs.agent).toBe('weather-bot');
      expect(attrs.model).toBe('gpt-4');
    });

    it('should return empty object for empty labels', () => {
      const attrs = convertLabels({});
      expect(Object.keys(attrs).length).toBe(0);
    });
  });

  describe('getOtelInstrumentType', () => {
    it('should map counter to Counter', () => {
      expect(getOtelInstrumentType('counter')).toBe('Counter');
    });

    it('should map gauge to ObservableGauge', () => {
      expect(getOtelInstrumentType('gauge')).toBe('ObservableGauge');
    });

    it('should map histogram to Histogram', () => {
      expect(getOtelInstrumentType('histogram')).toBe('Histogram');
    });
  });

  describe('MetricInstrumentCache', () => {
    let mockMeter: any;
    let mockCounter: any;
    let mockHistogram: any;
    let mockGaugeCallbacks: Array<(result: any) => void>;

    beforeEach(() => {
      mockCounter = { add: vi.fn() };
      mockHistogram = { record: vi.fn() };
      mockGaugeCallbacks = [];

      mockMeter = {
        createCounter: vi.fn().mockReturnValue(mockCounter),
        createHistogram: vi.fn().mockReturnValue(mockHistogram),
        createObservableGauge: vi.fn().mockReturnValue({
          addCallback: vi.fn((cb: any) => mockGaugeCallbacks.push(cb)),
        }),
      };
    });

    it('should record counter metrics via OTEL counter', () => {
      const cache = new MetricInstrumentCache(mockMeter);

      const metric: ExportedMetric = {
        timestamp: new Date(),
        name: 'mastra_agent_calls',
        metricType: 'counter',
        value: 1,
        labels: { agent: 'test' },
      };

      cache.recordMetric(metric);

      expect(mockMeter.createCounter).toHaveBeenCalledWith('mastra_agent_calls', {
        description: 'Mastra counter: mastra_agent_calls',
      });
      expect(mockCounter.add).toHaveBeenCalledWith(1, { agent: 'test' });
    });

    it('should record histogram metrics via OTEL histogram', () => {
      const cache = new MetricInstrumentCache(mockMeter);

      const metric: ExportedMetric = {
        timestamp: new Date(),
        name: 'mastra_agent_duration_ms',
        metricType: 'histogram',
        value: 150.5,
        labels: { agent: 'test', model: 'gpt-4' },
      };

      cache.recordMetric(metric);

      expect(mockMeter.createHistogram).toHaveBeenCalledWith('mastra_agent_duration_ms', {
        description: 'Mastra histogram: mastra_agent_duration_ms',
      });
      expect(mockHistogram.record).toHaveBeenCalledWith(150.5, { agent: 'test', model: 'gpt-4' });
    });

    it('should record gauge metrics via OTEL observable gauge', () => {
      const cache = new MetricInstrumentCache(mockMeter);

      const metric: ExportedMetric = {
        timestamp: new Date(),
        name: 'mastra_active_agents',
        metricType: 'gauge',
        value: 5,
        labels: { environment: 'production' },
      };

      cache.recordMetric(metric);

      expect(mockMeter.createObservableGauge).toHaveBeenCalledWith('mastra_active_agents', {
        description: 'Mastra gauge: mastra_active_agents',
      });
    });

    it('should reuse instruments for the same metric name', () => {
      const cache = new MetricInstrumentCache(mockMeter);

      const metric1: ExportedMetric = {
        timestamp: new Date(),
        name: 'mastra_agent_calls',
        metricType: 'counter',
        value: 1,
        labels: { agent: 'a' },
      };
      const metric2: ExportedMetric = {
        timestamp: new Date(),
        name: 'mastra_agent_calls',
        metricType: 'counter',
        value: 3,
        labels: { agent: 'b' },
      };

      cache.recordMetric(metric1);
      cache.recordMetric(metric2);

      // Should only create the counter once
      expect(mockMeter.createCounter).toHaveBeenCalledTimes(1);
      expect(mockCounter.add).toHaveBeenCalledTimes(2);
    });

    it('should register observable gauge only once per metric name', () => {
      const cache = new MetricInstrumentCache(mockMeter);

      const metric1: ExportedMetric = {
        timestamp: new Date(),
        name: 'mastra_active_agents',
        metricType: 'gauge',
        value: 3,
        labels: { env: 'staging' },
      };
      const metric2: ExportedMetric = {
        timestamp: new Date(),
        name: 'mastra_active_agents',
        metricType: 'gauge',
        value: 7,
        labels: { env: 'production' },
      };

      cache.recordMetric(metric1);
      cache.recordMetric(metric2);

      // Should only create the observable gauge once
      expect(mockMeter.createObservableGauge).toHaveBeenCalledTimes(1);
    });

    it('should handle gauge callback reporting latest values', () => {
      const cache = new MetricInstrumentCache(mockMeter);

      cache.recordMetric({
        timestamp: new Date(),
        name: 'mastra_active_agents',
        metricType: 'gauge',
        value: 10,
        labels: { env: 'prod' },
      });

      // Simulate OTEL collecting metrics by invoking the callback
      const mockResult = { observe: vi.fn() };
      for (const cb of mockGaugeCallbacks) {
        cb(mockResult);
      }

      expect(mockResult.observe).toHaveBeenCalledWith(10, { env: 'prod' });
    });
  });
});
