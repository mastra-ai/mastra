# Pulse Glossary

This glossary defines working terms used across the Pulse notes. It is not a spec. Terms marked as candidates or unresolved are still being tested in fit explorations.

## Core Concepts

### Pulse

A timestamped observation that something happened now.

A Pulse can carry text, numeric data, structured attributes, metadata, and relationships to other records. It is intentionally point-in-time, not duration-first.

Use `Pulse` for runtime observations such as model output, tool call, agent run state, approval decision, signal accepted, or error observed.

### Flow

A coherent execution made of related Pulse records and relationships.

`flow` is the preferred Pulse term for what tracing systems usually call a trace. A flow can include hierarchy, sequence, nested work, and references to config or definitions.

Decision after `fit_exploration_05`: `Flow` should be a derived or materialized read/query index, not an exported Pulse-like envelope. It should be reconstructed from Pulses and exported relationships.

### Origin Pulse

The first Pulse in a flow.

This replaces "root span" in Pulse-native language. The origin Pulse identifies the start of a coherent execution, such as an agent turn, workflow run, or tool-owned delegated run.

### Pulse ID

The identifier for one Pulse.

It should keep span-id-like precision for compatibility, but the object it identifies is a point-in-time observation, not a span.

### Flow ID

The identifier for a flow.

It should keep trace-id-like precision for compatibility. Earlier notes use `rootId`; current leaning is to use `flowId` in Pulse-native APIs.

### Thread

A grouping of related flows, usually conversational turns.

`threadId` groups flows but does not encode order. Use explicit flow relationships, such as `previous_flow`, to represent turn order.

### Previous Flow

A relationship from the current flow to the flow that came before it in a thread or comparable sequence.

`previousFlowId` can be stored on a flow-like envelope or represented as a `Relationship(previous_flow)`. `nextFlowId` is likely derivable.

## Export Family

### Pulse Export

Any append-only record emitted by the Pulse system.

The current candidate after `fit_exploration_04` and `fit_exploration_05` is:

```ts
type PulseExport =
  | Pulse
  | Relationship;
```

`Change` and any forced `Snapshot` are special kinds of Pulse rather than siblings of Pulse:

```ts
type Pulse =
  | ObservationPulse
  | ChangePulse
  | SnapshotPulse;
```

`Relationship` remains the main non-Pulse candidate because it records links that may only be known after the related Pulses exist.

`Flow` is a derived/materialized index. `Definition` bodies are referenced artifacts/contracts, with lifecycle and applicability represented by Pulses and relationships.

### Change

A Pulse specialization describing that a durable or logical state changed.

Use `ChangePulse` for agent config edits, context truncation, message removal, state-signal updates, task-list updates, pending-item state, and definition lifecycle or applicability changes.

`ChangePulse` absorbs delta-like behavior through operations. There is no current need for a separate `Delta` export shape.

Earlier notes may say `Change`; current naming preference is `ChangePulse`.

### Change Operation

A structured description of how state changed inside a `Change`.

Candidate operations include `add`, `remove`, `replace`, `move`, `truncate`, and `compact`. Use operations when the important fact is how state changed, not only that it changed.

### Relationship

An append-only link between exports or external ids.

Use `Relationship` for links that are awkward or impossible to know at the original emission time, such as `parent`, `next`, `flow_contains`, `thread_contains_flow`, `previous_flow`, `uses_config_version`, `uses_tool_definition`, `resume_of`, and `subagent_of`.

Relationships should not carry payload data.

### Snapshot

A bounded reconstruction checkpoint.

Avoid snapshots by default. They are a concession to bounded reconstruction, not a concept to add for neatness.

Use `SnapshotPulse` only if read/query needs require a checkpoint that cannot be reconstructed cheaply from prior Pulses and ChangePulses. If a snapshot only means "this state changed to this ref set," it should collapse into `ChangePulse`.

Snapshots should mostly contain refs, counts, hashes, and bounded summary data. They should not reintroduce full repeated message arrays.

Decision after `fit_exploration_05`: snapshots are not core exports for Flow reconstruction. Prefer materialized read-model checkpoints before adding exported SnapshotPulses.

