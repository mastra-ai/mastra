# Adversarial Review

This pass tries to break the relationship-graph direction.

## Challenge 1: Is A Materialized Flow Index Just A Flow Export In Disguise?

Risk: "derived Flow" becomes a stored envelope with status, timestamps, config refs, root fields, and lifecycle events.

Boundary that keeps the model coherent:

- Flow index rows are read models, not exported observability records.
- Flow index rows do not record lifecycle facts that are absent from Pulses.
- Flow status is computed from member Pulses or materialized from them.
- Flow config/context state is computed from relationships or materialized from them.

Failure mode:

- readers need Flow-specific lifecycle history
- Flow has payload bodies or event fields
- emitters write Flow as the authoritative fact instead of writing Pulses and relationships

If that happens, Flow has become a sibling export family.

## Challenge 2: Are Relationship Names Becoming An Ontology Trap?

Risk: purpose-named edges avoid overloaded parent fields but create dozens of bespoke relationship names.

The useful rule is reader behavior:

- If two edges are read the same way, prefer one relationship plus attributes.
- If two edges change traversal, reconstruction, or user-facing explanation, use distinct names.

Examples:

- `parent_of` and `resume_of` deserve different names because traversal and explanation differ.
- `uses_tool_definition` and `uses_model_settings` may deserve different names if common readers filter them differently.
- `provider_tool_result_of` may be too specific if a generic `result_of` edge plus `surface: 'tool'` reads cleanly.

## Challenge 3: Can Relationships Avoid Duplicating State?

Risk: every Pulse emits all active config, tool, schema, instruction, and context refs.

Rule:

- Emit direct edges for explicit runtime facts.
- Emit scoped ChangePulse edges for inherited applicability.
- Let read indexes materialize "active at this Pulse" state.

This keeps the append stream semantic while still making reads practical.

## Challenge 4: Does Content Ordering Need A Separate Model?

Risk: content reconstruction starts looking like a second graph unrelated to Flow.

Current answer:

- Content order is part of the same relationship graph.
- It may need a smaller vocabulary: `introduced_content`, `next_context_item`, `removed_content`, `replaced_content`, `compacted_to`.
- Context read indexes can materialize ordered content state without exporting snapshots.

Failure mode:

- every model call needs a full content array relationship set
- compaction cannot be understood without replaying the full thread
- content refs carry hidden mutable state outside Pulses and ChangePulses

## Challenge 5: Does `flow` As Endpoint Violate "No Flow Export"?

A `flow` endpoint id is acceptable only as an index identity.

If that feels too subtle, use the origin Pulse as flow identity:

```ts
{ kind: 'flow_origin', pulseId: 'pulse_run_started' }
```

The tradeoff:

- flow endpoint ids are ergonomic for thread containment and previous-flow edges
- origin Pulse identity is stricter but makes every flow relation indirect

Decision: allow `flow` endpoint ids, but keep them explicitly non-observational.

## Revised Leaning

The graph direction survives this pass with three constraints:

1. Flow may be materialized, but not exported as an event/envelope.
2. Relationship names should be purpose-named only when reader behavior differs.
3. Direct edges should represent explicit facts; inherited state belongs in scoped changes plus read indexes.
