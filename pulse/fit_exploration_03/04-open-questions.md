# Open Questions

## Export Family

### Is `Snapshot` separate?

Current leaning: avoid snapshots unless reconstruction forces them.

`Snapshot` is useful only if reconstruction needs bounded checkpoints with special query/storage behavior. If it only says "the context changed to this state," then it can be a `Change` with action `snapshot_created`.

Decision pressure:

- Prefer no snapshot if Pulses, Changes, and relationships can reconstruct state cheaply enough.
- If a snapshot is needed, prefer making it a special Pulse type rather than a sibling export artifact.
- Decide how a snapshot attaches to a flow before promoting it.
- Collapse into `Change` if snapshots are just another state transition.

### Is `Definition` separate?

Current leaning: unresolved.

Tool schemas, instruction versions, model settings, and processor configs read naturally as `Definition`. But the reduced family can represent them as `Change` records with actions like `definition_created` and `definition_updated`.

Definitions may also be temporary or permanent:

- temporary: runtime overrides, generated instructions, run-local tool schemas, one-run settings
- permanent: durable config, published versions, stored tool definitions, instruction revisions, reusable schemas

Concern:

- Collapsing `Definition` into `Change` makes runtime refs less semantic.
- Keeping `Definition` adds another top-level shape.
- Making `Definition` a special Pulse type may preserve the Pulse premise, but it needs concrete examples to prove it is not just a disguised artifact store.

### Is `Flow` separate?

Current leaning: derived index, not an exported Pulse-like envelope.

A flow should be reconstructable from Pulses and exported relationships. Rather than storing relationship fields directly on each Pulse object, the system may emit relationship records that connect Pulses into a graph in different ways.

Possible direction:

- `Flow` is not a telemetry event or Pulse-like envelope.
- `Flow` is a derived read/query index over Pulses and relationships.
- Exported relationships may replace embedded relationship fields on Pulse objects.
- Build the execution graph from relationship records such as parent, next, previous flow, subagent, resume, and uses-definition.

This should be tested in a separate flow/relationship-graph experiment.

## Messages And Context

### What owns content bodies?

Current leaning: the Pulse from the moment content enters execution should contain that content item.

When a new section of context appears, such as an LLM return, memory pull, tool output, reasoning chunk, or user input, the Pulse for that moment should carry the item. Ideally the full message array can be recreated from content-bearing Pulses plus relationships.

When context is removed, replaced, truncated, or compacted, record that as a `ChangePulse`.

Risk:

- Large content bodies may still need refs or external storage, but the conceptual owner is the moment Pulse that introduced the content.
- Reconstructing a full message array depends on the relationship graph being expressive enough.

### Should context reconstruction use all retained message refs?

Maybe not.

For large threads, retained refs could become another repeated array. Context changes should focus on changed refs and use snapshots only at bounded intervals.

## Agent Signals

### Is an Agent Signal a Pulse, a Change, or both?

Current leaning: unresolved pending a deeper Agent Signals source review.

Possible mapping still needs testing:

- signal arrival may be a Pulse
- signal-caused state mutation may be a ChangePulse
- some signal handling may need one Pulse with both arrival and mutation semantics

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
