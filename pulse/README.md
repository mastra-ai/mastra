# Pulse

Pulse is a proposed observability model for Mastra that unifies the useful parts of logs, metrics, and traces into one lean event shape.

A Pulse is a timestamped observation of a system. Pulses can contain text, measurements, attributes, and relationships. Pulses form a directed execution graph that captures both hierarchy and sequence. Logs, metrics, events, and spans are all specialized views of the same underlying Pulse data.

The core idea is simple: everything observable is recorded as a pulse at a point in time. A pulse can describe what happened, carry quantified measurements, attach runtime context, and link itself into an execution flow without becoming a span.

The name is intentional. A pulse implies a point in time, something happening, participation in a larger living system, the ability to carry information, and the ability to flow through a network. It works as a concept for both humans and machines, while moving away from the OpenTelemetry vocabulary of traces, spans, logs, and metrics.

Alternative names considered: `Moment`, `Frame`.

## Goals

- Replace separate log, metric, and span concepts with a single shape.
- Record observable facts at a point in time instead of modeling duration as the primary primitive.
- Preserve trace-like navigation through parent, child, and sibling relationships.
- Keep child pulses lean by avoiding repeated data already present on parent pulses.
- Support agent, workflow, tool, model, storage, and system observability without baking those categories into the pulse type system.

## Non-Goals

- Pulse is not a new name for spans.
- Pulse is not only a trace model.
- Pulse does not require every event to know a duration.
- Pulse should not force runtime concepts like agent, step, tool, or chunk into the top-level event type.
- Pulse should not duplicate parent context into every child event.

## Conceptual Model

Most observability systems are shaped like this:

```txt
Trace
└── Span
    └── Events
```

Pulse is shaped more like this:

```txt
Pulse
├── Text
├── Data
├── Attributes
└── Relationships
```

A pulse can behave like a log, a metric, a decision, an error, an input, or an output without changing shape. That is the simplification: observability categories become views over the same atomic unit instead of separate primitives.

An execution flow can then be modeled as pulses:

```txt
Flow
├── Pulse
├── Pulse
└── Pulse
```

Or, when hierarchy matters:

```txt
Execution Flow
└── Pulses
```

## Pulse Shape

```ts
type Pulse = {
  timestamp: string;
  type: PulseType;
  level?: PulseLevel;
  text?: string;
  data?: Record<string, number>;
  attributes?: Record<string, unknown>;
  metadata?: Record<string, string>;
  id: PulseId;
  links: PulseLinks;
};
```

### `timestamp`

The point in time when the pulse was recorded.

Pulse starts from the premise that observability should be event-first. Duration is derived from the time between paired pulses rather than captured as a field on a pulse.

### `type`

The kind of thing being observed.

Candidate types:

- `input`
- `output`
- `decision`
- `error`
- `reasoning`
- `state`
- `progress`
- `system`

The type should describe the semantic role of the pulse, not the Mastra runtime component that emitted it. For example, `input` is a better pulse type than `agent`, `step`, or `chunk`.

### `level`

An optional severity or visibility hint.

Candidate levels:

- `debug`
- `info`
- `warn`
- `error`

Open question: Pulse may not need `level` if `type`, `text`, and query-time filtering are expressive enough. If included, `level` should remain a presentation and filtering hint, not a structural primitive.

### `text`

A human-readable description of what happened.

This carries the useful part of a log line: concise narrative context that helps a developer understand the event without decoding structured fields first.

### `data`

Numeric measurements associated with the pulse.

This carries the useful part of metrics. Values should be quantified numbers that can be aggregated, charted, alerted on, or compared.

Duration should not be captured in `data`. It is the difference between paired pulse timestamps.

Examples:

```ts
data: {
  inputTokens: 1240,
  outputTokens: 312,
  retryCount: 1,
}
```

### `attributes`

Structured context about what ran or what happened.

Attributes may contain complex values. They are for runtime-local facts that explain the pulse.

Examples:

```ts
attributes: {
  model: "__GATEWAY_OPENAI_MODEL__",
  toolName: "searchDocs",
  resultCount: 8,
  suspended: false,
}
```

### `metadata`

External relationship tracking fields.

Metadata is intentionally limited to simple string key/value pairs. It should be used for correlation with external systems, tenants, environments, deployments, providers, or user-defined identifiers.

Examples:

```ts
metadata: {
  tenantId: "acme",
  deploymentId: "prod-2026-06-18",
  externalTraceId: "abc123",
}
```

## Identity

Pulse identity is split into root, seed, and pulse identifiers.

```ts
type PulseId = {
  rootId: string;
  seedId?: string;
  pulseId: string;
};
```

### `rootId`

Identifies the root pulse tree.

This is equivalent in role and precision to an OpenTelemetry-compatible trace ID.

If Pulse moves further away from tracing vocabulary, this may become `flowId`.

### `seedId`

Identifies the parent root when a nested execution creates its own pulse root.

This lets nested agents, workflows, or other delegated executions have distinct roots while still preserving their relationship to the execution that started them.

### `pulseId`

Identifies a single pulse.

This is equivalent in role and precision to an OpenTelemetry-compatible span ID, but it identifies a point-in-time pulse rather than a span.

## Relationships

Pulses form a directed execution graph that combines hierarchy with sequence.

This is not only a tree. It is closer to a tree plus a doubly linked list:

- `parent` means containment or causality.
- `children` means contained or caused pulses.
- `next` and `prev` mean temporal sequence between siblings.

Most tracing systems store parent and children relationships, then reconstruct ordering from timestamps. Pulse makes execution order a first-class relationship.

```ts
type PulseLinks = {
  root?: string;
  parent?: string;
  children?: string[];
  next?: string;
  prev?: string;
};
```

### `root`

The starting pulse for the tree.

### `parent`

The pulse that directly caused or contains this pulse.

Every non-root pulse has a parent.

### `children`

The pulses directly caused by this pulse.

Children should add new information. They should not repeat or duplicate data already sent on the parent pulse.

### `next` and `prev`

Sibling links that preserve local ordering between pulses with the same parent.

This gives Pulse trace-like traversal without requiring spans as the primary data model. It also lets readers distinguish containment from temporal sequence.

## Terminology

Pulse can keep ID compatibility with existing observability systems while using its own vocabulary internally.

| Existing Term | Pulse Term |
| --- | --- |
| Trace | Flow |
| Span | Pulse |
| Event | Pulse |
| Trace ID | Flow ID |
| Span ID | Pulse ID |
| Root Span | Origin Pulse |

Open question: The current shape uses `rootId` and `pulseId` because they make ID compatibility obvious. A more Pulse-native version might use `flowId`, `originPulse`, and `pulseId`.

## Lean Child Pulses

Pulse should avoid context duplication by design.

If a parent pulse already includes stable context, child pulses should inherit that context through links instead of repeating it. Child pulses should only add the information that is new at that point in the execution.

For example, a model call root pulse might include the model name and provider. Token counts on the output pulse should not need to repeat the model name unless it changed or the child must stand alone for export.

## Open Questions

- Should `level` exist, or should severity be expressed through `type` and attributes?
- What is the minimal useful set of initial pulse types?
- Should `children` be stored directly, derived from `parent`, or both?
- Should `next` and `prev` be required for all siblings, or derived when storage can guarantee ordering?
- Should identity use compatibility-oriented names like `rootId` or Pulse-native names like `flowId`?
- Should `seedId` be part of the core identity model, or should nested roots be represented through relationships only?
- Which fields should be required for transport versus derived for query and display?
