# Export Family Comparison

## Reduced Family

```ts
type PulseExport =
  | Pulse
  | Change
  | Relationship
  | Snapshot;
```

Possibly:

```ts
type PulseExport =
  | Pulse
  | Change
  | Relationship;
```

### Strengths

- Small conceptual surface.
- Fits the original Pulse instinct: fewer top-level concepts.
- Forces stable definitions/config/context edits to be modeled as changes, not runtime observations.
- Avoids turning `Flow` into a renamed trace unless needed.

### Weaknesses

- `Change` becomes overloaded.
- Tool definitions and schemas are awkward as `Change`.
- Flow-level data may have no obvious home.
- Content refs need an unnamed backing concept.

### Best Fits

- context truncation
- message add/remove/clear
- task list update
- state signal snapshot/delta
- pending suspension state
- config version created
- previous-flow links
- resume/subagent/uses-definition relationships

## Expanded Family

```ts
type PulseExport =
  | Pulse
  | Flow
  | Definition
  | Change
  | Relationship
  | Snapshot;
```

### Strengths

- `Definition` makes tool schemas, instructions, model settings, processor configs, and output schemas clear.
- `Flow` gives thread/order/config refs a home without duplicating them on every Pulse.
- `Snapshot` is explicit if reconstruction needs checkpoints.
- Runtime refs read naturally: Pulse uses Definition; Flow contains Pulse.

### Weaknesses

- More object-model complexity.
- Could drift back toward traditional tracing/resource/event object taxonomies.
- Each added shape needs a hard reason to exist.

### Best Fits

- stable tool definitions
- instruction versions
- model configs
- flow-level thread/config/resource refs
- context reconstruction snapshots

## Current Leaning

Use the reduced family as the historical test harness, but tighten the next pass around the premise that observable records should be Pulses. `Change` and any forced `Snapshot` should be tested as special Pulse types before treating them as sibling export artifacts.

`Snapshot` should be avoided by default. It should be promoted only if reconstruction without snapshots is too expensive or unbounded, and even then the likely shape is a special snapshot Pulse attached into a flow.

`Definition` needs more research. It clarifies instructions, settings, configs, tool schemas, and model settings, especially when those bodies can be referenced by runtime Pulses. The next fit pass should test whether definitions are separate artifacts, special Pulse types, or payloads attached to definition-created / definition-updated Pulses. It should also test temporary definitions versus permanent definitions.

`Flow` should be tested as a derived read model rather than an exported record. The stronger direction is to build the graph from exported Pulse relationships instead of embedding all relationship types on each Pulse object. This needs its own flow/relationship-graph experiment.

## Failure Conditions

The reduced family fails if:

- `Change` needs too many unrelated action namespaces.
- every runtime ref points at a `Change` in a way that is semantically unclear.
- flow-level fields get duplicated across Pulses.
- content bodies have no clean storage/export story.
- relationships are embedded in Pulse objects in a way that makes append-only graph construction awkward.

The expanded family fails if:

- `Flow` stores children and becomes a trace/span tree.
- `Definition` stores per-run payloads.
- `Snapshot` stores full repeated message arrays.
- query complexity increases without reducing duplicated payloads.
