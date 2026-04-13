# Plan: Trace client-side tool execution

Closes mastra-ai/mastra#10889.

## Goal

Tools defined via `@mastra/client-js`'s `clientTools` feature run in the
browser, not on the server. Today their execution is invisible to Mastra's
observability pipeline. This plan adds a new `CLIENT_TOOL_CALL` AI tracing
span type, propagates W3C trace context to the client, and ships
client-emitted spans/logs/metrics back through the Mastra server (not around
it) so they land in whatever exporters the user already has configured.

## Constraints

- `@mastra/core` should not gain new OpenTelemetry dependencies in this PR.
  All OTEL code lives in `@mastra/observability`, which already depends on
  `@opentelemetry/api`.
- Telemetry must flow back through the Mastra server. External OTLP exporters
  on the client are out of scope; the server is the only egress point so
  existing exporter configuration (Langfuse, Braintrust, custom, etc.) keeps
  working without per-client wiring.
- Server owns the lifecycle of the `CLIENT_TOOL_CALL` span so a client crash
  cannot orphan it.
- Tracing degrades to a no-op when `@mastra/observability` is not installed.

## Architecture

> **Important architectural note (discovered during implementation):**
> Client-side tool execution spans **two separate HTTP requests** to the
> server, not one. The first request emits the tool call and ends. The
> client SDK runs the tool and re-invokes `agent.stream()` with the
> result appended as a tool-role message — that re-invocation is a
> separate agent run.
>
> Detection of "this is a client tool" happens implicitly via
> `providerExecuted: false`
> (`packages/core/src/loop/workflows/agentic-execution/llm-mapping-step.ts:127-170`)
> and via the absence of an execute function
> (`packages/core/src/loop/workflows/agentic-execution/tool-call-step.ts:258-260`).
> There is no built-in cross-request trace correlation today, **so this
> PR adds one**: the W3C trace context carrier the server sends to the
> client in request 1 is echoed back by the client in request 2's body,
> giving the second `AGENT_RUN` span a parent it can inherit from.
>
> **The W3C carrier is the correlationId.** No new identifier is
> introduced — we reuse `traceparent` / `tracestate` / `baggage`, which
> already uniquely identify a span and carry sampling decisions. The
> client SDK echoes back what it received and the server treats it as
> the authoritative parent context for the subsequent run.
>
> Concretely:
>
> 1. Request 1: server emits a tool call with `providerExecuted: false`,
>    creates a `CLIENT_TOOL_CALL` child span of the current `AGENT_RUN`,
>    injects W3C carrier (traceparent points at this span), attaches the
>    carrier to the tool-call chunk's `observability` field, and ends
>    the span immediately with `attributes: { status: 'deferred' }`.
>    The span captures inputs and the carrier that was sent out; the
>    deferred status signals "this isn't done, look for child spans
>    arriving later in this trace".
> 2. Client SDK extracts the W3C carrier, runs the user's execute
>    function inside the extracted OTEL context with a buffering
>    provider, flushes child spans/logs as OTLP/JSON, and includes BOTH
>    the original carrier AND the OTLP payload in the next
>    `agent.stream()` request body under a top-level `observability`
>    field.
> 3. Request 2: server reads `observability.parentContext` from the body
>    and uses it as the parent for the new `AGENT_RUN` span, so request
>    2's trace inherits request 1's traceId. Reads `observability.payload`
>    and feeds it through `ClientToolObservabilityIngest.ingest()` which
>    decodes the OTLP, validates that all spans have the expected traceId
>    and that parents resolve, and forwards each span/log into the
>    observability bus. The client's spans land under the prior deferred
>    `CLIENT_TOOL_CALL` span (because their `parentSpanId` points at it),
>    so trace backends visualize the whole thing as one coherent trace.
>
> The deferred span ends "early" (at request-1 time) but its children
> arrive "late" (at request-2 time). OTLP traces explicitly allow
> out-of-order span arrival within a trace, so this is well-defined.

