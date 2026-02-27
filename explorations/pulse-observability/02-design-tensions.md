# Design Tensions

Open questions that need resolving. Each section presents the tension, the options,
and our current thinking.

---

## 1. What does the tree represent?

The pulse tree is formed by `parentId` references. But what does "parent" mean?

### Option A: Containment ("this happened inside that")

```
agent.start          ← parent of everything inside the agent run
├── model.start      ← parent of everything inside this model call
│   ├── chunk
│   ├── chunk
│   └── model.end    ← child of model.start (it happened "inside" the model scope)
├── tool.call
│   └── tool.result
└── agent.end        ← child of agent.start
```

**Pro**: An agent asking "what happened during this agent run?" gets everything nested
under one node. Simple tree traversal.

**Con**: `agent.end` is a sibling of the actual work (`model.start`, `tool.call`). The
"end" didn't happen "inside" the agent — it IS the agent finishing. Semantically weird.

### Option B: Causality with `closesId` ("this closes the scope opened by that")

```
agent.start          ← parent of children, NOT of agent.end
├── model.start
│   ├── chunk
│   ├── chunk
│   └── model.end    (closesId: model.start)
├── tool.call
│   └── tool.result
agent.end            (closesId: agent.start)  ← NOT a child, a sibling that closes
```

**Pro**: Clean parent chain for data inheritance. The tree represents real nesting.
**Con**: Two concepts (parentId AND closesId). Reconstruction needs to understand both.
         Querying "everything in this scope" requires following children AND finding the
         pulse that closesId this scope.

### Option C: Scope nodes (no separate start/end)

```
agent [scope]        ← single node, accumulates data over time
├── model [scope]
│   ├── chunk
│   └── chunk
└── tool.call
    └── tool.result
```

The "start" pulse creates the scope. When the scope ends, the same pulse gets `duration`
and `result` written to it. NOT append-only — the scope pulse is mutable.

**Pro**: Simplest tree. One node per logical operation. Most natural for querying.
**Con**: Breaks append-only immutability. Can't stream scope pulses until they close.
         Harder to capture "what was happening at time T" during long-running operations.

### Option D: Scope nodes with append-only updates

What if "updating" a scope emits a new pulse that targets it?

```
p1  agent.start       { agent: { id: "support", model: "claude-sonnet" } }
p2  ├── model.start   { messages: [...] }
p3  │   ├── chunk     { text: "Let me" }
p4  │   └── chunk     { text: " check." }
p5  │   model.end     { usage: { input: 150, output: 45 } }  [targets: p2]
p6  ├── tool.call     { tool: "search", input: { query: "refund policy" } }
p7  │   tool.result   { output: [...] }                       [targets: p6]
p8  agent.end         { output: "..." }                        [targets: p1]
```

Here, `targets` (or `closesId`) means "this pulse adds data to that pulse's scope."
The tree is formed by `parentId`. The `targets` field is a separate relationship that
says "and by the way, this data belongs on that scope."

**Pro**: Append-only. Tree is clean (parentId = containment). End data lands on the
right scope via `targets`. Reconstruction can merge `targets` pulses into their scope.
**Con**: Slight complexity in the reconstruction logic. Two relationship types.

### Current leaning

**Option D** feels right. It preserves append-only semantics while keeping the tree
clean. The `targets` field is simple — it just says "associate this data with that scope."

But this is still open. We should sketch concrete reconstruction code for each option
and see which is actually simplest.

---

## 2. Delta encoding: what's the merge contract?

The emitter decides what's "new" — it just emits what it created. But the **consumer**
needs rules for reconstruction: "walk the parent chain, merge data, get full state."

### The question: what does `deepMerge(parent.data, child.data)` mean?

Consider:

```typescript
// Parent pulse (agent.start)
{ data: { agent: { id: "support", tools: ["search", "lookup"] }, messages: [msg1] } }

// Child pulse (model.start)
{ data: { messages: [msg2] } }
```