### Definition

A stable reusable body referenced by runtime exports.

Candidate definitions include tool schemas, instruction versions, model settings, processor configs, and reusable content.

Definitions are useful because they separate stable explanatory material from runtime observations. A runtime Pulse can then reference the instruction version, model settings, tool schema, or config state it used instead of copying that body into every event.

Definitions may be temporary or permanent by scope of effect:

- temporary definitions apply only to a bounded scope, such as the next step, one tool call, one model call, or one decision
- permanent definitions keep applying until another change replaces them, such as for the remainder of a run, a published version, or future runs

Decision after `fit_exploration_04`: durable or reusable definitions should be referenced artifacts/contracts, while lifecycle, selection, applicability, and use should be represented by Pulses and relationships. Temporary definitions should usually be inline or referenced bodies on ChangePulses. `DefinitionPulse` should remain rare and provisional until a concrete source case needs it.

## Pulse Fields

### Type

The semantic role of a Pulse.

Candidate values include `input`, `output`, `decision`, `error`, `reasoning`, `state`, `progress`, and `system`.

Do not use runtime component names like `agent`, `tool`, or `model` as Pulse types. Those belong in `surface`.

### Surface

The domain area where the observation or change occurred.

Candidate surfaces include `agent`, `agent_config`, `model`, `tool`, `tool_config`, `context`, `thread`, `signal`, `memory`, `task`, `workflow`, `processor`, `scorer`, `eval`, `harness`, `suspension`, `tool_approval`, `plan`, and `content`.

Surfaces should describe the domain result, not the product page or UI that caused it. For example, use `agent_config`, not `agent_builder`, for a committed instruction change.

### Action

The constrained verb for a surface.

Actions should be surface-specific. For example, `created` means different things for `thread`, `suspension`, and `agent_config`, while `text_chunk` only makes sense for model or content surfaces.

Avoid storing generated display names like `model.text_chunk` as an event name. Display names can be derived from `surface` and `action`.

### Level

An optional severity or visibility hint.

Candidate values are `debug`, `info`, `warn`, and `error`. `level` should not be structural; filtering by `type`, `surface`, `action`, and relationships is more important.

### Text

A concise natural-language description of the observation.

`text` should be useful to agents first and humans second. It is optional; display text can be generated from structured fields.

### Data

Numeric measurements on a Pulse.

Use `data` for values worth aggregating, graphing, comparing, or alerting on, such as token counts, retry counts, score values, chunk counts, or usage totals.

Duration-like measurements are allowed only when they are meaningful facts on a Pulse. Do not recreate spans by emitting generic start/end/duration pairs for every operation.

### Attributes

Action-specific structured context.

Use `attributes` for runtime-local facts that explain what happened, including selected ids, input/output summaries, error details, provider details, or source information. This field is under pressure because it can become too broad.

### Metadata

External or correlation-oriented string fields.

Use `metadata` for tenant ids, deployment ids, external trace ids, provider ids, or user-defined correlation values. Metadata should stay simple string key/value data.

### Export Ref

A reference to another Pulse export, external object, or content body.

The exact shape is deferred. Examples include references to a Pulse, Change, Definition, content body, config version, tool definition, or flow.

## Runtime And State Terms

### Context

The active model or agent context used to produce behavior.

Context should be represented through content Pulses, context Changes, relationships, and bounded snapshots. Do not export repeated full `messages` arrays as Pulse attributes.

### Content

The body or body fragment that enters or exits execution.

Content can include user text, model text chunks, reasoning chunks, tool output, system instructions, memory pulls, or compacted summaries.

Current leaning: the Pulse from the moment content enters execution should contain that content item. Context removals, replacements, truncations, and compactions should be recorded as ChangePulses.

Large bodies may still need refs or external storage, but conceptually the owner is the Pulse that introduced the content.

### Message

A common read-model object for chat-style UI and model context.

`message` is intentionally not a preferred Pulse surface right now. Use `content` for bodies and `context` for add/remove/truncate/compact operations unless a later exploration proves `message` is necessary.

