# Learnings Summary

This summarizes the current takeaways from `fit_exploration_01`, including corrections from review notes. It should be read as a working position, not a spec.

## Core Direction

Pulse should not recreate traces, spans, logs, or metrics under new names.

The useful simplification is still:

- one timestamped observation shape
- semantic observation type
- numeric data for graphable quantities
- links for hierarchy and sequence
- no duration field
- no automatic start/end span pairs

The first exploration confirmed that many audited events can fit this shape, but it also exposed that the candidate shape needs more root-level structure than originally written.

## Shape Changes To Explore

### Add Root-Level `action`

Raw audit names should not become `type`, but they also should not be buried in unconstrained `attributes.event`.

Current leaning:

```ts
type Pulse = {
  type: 'input' | 'output' | 'decision' | 'error' | 'reasoning' | 'state' | 'progress' | 'system';
  action: 'execute_started' | 'snapshot_emitted' | 'retry_scheduled' | string;
}
```

The exact vocabulary is open. The important point is that this field should behave more like a constrained action than a human-facing name.

Rejected or weak options:

- `name`: too likely to become generic display text
- `attributes.event`: too easy to fragment and too hidden for machine use
- component-specific values in `type`: makes `type` stop being useful

Devil's advocate: if `action` remains a broad string, it has the same failure mode as `name`. The value is only real if the SDK defines a small vocabulary or uses typed action unions by surface.

### Add Root-Level `surface` Or `primitive`

Runtime surface should not be encoded in `type`, but it probably should not live in attributes either.

Current leaning:

```ts
type Pulse = {
  surface: 'agent' | 'workflow' | 'tool' | 'model' | 'processor' | 'scorer' | 'eval' | 'memory' | 'channel' | string;
}
```

Open naming issue:

- `surface` describes where the observation happened.
- `primitive` describes what user-facing thing owns the work.

These may not be identical. Example: a model Pulse can happen under an agent primitive. A memory Pulse can be owned by an agent but performed by memory.

Possible shape:

```ts
type Pulse = {
  surface: 'model';
  primitive?: {
    type: 'agent';
    id?: string;
  };
}
```

This needs more testing against model calls, memory operations, task tools, A2A, and workflow steps.

### Reconsider `attributes`

The first pass used `attributes` as broad runtime context. That may be too vague.

The desired use seems closer to action-specific payload:

- raw input
- raw output
- error details
- model/provider-specific details
- tool arguments
- usage details not suitable for numeric `data`

Possible alternatives:

- keep `attributes`, but define it as action-specific structured context
- rename to `parameters`
- split by type: `input`, `output`, `error`
- keep `attributes` only for secondary facts and add explicit payload fields

The split-by-type option is tempting, but it may recreate the current span-type-specific schema complexity. The main risk is losing the single-shape advantage.

### Make `text` Agent-Readable First

`text` should not be assumed to be primarily human-facing.

Current leaning:

- `text` is optional.
- When present, it should be concise, agent-readable, and semantically useful.
- Human display strings can be generated from `type`, `surface`, `action`, and payload.

This means Pulse should not require a log-style sentence for every observation.

### Keep `level`, But Do Not Rely On It

`level` may be useful as a review/display granularity hint:

```ts
level?: 'debug' | 'info' | 'warn' | 'error';
```

Current leaning:

- optional
- default `info`
- not structural
- not the main filtering mechanism

Filtering by `type`, `surface`, `action`, and relationships is probably stronger than log-level filtering.

## Confirmed Decisions

### Do Not Recreate Spans

Start/end pairs should not be automatic.

Duplicating tracing semantics is a non-goal. A pair of Pulses is useful only when each point carries its own observation.

For model calls, the first exploration's "good pair" may still be too span-shaped. A better pattern might be:

- model stream started
- one or more aggregated text chunk Pulses
- final output Pulse only if the completed output carries distinct information

There does not need to be a generic `completed` Pulse for every started operation.

### `data` Works For Numeric Measurements

The fit for numeric data still looks good.

Good `data` candidates:

- token counts
- retry counts
- chunk counts
- status counters
- scores
- latency-adjacent counters that are measured directly
- usage totals

Still excluded:

- duration
- booleans
- ids
- strings
- provider names
- status values
- nested provider usage objects

Rule of thumb: if we want to graph, trend, aggregate, or compare it over time, it probably belongs in `data`.

