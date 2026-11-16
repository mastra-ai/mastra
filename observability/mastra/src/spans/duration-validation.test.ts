import { SpanType, TracingEventType } from '@mastra/core/observability';
import type { ObservabilityEvent } from '@mastra/core/observability';
import { describe, expect, it, vi } from 'vitest';
import { DefaultObservabilityInstance } from '../instances';
import type { EndSpanOptionsWithTime } from './default';

describe('live span duration hardening (OBS-935)', () => {
  it.each(['explicit reversed end', 'backward clock', 'zero duration', 'positive duration'])(
    'delivers completion and a nonnegative duration metric for %s',
    async scenario => {
      vi.useFakeTimers({ toFake: ['Date'] });
      vi.setSystemTime(1000);
      const events: ObservabilityEvent[] = [];
      const instance = new DefaultObservabilityInstance({
        name: 'duration-test',
        serviceName: 'test',
        exporters: [
          {
            name: 'capture',
            exportTracingEvent: async event => {
              events.push(event);
            },
            onMetricEvent: event => {
              events.push(event);
            },
            flush: async () => {},
            shutdown: async () => {},
          },
        ],
      });
      try {
        const span = instance.startSpan({ name: 'work', type: SpanType.AGENT_RUN });
        await instance.flush();
        expect(events.some(event => event.type === TracingEventType.SPAN_STARTED)).toBe(true);
        vi.setSystemTime(scenario === 'backward clock' ? 999 : scenario === 'positive duration' ? 1001 : 1000);
        span.end(
          scenario === 'explicit reversed end'
            ? ({ endTime: new Date(999) } as EndSpanOptionsWithTime<SpanType.AGENT_RUN>)
            : undefined,
        );
        await instance.flush();
        const expectedDuration = scenario === 'positive duration' ? 1 : 0;
        expect(span.endTime).toEqual(new Date(1000 + expectedDuration));
        expect(events.find(event => event.type === TracingEventType.SPAN_ENDED)).toMatchObject({
          exportedSpan: { startTime: new Date(1000), endTime: new Date(1000 + expectedDuration) },
        });
        expect(events.filter(event => event.type === 'metric')).toEqual([
          expect.objectContaining({ metric: expect.objectContaining({ value: expectedDuration }) }),
        ]);
      } finally {
        await instance.shutdown();
        vi.useRealTimers();
      }
    },
  );
});
