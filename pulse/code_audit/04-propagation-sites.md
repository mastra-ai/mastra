# Propagation and Carrier Sites

These locations do not always emit a signal immediately, but they propagate trace/span identity or observability payloads that affect where later traditional observability events attach.

## Context Injection Helpers

| Location | Role |
| --- | --- |
| `packages/core/src/observability/context.ts:42` | `wrapMastra(...)` creates a tracing-aware Mastra proxy. |
| `packages/core/src/observability/context.ts:98` | `wrapAgent(...)` injects an `ObservabilityContext` into agent generation methods. |
| `packages/core/src/observability/context.ts:137` | `wrapWorkflow(...)` injects an `ObservabilityContext` into workflow execution methods. |
| `packages/core/src/observability/context.ts:186` | `wrapRun(...)` injects an `ObservabilityContext` into workflow run `start(...)`. |
| `packages/core/src/observability/context-factory.ts:50` | `createObservabilityContext(...)` packages tracing, logger, and metrics contexts. |
| `packages/core/src/observability/context-factory.ts:64` | `resolveObservabilityContext(...)` normalizes partial context passed through execution APIs. |

## Client Observability Carrier

Core defines the client observability contract and uses it for client-side tool execution. The implementation lives outside core, but core creates the server-side marker span and moves the carrier through stream payloads.

| Location | Role |
| --- | --- |
| `packages/core/src/observability/types/client.ts:25` | `ClientObservabilityCarrier` with `traceparent`, `tracestate`, and `baggage`. |
| `packages/core/src/observability/types/client.ts:48` | `ClientObservabilityPayload` with returned client spans/logs plus `executionDurationMs` and `toolName`. |
| `packages/core/src/observability/types/client.ts:84` | `ClientObservabilityProxy` interface. |
| `packages/core/src/observability/types/client.ts:89` | `inject(parentSpan)` creates the W3C carrier. |
| `packages/core/src/observability/types/client.ts:99` | `receive(payload, parentContext)` receives client spans/logs. |
| `packages/core/src/observability/types/core.ts:368` | `ObservabilityEntrypoint.getClientObservabilityProxy()`. |
| `packages/core/src/stream/types.ts:189` | Tool-call payload carries `observability?: ClientObservabilityCarrier`. |
| `packages/core/src/stream/types.ts:220` | Streaming tool input start payload carries `observability?: ClientObservabilityCarrier`. |
| `packages/core/src/loop/workflows/agentic-execution/llm-execution-step.ts:462` | `injectClientToolObservability(...)` helper. |
| `packages/core/src/loop/workflows/agentic-execution/llm-execution-step.ts:492` | Fetches `mastra.observability.getClientObservabilityProxy()`. |
| `packages/core/src/loop/workflows/agentic-execution/llm-execution-step.ts:502` | Creates the server-side `CLIENT_TOOL_CALL` span. |
| `packages/core/src/loop/workflows/agentic-execution/llm-execution-step.ts:515` | Calls `proxy.inject(clientToolSpan)`. |
| `packages/core/src/loop/workflows/agentic-execution/llm-execution-step.ts:518` | Writes the carrier onto the outgoing tool payload. |
| `packages/core/src/loop/workflows/agentic-execution/llm-execution-step.ts:567` | Injects carrier for tool input start chunks. |
| `packages/core/src/loop/workflows/agentic-execution/llm-execution-step.ts:586` | Injects carrier for later tool-call payloads. |
| `packages/core/src/agent/agent.ts:1099` | `#extractClientObservability(...)` scans incoming messages for returned client observability payloads. |
| `packages/core/src/agent/agent.ts:1102` | Fetches `getClientObservabilityProxy()` to receive returned data. |
| `packages/core/src/agent/agent.ts:1114` | Calls `proxy.receive(...)`. |
| `packages/core/src/agent/agent.ts:6938` | Calls `#extractClientObservability(...)` in one modern agent path. |
| `packages/core/src/agent/agent.ts:7309` | Calls `#extractClientObservability(...)` in another modern agent path. |
| `packages/core/src/stream/aisdk/v5/transform.ts:252` | Preserves `observability` converting AI SDK tool-call input to Mastra chunks. |
| `packages/core/src/stream/aisdk/v5/transform.ts:285` | Preserves `observability` converting another tool-call shape to Mastra chunks. |
| `packages/core/src/stream/aisdk/v5/transform.ts:480` | Writes `chunk.payload.observability` back onto AI SDK tool-call part. |

## Trace/Span IDs on Public Results

These sites expose trace/span IDs to callers. They are not emissions, but they make later score/feedback attachment and user-visible trace navigation possible.

