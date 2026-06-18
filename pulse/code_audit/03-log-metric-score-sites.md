# Log, Metric, Score, and Feedback Sites

This file covers non-span traditional observability signals in `packages/core/src`.

## Structured Log Emission

Core has two structured-log paths:

1. Direct `LoggerContext` / `loggerVNext` usage.
2. Transparent dual-write from `IMastraLogger` through `DualLogger`.

### Direct `loggerVNext`

There are no direct production call sites of `loggerVNext.debug/info/warn/error/fatal(...)` in `packages/core/src` outside the bridge and type docs.

The public accessor exists here:

| Location | Signal |
| --- | --- |
| `packages/core/src/mastra/index.ts:3819` | `mastra.loggerVNext` returns the default observability instance's `LoggerContext`, or a no-op logger. |

### `DualLogger` Bridge

`DualLogger` is the main structured log emission bridge. Once installed, ordinary `IMastraLogger` calls can emit observability `LogEvent` records.

| Location | Behavior |
| --- | --- |
| `packages/core/src/mastra/index.ts:1227` | Constructor wraps the configured logger in `DualLogger`, using `this.loggerVNext` as the lazy destination. |
| `packages/core/src/mastra/index.ts:3680` | `setLogger(...)` wraps replacement loggers in `DualLogger`. |
| `packages/core/src/logger/dual-logger.ts:36` | `debug(...)` dual-writes to `loggerVNext.debug(...)`. |
| `packages/core/src/logger/dual-logger.ts:41` | `info(...)` dual-writes to `loggerVNext.info(...)`. |
| `packages/core/src/logger/dual-logger.ts:46` | `warn(...)` dual-writes to `loggerVNext.warn(...)`. |
| `packages/core/src/logger/dual-logger.ts:51` | `error(...)` dual-writes to `loggerVNext.error(...)`. |
| `packages/core/src/logger/dual-logger.ts:56` | `trackException(...)` emits an observability error log with normalized error fields. |
| `packages/core/src/logger/dual-logger.ts:109` | Resolves span-correlated logger first, then global logger. |
| `packages/core/src/logger/dual-logger.ts:131` | Calls `loggerVNext[level](...)`; this is the log emission point. |

### Direct Log-Like Frame Emission

This is not the observability `LogEvent` bus, but it is a traditional log-shaped event emitted by core code.

| Location | Signal |
| --- | --- |
| `packages/core/src/tools/code-mode/runner.ts:87` | Captures sandboxed `console.log/info/warn/error` and emits `{ type: 'log', level, message }` frames to stdout. |
| `packages/core/src/tools/code-mode/types.ts:82` | Type definition for the code-mode `{ type: 'log' }` frame. |

### Logger Call Site Density

Because `DualLogger` makes ordinary logger calls observability-capable, these files contain logger calls that can become log events when the logger is dual-wrapped:

| File | Count |
| --- | ---: |
| `packages/core/src/agent/agent.ts` | 62 |
| `packages/core/src/llm/model/model.ts` | 22 |
| `packages/core/src/workflows/workflow.ts` | 21 |
| `packages/core/src/workspace/sandbox/local-sandbox.ts` | 20 |
| `packages/core/src/workspace/sandbox/mount-manager.ts` | 14 |
| `packages/core/src/agent/agent-legacy.ts` | 13 |
| `packages/core/src/mastra/index.ts` | 12 |
| `packages/core/src/workflows/scheduler/scheduler.ts` | 10 |
| `packages/core/src/loop/network/index.ts` | 8 |
| `packages/core/src/llm/model/model.loop.ts` | 7 |
| `packages/core/src/utils.ts` | 7 |
| `packages/core/src/workflows/evented/workflow-event-processor/index.ts` | 6 |
| `packages/core/src/processors/runner.ts` | 5 |
| `packages/core/src/logger/multi-logger.ts` | 5 |
| `packages/core/src/channels/agent-channels.ts` | 4 |
| `packages/core/src/workspace/sandbox/mastra-sandbox.ts` | 4 |
| `packages/core/src/workspace/filesystem/mastra-filesystem.ts` | 4 |
| `packages/core/src/workflows/evented/step-executor.ts` | 4 |
| `packages/core/src/agent/workflows/prepare-stream/map-results-step.ts` | 3 |
| `packages/core/src/mastra/hooks.ts` | 3 |
| `packages/core/src/tools/tool-builder/builder.ts` | 3 |
| `packages/core/src/worker/workers/scheduler-worker.ts` | 2 |
| `packages/core/src/workspace/tools/ast-edit.ts` | 2 |
| `packages/core/src/workflows/handlers/control-flow.ts` | 2 |
| `packages/core/src/workflows/handlers/step.ts` | 2 |
| `packages/core/src/workflows/execution-engine.ts` | 2 |
| Single-call files | 12 files |

The direct `trackException(...)` sites are especially likely to produce error log events through `DualLogger.trackException(...)`:

- `packages/core/src/mastra/hooks.ts:108`
- `packages/core/src/workflows/handlers/control-flow.ts:391`
- `packages/core/src/tools/tool-builder/builder.ts:842`
- `packages/core/src/mastra/index.ts:921`, `1728`, `1811`, `1851`, `2151`, `2203`, `2340`, `2483`, `2688`, `2857`, `2906`, `3060`, `3117`, `3214`, `3274`, `3413`, `3460`, `3858`, `4003`, `4018`, `4055`, `4138`, `4514`, `4566`
- `packages/core/src/workflows/handlers/step.ts:573`
- `packages/core/src/workflows/default.ts:444`
- `packages/core/src/loop/loop.ts:41`
- `packages/core/src/agent/agent-legacy.ts:392`, `660`
- `packages/core/src/workflows/evented/step-executor.ts:320`
- `packages/core/src/agent/workflows/prepare-stream/prepare-memory-step.ts:155`
- `packages/core/src/agent/agent.ts:460`, `475`, `571`, `1196`, `1730`, `1856`, `1870`, `1938`, `2013`, `2190`, `2230`, `2271`, `2315`, `2358`, `2404`, `2472`, `2539`, `2572`, `2593`, `2637`, `5060`, `5339`, `5698`, `5868`, `6674`

## Metrics

Core defines and exposes metrics, but this pass did not find production `metrics.emit(...)`, `counter(...)`, `gauge(...)`, or `histogram(...)` call sites in `packages/core/src` outside interfaces, comments, tests, and no-op implementations.

| Location | Signal |
| --- | --- |
| `packages/core/src/mastra/index.ts:3828` | `mastra.metrics` returns the default observability instance's `MetricsContext`, or no-op metrics. |
| `packages/core/src/observability/context-factory.ts:25` | Derives span-correlated metrics context from the current span. |
| `packages/core/src/observability/types/metrics.ts:21` | Defines `MetricsContext.emit(...)`. |
| `packages/core/src/observability/types/metrics.ts:24` | Deprecated `counter`, `gauge`, `histogram` APIs. |

Storage support exists for persisted metric records, but storage methods are sinks, not emitters:

| Location | Role |
| --- | --- |
| `packages/core/src/storage/domains/observability/base.ts:429` | Base `batchCreateMetrics(...)` unsupported default. |
| `packages/core/src/storage/domains/observability/inmemory.ts:1143` | In-memory `batchCreateMetrics(...)` sink. |

## Scores

| Location | Signal |
| --- | --- |
| `packages/core/src/evals/base.ts:635` | Checks for `mastra.observability.addScore`. |
| `packages/core/src/evals/base.ts:640` | Emits/attaches a score through `mastra.observability.addScore(...)`. |
| `packages/core/src/evals/scoreTraces/scoreTracesWorkflow.ts:228` | Constructs a legacy score link object with `type: 'score'` for span links. |
| `packages/core/src/mastra/hooks.ts:114` | Comment marks legacy scores-store path and points to `mastra.observability.addScore()`. |
| `packages/core/src/evals/run/index.ts:652` | Comment marks legacy scores-store path and points to `mastra.observability.addScore()`. |
| `packages/core/src/evals/scoreTraces/scoreTracesWorkflow.ts:168` | Comment marks legacy scores-store path and points to `mastra.observability.addScore()`. |
| `packages/core/src/evals/scoreTraces/scoreTracesWorkflow.ts:202` | Comment marks legacy score-attach path and points to `mastra.observability.addScore()`. |

Storage sinks:

| Location | Role |
| --- | --- |
| `packages/core/src/storage/domains/observability/base.ts:566` | Base `createScore(...)` unsupported default. |
| `packages/core/src/storage/domains/observability/base.ts:578` | Base `batchCreateScores(...)` unsupported default. |
| `packages/core/src/storage/domains/observability/inmemory.ts:1817` | In-memory `createScore(...)` sink. |
| `packages/core/src/storage/domains/observability/inmemory.ts:1827` | In-memory `batchCreateScores(...)` sink. |

## Feedback

This pass did not find production `observability.addFeedback(...)`, `recordedSpan.addFeedback(...)`, or `recordedTrace.addFeedback(...)` call sites in `packages/core/src` outside interfaces and storage sinks.

| Location | Role |
| --- | --- |
| `packages/core/src/observability/types/core.ts:351` | Defines `ObservabilityEntrypoint.addFeedback(...)`. |
| `packages/core/src/observability/types/tracing.ts:1062` | Defines `RecordedSpan.addFeedback(...)`. |
| `packages/core/src/observability/types/tracing.ts:1107` | Defines `RecordedTrace.addFeedback(...)`. |
| `packages/core/src/storage/domains/observability/base.ts:654` | Base `createFeedback(...)` unsupported default. |
| `packages/core/src/storage/domains/observability/base.ts:666` | Base `batchCreateFeedback(...)` unsupported default. |
| `packages/core/src/storage/domains/observability/inmemory.ts:2164` | In-memory `createFeedback(...)` sink. |
| `packages/core/src/storage/domains/observability/inmemory.ts:2177` | In-memory `batchCreateFeedback(...)` sink. |
