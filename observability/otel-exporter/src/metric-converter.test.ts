import type { ExportedMetric } from '@mastra/core/observability';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import { MetricInstrumentCache, convertLabels } from './metric-converter';

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

  describe('MetricInstrumentCache', () => {
    let mockMeter: any;
    let mockHistogram: { record: ReturnType<typeof vi.fn> };

    beforeEach(() => {
      mockHistogram = { record: vi.fn() };
      mockMeter = {
        createHistogram: vi.fn().mockReturnValue(mockHistogram),
      };
    });

    function makeMetric(overrides: Partial<ExportedMetric> = {}): ExportedMetric {
      return {
        metricId: 'm1',
        timestamp: new Date(),
        name: 'mastra_agent_calls',
        value: 1,
        labels: { agent: 'weather-bot' },
        ...overrides,
      };
    }

    it('records a metric value through a Histogram with converted attributes', () => {
      const cache = new MetricInstrumentCache(mockMeter);

      cache.recordMetric(makeMetric({ value: 2 }));

      expect(mockMeter.createHistogram).toHaveBeenCalledWith('mastra_agent_calls', {
        description: expect.any(String),
      });
      expect(mockHistogram.record).toHaveBeenCalledWith(2, { agent: 'weather-bot' });
    });

    it('caches the histogram instrument by metric name', () => {
      const cache = new MetricInstrumentCache(mockMeter);

      cache.recordMetric(makeMetric({ value: 1 }));
      cache.recordMetric(makeMetric({ value: 5 }));

      expect(mockMeter.createHistogram).toHaveBeenCalledTimes(1);
      expect(mockHistogram.record).toHaveBeenNthCalledWith(1, 1, { agent: 'weather-bot' });
      expect(mockHistogram.record).toHaveBeenNthCalledWith(2, 5, { agent: 'weather-bot' });
    });

    it('creates a separate histogram per distinct metric name', () => {
      const cache = new MetricInstrumentCache(mockMeter);

      cache.recordMetric(makeMetric({ name: 'metric_a' }));
      cache.recordMetric(makeMetric({ name: 'metric_b' }));

      expect(mockMeter.createHistogram).toHaveBeenCalledTimes(2);
      expect(mockMeter.createHistogram).toHaveBeenNthCalledWith(1, 'metric_a', expect.any(Object));
      expect(mockMeter.createHistogram).toHaveBeenNthCalledWith(2, 'metric_b', expect.any(Object));
    });
  });
});