Duration remains derived from related timestamps, not captured as data.

### Storage Operations Should Usually Not Emit Pulse

Persistence is usually not interesting for understanding what an agent did.

Storage should generally not emit Pulse for every read/write.

Better pattern:

- the primitive or component that performed the meaningful action emits the Pulse
- storage failures surface as primitive-owned `error` Pulses only when they affect execution
- durable state changes may become `state` Pulses at the caller boundary

Example: memory writes should be represented as memory/agent state changes, not storage adapter insert events.

## Streaming And Chunks

High-volume streaming should stay in scope, but the model should be closer to existing `CHUNK_SPAN` behavior than to full per-token persistence.

Current leaning:

- emit stream-start Pulse
- collect text deltas
- emit aggregated `text_chunk` Pulse
- possibly repeat chunk Pulses at bounded intervals
- avoid one persisted Pulse per tiny token delta by default

This is close to the desired "point in time observation" model because a chunk Pulse can say "this accumulated chunk was emitted now" without implying a span duration.

Open issue: whether live subscribers and persisted storage should see the same chunk stream. They may need different retention/granularity rules.

## Roots, Seeds, And Nested Work

Current leaning: nested primitives should usually stay in the same root.

Reason:

- for subagents and internal workflows, it is still valuable to know where execution started
- splitting roots too aggressively makes causal understanding harder

`seedId` may still be useful, but the name and semantics need work.

Possible role:

- keep `rootId` for the overall execution origin
- use a seed-like id only when a nested execution creates an independently inspectable tree
- do not use it just because a subagent or child workflow exists

Open naming issue: `seedId` may not be the best term. Alternatives should be tested once the root semantics are clearer.

## Surface Notes

Current surface candidates that feel reasonable:

- `agent`
- `workflow`
- `tool`
- `model`
- `processor`
- `scorer`
- `eval`
- `memory`
- `channel`
- `harness`
- `sandbox`

Uncertain names:

- `a2a`
- `code_mode`
- `state_signal`

Memory should be treated as a surface owned by the agent when memory performs the action. The owner/origin should be the item that performed the action, while primitive context can still point back to the agent.

## Scope Notes

### RAG Ingestion

RAG ingestion probably qualifies as a primitive, but it is not worth over-optimizing for now.

Working position:

- include it when it is explicit user runtime work
- do not prioritize generic vector/storage plumbing
- expect this area to change as RAG patterns continue to evolve

### Task Tools

Current leaning still holds:

- task tools are tools
- task state is special because it shapes model behavior
- emit tool-call Pulses and task/state Pulses when both tell different facts
- avoid duplicating full task state in multiple child Pulses

### Memory Pulses

The owner/origin should be the component that performed the action.

Working position:

- agent-owned memory activity emits under agent context
- processor-owned memory activity emits under processor context
- direct memory admin APIs stay out of scope

## Event Strings And Display

Saved Pulses probably do not need human names.

The UI can derive display strings from:

- `type`
- `surface`
- `action`
- `level`
- `data`
- selected payload fields

This is closer to a `toString()` operation than saved event naming.

Still, the persisted Pulse likely needs a machine action field. The open question is not "name or no name"; it is whether a constrained `action` field is needed for machine interpretation.

## Deferred For Later

These are intentionally not important for this phase:

- emission API
- storage implementation
- exporter compatibility
- migration from spans/logs/metrics
- old observability query views
- redaction mechanics
- hot-path performance details

They matter later, but answering them now would likely distort the shape exploration.

## Current Candidate Shape

This is not a final proposal. It reflects the current learning summary.

```ts
type Pulse = {
  timestamp: string;
  type: 'input' | 'output' | 'decision' | 'error' | 'reasoning' | 'state' | 'progress' | 'system';
  action?: string;
  surface?: string;
  primitive?: {
    type: string;
    id?: string;
  };
  level?: 'debug' | 'info' | 'warn' | 'error';
  text?: string;
  data?: Record<string, number>;
  attributes?: Record<string, unknown>;
  metadata?: Record<string, string>;
  id: {
    rootId: string;
    seedId?: string;
    pulseId: string;
  };
  links: {
    parent?: string;
    children?: string[];
    prev?: string;
    next?: string;
  };
};
```

Most important unresolved issue: whether `attributes` stays broad or gets replaced/supplemented with explicit payload fields.
