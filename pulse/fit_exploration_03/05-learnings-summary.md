# Learnings Summary

This pass is early, but a few patterns are already clear.

## Confirmed

### Full message arrays should not be exported

The Harness run engine emits `message_update` events that contain growing message snapshots. That is useful for UI display, but it is the wrong source shape for Pulse.

Better direction:

- content pulses for text/reasoning/tool chunks
- context changes for message add/remove/clear/truncate
- relationships for flow/thread/message ordering
- optional snapshots for bounded reconstruction

### `Change` absorbs `Delta`

A separate `Delta` shape is unnecessary. Deltas are operations inside `Change`.

This maps well to:

- state signal `mode: 'delta'`
- message removals
- context truncation
- task list updates
- config edits

### `Relationship` is needed

Relationship records solve forward-link problems:

- parent/child after both exist
- next sibling after the next item exists
- previous flow within a thread
- suspended flow and resumed flow
- subagent flow and parent tool call
- runtime pulse uses a tool/schema/instruction definition

Without relationship records, immutable Pulses would either be incomplete or require mutation.

### Harness should be treated as source material, not as the Pulse surface

Harness events are often UI/read-model events. The Pulse-worthy facts are lower-level:

- user input accepted
- flow/run started or finished
- tool called/resulted/failed
- approval required/responded
- suspension created/resumed
- subagent started/finished
- task/context/memory changed

`display_state_changed` should be skipped.

## Weakened Or Unresolved

### Reduced family works, but `Definition` is a real pressure point

Representing tool definitions and schemas as `Change` is possible, but semantically odd. Runtime examples read better with a `Definition` export.

The reduced-family defense is storage simplicity. The expanded-family defense is semantic clarity and better refs.

### `Snapshot` is still unresolved

Context snapshots may be necessary to avoid expensive reconstruction. But if a snapshot is just "context version changed to this ref set," it can be a `Change`.

Decision should be based on read/query needs, not conceptual neatness.

### `Flow` is probably useful, but might be an index

A flow can be represented by relationships, but flow-level metadata is likely common enough that a separate `Flow` record or derived read model will be useful.

The open question is whether `Flow` is part of the append-only export family or only a materialized/query shape.

## Candidate Shape After This Pass

Most promising reduced export family:

```ts
type PulseExport =
  | Pulse
  | Change
  | Relationship
  | Snapshot;
```

With `Snapshot` optional pending reconstruction tests.

Most promising expanded export family:

```ts
type PulseExport =
  | Pulse
  | Flow
  | Definition
  | Change
  | Relationship
  | Snapshot;
```

The expanded family is clearer for definitions and flows. The reduced family is more philosophically aligned with keeping the model small.

## Risks

- `Change` may become too broad.
- `Flow` may become a renamed trace if it stores too much.
- `Snapshot` may reintroduce full message arrays under a different name.
- Harness display events can pollute Pulse if consumed directly.
- Content refs need a real strategy; otherwise duplication just moves from `messages` to `attributes`.

## Next Things To Test

- Can a full thread with three user turns be reconstructed without any exported `messages` array?
- Can tool definitions be represented as `Change` without awkward queries?
- Can Agent state signals produce one clean state history without duplicate Pulse plus Change payloads?
- Can Harness suspension/resume flows be linked cleanly with relationships only?
- Can `Flow` remain a minimal envelope instead of becoming a trace/span container?