```
[server, request 1]
  └─ AGENT_RUN span (traceId = T1)
      └─ model emits tool call with providerExecuted=false
      └─ if observability ingest registered:
          - create CLIENT_TOOL_CALL "deferred" child span (spanId = S1)
          - inject(span) -> W3C carrier { traceparent: 00-T1-S1-01 }
          - attach to tool-call chunk's `observability` field
          - span.end({ attributes: { status: 'deferred' } })
      └─ AGENT_RUN span ends; HTTP response closes
       │
       ▼
  [@mastra/client-js] (with @mastra/client-js/observability opted in)
    └─ extract W3C context from chunk
    └─ run clientTool.execute() inside that context
    └─ buffer child spans/logs via in-memory OTEL providers
       (children have traceId=T1, parentSpanId=S1)
    └─ flush as OTLP/JSON
    └─ next request body:
         { messages: [..., toolResult],
           observability: { parentContext: <original carrier>,
                            payload: { spans, logs } } }
       │
       ▼
[server, request 2]
  └─ extract observability.parentContext -> traceId=T1, parentSpanId=S1
  └─ AGENT_RUN span inherits trace: traceId = T1, parent = S1
  └─ if observability.payload present + ingest registered:
       - ingest(payload, parentContext)
         · validate every span's traceId == T1
         · validate parents resolve to S1 or another span in payload
         · enforce size/count caps
         · forward each span/log into the observability bus
       (children land under S1 because their parentSpanId points at it)
  └─ agent run continues with the tool result
```

The wire format is OTLP/JSON because it is a stable, public spec that does
not require the client and server to share JS imports — they only share bytes.

## Package boundaries

### `@mastra/core` — interface only, zero new deps

**`packages/core/src/observability/types/tracing.ts`**

- Add `SpanType.CLIENT_TOOL_CALL = 'client_tool_call'`.
- Add `ClientToolCallAttributes extends AIBaseAttributes` with:
  - `toolType?: string`
  - `toolDescription?: string`
  - `clientEnvironment?: string`
- Register in `SpanTypeMap`.
- Note: success/failure is conveyed by `output` vs `errorInfo` on the span,
  not by an attribute. The existing server-side `TOOL_CALL` /
  `MCP_TOOL_CALL` spans currently set `success` as an attribute; that is a
  pre-existing inconsistency and is **out of scope** for this PR.

**New: `packages/core/src/observability/types/client-tool.ts`**

Lives in the `types/` folder alongside the existing tracing types — these
are pure interfaces, no runtime code. Naming is `client-tool` (singular)
so it can hold spans, logs, and any future client-tool observability
concerns without renaming.

```ts
import type { AnySpan } from './tracing';

/**
 * Carrier shipped from server → client over the tool-call chunk.
 * Holds W3C trace context plus any other observability hints the
 * client SDK needs to attach child spans/logs to the right parent.
 */
export interface ClientToolObservabilityContext {
  traceparent: string;
  tracestate?: string;
  baggage?: string;
}

/**
 * OTLP/JSON payload returned from client → server attached to the tool
 * result. Typed as `unknown` at the core boundary; the implementation
 * package validates the actual shape.
 */
export interface ClientToolObservabilityPayload {
  spans?: unknown;
  logs?: unknown;
}

export interface ClientToolObservabilityIngest {
  /**
   * Called from request 1 when the agent emits a client-side tool
   * call. Returns a W3C carrier for the parent span.
   */
  inject(parentSpan: AnySpan): ClientToolObservabilityContext;

  /**
   * Called from request 2 when the agent receives the tool result.
   * Note that the parent span has already ended in a previous run, so
   * we pass the carrier (which the client echoed back) rather than a
   * live span.
   */
  ingest(payload: ClientToolObservabilityPayload, parentContext: ClientToolObservabilityContext): void;
}
```

Re-exported from `packages/core/src/observability/index.ts`.

**`packages/core/src/stream/types.ts`**

- Add optional `observability?: ClientToolObservabilityContext` to the
  tool-call chunk payload (`ToolCallPayload` at
  `packages/core/src/stream/types.ts:159-169`).
- Add optional `observability?: ClientToolObservabilityPayload` to the
  tool-result payload.

**`packages/core/src/loop/workflows/agentic-execution/`** (suspension
detection lives here, NOT in the tool builder)

When the loop detects a tool call with `providerExecuted: false` (the
implicit "this is a client tool" signal in
`llm-mapping-step.ts:127-170`), and after `tool-call-step.ts:258`
returns with no result because the client tool has no `execute`
function:

1. **Always** create a `CLIENT_TOOL_CALL` child span of the current
   `AGENT_RUN`. Input = the tool args. Attributes = `toolDescription`,
   `toolType`. Created regardless of whether client-side observability
   is enabled — every user gets the server-side marker showing that a
   client tool was invoked.