| Location | Role |
| --- | --- |
| `packages/core/src/agent/agent-legacy.ts:986` | Reads legacy agent `traceId` / `spanId` from span. |
| `packages/core/src/agent/agent-legacy.ts:1165` | Writes `traceId` to legacy result. |
| `packages/core/src/agent/agent-legacy.ts:1166` | Writes `spanId` to legacy result. |
| `packages/core/src/agent/agent-legacy.ts:1266` | Writes `traceId` to legacy result. |
| `packages/core/src/agent/agent-legacy.ts:1267` | Writes `spanId` to legacy result. |
| `packages/core/src/agent/agent-legacy.ts:1460` | Writes `traceId` to legacy stream result. |
| `packages/core/src/agent/agent-legacy.ts:1461` | Writes `spanId` to legacy stream result. |
| `packages/core/src/agent/agent-legacy.ts:1540` | Writes `traceId` to legacy stream-object result. |
| `packages/core/src/agent/agent-legacy.ts:1541` | Writes `spanId` to legacy stream-object result. |
| `packages/core/src/stream/base/output.ts:294` | Stores result `traceId` from result span. |
| `packages/core/src/stream/base/output.ts:295` | Stores result `spanId` from result span. |
| `packages/core/src/stream/base/output.ts:1436` | Emits/output serializes `traceId`. |
| `packages/core/src/stream/base/output.ts:1437` | Emits/output serializes `spanId`. |
| `packages/core/src/workflows/workflow.ts:3263` | Reads workflow `traceId` from span. |
| `packages/core/src/workflows/workflow.ts:3264` | Reads workflow `spanId` from span. |
| `packages/core/src/workflows/workflow.ts:3294` | Writes workflow result `traceId`. |
| `packages/core/src/workflows/workflow.ts:3295` | Writes workflow result `spanId`. |
| `packages/core/src/workflows/workflow.ts:4103` | Reads resumed workflow `traceId`. |
| `packages/core/src/workflows/workflow.ts:4104` | Reads resumed workflow `spanId`. |
| `packages/core/src/workflows/workflow.ts:4139` | Writes resumed result `traceId`. |
| `packages/core/src/workflows/workflow.ts:4140` | Writes resumed result `spanId`. |
| `packages/core/src/workflows/workflow.ts:4206` | Reads workflow `traceId`. |
| `packages/core/src/workflows/workflow.ts:4207` | Reads workflow `spanId`. |
| `packages/core/src/workflows/workflow.ts:4230` | Writes workflow result `traceId`. |
| `packages/core/src/workflows/workflow.ts:4231` | Writes workflow result `spanId`. |
| `packages/core/src/workflows/workflow.ts:4344` | Reads workflow `traceId`. |
| `packages/core/src/workflows/workflow.ts:4345` | Reads workflow `spanId`. |
| `packages/core/src/workflows/workflow.ts:4370` | Writes workflow result `traceId`. |
| `packages/core/src/workflows/workflow.ts:4371` | Writes workflow result `spanId`. |

## Durable / Resume Trace Context

| Location | Role |
| --- | --- |
| `packages/core/src/agent/agent.ts:6282` | Reads persisted tracing context shape `{ traceId, spanId, parentSpanId }`. |
| `packages/core/src/agent/agent.ts:6288` | Reads user-provided `traceId`. |
| `packages/core/src/agent/agent.ts:6289` | Reads user-provided `parentSpanId`. |
| `packages/core/src/agent/agent.ts:6299` | Passes effective `traceId` into resumed agent span creation. |
| `packages/core/src/agent/agent.ts:6300` | Passes effective `parentSpanId` into resumed agent span creation. |
| `packages/core/src/agent/agent.ts:6328` | Records `resumedFromSpanId` metadata. |
| `packages/core/src/workflows/default.ts:842` | Persists workflow run `traceId`. |
| `packages/core/src/workflows/default.ts:843` | Persists workflow run `spanId`. |
| `packages/core/src/workflows/default.ts:844` | Persists workflow run `parentSpanId`. |
| `packages/core/src/workflows/workflow.ts:4058` | Reads user-provided `traceId` on resume. |
| `packages/core/src/workflows/workflow.ts:4059` | Reads user-provided `parentSpanId` on resume. |
| `packages/core/src/workflows/workflow.ts:4076` | Passes effective `traceId` into resumed workflow span creation. |
| `packages/core/src/workflows/workflow.ts:4077` | Passes effective `parentSpanId` into resumed workflow span creation. |
| `packages/core/src/workflows/workflow.ts:4094` | Records `resumedFromSpanId` metadata. |
| `packages/core/src/workflows/evented/workflow-event-processor/index.ts:183` | Documents snapshotting current span as `{ traceId, spanId, parentSpanId }`. |
| `packages/core/src/workflows/evented/workflow-event-processor/index.ts:196` | Returns trace/span/parent IDs from the current span. |
| `packages/core/src/harness/session.ts:534` | Stores harness trace ID. |
| `packages/core/src/harness/session.ts:558` | Sets harness trace ID. |
| `packages/core/src/harness/harness.ts:2111` | Clears harness run trace ID before a new subscribed run starts. |
