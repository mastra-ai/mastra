# Pulse Observability — Exploration Notes

**Status:** Active exploration
**Branch:** `claude/explore-observability-system-FUPMo`

---

## The Problem

Traditional observability (logs, metrics, spans) was designed for humans staring at dashboards.
In an agent-native world, the primary consumer of observability data is *another agent or LLM*
that needs to understand what happened, why, and what to do next.

### Pain points in the current Mastra observability system

#### 1. Three separate signal types that are really all "things that happened"

Today we have 5 event types flowing through the ObservabilityBus:
```
TracingEvent  (span_started | span_updated | span_ended)
LogEvent
MetricEvent
ScoreEvent
FeedbackEvent
```
Each has its own type hierarchy, its own exporter handler, and its own storage schema.
But they're all just "something happened at time T with data D."

#### 2. Massive data duplication in span trees

A typical agent execution creates this span tree:

```
AGENT_RUN
├─ MODEL_GENERATION
│  ├─ MODEL_STEP (step 0)
│  │  └─ MODEL_CHUNK (×N)
│  └─ MODEL_STEP (step 1)    ← repeats step 0's messages + new ones
│     └─ MODEL_CHUNK (×N)
├─ TOOL_CALL
│  └─ [nested AGENT_RUN]     ← entire sub-tree repeats parent context
└─ PROCESSOR_RUN
```

Key duplication vectors:
- **Entity inheritance**: Every child span copies `entityType`, `entityId`, `entityName` from
  its parent. A MODEL_GENERATION span carries `entityType: AGENT` even though it's a model call.
- **Metadata on every span**: `requestContextKeys` extraction merges the same metadata into
  every span in the trace.
- **Logger correlation**: `LoggerContextImpl` copies `span.metadata` into every `ExportedLog.metadata`.
- **Multi-turn conversations**: Each MODEL_STEP contains the full message history up to that point.
  Turn 10's input includes all messages from turns 1-9. The observability storage has the same
  messages stored 10 times.
- **Storage schema width**: Every `SpanRecord` has ~20 nullable fields (`userId`, `organizationId`,
  `resourceId`, `runId`, `sessionId`, `threadId`, `requestId`, `environment`, `source`,
  `serviceName`, `scope`, `metadata`, `tags`, ...) — most are only meaningful on root spans
  but the schema carries them on every row.

#### 3. Parallel type systems that drift from reality

The observability system maintains its own attribute types for each span kind:

```typescript
// These are observability-specific mirrors of domain types:
AgentRunAttributes       { conversationId, instructions, prompt, availableTools, maxSteps }
ModelGenerationAttributes { model, provider, usage, parameters, streaming, finishReason, ... }
ToolCallAttributes       { toolType, toolDescription, success }
WorkflowRunAttributes    { status }
WorkflowStepAttributes   { status }
// ... 16 span types × unique attribute interfaces
```

These are hand-maintained copies of information that already exists on the actual `Agent`,
`Tool`, `Workflow` types. When a new field is added to `Agent`, someone has to remember to
also add it to `AgentRunAttributes`. They drift.

The OTel exporter then creates a *third* representation via GenAI semantic conventions:
```
gen_ai.agent.id, gen_ai.agent.name, gen_ai.request.model, gen_ai.response.model,
gen_ai.usage.input_tokens, gen_ai.tool.name, gen_ai.tool.call.arguments, ...
```

Three representations of the same data, each with its own mapping logic.

#### 4. Context propagation is heavy

Current context threading:
- `ObservabilityContext` carries `TracingContext`, `LoggerContext`, `MetricsContext`
- `TracingContext` holds `currentSpan?: AnySpan` — a live object with methods, parent refs, etc.
- `TraceState` is computed at root and shared across spans
- `wrapMastra()` / `wrapAgent()` / `wrapWorkflow()` / `wrapRun()` create Proxy wrappers
  to inject tracing context into nested calls
