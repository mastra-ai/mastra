# Current Pulse Model

This is the current candidate model after `fit_exploration_04/`, `fit_exploration_05/`, `fit_exploration_06/`, `fit_exploration_07/`, and `fit_exploration_08/`.
It is not a final spec. It records the strongest working shape so future experiments do not reopen settled ground accidentally.

## Export Family

Current candidate:

```ts
type PulseExport =
  | Pulse
  | Relationship;

type Pulse =
  | ObservationPulse
  | ChangePulse
  | SnapshotPulse;
```

`ObservationPulse` is the ordinary runtime moment fact.

`ChangePulse` is a Pulse specialization for durable or logical state changes, including config changes, definition applicability, context removal, context replacement, and compaction.

`SnapshotPulse` is a last-resort Pulse specialization. Avoid it unless reconstruction becomes unbounded or impractical without an exported checkpoint.

`Relationship` is the main non-Pulse export because some links are append-only facts discovered after one or both endpoints exist.

## Derived Read Models

`Flow` is a derived or materialized read/query index, not an exported Pulse-like envelope.

`model_input` is a derived/index endpoint for the prompt sent to the model at a specific turn.

Flow ids may appear as relationship endpoints:

```ts
{ kind: 'flow', id: 'flow_123' }
```

A Flow id is an index identity only. It should not carry Pulse fields such as timestamp, surface, action, level, lifecycle state, or payload.

Model input ids may appear as relationship endpoints:

```ts
{ kind: 'model_input', id: 'model_input_123' }
```

A model input id is an ordering/reconstruction identity only. It should not become a new exported envelope.

Other likely read models:

- active-definition state
- reconstructed context state
- message-list views
- model-input order
- thread order

These can be materialized for performance, but they should be derived from Pulses and Relationships.

## Definitions

Definition bodies are referenced artifacts or contracts, not core exported runtime records.

Examples:

- tool schemas
- instruction versions
- model settings
- processor configs
- reusable output schemas

Lifecycle, selection, applicability, and temporary override facts should be represented by `ChangePulse` records and relationships.

Runtime use should be represented by purpose-named relationships, such as `uses_config_version`, `uses_tool_definition`, `uses_definition`, `enables_definition`, and `disables_definition`.

Temporary versus permanent describes scope of effect, not physical persistence:

- temporary: applies to the next step, one tool call, one model call, or one decision
- permanent: applies until replaced within a scope, such as the remainder of a run, a published version, or future runs

Inline one-off definition bodies are acceptable on `ChangePulse` records. `DefinitionPulse` should remain rare and provisional until a concrete source case requires it.

## Content

The Pulse from the moment content enters execution owns that content item.

Examples:

- user input
- model text chunk
- reasoning chunk
- tool output
- memory pull
- compacted summary

Context removal, replacement, truncation, and compaction should be recorded as `ChangePulse` records plus content relationships. Avoid exporting repeated full message arrays.

Large bodies may still use refs or external storage, but the conceptual owner remains the introducing Pulse.

## Relationship Vocabulary

Core relationships:

| Relationship | Purpose |
| --- | --- |
| `origin_of` | links origin Pulse to derived Flow id |
| `flow_contains` | links Flow id to member Pulse |
| `thread_contains_flow` | links thread to derived Flow id |
| `parent_of` | execution parentage only |
| `previous_flow` | thread or turn order |
| `resume_of` | resumed segment continues a suspended Pulse or segment |
| `external_parent` | bridge to an external trace, span, or request parent |
| `uses_config_version` | runtime used durable agent config version |
| `uses_tool_definition` | runtime tool call used a tool contract |
| `uses_definition` | generic fallback for less-common definition refs |
| `enables_definition` | scoped applicability adds a definition |
| `disables_definition` | scoped applicability removes a definition |
| `introduced_content` | Pulse introduced a content item |
| `included_in_model_input` | content or signal Pulse was visible in a specific model input |
| `removed_content` | ChangePulse removed content from context |
| `replaced_content` | ChangePulse replaced content in context |
| `compacted_to` | old content was compacted into summary or reflection content |

Candidate relationships:

- `uses_instruction_version`
- `uses_model_settings`
- `validated_against`
- `shaped_by`
- `subagent_of`
- `delegates_to`
- `client_tool_bridge`
- `next_pulse`
- `next_context_item`
- `previous_context_item`
- `queued_signal`
- `drained_signal`
- `after_response_boundary`

Promote a candidate to core only when reader behavior changes without it.

## Resolved Or Leaning-Resolved Questions

- Snapshot: avoid by default; if needed, make it a `SnapshotPulse`.
- Definition: referenced artifacts/contracts plus `ChangePulse` lifecycle and relationship-based use.
- Flow: derived/materialized index over Pulses and Relationships.
- Content bodies: owned by the introducing Pulse, with removals and transformations recorded as `ChangePulse` records and relationships.
- Agent Signals: no top-level `Signal` export; use delivery decision Pulses, content-introducing Pulses, state/notification ChangePulses, and relationships.
- Signal queues: delivery is not model visibility; emit queue, drain, and model-input facts when delivery and model-context entry are separated.
- Abort: model as run/thread/execution control, not Agent Signal content.

## Agent Signals

Agent Signals are source/runtime objects, not Pulse exports.

Use:

- `ObservationPulse(signal.delivery_decided)` when routing policy matters: `wake`, `deliver`, `persist`, `discard`, or `blocked`
- `ObservationPulse(signal.accepted)` or `ObservationPulse(content.introduced)` when signal content enters transcript/model context
- `ChangePulse(signal.state_tracking_updated)` when a state signal mutates thread-scoped tracking
- `ChangePulse(notification_record.*)` when notification inbox records change
- relationships such as `applies_state_signal`, `updates_state_lane`, `notification_signal_for`, and `summary_signal_for`

Do not emit a generic signal-arrival Pulse by default. `createSignal()` is validation/conversion, not an export boundary. State signal `mode: 'snapshot'` is a domain mode, not `SnapshotPulse`.

Queued signals need a stronger reconstruction rule from `fit_exploration_08`: if delivery occurs before model visibility, emit queue, drain, and model-input facts. Pre-run signals are folded into the first model request; pending signals become a later model turn and force continuation.

For delayed Agent Signals:

- `signal.delivery_decided` owns routing
- `signal_queue.enqueued` owns delayed queue state
- `signal.drained_to_context` or `content.introduced` owns the signal body
- `included_in_model_input` anchors the content to the model input turn

Do not infer model visibility from original signal `createdAt` or API acceptance time.

## Abort And Cancellation

Abort is cancellation/control, not an Agent Signal.

Use control or execution surfaces:

- `run_control`
- `thread_control`
- `execution`
- `model`
- `tool`

Candidate actions:

- `abort_requested`
- `abort_intent_recorded`
- `abort_propagated`
- `abort_observed`
- `abort_completed`

Expected `AbortError` under an already-aborted signal is not an error Pulse. Do not create content refs for abort. Do not use `SnapshotPulse`.
