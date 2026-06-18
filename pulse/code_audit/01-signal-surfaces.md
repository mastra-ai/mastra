# Signal Surfaces

This file lists the central observability surfaces in `packages/core/src`. These are the APIs that call sites use to initiate traditional observability signals.

## Event Type Definitions

| Signal | Location | Notes |
| --- | --- | --- |
| Span lifecycle | `packages/core/src/observability/types/tracing.ts:1395` | `TracingEventType.SPAN_STARTED`, `SPAN_UPDATED`, `SPAN_ENDED`; these correspond to traditional `span_start`, `span_update`, and `span_end` events. |
| Logs | `packages/core/src/observability/types/logging.ts:80` | `LogEvent` has `type: 'log'` and wraps an `ExportedLog`. |
| Metrics | `packages/core/src/observability/types/metrics.ts:119` | `MetricEvent` has `type: 'metric'` and wraps an `ExportedMetric`. |
| Scores | `packages/core/src/observability/types/scores.ts:129` | `ScoreEvent` has `type: 'score'`. |
| Feedback | `packages/core/src/observability/types/feedback.ts:128` | `FeedbackEvent` has `type: 'feedback'`. |
| Union bus event | `packages/core/src/observability/types/core.ts:148` | `ObservabilityEvent = TracingEvent | LogEvent | MetricEvent | ScoreEvent | FeedbackEvent`. |
| Drop event | `packages/core/src/observability/types/core.ts:171` | `ObservabilityDropEvent` has `type: 'drop'`; exporter pipeline diagnostic signal. |

## Emission APIs

| Surface | Location | Emits / Initiates |
| --- | --- | --- |
| `ObservabilityInstance.startSpan(...)` | `packages/core/src/observability/types/core.ts:217` | Starts a root span for a selected observability instance. |
| `ObservabilityInstance.rebuildSpan(...)` | `packages/core/src/observability/types/core.ts:226` | Rehydrates exported span data so durable workflows can later emit update/end/error lifecycle events. |
| `Span.createChildSpan(...)` | `packages/core/src/observability/types/tracing.ts:800` | Starts a child span from the current span. |
| `Span.end(...)` | `packages/core/src/observability/types/tracing.ts` | Ends a span; traditional `span_end`. |
| `Span.update(...)` | `packages/core/src/observability/types/tracing.ts` | Updates span attributes/metadata/output; traditional `span_update`. |
| `Span.error(...)` | `packages/core/src/observability/types/tracing.ts` | Records span error; may also end the span when `endSpan: true`. |
| `LoggerContext.*(...)` | `packages/core/src/observability/types/logging.ts:14` | Emits structured observability logs through levels `debug`, `info`, `warn`, `error`, `fatal`. |
| `MetricsContext.emit(...)` | `packages/core/src/observability/types/metrics.ts:21` | Emits one raw metric observation. |
| Deprecated metric instruments | `packages/core/src/observability/types/metrics.ts:24` | `counter`, `gauge`, `histogram` remain as deprecated emission APIs. |
| `ObservabilityEntrypoint.addScore(...)` | `packages/core/src/observability/types/core.ts:335` | Emits/attaches score without hydrating a recorded trace/span. |
| `ObservabilityEntrypoint.addFeedback(...)` | `packages/core/src/observability/types/core.ts:351` | Emits/attaches feedback without hydrating a recorded trace/span. |
| `RecordedSpan.addScore(...)` / `addFeedback(...)` | `packages/core/src/observability/types/tracing.ts:1055` | Emits score/feedback on a recorded span. |
| `RecordedTrace.addScore(...)` / `addFeedback(...)` | `packages/core/src/observability/types/tracing.ts:1100` | Emits score/feedback on a recorded trace. |

## Context Construction

| Location | Role |
| --- | --- |
| `packages/core/src/observability/context-factory.ts:20` | Derives a `LoggerContext` from the current span. |
| `packages/core/src/observability/context-factory.ts:31` | Derives a `MetricsContext` from the current span. |
| `packages/core/src/observability/context-factory.ts:50` | `createObservabilityContext(...)` returns tracing, logger, and metrics contexts. |
| `packages/core/src/observability/context-factory.ts:64` | `resolveObservabilityContext(...)` fills partial contexts with no-op or derived contexts. |
| `packages/core/src/observability/no-op.ts:28` | `noOpTracingContext` discards tracing when no current span exists. |
| `packages/core/src/observability/no-op.ts:39` | `noOpLoggerContext` discards structured logs. |
| `packages/core/src/observability/no-op.ts:52` | `noOpMetricsContext` discards metrics. |

## Infrastructure Logger Bridge

`packages/core/src/logger/dual-logger.ts` is important because it turns ordinary `IMastraLogger` calls into structured observability log emissions when a `LoggerContext` is available.

| Location | Behavior |
| --- | --- |
| `packages/core/src/logger/dual-logger.ts:36` | `debug(...)` forwards to `loggerVNext.debug(...)`. |
| `packages/core/src/logger/dual-logger.ts:41` | `info(...)` forwards to `loggerVNext.info(...)`. |
| `packages/core/src/logger/dual-logger.ts:46` | `warn(...)` forwards to `loggerVNext.warn(...)`. |
| `packages/core/src/logger/dual-logger.ts:51` | `error(...)` forwards to `loggerVNext.error(...)`. |
| `packages/core/src/logger/dual-logger.ts:56` | `trackException(...)` forwards to `loggerVNext.error(...)`. |
| `packages/core/src/logger/dual-logger.ts:93` | Resolves span-correlated logger from async span context first. |
| `packages/core/src/logger/dual-logger.ts:116` | Adapts variadic logger args into structured log data and emits the vNext log. |