- The OTel bridge maintains a `Map<spanId, { otelSpan, otelContext }>` for cross-library compat
- All of this exists to answer: "who is my parent?"

#### 5. Not agent-friendly

An LLM trying to understand "what went wrong" has to:
1. Fetch spans from the tracing store
2. Fetch logs from the log store (correlating by traceId/spanId)
3. Fetch metrics from the metrics store (correlating by dimensions)
4. Reconstruct the tree
5. Parse each span type's unique attribute schema
6. Deal with massive token counts from duplicated data

---

## The Idea: Pulses

A **pulse** is the atomic unit of observability. Everything that happens is a pulse.

### Core principles

1. **One type** — not spans + logs + metrics. Just pulses.
2. **Append-only stream** — pulses are immutable events in a time-ordered stream.
3. **Tree structure via parent references** — each pulse knows its parent pulse ID.
4. **Delta-only data** — a pulse carries only what's *new* relative to its parent.
5. **Native Mastra types** — pulses carry serialized snapshots of actual domain objects,
   not observability-specific attribute schemas.
6. **Minimal context** — just "current pulse ID" via AsyncLocalStorage. No complex context objects.

### The Pulse type

```typescript
interface Pulse {
  id: string;                    // unique pulse ID
  parentId?: string;             // parent pulse (forms tree)
  ts: number;                    // timestamp (epoch ms)

  // What happened
  kind: string;                  // e.g. "agent.start", "model.response", "tool.call", "log.warn"

  // The actual data — serialized from real Mastra types
  // Only NEW or CHANGED data relative to parent
  data?: Record<string, unknown>;

  // Optional timing for duration-based events
  duration?: number;             // ms, present on "end" pulses

  // Optional error
  error?: { message: string; stack?: string; [key: string]: unknown };
}
```

That's it. No `entityType`, no `entityId`, no `entityName`, no `tags`, no `metadata` as
separate fields. If that information matters, it's in `data` — serialized from the real object.

### How signals collapse into pulses

**A log** is a pulse:
```typescript
{ kind: "log.warn", data: { message: "Rate limit approaching", rateLimit: { remaining: 5 } } }
```

