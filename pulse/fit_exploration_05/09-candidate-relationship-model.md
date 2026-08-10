# Candidate Relationship Model

This captures the relationship model selected by this exploration.

## Position

`Flow` should not be an exported Pulse-like envelope.

The useful split is:

- Pulses observe moments and changes.
- Relationship records connect Pulses, content, definitions, external ids, threads, and derived flow ids.
- Flow is a materialized or query-time index over those records.

"Derived" should not mean "never stored." It means Flow has no independent event lifecycle. A database may materialize a Flow index for fast reads.

## Relationship Families

### Structural

Structural relationships answer "what contains or owns this?"

- `flow_contains`
- `thread_contains_flow`
- `parent_of`
- `origin_of`

Use structural edges for reconstruction and navigation. Do not overload them with resume or external parent semantics.

### Ordering

Ordering relationships answer "what came before this in a logical sequence?"

- `next_pulse`
- `previous_flow`
- `next_context_item`
- `previous_context_item`

Timestamps are useful attributes, but not sufficient for transcript or stream reconstruction.

### Lineage And Bridge

Lineage and bridge relationships answer "what is this continuing, delegating, or correlating with?"

- `resume_of`
- `external_parent`
- `delegates_to`
- `subagent_of`
- `client_tool_bridge`

These should not collapse into `parent_of`.

### Definition And Applicability

Definition relationships answer "which contract/config/body governed this?"

- `uses_config_version`
- `uses_instruction_version`
- `uses_tool_definition`
- `uses_model_settings`
- `validated_against`
- `enables_definition`
- `disables_definition`
- `shaped_by`

Use direct `uses_*` edges where the use is an actual runtime fact, such as a tool call using a tool definition or validation using a schema. Use `enables_definition` / `disables_definition` for scoped applicability changes.

### Content Transformation

Content relationships answer "what content entered, left, or replaced context?"

- `introduced_content`
- `removed_content`
- `replaced_content`
- `compacted_to`

These support the no-full-message-array rule without forcing Snapshot into the core model.

## Endpoint Rules

Relationship endpoints may point at:

- Pulse refs
- definition refs
- content refs
- external refs
- thread ids
- derived flow ids

Flow ids are allowed as endpoint identities only if they remain index identities. They should not carry Pulse fields, lifecycle state, or payload bodies.

## Late Relationship Rule

Relationships may be emitted after the endpoints they connect.

This is required by:

- provider tool calls whose final parent is known when the result arrives
- resume edges that are known after loading persisted suspended state
- context compaction that replaces prior content with a later summary
- external bridge edges discovered from incoming or outgoing carriers

## Direct Versus Implied Edges

Do not copy every inherited definition relationship onto every descendant Pulse by default.

Candidate rule:

- use direct `uses_*` edges for explicit runtime acts
- use scoped ChangePulses plus `enables_definition` / `disables_definition` for inherited applicability
- materialize active definition state in a derived read index when query speed requires it

This keeps export records semantic while allowing practical reads.
