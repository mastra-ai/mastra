/**
 * Shared event routing logic for observability handlers (exporters and bridges).
 *
 * Both ObservabilityExporter and ObservabilityBridge implement the same optional
 * signal handlers (onTracingEvent, onLogEvent, onMetricEvent, onScoreEvent,
 * onFeedbackEvent). This module provides a single routing function used by both
 * the ObservabilityBus (for exporters) and BaseObservabilityInstance (for bridges).
 */

import type { IMastraLogger } from '@mastra/core/logger';
import type {
  ObservabilityEvents,
  TracingEvent,
  LogEvent,
  MetricEvent,
  ScoreEvent,
  FeedbackEvent,
  ObservabilityEvent,
} from '@mastra/core/observability';
import { TracingEventType } from '@mastra/core/observability';

/**
 * Any handler that can receive routed observability events.
 * Both ObservabilityExporter and ObservabilityBridge extend
 * ObservabilityEvents, so this matches either.
 */
export type ObservabilityHandler = ObservabilityEvents & { name: string };

/**
 * Route a single event to the appropriate method on a handler.
 *
 * For tracing events, prefers onTracingEvent when present and falls back
 * to exportTracingEvent. For all other signals, calls the corresponding
 * optional handler method if the handler implements it.
 *
 * Async results are caught to prevent unhandled rejections.
 * Sync throws are caught so one failing handler doesn't break others.
 */
export function routeToHandler(handler: ObservabilityHandler, event: ObservabilityEvent, logger: IMastraLogger): void {
  try {
    switch (event.type) {
      case TracingEventType.SPAN_STARTED:
      case TracingEventType.SPAN_UPDATED:
      case TracingEventType.SPAN_ENDED: {
        const fn = handler.onTracingEvent
          ? handler.onTracingEvent.bind(handler)
          : handler.exportTracingEvent.bind(handler);
        catchAsyncResult(fn(event as TracingEvent), handler.name, 'tracing', logger);
        break;
      }

      case 'log':
        if (handler.onLogEvent) {
          catchAsyncResult(handler.onLogEvent(event as LogEvent), handler.name, 'log', logger);
        }
        break;

      case 'metric':
        if (handler.onMetricEvent) {
          catchAsyncResult(handler.onMetricEvent(event as MetricEvent), handler.name, 'metric', logger);
        }
        break;

      case 'score':
        if (handler.onScoreEvent) {
          catchAsyncResult(handler.onScoreEvent(event as ScoreEvent), handler.name, 'score', logger);
        }
        break;

      case 'feedback':
        if (handler.onFeedbackEvent) {
          catchAsyncResult(handler.onFeedbackEvent(event as FeedbackEvent), handler.name, 'feedback', logger);
        }
        break;
    }
  } catch (err) {
    logger.error(`[Observability] Handler error [handler=${handler.name}]:`, err);
  }
}

/** Catch rejected promises from async handlers without blocking. */
function catchAsyncResult(
  result: void | Promise<void>,
  handlerName: string,
  signal: string,
  logger: IMastraLogger,
): void {
  if (result && typeof (result as Promise<void>).catch === 'function') {
    (result as Promise<void>).catch(err => {
      logger.error(`[Observability] ${signal} handler error [handler=${handlerName}]:`, err);
    });
  }
}
