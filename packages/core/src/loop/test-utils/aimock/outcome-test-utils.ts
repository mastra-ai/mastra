import { Observability } from '../../../../../../observability/mastra/src/default';
import type { TracingEvent } from '../../../observability';
import { SpanType, TracingEventType } from '../../../observability';

export function captureOutcomeEvents() {
  const events: TracingEvent[] = [];
  const observability = new Observability({
    configs: {
      default: {
        serviceName: 'outcomes',
        exporters: [
          {
            name: 'capture',
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
  return { events, observability, ended };
}