2. If `mastra.observability.getClientToolObservabilityIngest()` returns
   an implementation, call `inject(span)` and attach the result to the
   tool-call chunk's `observability` field.
3. End the span immediately with
   `attributes: { status: 'deferred' }` (and no output) — the actual
   execution result and child telemetry will arrive in the next agent
   run via the OTLP ingest path.

**Server entry point** (`packages/server/src/server/handlers/agents.ts`
stream/generate handlers, before the agent run starts):

When a request body carries an `observability` field:

1. If `observability.parentContext` is present, use it as the parent
   trace context for the new `AGENT_RUN` span so request 2's trace
   inherits request 1's traceId/spanId. This is the cross-request trace
   correlation mechanism — the client echoes back the same W3C carrier
   it received, and the server treats it as authoritative.
2. If `observability.payload` is present and
   `getClientToolObservabilityIngest()` returns an implementation, call
   `ingest(payload, parentContext)`. The ingest validates traceIds,
   resolves parent links, and forwards each span/log into the
   observability bus where existing exporters pick them up.
3. If no ingest is registered but the payload is present, drop it
   silently (with a debug log). Should never normally happen because
   the client only sends the payload when the server sent a carrier in
   the prior turn, and that only happens when an ingest exists.

**`packages/server/src/server/schemas/agents.ts`**

Extend `agentExecutionBodySchema` (lines 205-279) with an optional
top-level `observability` field:

```ts
observability: z.object({
  parentContext: z
    .object({
      traceparent: z.string(),
      tracestate: z.string().optional(),
      baggage: z.string().optional(),
    })
    .optional(),
  payload: z
    .object({
      spans: z.unknown().optional(),
      logs: z.unknown().optional(),
    })
    .optional(),
}).optional();
```

**`packages/core/src/mastra/index.ts`**

- No new registration call site needed. Add a single accessor to the
  existing `ObservabilityEntrypoint` interface
  (`packages/core/src/observability/types/core.ts:263-319`):

  ```ts
  getClientToolObservabilityIngest(): ClientToolObservabilityIngest | undefined;
  ```

  - `NoOpObservability` returns `undefined`.
  - The real `Observability` class in `@mastra/observability` returns a
    working implementation backed by OTEL.
  - The tool builder calls this accessor and skips the cross-boundary
    flow when undefined.

### `@mastra/observability` — implementation

Already depends on `@opentelemetry/api`. Add `@opentelemetry/core`,
`@opentelemetry/sdk-trace-base`, `@opentelemetry/sdk-logs`, and
`@opentelemetry/otlp-transformer`. These are acceptable in a dedicated
observability package.

**New: `observability/mastra/src/client-tool/index.ts`**

- Exports `createClientToolObservabilityIngest(): ClientToolObservabilityIngest`
  and registers it on the `Observability` class so
  `getClientToolObservabilityIngest()` returns it by default.
- `inject(parentSpan)`:
  - Builds an OTEL `Context` from `parentSpan.traceId` / `parentSpan.spanId`.
  - Uses `W3CTraceContextPropagator.inject()` and
    `W3CBaggagePropagator.inject()` to populate a carrier object.
  - Adds `mastra.tracingPolicy=...` and `mastra.runId=...` to baggage so
    the client can short-circuit when sampled out.
- `ingest(payload, parentSpan)`:
  - **Spans:** decode `payload.spans` (OTLP/JSON `ResourceSpans`) via
    `@opentelemetry/otlp-transformer`. Walk
    `resourceSpans[].scopeSpans[].spans[]`.
  - **Logs:** decode `payload.logs` (OTLP/JSON `ResourceLogs`) the same
    way. Walk `resourceLogs[].scopeLogs[].logRecords[]`. Each log record
    is associated with its enclosing span via `spanId` and gets routed
    to the same observability bus path used by server-side logging.
  - Validation (security-critical, reject the entire payload on any
    failure):
    - Every span's `traceId` and every log record's `traceId` must equal
      `parentSpan.traceId`.
    - Every span's `parentSpanId` must resolve to `parentSpan.spanId` or
      another spanId present in this payload (no orphans, no cross-trace
      injection).
    - Every log record's `spanId` must resolve to a span in this payload
      or to `parentSpan.spanId`.
    - Hard caps: `maxSpans` (default 1000), `maxLogs` (default 1000),
      `maxPayloadBytes` (default 1 MiB).
  - Forwards each accepted span/log into the existing observability bus
    using the same internal entry points server-side spans/logs use.
  - Uses the first child span's `startTime` (or an explicit
    `mastra.actualStartTime` baggage entry) as the effective start of
    the `CLIENT_TOOL_CALL` span so latency is measured from real
    client-side execution start, not from chunk emission.