What is the reconstructed state at the child?

- If **objects deep-merge**: `{ agent: { id: "support", tools: ["search", "lookup"] }, messages: ??? }`
- If **arrays append**: `messages: [msg1, msg2]` ← what we want for messages
- If **arrays replace**: `messages: [msg2]` ← wrong, we lost msg1

But for other arrays:

```typescript
// Parent: { data: { tools: ["search", "lookup"] } }
// Child:  { data: { tools: ["search", "lookup", "email"] } }  // tool was added
```

Should tools append (giving duplicates) or replace?

### Options for merge strategy

**A. Convention-based** — all arrays append, all objects merge, all scalars replace.
Simple but sometimes wrong (the tools example above gets duplicates).

**B. Key-path rules** — a schema that says `messages` appends, `tools` replaces, etc.
Correct but requires maintaining a schema.

**C. Explicit delta markers** — the emitter annotates what it means:

```typescript
{ data: { messages: { __delta: "append", values: [msg2] } } }
{ data: { tools: { __delta: "replace", values: ["search", "lookup", "email"] } } }
```

Precise but verbose and ugly.

**D. Don't merge arrays automatically** — arrays are always replaced. For growing
collections like messages, the emitter stores only the delta as a named field:

```typescript
// Instead of: { data: { messages: [msg2] } }
// Emit:       { data: { newMessages: [msg2] } }
```

Reconstruction concatenates `newMessages` from the chain. The field name signals intent.

**E. Emitter-only deltas, no reconstruction** — pulses are self-contained enough that
reconstruction is rarely needed. When it is, it's done by domain-specific code that
knows the semantics, not a generic merge function.

### Current leaning

Probably a hybrid of **A** and **E**. Have a simple convention (scalars replace, objects
merge) but don't try to auto-reconstruct arrays. For growing collections, use explicit
delta fields (`newMessages`, `addedTools`). Domain-specific reconstruction code can
assemble these. The generic `reconstruct()` function handles the common case; anything
array-shaped is left to the caller.

But honestly — **this might not matter much in practice**. If pulses are designed well,
most consumers will read the stream linearly and won't need full-state reconstruction.
The primary use case is an LLM reading pulses in order and understanding what happened.

---

## 3. Streaming chunks: pulse-per-chunk or aggregate?

Model streaming produces many small events (text deltas, tool call chunks, etc.).

### The cost of pulse-per-chunk

A typical streamed response might produce 50-200 chunks. That's 50-200 pulses for a
single model call. For a 10-step agent, that's 500-2000 chunk pulses.

Most of the time, nobody cares about individual chunks. You want the final assembled
response. The chunks are only useful for:
- Debugging streaming issues
- Measuring time-to-first-token (TTFT)
- Observing token-by-token behavior

### Options

**A. Always emit chunk pulses** — simple, complete, but noisy. Storage cost is real.

**B. Never emit chunk pulses** — only emit `model.start` and `model.end`. Streaming
is invisible in the pulse stream. TTFT can still be captured as a field on `model.end`.

**C. Configurable fidelity** — a `verbosity` setting per pulse kind:
- `"normal"`: no chunk pulses, TTFT on model.end
- `"detailed"`: first chunk + last chunk + every Nth chunk
- `"verbose"`: every chunk

**D. Aggregate chunk pulse** — instead of per-chunk, emit periodic aggregates:

```typescript
{ kind: "model.chunks", data: { count: 47, firstChunkAt: 1234567890, texts: ["Let me", " check", ...] } }
```

One pulse instead of 47. Still captures the detail if needed.

### Current leaning

**B as default, C for opt-in**. The current system already has MODEL_CHUNK spans and
they're rarely useful. Emit `model.start` (with a note that it's streaming), then
`model.end` with the full result, TTFT, and usage. If someone explicitly wants chunk
detail, they can opt into verbose mode.

---

## 4. Kind taxonomy: how structured?

What does `kind` look like?

### Options

