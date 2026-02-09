import type { FeedbackEvent } from './feedback';
import type { LogEvent } from './logging';
import type { MetricEvent } from './metrics';
import type { ScoreEvent } from './scores';
import type { TracingEvent } from './tracing';

export interface ObservabilityEventBus<TEvent> {
  emit(event: TEvent): void;
  subscribe(handler: (event: TEvent) => void): () => void;
  flush(): Promise<void>;
  shutdown(): Promise<void>;
}

// Union of all observability events
export type ObservabilityEvent = TracingEvent | LogEvent | MetricEvent | ScoreEvent | FeedbackEvent;