### Agent Signal

A signal delivered to an agent thread or run.

Decision after `fit_exploration_06`: Agent Signals are source/runtime objects, not Pulse exports. Use delivery decision Pulses for routing, content-introducing Pulses when signal bodies enter context, ChangePulses for state and notification mutations, and relationships to connect those facts. Do not emit a generic signal-arrival Pulse by default.

Decision after `fit_exploration_08`: delivery is not model visibility. Queued Agent Signals need explicit queue, drain, and model-input facts when delivery and model-context entry are separated. Pre-run signals are folded into the first model request; pending signals become a later model turn and force continuation. Do not infer model visibility from original signal timestamps.

### Model Input

A derived/index endpoint representing the prompt sent to the model for one model turn.

Use model input ids to reconstruct which content items were visible to the model and in what turn. A model input id may be a relationship endpoint, but it is not an exported Pulse-like envelope.

### State Signal

A signal that updates or contributes to agent context or state.

State signal snapshots and deltas are Agent Signal domain modes, not Pulse `SnapshotPulse`. Accepted state signals usually produce a content-introducing Pulse plus a `ChangePulse` for thread-scoped state tracking. Skipped duplicate state signals do not introduce content.

### Abort Signal

A runtime cancellation signal, usually an `AbortSignal`, used to stop or interrupt execution.

Abort signals are not Agent Signals and do not carry content. Model them as run/thread/execution control facts, such as `abort_requested`, `abort_intent_recorded`, `abort_propagated`, `abort_observed`, and `abort_completed`. Expected aborts should not become error Pulses.

### Harness

The local runtime/session layer that can receive user input, deliver signals, run agents, track pending work, and emit UI-facing events.

Harness events are source material, not automatically Pulse records. Skip display snapshots and growing message snapshots. Keep the underlying execution, decision, state, and relationship facts.

### Pending Item

A durable Harness item waiting for external action.

Examples include tool approvals, tool suspensions, questions, and plan approvals. Pending item lifecycle usually maps to `Change` records, with related decision Pulses for approvals, declines, resumes, or cancellations.

### Suspension

A pause in execution that waits for external input or resume data.

Suspension is a candidate surface because it affects flow continuity. Use relationships such as `resume_of` to link resumed work to the suspended point.

### Tool Approval

A human or policy gate before a tool executes.

Tool approval is a candidate surface separate from `tool` because approval decisions explain why execution proceeded, stopped, or changed.

## Configuration And Provenance

### Config Provenance

Append-only records that explain which configuration produced later runtime behavior.

Good candidates include agent created, version created, version published, instructions changed, tool added or removed, model changed, request context schema changed, memory changed, and scorer/eval attached.

Config provenance is not generic storage observability. Emit it at the product/API/domain boundary, not from storage adapter internals.

### Config Version

A stable version of agent, tool, workflow, or related runtime configuration.

Runtime flows should reference config versions instead of copying full instructions, schemas, tool definitions, and model settings into every Pulse.

### Product Source

The product or API surface that caused a domain change.

Examples include Agent Builder, Agent CMS, API, CLI, import, migration, or code sync. Product source should usually be an attribute such as `source: 'agent_builder'`, not the Pulse surface.

### Primitive

The user-facing thing that owns work.

Examples include agent, workflow, tool, processor, scorer, or eval. `primitive` is optional because ownership is often inherited through flow or relationship context.

## Terms To Avoid Or Treat Carefully

### Span

Do not use `span` as the core Pulse concept.

Pulse may keep OpenTelemetry-compatible ids, but a Pulse is not a duration-first span.

### Trace

Use `flow` for Pulse-native language.

Use `trace` only when discussing compatibility with existing observability systems.

### Delta

Do not introduce a separate `Delta` export shape unless a later exploration proves `Change.operations` cannot represent the needed state transitions.

### UI Event

Do not map UI events directly to Pulses.

Keep committed domain changes, runtime decisions, state changes, and execution observations. Skip clicks, display-state changes, list views, and read-model snapshots unless they materially affect execution.