**A. Freeform strings** — `"agent.start"`, `"my-plugin.connect"`, whatever you want.
Maximum flexibility, no compile-time safety.

**B. Dot-namespaced convention** — `"{component}.{event}"` where component and event
are conventions, not enforced types. Like HTTP methods — everyone uses GET/POST but
nothing prevents you from using PATCH.

**C. Enum** — `PulseKind.AGENT_START`. Compile-time safety. Adding a new kind requires
changing core code. Same problem as `SpanType` today.

**D. Branded strings** — TypeScript template literal types:
```typescript
type PulseKind = `${string}.${string}`;
// or more specific:
type PulseKind = `${'agent'|'model'|'tool'|'workflow'|'log'|'metric'|'score'|'feedback'}.${string}`;
```

Some structure, still extensible.

### Current leaning

**B with D for core kinds**. Convention: `component.event`. Core kinds use template
literal types for autocomplete/safety. Third-party kinds are just strings that follow
the convention.

```typescript
// Core kinds — get autocomplete
type CorePulseKind =
  | `agent.${'start' | 'end'}`
  | `model.${'start' | 'end' | 'chunk'}`
  | `tool.${'call' | 'result'}`
  | `workflow.${'start' | 'end' | 'step.start' | 'step.end'}`
  | `log.${'debug' | 'info' | 'warn' | 'error' | 'fatal'}`
  | `metric`
  | `score`
  | `feedback`;

// Full kind type — core + extension
type PulseKind = CorePulseKind | (string & {});
```

The `(string & {})` trick allows any string while still giving autocomplete for core kinds.

---

## 5. What about trace IDs?

Current system has explicit `traceId` on every span (32 hex chars, OTel-compatible).
The pulse model derives traces from the tree (root pulse = trace root).

### Do we need explicit trace IDs?

**Arguments for**:
- External correlation (OTel, Langfuse, etc.)
- Querying: "give me all pulses in trace X" without tree traversal
- Cross-process traces where parent might not be local

**Arguments against**:
- Redundant with the tree structure
- Another field copied to every pulse
- The root pulse's ID IS the trace ID

### Current leaning

Include `traceId` as an optional field, derived from the root pulse ID by default.
When bridging to external systems, the bridge can assign an OTel-compatible trace ID.
Don't require it on every pulse — it can be materialized at query time by walking to root.

For cross-process traces (agent A calls agent B on another machine), the caller passes
its pulse ID as the parent, and the callee uses it. The trace is stitched together by
parentId, same as within a process.

---

## 6. Snapshot frequency for long chains

For a 100-turn conversation, reconstructing full state at turn 100 means walking 100+
pulses and merging. That's potentially expensive.

### Options

**A. No snapshots** — always walk the chain. Bound by conversation length. 100 turns
is probably fine. 10,000 turns might not be.

**B. Periodic snapshots** — every N pulses, emit a "snapshot" pulse with full state.
Reconstruction walks back to nearest snapshot.

**C. On-demand snapshots** — no automatic snapshots, but a `snapshot()` API that
captures full state when called. Useful for debugging.

**D. Materialized views** — the storage layer periodically materializes full state
at key pulses. Not part of the pulse stream itself.

### Current leaning

**A for now, B as an optimization later**. Most agent conversations are <50 turns.
Walking 50 pulses to reconstruct state is trivial. If we hit performance issues with
very long conversations, add periodic snapshots. Don't over-engineer upfront.

---

## Summary of current leanings

| Tension | Leaning | Confidence |
|---------|---------|------------|
| Tree semantics | Option D (clean tree + `targets` for scope closing) | Medium — need to sketch code |
| Delta merge contract | Convention (scalars replace, objects merge) + explicit delta fields for arrays | Medium |
| Streaming chunks | Don't emit by default, opt-in verbose mode | High |
| Kind taxonomy | Dot-namespaced convention + template literal types for core | High |
| Trace IDs | Optional, derived from root pulse ID | Medium |
| Snapshots | None initially, add if needed | High |
