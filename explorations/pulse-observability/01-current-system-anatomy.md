# Current Mastra Observability System — Anatomy

An inventory of what exists today, to understand what pulses would replace.

---

## The five event types

Everything flows through `ObservabilityEventBus<ObservabilityEvent>` where:

```typescript
type ObservabilityEvent = TracingEvent | LogEvent | MetricEvent | ScoreEvent | FeedbackEvent;
```

Each event type has its own:
- Type definition (in `packages/core/src/observability/types/`)
- Handler method on exporters (`onTracingEvent`, `onLogEvent`, `onMetricEvent`, etc.)
- Storage schema expectations

**With pulses**: All five collapse into one type. A pulse.

---

## The 16 span types and their attribute interfaces

From `packages/core/src/observability/types/tracing.ts`:

```
SpanType.AGENT_RUN              → AgentRunAttributes
SpanType.MODEL_GENERATION       → ModelGenerationAttributes
SpanType.MODEL_STEP             → ModelStepAttributes
SpanType.MODEL_CHUNK            → ModelChunkAttributes
SpanType.TOOL_CALL              → ToolCallAttributes
SpanType.MCP_TOOL_CALL          → MCPToolCallAttributes
SpanType.PROCESSOR_RUN          → ProcessorRunAttributes
SpanType.WORKFLOW_RUN           → WorkflowRunAttributes
SpanType.WORKFLOW_STEP          → WorkflowStepAttributes
SpanType.WORKFLOW_CONDITIONAL   → WorkflowConditionalAttributes
SpanType.WORKFLOW_CONDITIONAL_EVAL → WorkflowConditionalEvalAttributes
SpanType.WORKFLOW_PARALLEL      → WorkflowParallelAttributes
SpanType.WORKFLOW_LOOP          → WorkflowLoopAttributes
SpanType.WORKFLOW_SLEEP         → WorkflowSleepAttributes
SpanType.WORKFLOW_WAIT_EVENT    → WorkflowWaitEventAttributes
SpanType.GENERIC                → AIBaseAttributes
```

Each attribute interface is a hand-maintained copy of fields that already exist on the
real domain types (Agent, Tool, Workflow, etc.). When a field is added to `Agent`, someone
must also add it to `AgentRunAttributes`. They drift.

The `SpanTypeMap` gives compile-time type safety: `Span<SpanType.MODEL_GENERATION>` guarantees
`ModelGenerationAttributes`. This is genuinely useful but comes at high maintenance cost.

**With pulses**: No attribute interfaces. Serialize the actual domain object. `Agent` gains
a field → it automatically appears in pulse data.

---

## The 10 entity types

```typescript
enum EntityType {
  AGENT, EVAL, INPUT_PROCESSOR, INPUT_STEP_PROCESSOR,
  OUTPUT_PROCESSOR, OUTPUT_STEP_PROCESSOR, WORKFLOW_STEP,
  TOOL, WORKFLOW_RUN
}
```

Every span carries `entityType`, `entityId`, `entityName`. Every child span copies these
from its parent — a `MODEL_GENERATION` span carries `entityType: AGENT` even though it's
a model call, because it's inside an agent run.

**With pulses**: No entity inheritance. The agent pulse says it's an agent. The model pulse
just says what model it called. Walk up the tree if you need to know "which agent triggered
this model call."

---

## The span object

A live `Span<TType>` is a heavyweight object:

```typescript
interface Span<TType extends SpanType> {
  // Identity
  id: string;
  traceId: string;              // 32 hex chars
  name: string;
  type: TType;

  // Entity (copied from parent)
  entityType?: EntityType;
  entityId?: string;
  entityName?: string;

  // Timing
  startTime: Date;
  endTime?: Date;

  // Data
  attributes?: SpanTypeMap[TType];
  metadata?: Record<string, any>;
  tags?: string[];
  input?: any;
  output?: any;
  errorInfo?: SpanErrorInfo;
  isEvent: boolean;

  // Tree
  parent?: AnySpan;             // live object reference
  isInternal: boolean;
  observabilityInstance: ObservabilityInstance;  // back-pointer
  traceState?: TraceState;      // shared across trace

  // Methods (10+)
  end(), error(), update(), createChildSpan(), createEventSpan(),
  isRootSpan, isValid, getParentSpanId(), findParent(),
  exportSpan(), externalTraceId, executeInContext(), executeInContextSync()
}
```

Compare to the proposed pulse:

```typescript
interface Pulse {
  id: string;
  parentId?: string;
  ts: number;
  kind: string;
  data?: Record<string, unknown>;
  duration?: number;
  error?: { message: string; stack?: string };
}
```

---

## Context propagation: the Proxy chain

**File**: `packages/core/src/observability/context.ts` (220 lines)

The system uses JavaScript Proxies (not AsyncLocalStorage) to thread tracing context:

```
wrapMastra(mastra, tracingContext)
  → intercepts getAgent(), getAgentById() → returns wrapAgent(agent, tracingContext)
  → intercepts getWorkflow(), getWorkflowById() → returns wrapWorkflow(workflow, tracingContext)

wrapAgent(agent, tracingContext)
  → intercepts generate(), stream(), generateLegacy(), streamLegacy()
  → injects tracingContext into options

wrapWorkflow(workflow, tracingContext)
  → intercepts execute(), createRun()
  → injects tracingContext into options
  → createRun() further wraps the returned Run object

wrapRun(run, tracingContext)
  → intercepts start()
  → injects tracingContext into options
```

This is **4 layers of Proxy wrapping** to answer one question: "who is my parent?"

Each proxy has try/catch guards with `console.warn` fallbacks, NoOp detection, and
`bind(target)` for pass-through methods. The code is careful and correct but inherently
complex — any bug in the Proxy chain silently drops tracing.

**With pulses**: One string in AsyncLocalStorage. `currentPulseId.getStore()` returns
the parent. No Proxies, no wrapping, no interception.

---

## The ObservabilityContext bundle

```typescript
interface ObservabilityContext {
  tracing: TracingContext;          // { currentSpan?: AnySpan }
  loggerVNext: LoggerContext;      // debug/info/warn/error/fatal
  metrics: MetricsContext;          // counter/gauge/histogram
  tracingContext: TracingContext;   // alias for tracing
}
```

Created by `createObservabilityContext(tracingContext)` which derives logger and metrics
from the current span. This means every time a new child span is created, a new
ObservabilityContext must be constructed.

**With pulses**: The context IS the current pulse ID. Logger calls become `emit({ kind: "log.warn", ... })`.
Metrics become `emit({ kind: "metric", ... })`. No separate context objects.

---

## The span creation entry point

`getOrCreateSpan()` in `packages/core/src/observability/utils.ts`:

```typescript
function getOrCreateSpan<T extends SpanType>(options: GetOrCreateSpanOptions<T>): Span<T> | undefined {
  if (tracingContext?.currentSpan) {
    return tracingContext.currentSpan.createChildSpan({ ... });
  }
  const instance = options.mastra?.observability?.getSelectedInstance();
  return instance?.startSpan<T>({ ... });
}
```

This requires: the TracingContext, a reference to Mastra (for the registry), the
ObservabilityInstance, and all the span options. A lot of objects in play.

**With pulses**:
```typescript
function emit(pulse: Omit<Pulse, 'id' | 'parentId' | 'ts'>): string {
  const id = generateId();
  store.append({ ...pulse, id, parentId: currentPulseId.getStore(), ts: Date.now() });
  return id;
}
```

---

## Model span tracking

`ModelSpanTracker` in `observability/mastra/src/model-tracing.ts` manages the
MODEL_GENERATION → MODEL_STEP → MODEL_CHUNK hierarchy.

It wraps AI SDK streams via `wrapStream()` to automatically create MODEL_STEP and
MODEL_CHUNK spans as streaming data arrives. This is one of the more complex pieces
because it interleaves span lifecycle with stream processing.

**With pulses**: `model.start` pulse, then `chunk` pulses as they arrive, then
`model.end` pulse with assembled result. The stream wrapping still needs to happen,
but it emits simple pulses instead of managing span objects.

---

## What's NOT in the observability system

Things that are absent (and might inform pulse design):

1. **No deduplication** — if the same data appears on parent and child spans, both store it
2. **No delta encoding** — each span is a complete record
3. **No streaming/subscription API** — exporters receive events but there's no
   "subscribe to the pulse stream" primitive for agents
4. **No reconstruction** — you can't ask "what was the full state at this point in time?"
   without manually reassembling from the span tree
5. **No built-in cost tracking** — token usage is on MODEL_GENERATION spans but not
   aggregated up to AGENT_RUN automatically

---

## File locations reference

| Component | Path |
|-----------|------|
| Type definitions | `packages/core/src/observability/types/` |
| Span types + attributes | `packages/core/src/observability/types/tracing.ts` |
| ObservabilityInstance interface | `packages/core/src/observability/types/core.ts` |
| ObservabilityContext | `packages/core/src/observability/types/core.ts:61` |
| Context proxies (wrapMastra etc) | `packages/core/src/observability/context.ts` |
| Context factory | `packages/core/src/observability/context-factory.ts` |
| getOrCreateSpan helper | `packages/core/src/observability/utils.ts` |
| No-op implementations | `packages/core/src/observability/no-op.ts` |
| ObservabilityInstance impl | `observability/mastra/src/instances/base.ts` |
| Span base class | `observability/mastra/src/spans/base.ts` |
| Span serialization | `observability/mastra/src/spans/serialization.ts` |
| Model tracking | `observability/mastra/src/model-tracing.ts` |
| Registry | `observability/mastra/src/registry.ts` |
| Exporters | `observability/mastra/src/exporters/` |
| Event bus | `observability/mastra/src/bus/` |
| Agent span creation | `packages/core/src/agent/agent.ts:3829` |
