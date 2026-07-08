# Open Questions

## Export Family

### Is `Snapshot` separate?

Current leaning: maybe.

`Snapshot` is useful if reconstruction needs bounded checkpoints with special query/storage behavior. If it only says "the context changed to this state," then it can be a `Change` with action `snapshot_created`.

Decision pressure:

- Keep separate if snapshots are read-optimized checkpoints.
- Collapse into `Change` if snapshots are just another state transition.

### Is `Definition` separate?

Current leaning: unresolved.

Tool schemas, instruction versions, model settings, and processor configs read naturally as `Definition`. But the reduced family can represent them as `Change` records with actions like `definition_created` and `definition_updated`.

Concern:

- Collapsing `Definition` into `Change` makes runtime refs less semantic.
- Keeping `Definition` adds another top-level shape.

### Is `Flow` separate?

Current leaning: probably yes for read ergonomics, but not proven.

A flow can be implied by an origin Pulse plus relationships. However, flow-level data like thread id, previous flow id, origin pulse, active config refs, and root ids may be awkward without a separate record.

Possible compromise:

- `Flow` is not a telemetry event.
- `Flow` is an index/envelope record or derived read model.
- The append-only export stream can still use `Relationship` for ordering.

## Messages And Context

### What owns content bodies?

The examples use `contentRef`, but this pass has not named a content export shape.

Options:

- use `Change` for content creation
- use `Definition` for stable content
- use an external content-addressed store
- allow `Pulse.attributes` to carry small content inline

Risk:

- Without a content strategy, "no messages array" just moves duplicated payloads elsewhere.

### Should context reconstruction use all retained message refs?

Maybe not.

For large threads, retained refs could become another repeated array. Context changes should focus on changed refs and use snapshots only at bounded intervals.

## Agent Signals

### Is an Agent Signal a Pulse, a Change, or both?

It depends on the signal type.

- user/reactive/notification signals entering a flow are Pulses.
- state signals that update context are Changes.
- a state signal entering model context during a flow may also deserve a Pulse.

Concern:

- Emitting both for every state signal could duplicate data unless one only references the other.

### Should signal subscription changes be Pulse exports?

Usually no.

Subscribing a thread to an external resource is a relationship/config change. A notification arriving from that resource is the runtime Pulse.

## Harness

### Should Harness UI events become Pulses?

No, not directly.

Harness events are useful source material, but many are UI read-model snapshots. Pulse should target the underlying execution, decision, input, output, state change, and relationship.

### Are tool approval and suspension separate surfaces?

Current leaning: yes.

They are not just tool calls. They represent human/external gates that affect execution order and flow continuity.

### Are Harness thread changes in scope?

Only selectively.

Thread creation and flow ordering matter. Thread selection in a UI may not matter unless it starts or changes execution context.

## Vocabulary

### Should `surface` include `message`?

Maybe not.

`message` is often a read-model artifact. `content` or `context` may be better:

- `content.text_chunk`
- `context.message_added`
- `context.message_removed`

### Should actions be global or surface-specific?

Surface-specific.

`created` means different things for `thread`, `suspension`, `tool_config`, and `context`. A global enum would either be too generic or too large.

## Deferred

- exact id field names
- precise `ExportRef` shape
- content-addressing details
- persistence/query indexes
- UI generation names
- migration from current observability

