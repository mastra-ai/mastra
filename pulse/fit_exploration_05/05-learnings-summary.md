# Learnings Summary

This file summarizes the Flow / Relationship Graph experiment.

## Starting Hypothesis

Flow should be a derived read/query index over Pulses and exported relationships, not an exported Pulse-like envelope.

The strongest reason to test this now is the result from `fit_exploration_04`: referenced definitions only work if relationship edges can reconstruct active config, instructions, tools, schemas, settings, and content without copying those bodies into every Pulse.

## Starting Failure Conditions

This direction should fail if:

- common reads require unbounded replay from the origin Pulse
- relationship edges become another overloaded parent/config field
- content order cannot be reconstructed without full message arrays
- scoped definition applicability cannot be reconstructed without copying refs onto every Pulse
- the derived Flow index needs lifecycle semantics that make it an exported event envelope

## First-Pass Learnings

### Derived Flow Is Plausible, But Needs Materialization

Current tracing already reconstructs tree views from flat span records. Pulse can do the same with relationships, but common reads will likely need a lightweight Flow index.

The key boundary: a Flow index may be stored, but it should not have event lifecycle semantics.

### `parent_of` Must Stay Narrow

Resume, external parentage, subagent delegation, content order, and definition applicability should not collapse into a generic parent field.

This directly supports the PR #20499 lesson.

### Relationships Need Late Emission

Provider-executed tool calls are a concrete source case where the final parent is known only when the result arrives. Pulse relationship records must be appendable after both endpoint Pulses exist.

### Timestamp Ordering Is Not Enough

MessageList and stream chunk reconstruction preserve order with explicit insertion behavior. Pulse should test order edges or sequence metadata for context/message reconstruction.

### Definitions Can Avoid Per-Pulse Copying

The first pass supports the Exploration 04 result if:

- direct `uses_*` edges are emitted for explicit runtime acts
- scoped applicability changes use `enables_definition` / `disables_definition`
- active definition state can be materialized in a derived read index

### Relationship Vocabulary Needs A Reader-Behavior Rule

Purpose-named edges are justified when traversal, reconstruction, or explanation differs. Otherwise, prefer a smaller relationship plus attributes.

This keeps the model from replacing one overloaded parent field with an unbounded edge ontology.

### Earlier Audits Agree With This Direction

Harness suspension, subagent delegation, message context reconstruction, and config provenance notes already pointed toward explicit relationship records.

Exploration 05 tightens that into relationship families and clarifies that Flow can be materialized without becoming an exported event family.

## Closing Verdict

The candidate passes this experiment.

Flow should be a derived/materialized index, not an exported Pulse-like envelope. Relationship records should be exported append-only facts.

The minimum export family now looks like:

```ts
type PulseExport =
  | Pulse
  | Relationship;
```

Where:

- `ChangePulse` is a Pulse specialization.
- `SnapshotPulse` remains a last-resort Pulse specialization.
- Definition bodies remain referenced artifacts/contracts.
- Flow, active-definition state, and context state can be materialized read indexes.

## Decisions

- Allow `flow` endpoint ids as derived index identities.
- Keep `parent_of` limited to execution parentage.
- Use `resume_of` for suspend/resume lineage.
- Use `external_parent` for external trace/request correlation.
- Use `thread_contains_flow` and `previous_flow` for thread order.
- Use direct `uses_*` edges for explicit runtime facts.
- Use scoped ChangePulses plus `enables_definition` / `disables_definition` for inherited applicability.
- Use content relationships or sequence metadata for message/context order.

## Remaining Risks

- Relationship vocabulary can still sprawl.
- Materialized Flow can still become an exported envelope if implementation discipline slips.
- Long context reconstruction may still need checkpoints, but those should be read-model checkpoints before exported SnapshotPulse.
