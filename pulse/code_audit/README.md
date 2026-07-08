# Core Observability Emission Audit

Scope: `packages/core/src`.

Goal: identify places where core currently emits or initiates traditional observability signals: spans, span lifecycle updates, logs, metrics, scores, feedback, and related observability carriers.

This audit intentionally stops at location discovery. It does not propose Pulse mappings yet.

## Method

The audit treats these as emission surfaces:

- span creation: `startSpan(...)`, `createChildSpan(...)`, `getOrCreateSpan(...)`
- span lifecycle: `.end(...)`, `.update(...)`, `.error(...)`, model-generation lifecycle helpers
- structured observability logs: `loggerVNext.*(...)`, `LoggerContext.*(...)`, direct `LogEvent` construction
- structured observability metrics: `metrics.emit(...)`, deprecated metric instruments, direct `MetricEvent` construction
- scores and feedback: `observability.addScore(...)`, `recordedSpan.addScore(...)`, `recordedTrace.addScore(...)`, feedback equivalents
- observability propagation: `tracingContext`, `observabilityContext`, and client observability carriers

Ordinary `IMastraLogger` infrastructure logging, `console.*`, EventEmitter events, stream chunks, and UI/harness events are noted only when they bridge into the observability system. They are not counted as traditional observability emissions by themselves.

## Files

- [01-signal-surfaces.md](./01-signal-surfaces.md): central APIs and event types.
- [02-span-call-sites.md](./02-span-call-sites.md): span creation and lifecycle locations.
- [03-log-metric-score-sites.md](./03-log-metric-score-sites.md): log, metric, score, and feedback locations.
- [04-propagation-sites.md](./04-propagation-sites.md): context/carrier propagation locations that do not necessarily emit by themselves.
- [05-recent-feature-coverage-gaps.md](./05-recent-feature-coverage-gaps.md): recently announced feature areas that look under-instrumented.
- [06-file-by-file-pulse-candidates.md](./06-file-by-file-pulse-candidates.md): broader Pulse candidate audit, including places that do not currently emit traditional observability.
- [07-deeper-core-pulse-candidates.md](./07-deeper-core-pulse-candidates.md): deeper follow-up on memory, datasets/evals, integrations, providers, relevance, server, license, cache, bundler, deployer, and hooks.
- [08-runtime-surfaces-pulse-candidates.md](./08-runtime-surfaces-pulse-candidates.md): tool execution, task tools/state signals, LLM model routing, and websocket transport candidates.
- [09-storage-observability-pulse-candidates.md](./09-storage-observability-pulse-candidates.md): observability helpers, storage composition/init, observability storage, and storage-domain method surfaces.
- [10-protocol-telemetry-adapter-pulse-candidates.md](./10-protocol-telemetry-adapter-pulse-candidates.md): A2A, ToolLoopAgent adapter, Agent Builder policy, telemetry, logging, and thin boundary re-exports.
- [11-pulse-applicability-review.md](./11-pulse-applicability-review.md): narrows the raw audit to user-primitive Pulse candidates and marks admin/query/storage/infrastructure items to skip or defer.
- [12-harness-agent-config-pulse-candidates.md](./12-harness-agent-config-pulse-candidates.md): follow-up audit for Harness v1 runtime candidates and Agent Builder/CMS-style config provenance.