### `@mastra/client-js` — observability via subpath export

The CLIENT_TOOL_CALL parent span is created server-side **regardless of
whether the client opts into the observability subpath**. Every user
already gets:

- A `CLIENT_TOOL_CALL` span in their existing exporters showing that a
  client tool ran, what its inputs were, what it returned, how long it
  took, and whether it errored.

The subpath export is for users who want **richer telemetry from inside
their client tool execute functions** — child spans, logs, and any OTEL
instrumentation they have running in the browser. Following the
established Mastra subpath pattern (e.g. `@mastra/core/auth/ee`,
`@mastra/core/observability/context-storage`, etc. — 21 such exports in
core today), this is added via the `exports` map of `@mastra/client-js`.

**New: `client-sdks/client-js/src/observability/index.ts`**

- New subpath export: `@mastra/client-js/observability` declared in
  `client-sdks/client-js/package.json` `exports`.
- Adds `@opentelemetry/api`, `@opentelemetry/sdk-trace-base`,
  `@opentelemetry/sdk-logs`, `@opentelemetry/core`,
  `@opentelemetry/otlp-transformer` as dependencies (only loaded when
  the subpath is imported — base bundle is unaffected because nothing
  in the main entry references this file).
- Exports `createClientToolObservabilityCollector(ctx: ClientToolObservabilityContext)`:
  - Lazily instantiates a `BasicTracerProvider` with one in-memory
    `SpanProcessor` that buffers `ReadableSpan`s.
  - Lazily instantiates a `LoggerProvider` with one in-memory
    `LogRecordProcessor` that buffers log records.
  - Reads `ctx.traceparent` / `ctx.baggage`, calls
    `propagation.extract(ROOT_CONTEXT, carrier)`, returns a `Context`.
  - `withContext(ctx, fn)` runs the user's `execute` inside it, so any
    OTEL instrumentation in the user's app naturally parents under
    `CLIENT_TOOL_CALL`.
  - If baggage carries `mastra.tracingPolicy=off`, the collector is a
    singleton no-op — zero allocations, no provider instantiation.
  - `flush()` returns
    `{ spans: ResourceSpansJSON, logs: ResourceLogsJSON }` produced via
    `@opentelemetry/otlp-transformer`'s `createExportTraceServiceRequest`
    and `createExportLogsServiceRequest`.

**`client-sdks/client-js/src/resources/agent.ts`**

Around `executeToolCallAndRespond` (lines 61–105 today). The collector is
attached via a registration hook so the base SDK does not import the
observability subpath:

```ts
// observability collector is undefined unless the user opted into the
// subpath. The CLIENT_TOOL_CALL parent span on the server happens
// either way; this only governs whether child spans/logs are collected.
const collector = collectorFactory?.(toolCallChunk.observability);
let result, error;
try {
  result = collector
    ? await collector.withContext(() =>
        clientTool.execute({
          context: args,
          runtimeContext,
          tracingContext: { currentSpan: collector.rootSpan },
        }),
      )
    : await clientTool.execute({ context: args, runtimeContext });
} catch (e) {
  error = e;
}

// The result is appended as a tool-role message and respondFn re-invokes
// agent.generate()/stream() with `observability` at the top level of the
// request body.
await respondFn(updatedMessages, {
  ...respondOptions,
  observability: collector ? collector.flush() : undefined,
});
```

Users opt in once at SDK construction:

```ts
import { MastraClient } from '@mastra/client-js';
import { createClientToolObservabilityCollector } from '@mastra/client-js/observability';

const client = new MastraClient({
  baseUrl,
  observability: { collectorFactory: createClientToolObservabilityCollector },
});
```

The opt-in only adds the OTEL deps to bundles that explicitly import the
subpath. Users who don't import it pay nothing and still get the
server-side `CLIENT_TOOL_CALL` parent span in their existing exporters.

## Tests

- `packages/core/src/observability/types/tracing.test.ts` — enum + type map
  sanity for `CLIENT_TOOL_CALL`.
