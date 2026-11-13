import { SpanType, TracingEventType } from '@mastra/core/observability';
import type { ObservabilityEvent, TracingEvent } from '@mastra/core/observability';
import { describe, expect, it } from 'vitest';
import { ObservabilityBus } from '../bus';
import { DefaultObservabilityInstance } from '../instances';
import type { EndSpanOptionsWithTime } from './default';

describe('negative span duration rejection (OBS-935)', () => {
  it.each([TracingEventType.SPAN_STARTED, TracingEventType.SPAN_UPDATED, TracingEventType.SPAN_ENDED])(
    'rejects malformed %s events before any exporter, bridge, or subscriber receives them',
    async type => {
      const bus = new ObservabilityBus();
      const deliveries: ObservabilityEvent[][] = [[], [], [], []];
      for (const [index, events] of deliveries.slice(0, 2).entries()) {
        bus.registerExporter({
          name: `capture-${index}`,
          exportTracingEvent: async event => {
            events.push(event);
          },
          flush: async () => {},
          shutdown: async () => {},
        });
      }
      bus.registerBridge({
        name: 'bridge',
        createSpan: () => undefined,
        exportTracingEvent: async event => {
          deliveries[2]!.push(event);
        },
        flush: async () => {},
        shutdown: async () => {},
      });
      bus.subscribe(event => {
        deliveries[3]!.push(event);
      });
      const base = {
        id: 'span',
        traceId: 'trace',
        name: 'work',
        type: SpanType.GENERIC,
        isRootSpan: true,
        isEvent: false,
        startTime: new Date(1000),
      };
      const malformed: TracingEvent = { type, exportedSpan: { ...base, endTime: new Date(999) } };
      bus.emit(malformed);
      const valid: TracingEvent[] = [undefined, new Date(1000), new Date(1001)].map(endTime => ({
        type,
        exportedSpan: { ...base, endTime },
      }));
      valid.forEach(event => bus.emit(event));
      await bus.flush();
      for (const events of deliveries) expect(events).toEqual(valid);
      expect(malformed.exportedSpan.endTime).toEqual(new Date(999));
    },
  );

  it('rejects an explicitly reversed end without replacing it or exporting a duration metric', async () => {
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
    const span = instance.startSpan({ name: 'work', type: SpanType.AGENT_RUN, startTime: new Date(1000) });
    span.end({ endTime: new Date(999) } as EndSpanOptionsWithTime<SpanType.AGENT_RUN>);
    await instance.flush();
    expect(span.endTime).toEqual(new Date(999));
    expect(events.filter(event => event.type === TracingEventType.SPAN_ENDED || event.type === 'metric')).toEqual([]);
    await instance.shutdown();
  });
});
