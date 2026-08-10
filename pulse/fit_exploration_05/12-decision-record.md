# Decision Record

This file closes the main questions from the Flow / Relationship Graph experiment.

## Decision 1: Flow Identity

Use `flow` endpoint ids as derived index identities.

Accepted shape:

```ts
{ kind: 'flow', id: 'flow_123' }
```

Constraints:

- a Flow id is an index identity, not an exported observability record
- Flow does not have Pulse fields such as `timestamp`, `surface`, `action`, `level`, or payload
- Flow status, origin, active config, and content state are computed or materialized from Pulses and relationships
- emitters should not write Flow lifecycle facts directly

Why not origin Pulse only:

- thread-to-flow and previous-flow edges read awkwardly when every Flow identity is an origin Pulse ref
- derived indexes often need stable ids anyway
- the risk is manageable if Flow ids remain non-observational

Failure trigger:

- if Flow accumulates lifecycle semantics, promote that concern back to open instead of pretending Flow is still derived

## Decision 2: Core Relationship Vocabulary

Core relationships are the small set required to reconstruct execution, thread order, resume, external bridge, definition use, and content state.

### Core

| Relationship | Purpose |
| --- | --- |
| `origin_of` | links origin Pulse to derived Flow id |
| `flow_contains` | links Flow id to member Pulse |
| `thread_contains_flow` | links thread to derived Flow id |
| `parent_of` | execution parentage only |
| `previous_flow` | thread/turn order |
| `resume_of` | resumed segment continues a suspended Pulse/segment |
| `external_parent` | bridge to external trace/span/request parent |
| `uses_config_version` | runtime used durable agent config version |
| `uses_tool_definition` | runtime tool call used a tool contract |
| `uses_definition` | generic fallback for less-common definition refs |
| `enables_definition` | scoped applicability adds a definition |
| `disables_definition` | scoped applicability removes a definition |
| `introduced_content` | Pulse introduced a content item |
| `removed_content` | ChangePulse removed content from context |
| `replaced_content` | ChangePulse replaced content in context |
| `compacted_to` | old content was compacted into summary/reflection content |

### Candidate

| Relationship | Why Candidate |
| --- | --- |
| `uses_instruction_version` | useful if instructions are queried separately from agent config |
| `uses_model_settings` | useful for model routing/override analysis |
| `validated_against` | useful for schema validation failures |
| `shaped_by` | useful for structured output / schema-shaped output |
| `subagent_of` | useful if subagent runs get separate Flow ids |
| `delegates_to` | useful for parent tool-call to subagent/workflow invocation |
| `client_tool_bridge` | useful for client-side execution carrier correlation |
| `next_pulse` | useful only when sibling order is semantically important |
| `next_context_item` | useful if content order is represented by edges instead of sequence numbers |
| `previous_context_item` | likely derivable from `next_context_item` |

Rule:

- promote a candidate to core only when reader behavior changes without it
- otherwise prefer a generic relationship plus attributes

## Decision 3: Direct Versus Implied Definition Edges

Use both, but for different jobs.

Direct runtime facts:

- tool call directly emits `uses_tool_definition`
- validation failure directly emits `validated_against`
- run start directly emits `uses_config_version`

Inherited applicability:

- scoped tool-setting changes emit `enables_definition` / `disables_definition`
- active definition state is materialized by a read index
- descendant Pulses do not copy inherited refs by default

This preserves the Exploration 04 result without bloating every Pulse.

## Decision 4: Order

Do not depend on timestamps alone.

Use:

- `previous_flow` for thread/turn order
- explicit content order edges or sequence metadata for context reconstruction
- optional `next_pulse` only where sibling Pulse order is semantically meaningful

Reason:

- source already works around timestamp collisions in `MessageList`
- streamed chunks and provider tool events can arrive or resolve out of ordinary timestamp order

## Decision 5: Snapshots

Do not add Snapshot as a core export for Flow reconstruction.

Allowed:

- materialized Flow index
- materialized active-definition index
- materialized context index

Not allowed by default:

- exported SnapshotPulse carrying repeated message arrays
- Flow envelope duplicating active config/content refs as authoritative facts

If reconstruction becomes unbounded, prefer read-model checkpoints before adding exported SnapshotPulse.

## Verdict

The candidate passes this experiment.

Recommended next model:

```ts
type PulseExport =
  | Pulse
  | Relationship;
```

Where:

- `ChangePulse` is a Pulse specialization
- `SnapshotPulse` remains a last-resort Pulse specialization
- Flow is a derived/materialized index
- Definition bodies are referenced artifacts/contracts
- Relationships are append-only records that make Flow, context, and definition usage reconstructable