- `packages/core/src/agent/__tests__/tools.test.ts` — extend the existing
  client-tool tests (around line 358) to assert:
  - The tool-call chunk carries `tracing.traceparent` when an ingest is
    registered.
  - A `CLIENT_TOOL_CALL` span appears in the in-memory exporter as a child
    of the agent run span, with input/output set, when the client returns a
    result.
  - The span carries `errorInfo` when the client returns an error.
  - With no ingest registered, no `tracing` field is emitted and no OTLP
    payload is consumed; the span is still created.
- `observability/mastra/src/client-tool/index.test.ts`:
  - W3C inject roundtrip.
  - OTLP/JSON spans happy path: child spans land in the exporter under
    the parent.
  - OTLP/JSON logs happy path: log records land in the bus parented
    correctly.
  - Validation rejections: traceId mismatch, orphan parent span, log
    pointing at unknown spanId, oversized payload.
- `client-sdks/client-js/src/observability/collector.test.ts`:
  - `tracingPolicy=off` returns a no-op singleton.
  - Extract/inject roundtrip.
  - `flush()` returns `{ spans, logs }` with spans whose parent is the
    carrier spanId and logs whose enclosing span resolves locally.

## Docs and changeset

- Update the AI tracing span types reference doc to list `CLIENT_TOOL_CALL`.
- Update `docs/src/content/en/reference/client-js/agents.mdx` "Client tools"
  section to note executions are now traced and link to the new doc.
- New short doc: "Tracing client-side tools" — how to enable the collector,
  what users see in their existing exporters.
- `pnpm changeset` — minor bumps for `@mastra/core`, `@mastra/client-js`,
  `@mastra/observability`.

## Resolved during planning

1. **Tool result return path.** Client tool results are not sent on a
   side-channel. The client SDK's `executeToolCallAndRespond` appends the
   result as a `tool` role message and re-invokes `agent.generate()` /
   `agent.stream()` via `respondFn`
   (`client-sdks/client-js/src/resources/agent.ts:107-137`, bound at line
   559). Server-side this becomes a fresh POST to
   `/agents/:agentId/stream`
   (`packages/server/src/server/handlers/agents.ts:1299-1378`).
   **Implication:** the `observability.otlp` field rides at the top level
   of the agent execution request body, added to
   `agentExecutionBodySchema` and plumbed through stream/generate options.
   A single request may carry results for multiple client tool calls;
   ingest resolves each child span to its `CLIENT_TOOL_CALL` parent by
   spanId lookup against currently-pending spans.

2. **`@mastra/observability` registration.** `Mastra` already accepts
   `observability: ObservabilityEntrypoint`
   (`packages/core/src/mastra/index.ts:162-182`), instantiated as
   `new Observability({...})` from `@mastra/observability`
   (`observability/mastra/src/default.ts:47`). The
   `ObservabilityEntrypoint` interface
   (`packages/core/src/observability/types/core.ts:263-319`) is the right
   home for a new accessor: add
   `getClientToolObservabilityIngest(): ClientToolObservabilityIngest | undefined`.
   `NoOpObservability` returns `undefined`; the real `Observability`
   class in `@mastra/observability` returns a working implementation
   that uses the OTEL libraries. Tool builder reads
   `mastra.observability.getClientToolObservabilityIngest()` and skips
   the cross-boundary flow when undefined. No new registration call site
   — purely additive to an existing interface.

3. **Subpath exports are an established pattern.**
   `@mastra/core` already declares 21 subpath exports (e.g.
   `./auth/ee`, `./observability/context-storage`, `./agent/message-list`).
   Adding `@mastra/client-js/observability` follows the same convention
   — no new package needed, no precedent to invent.

## In scope for v1

- Spans **and logs** for client-side tool execution.

## Deferred / out of scope

1. **Metrics.** Mastra metrics are significantly different from OTEL
   metrics, so cleanly mapping them is its own design problem. Skip for
   now; may never support if there is no good mapping.
2. **Fixing the pre-existing `success` attribute on `TOOL_CALL` /
   `MCP_TOOL_CALL` spans.** Pre-existing inconsistency, tracked
   separately.
3. **Direct-to-backend OTLP exporters from the browser.** Telemetry must
   flow through the Mastra server.
4. **Auto-instrumentation of `fetch` / `XMLHttpRequest` inside client
   tools.** Users who want it can register their own OTEL
   instrumentation; it will parent correctly under `CLIENT_TOOL_CALL`
   because the collector `withContext`s the execution.
