import { Observability } from '../../../../../../observability/mastra/src/default';
import type { SamplingStrategy } from '../../../../../../observability/mastra/src/config';
import type { LogEvent, TracingEvent } from '../../../observability';
import { SpanType, TracingEventType } from '../../../observability';

export function captureOutcomeEvents(sampling?: SamplingStrategy) {
  const events: TracingEvent[] = [];
  const logs: LogEvent[] = [];
  const observability = new Observability({
    configs: {
      default: {
        serviceName: 'outcomes',
        logging: { level: 'info' },
        sampling,
        exporters: [
          {
            name: 'capture',
            onLogEvent: event => void logs.push(event),
            exportTracingEvent: async event => void events.push(event),
            shutdown: async () => {},
            flush: async () => {},
          },
        ],
      },
    },
  });
  const ended = (type: SpanType = SpanType.AGENT_RUN) =>
    events.filter(e => e.type === TracingEventType.SPAN_ENDED && e.exportedSpan.type === type).map(e => e.exportedSpan);
  return { events, logs, observability, ended };
}
