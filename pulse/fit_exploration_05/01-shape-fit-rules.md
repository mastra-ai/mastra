# Shape Fit Rules

This pass tests whether a Flow can be derived from Pulses plus exported relationships.

## Candidate Direction

```ts
type PulseRef = {
  kind: 'pulse';
  id: string;
};

type DefinitionRef = {
  kind: 'definition';
  id: string;
  version?: string | number;
  hash?: string;
};

type ExternalRef = {
  kind: 'external';
  system: string;
  id: string;
};

type RelationshipEndpoint =
  | PulseRef
  | DefinitionRef
  | ExternalRef
  | { kind: 'content'; id: string }
  | { kind: 'thread'; id: string }
  | { kind: 'flow'; id: string };

type PulseRelationship = {
  exportType: 'relationship';
  id: string;
  relationship: RelationshipType;
  from: RelationshipEndpoint;
  to: RelationshipEndpoint;
  timestamp?: string;
  scope?: RelationshipScope;
  attributes?: Record<string, unknown>;
};
```

`Flow` is not exported as a Pulse-like record. It is a derived index over:

- Pulses
- relationship records
- optional read/materialized indexes

Derived does not mean unstored. A Flow index may be materialized for reads as long as it does not have event lifecycle semantics.

## Relationship Type Rules

Prefer purpose-named relationships when the edge changes semantic meaning:

- `flow_contains`
- `thread_contains_flow`
- `parent_of`
- `origin_of`
- `next_pulse`
- `previous_flow`
- `resume_of`
- `delegates_to`
- `subagent_of`
- `external_parent`
- `uses_config_version`
- `uses_instruction_version`
- `uses_tool_definition`
- `uses_model_settings`
- `validated_against`
- `enables_definition`
- `disables_definition`
- `introduced_content`
- `removed_content`
- `replaced_content`
- `compacted_to`

Do not force unrelated semantics through one generic `parent` field.

Relationships may be emitted late, after both endpoints exist. This is required for provider tool calls, resume edges, context compaction, and external bridge correlation.

## Flow Rules

- A Flow starts at an origin Pulse.
- A Flow is reconstructed from containment, ordering, lineage, and derivation relationships.
- A thread can contain multiple flows.
- Flow order in a thread should be represented with `previous_flow`, not inferred from timestamp alone.
- `next_pulse` is likely selective, not mandatory for every sibling. Use explicit order edges or sequence metadata where ordering is semantically important.

## Definition Rules

- Durable definition bodies are not copied onto every Pulse.
- Relationships should let readers find active definitions for a Pulse.
- Scoped definition changes may be represented with `enables_definition`, `disables_definition`, or `uses_*` relationships from a ChangePulse.
- Direct `uses_*` edges are preferred for explicit runtime acts. Scoped ChangePulses imply inherited applicability until superseded.

## Content Rules

- A content-bearing Pulse owns the content item it introduces.
- Context removals, replacements, truncations, and compactions are ChangePulses.
- Relationships or sequence metadata should reconstruct the message/context order without exporting full message arrays.

## Devil's Advocate

This model may be too pure. A derived Flow without a durable envelope may make common reads expensive, especially "show me this run with active config, context, parentage, and resumed segments." If every reader must replay relationship history from the origin Pulse, a Flow index becomes mandatory. The experiment should distinguish "not exported" from "not materialized"; a derived Flow index may still need storage.

Another failure mode is relationship vocabulary sprawl. Purpose-named relationships avoid overloaded parent fields, but an unbounded edge taxonomy makes readers brittle. Prefer explicit names only where reader behavior changes.
