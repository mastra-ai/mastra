# Open Questions

## Is Flow Allowed As An Endpoint?

If `Flow` is not exported, relationship examples still may need a `flow` endpoint for containment.

Options:

- use origin Pulse as the flow identity
- allow `flow` endpoint ids as derived/index identities
- emit a minimal non-observational Flow index record

Decision:

- Allow `flow` endpoint ids as derived/index identities, but do not give Flow Pulse fields or lifecycle semantics.
- If this becomes too envelope-like, fall back to using origin Pulse as the flow identity.

Failure mode:

- A "non-exported" Flow quietly becomes an exported envelope with lifecycle semantics.

## Should Relationships Be Direct Facts Or Derived Facts?

Examples:

- A direct `uses_tool_definition` edge on every tool call is easy to query.
- An `enables_definition` edge on an earlier ChangePulse plus ordering/scope may imply later use.

Question:

- Where is the line between useful denormalization and duplicating inherited context?

Decision:

- Direct edges are warranted for explicit runtime acts, such as a tool call using a tool definition.
- Inherited applicability should come from scoped ChangePulses plus materialized read indexes.

## Do We Need Containment Edges And `parent_of`?

Containment and execution parentage are not always the same.

Examples:

- a thread contains flows
- a flow contains Pulses
- an agent run is parent of a model call
- an external trace is parent-like but not a Mastra execution parent

Question:

- Are `flow_contains`, `thread_contains_flow`, `parent_of`, `external_parent`, and `resume_of` enough to avoid overloaded parent semantics?

Decision:

- Add delegation-specific edges such as `delegates_to` or `subagent_of`; subagent execution is not only parentage.

## How Is Order Reconstructed?

Timestamp ordering is insufficient when events are concurrent, buffered, retried, or emitted after the fact.

Candidate order edges:

- `next_pulse`
- `previous_context_item`
- `previous_flow`
- `next_context_item`
- sequence numbers on relationship attributes

Question:

- Which order relations need explicit append-only edges, and which can be derived?

Decision:

- Thread flow order and context/message order need explicit relationships or sequence metadata.
- Sibling Pulse order inside a narrow parent may still sort by timestamp plus sequence.

## Can Graph Reconstruction Avoid Snapshots?

If context and active definitions require replaying an unbounded graph, snapshots may reappear as read checkpoints.

Question:

- What is the smallest derived/materialized index that avoids promoting Snapshot back into a core export family?

Decision:

- Materialized read indexes are acceptable. Exported SnapshotPulse is still a last resort for bounded reconstruction, not a default.

## What Relationship Vocabulary Is Too Specific?

Purpose-named edges avoid overloaded fields, but too many edge names create a bespoke ontology.

Question:

- Should Pulse use many explicit relationship names, or a smaller set with typed attributes?

Decision:

- Use purpose-named edges only where traversal, reconstruction, or explanation differs.
- Keep less-common cases as candidate relationships until a reader needs them.