**A span** is two pulses (or one if it's instant):
```typescript
// Start
{ id: "p1", kind: "agent.start", data: { agentId: "support", model: "claude-sonnet-4-20250514" } }
// End
{ id: "p2", parentId: "p1", kind: "agent.end", data: { output: "...", tokensUsed: 1523 }, duration: 2340 }
```

**A metric** is a pulse:
```typescript
{ kind: "metric", data: { name: "queue_depth", value: 42, queue: "high_priority" } }
```

**A score/feedback** is a pulse:
```typescript
{ kind: "score", data: { scorer: "relevance", value: 0.85, reason: "..." } }
{ kind: "feedback", data: { source: "user", type: "thumbs", value: 1 } }
```

### How a real agent execution looks as pulses

Here's a 2-turn agent conversation with a tool call:

```
p01  agent.start        { agent: { id: "support", model: "claude-sonnet-4-20250514", tools: ["search", "lookup"] } }
p02  ├─ model.start     { messages: [{ role: "user", content: "What's the refund policy?" }] }
p03  │  ├─ chunk        { type: "text", text: "Let me look" }
p04  │  ├─ chunk        { type: "text", text: " that up for you." }
p05  │  └─ chunk        { type: "tool_call", toolName: "search", args: { query: "refund policy" } }
p06  │  model.end       { finishReason: "tool-calls", usage: { input: 150, output: 45 } }
p07  ├─ tool.call       { tool: "search", input: { query: "refund policy" } }
p08  │  tool.result     { output: { results: [...] } }
p09  ├─ model.start     { messages: [{ role: "tool", content: "..." }] }  ← DELTA: only the new tool result message
p10  │  ├─ chunk        { type: "text", text: "Our refund policy..." }
p11  │  └─ chunk        { type: "text", text: " is 30 days." }
p12  │  model.end       { finishReason: "stop", usage: { input: 280, output: 35 } }
p13  agent.end          { output: "Our refund policy is 30 days." }
```

**Notice p09**: it only records the NEW message (the tool result). It doesn't re-record the
original user message from p02. To reconstruct the full message list at p09, walk up:
`p09 → p06 → p02` and merge the messages.

Compare this to today where the MODEL_STEP span for turn 2 would contain the ENTIRE message
array including the original user message.

### The tree structure

```
p01 agent.start
├── p02 model.start
│   ├── p03 chunk
│   ├── p04 chunk
│   ├── p05 chunk
│   └── p06 model.end
├── p07 tool.call
│   └── p08 tool.result
├── p09 model.start
│   ├── p10 chunk
│   ├── p11 chunk
│   └── p12 model.end
└── p13 agent.end
```

Parent references form the tree. No separate "trace" concept needed — the tree IS the trace.
The root pulse IS the trace root.

### Start/End pulse pairing

Some events are instantaneous (logs, metrics, chunks). Others have duration (agent runs,
model calls, tool calls). For duration events:

- The **start pulse** (`agent.start`) carries input data and creates a scope.
- Children reference the start pulse as their parent.
- The **end pulse** (`agent.end`) references the start pulse as its parent and carries
  output data + duration.

This means the "end" pulse is a *sibling* of the children, not a separate entity. The start
pulse's children tell you everything that happened during its scope.

**Alternative: end pulse references start pulse directly (not as parent)**

```typescript
interface Pulse {
  // ...
  closesId?: string;  // "this pulse closes the scope opened by closesId"
}
```

This keeps the parent chain clean for data inheritance while still pairing start/end.

### Delta encoding strategy

The emitter decides what's new. The rules are simple:

1. **First time data appears → include it.** The agent.start pulse includes the agent config.
2. **Data already in an ancestor → omit it.** The model.start pulse doesn't re-include agent config.
3. **For growing collections (messages) → include only new items.** Turn 2's model.start only
   includes messages added since turn 1.
4. **For changed values → include the new value.** If temperature changed between calls, include it.

This is "emitter-decided delta" — the code emitting the pulse knows what's new because it just
created it. No diffing algorithm needed.

### Reconstruction

To get the full state at any pulse, walk the parent chain and merge `data` objects:

```typescript
function reconstruct(pulseId: string, store: PulseStore): Record<string, unknown> {
  const chain = getAncestorChain(pulseId, store); // [pulse, parent, grandparent, ...]
  const state: Record<string, unknown> = {};

  // Walk from root to leaf, applying each pulse's data
  for (const pulse of chain.reverse()) {
    deepMerge(state, pulse.data);
  }
  return state;
}
```

For arrays (like messages), we'd need a merge strategy — probably append-only for message lists.

**Optimization: Periodic snapshots**

For long chains (100+ turn conversations), we could emit periodic "snapshot" pulses that
capture full state, making reconstruction O(1) from the nearest snapshot.

### No more parallel type systems

Today, creating an agent span requires translating domain data into observability types:

```typescript
// Current: manual mapping that drifts
const agentSpan = startSpan({
  type: SpanType.AGENT_RUN,
  attributes: {
    conversationId: agent.conversationId,   // AgentRunAttributes
    instructions: agent.instructions,        // copied from Agent
    availableTools: agent.tools.map(t => t.name),
    maxSteps: agent.maxSteps,
  },
});
```

With pulses, just serialize the thing:

```typescript
// Pulse: serialize the actual object
emit({
  kind: "agent.start",
  data: {
    agent: serialize(agent),  // actual Agent type, cleaned for serialization
    // whatever else is relevant
  }
});
```

If we add a field to Agent tomorrow, it automatically appears in pulse data. No attribute
interface to update. No OTel semantic convention mapping to maintain.

### Minimal context: just an ID

The current system threads complex objects through execution:

```typescript
// Current context
interface ObservabilityContext {
  tracing: TracingContext;          // { currentSpan?: AnySpan }
  loggerVNext: LoggerContext;       // structured logger with trace correlation
  metrics: MetricsContext;          // counter/gauge/histogram with cardinality
  tracingContext: TracingContext;   // alias
}
```

Plus Proxy wrappers on Mastra, Agent, Workflow, and Run objects.

With pulses, the only thing to propagate is "current pulse ID":

```typescript
const currentPulseId = new AsyncLocalStorage<string>();

function emit(pulse: Omit<Pulse, 'id' | 'parentId' | 'ts'>): string {
  const id = generateId();
  store.append({
    ...pulse,
    id,
    parentId: currentPulseId.getStore(),
    ts: Date.now(),
  });
  return id;
}

function withPulse<T>(pulseId: string, fn: () => T): T {
  return currentPulseId.run(pulseId, fn);
}
```

That's the entire context propagation system. A string in AsyncLocalStorage.

---

## Comparison with existing "Mastra Pulse" vision

The `.notion/product/product-specs/observability/mastra-pulse.md` doc describes a "Moment"
model that's closer to the current system than what we're exploring here:

| Aspect | Existing Pulse/Moments doc | This exploration |
|--------|---------------------------|-----------------|
| Event types | 7 MomentKinds (WORK, SIGNAL, MEASURE, CHANGE, ANNOTATION, DECISION, OUTCOME) with typed payloads per kind | One type: Pulse. Kind is a string. Data is freeform. |
| Data model | Typed sub-interfaces (WorkMoment, SignalMoment, MeasureMoment, ...) | Just `data: Record<string, unknown>` from real types |
| Links | First-class Link objects with 10 LinkTypes (CONTAINS, CAUSES, AWAITS, RETRIES, ...) | Simple `parentId` for tree structure. Links could be added later. |
| Delta encoding | Not mentioned | Core design principle |
| Storage | ClickHouse with typed tables | Append-only pulse stream (storage-agnostic) |
| Context | Not addressed | Single ID via AsyncLocalStorage |
| Complexity | High — many types, link inference, Finding/Detector systems | Deliberately minimal |

The existing doc is a "better OTel" — structured, typed, comprehensive. This exploration is
more radical: **what's the simplest possible thing that captures everything?**

The two aren't mutually exclusive. Rich link types (RETRIES, FALLBACKS, AWAITS) and Finding
systems could be layered on top of a pulse stream. But the *recording layer* should be as
simple as possible.

---

## Injection into Mastra

How would this get wired in? Two levels:

### Level 1: Alongside existing observability (experiment mode)

A `PulseRecorder` that subscribes to the existing ObservabilityBus events and translates
them into pulses. This lets us capture pulse data without changing any instrumentation.

```typescript
// Quick experiment: pulse recorder as an exporter
class PulseRecorder implements ObservabilityExporter {
  onTracingEvent(event: TracingEvent) {
    // Translate span events to pulses
    if (event.type === 'span_started') {
      this.emit({ kind: `${event.exportedSpan.type}.start`, data: event.exportedSpan });
    }
  }
  onLogEvent(event: LogEvent) {
    this.emit({ kind: `log.${event.log.level}`, data: event.log });
  }
  // etc.
}
```

This is good for collecting data and validating the model, but doesn't solve the duplication
problem because the existing system still creates the full spans.

### Level 2: Native pulse emission (replace spans)

Mastra components emit pulses directly instead of creating spans:

```typescript
// In agent.ts
async generate(messages, options) {
  const pulseId = emit({ kind: "agent.start", data: { agent: serialize(this) } });

  return withPulse(pulseId, async () => {
    const result = await this.model.generate(messages);
    emit({ kind: "agent.end", data: { output: result }, closesId: pulseId });
    return result;
  });
}
```

This is the deeper change. It means:
- No more `Span` objects, `TracingContext`, `ObservabilityContext`
- No more `wrapMastra()` / `wrapAgent()` Proxy chains
- No more `SpanType` enum with 16 entries and typed attribute interfaces
- No more `ObservabilityBridge` for OTel compat
- Just `emit()` and `withPulse()`

For OTel compatibility, a bridge could translate pulses back to spans for export to
traditional backends. But the recording format is pulses.

---

## What would we lose?

Being honest about trade-offs:

1. **Type safety on attributes** — Today, `Span<SpanType.MODEL_GENERATION>` guarantees you
   get `ModelGenerationAttributes`. With freeform `data`, you lose compile-time guarantees
   on what fields exist. (Mitigated by: the data comes from real typed objects anyway.)

2. **Query ergonomics** — "Give me all spans where usage.inputTokens > 1000" is easy with
   typed columns. "Give me all pulses where data.usage.inputTokens > 1000" requires JSON
   querying. (Mitigated by: indexes on common paths, or extract-on-write.)

3. **OTel ecosystem compatibility** — Current system maps cleanly to OTel spans. Pulses
   would need a translation layer. (Mitigated by: we already have one, it just reverses.)

4. **Existing exporter ecosystem** — Langfuse, Braintrust, etc. expect spans. (Mitigated by:
   pulse→span translation for export, keeping native pulse format for storage/agent consumption.)

5. **Start/end pairing complexity** — Spans naturally have start+end. With pulses, we need
   to pair them ourselves via `closesId`. (Mitigated by: simple helper that emits both.)

---

## What would we gain?

1. **Dramatically less data** — Delta encoding means a 10-turn conversation stores ~1x the
   data instead of ~10x.

2. **One mental model** — Developers learn one concept (pulse), not five (span, log, metric,
   score, feedback) with their own APIs.

3. **Always in sync with domain types** — No attribute interfaces to maintain. New Agent
   fields automatically appear in pulse data.

4. **Trivially simple context propagation** — One string in AsyncLocalStorage.

5. **Agent-friendly** — An LLM can read a pulse stream linearly and understand what happened.
   No tree reconstruction needed for the common case.

6. **Append-only, immutable** — Perfect for streaming, replication, and event sourcing patterns.

7. **Natural time ordering** — Pulses are in emission order. You can read them like a story.

---

## Open questions to explore together

1. **Start+end pairing**: Should end-pulses be children of start-pulses (making them siblings
   of the actual work)? Or should they use a separate `closesId` field? Or should we use a
   different pattern entirely — like a "scope" pulse that gets updated?

2. **Delta encoding granularity**: Emitter-decided ("I know what's new") is simplest but
   requires discipline. Should we provide helpers like `deltaMessages(previous, current)`?

3. **Reconstruction API**: What does `getFullState(pulseId)` look like? How do we handle
   array merging (messages), object merging (config), and value replacement (status)?

4. **Kind taxonomy**: Fully freeform strings? Dot-namespaced convention? Enum?
   `"agent.start"` vs `"agent:start"` vs `PulseKind.AGENT_START`?

5. **Snapshot frequency**: For long conversations, how often do we emit full-state snapshots
   to bound reconstruction cost?

6. **Storage model**: Pure append-only log? Or do we want indexes? ClickHouse with a single
   `pulses` table? Or something simpler like a local file?

7. **Backwards compatibility**: Can we emit pulses AND translate to traditional spans for
   existing exporters? Or is this a clean break?

8. **What about streaming?**: Chunks are high-frequency, low-value individually. Do we
   aggregate them? Skip them? Record them at a different fidelity?

9. **The "agent reading pulses" UX**: What does it actually look like when an agent consumes
   a pulse stream to understand what happened? Should we prototype this?

---

## Next steps

- [ ] Sketch concrete TypeScript types for Pulse (in this file or a `.ts` sketch file)
- [ ] Walk through a real agent execution and produce the exact pulse stream
- [ ] Prototype the `emit()` / `withPulse()` / `reconstruct()` primitives
- [ ] Test delta encoding on a real multi-turn conversation
- [ ] Design the "agent reads pulses" query API
- [ ] Consider how this relates to the existing ObservabilityBus (level 1 vs level 2)
