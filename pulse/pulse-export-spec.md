# Pulse Export Spec

Status: initial integrated draft.

This spec consolidates the current Pulse model after `fit_exploration_04/` through `fit_exploration_09/`.
It is a candidate implementation target, not a final public API contract.

## Goals

Pulse exports should let readers reconstruct and explain:

- execution flows
- thread and turn order
- model input context
- content ownership
- definition, config, tool, skill, schedule, workflow, scorer, and model applicability
- signal delivery and model visibility
- state changes, context removal, compaction, and cancellation
- user-visible runtime decisions such as approvals, suspensions, retries, skips, and fallbacks

Pulse exports should avoid:

- full repeated message arrays
- Flow envelopes that recreate traces
- Definition exports that become artifact storage
- generic product event logging
- UI display snapshots
- transport, worker, pubsub, adapter, or storage bookkeeping
- timestamp-only ordering

## Export Family

```ts
type PulseExport =
  | Pulse
  | Relationship;

type Pulse =
  | ObservationPulse
  | ChangePulse
  | SnapshotPulse;
```

`ObservationPulse` records that something happened now.

`ChangePulse` records that durable, scoped, or logical state changed.

`SnapshotPulse` is a last-resort checkpoint. Avoid it unless reconstruction becomes unbounded or impractical without an exported checkpoint.

`Relationship` is an append-only link between Pulses, derived endpoint ids, referenced artifacts, external ids, or content refs.

Do not add top-level export families for Agent Signals, Flow, Definition, Agent Controller, background tasks, schedules, experiments, or evals unless a concrete source case cannot fit this model.

## Derived Endpoints

Derived endpoints are relationship targets, not exported envelopes.

```ts
type Endpoint =
  | { kind: 'pulse'; id: string }
  | { kind: 'flow'; id: string }
  | { kind: 'thread'; id: string }
  | { kind: 'model_input'; id: string }
  | { kind: 'content'; id: string }
  | { kind: 'definition'; id: string }
  | { kind: 'external'; id: string; system?: string };
```

`flow` identifies a derived execution graph.

`model_input` identifies the prompt sent to the model for one model turn.

Derived endpoint ids must not accumulate Pulse fields such as timestamp, surface, action, level, lifecycle state, or payload.

## Pulse Shape

Candidate shape:

```ts
type PulseBase = {
  id: string;
  timestamp: string;
  type: PulseType;
  surface: PulseSurface;
  action: string;
  level?: 'debug' | 'info' | 'warn' | 'error';
  text?: string;
  data?: Record<string, number>;
  attributes?: Record<string, unknown>;
  metadata?: Record<string, string>;
};
```

`type` is the semantic role of the Pulse, not the runtime component.

Candidate `type` values:

- `input`
- `output`
- `decision`
- `state`
- `error`
- `progress`
- `system`

`surface` is the domain area where the fact occurred. Common surfaces:

- `agent`
- `agent_config`
- `agent_controller`
- `background_task`
- `channel`
- `content`
- `context`
- `eval`
- `execution`
- `experiment`
- `memory`
- `model`
- `notification`
- `processor`
- `run_control`
- `schedule`
- `signal`
- `signal_queue`
- `suspension`
- `task`
- `thread`
- `thread_control`
- `tool`
- `tool_approval`
- `tool_config`
- `workflow`

`action` is surface-specific. Do not create global action semantics unless reader behavior is identical across surfaces.

## Relationship Shape

Candidate shape:

```ts
type Relationship = {
  id: string;
  timestamp: string;
  type: RelationshipType;
  from: Endpoint;
  to: Endpoint;
  attributes?: Record<string, unknown>;
  metadata?: Record<string, string>;
};
```

Relationships should not carry payload bodies.

Use purpose-named relationships when traversal, reconstruction, or explanation differs. Avoid overloading one generic parent field.

## Core Relationships

| Relationship | Purpose |
| --- | --- |
| `origin_of` | links origin Pulse to derived Flow id |
| `flow_contains` | links Flow id to member Pulse |
| `thread_contains_flow` | links thread to derived Flow id |
| `parent_of` | execution parentage only |
| `previous_flow` | thread or turn order |
| `resume_of` | resumed segment continues a suspended Pulse or segment |
| `external_parent` | bridge to an external trace, span, request, message, or platform parent |
| `uses_config_version` | runtime used durable agent config version |
| `uses_instruction_version` | runtime/model input used an instruction version |
| `uses_model_settings` | runtime/model call used model settings or provider options |
| `uses_tool_definition` | runtime tool call used a tool contract |
| `uses_definition` | generic fallback for less-common definition refs |
| `enables_definition` | scoped applicability adds a definition |
| `disables_definition` | scoped applicability removes a definition |
| `introduced_content` | Pulse introduced a content item |
| `included_in_model_input` | content/Pulse was visible in a specific model input |
| `removed_content` | ChangePulse removed content from context |
| `replaced_content` | ChangePulse replaced content in context |
| `compacted_to` | old content was compacted into summary/reflection content |
| `queued_signal` | queue ChangePulse queued a delivered signal |
| `drained_signal` | drain/content Pulse consumed a queued signal |
| `queued_follow_up` | thread/run control queued user content while a run was active |
| `schedule_triggered` | schedule fire caused a run, signal, or content introduction |
| `scored_target` | score/scorer Pulse evaluated a target trace, flow, item, or run |

## Candidate Relationships

Promote only when reader behavior changes without them.

- `validated_against`
- `shaped_by`
- `subagent_of`
- `delegates_to`
- `client_tool_bridge`
- `next_pulse`
- `next_context_item`
- `previous_context_item`
- `after_response_boundary`
- `signal_forwarded_to_owner`
- `local_signal_copy_discarded`
- `updates_state_lane`
- `applies_state_signal`
- `notification_signal_for`
- `summary_signal_for`
- `aborted_run`
- `stale_approval_for`
- `task_result_included_in_model_input`

## Flow Rules

Flow is a derived/materialized read model over Pulses and Relationships.

Emit:

- origin Pulse
- `origin_of`
- `flow_contains`
- `thread_contains_flow`
- `previous_flow` when thread/turn order matters
- `parent_of` only for execution parentage
- `resume_of` for suspended/resumed execution
- `external_parent` for external trace/span/request/message bridge

Do not emit a Flow envelope with lifecycle fields or payload.

If Flow starts accumulating authoritative state, reopen the Flow decision.

## Definition Rules

Definition bodies are referenced artifacts/contracts, not core exported runtime records.

Examples:

- agent config versions
- file-routed agent config, instruction, tool, skill, schedule, scorer, workflow, and subagent definitions
- instruction versions
- tool schemas
- skill metadata and bodies
- model settings and provider capability references
- processor configs
- workflow definitions
- scorer definitions
- output schemas

Represent lifecycle, selection, applicability, and temporary overrides with `ChangePulse` records and relationships.

Temporary versus permanent describes scope of effect:

- temporary: next step, one tool call, one model call, one decision, or one prompt turn
- permanent: until replaced within a scope, such as the rest of a run, a session, a thread, a published version, or future runs

Runtime use:

- emit direct `uses_*` relationships for explicit runtime facts
- emit `enables_definition` / `disables_definition` for scoped applicability
- materialize active-definition state in read indexes
- do not copy inherited definition refs onto every descendant Pulse by default

`DefinitionPulse` is not part of the current export family. Keep it as an escape hatch until a concrete source case requires it.

File path plus content hash is the safest minimum identity for file-routed definitions until a deployed version id exists.

## Content Rules

The Pulse from the moment content enters execution owns that content item.

Content may be inline or referenced. Large bodies should use content refs or external storage, but the introducing Pulse remains the conceptual owner.

Emit `introduced_content` from the introducing Pulse to the content ref.

Do not export repeated full `messages` arrays.

Represent context changes as ChangePulses and relationships:

- removal: `removed_content`
- replacement: `replaced_content`
- compaction: `compacted_to`
- model visibility: `included_in_model_input`

Do not rely on timestamps alone for context order. Use sequence metadata or explicit relationships when order affects reconstruction.

## Model Input Rules

`model_input` is a derived endpoint for one prompt sent to a model.

Use it to answer:

- which content was visible to the model
- which signal/context items were included
- which definitions/settings were active
- where a delayed signal became model-visible

Emit `included_in_model_input` for content-bearing Pulses or content refs that are visible in a model input.

`model_input` is not a Pulse export and should not carry lifecycle fields or payload.

Skill metadata injected into a system message is model-input visibility. Emit the injected content and link it to skill definitions and the model input. Do not emit separate low-level skill resolver events unless the resolver changed active applicability.

## Agent Signal Rules

Agent Signals are runtime/source objects, not Pulse exports.

Do not emit a generic signal-arrival Pulse.

Do not emit for `createSignal()` alone. It is validation/conversion, not an export boundary.

Use:

- `ObservationPulse(signal.delivery_decided)` when routing policy matters
- `ChangePulse(signal_queue.enqueued)` when delivery and model visibility are separated
- `ObservationPulse(signal.drained_to_context)` or `ObservationPulse(content.introduced)` when the signal enters transcript/model context
- `ChangePulse(signal.state_tracking_updated)` when a state signal mutates thread-scoped tracking
- `ChangePulse(notification_record.*)` when notification inbox records change
- `included_in_model_input` when signal content is visible in a model input

Delivery decisions:

- `wake`
- `deliver`
- `persist`
- `discard`
- `blocked`

Queue scopes:

- `pre-run`: folded into the first model request
- `pending`: drained into a later model turn and forces continuation
- `idle`: pending idle handoff, if exported

For delayed Agent Signals:

1. `signal.delivery_decided` owns routing.
2. `signal_queue.enqueued` owns delayed queue state.
3. `signal.drained_to_context` or `content.introduced` owns the signal body.
4. `included_in_model_input` anchors the signal to the model input turn.

Do not infer model visibility from original signal `createdAt` or API acceptance time.

State signal `mode: 'snapshot'` is an Agent Signal domain mode, not `SnapshotPulse`.

Skipped duplicate state signals do not introduce content.

## Run Control And Cancellation

Abort is cancellation/control, not Agent Signal content.

Use control/execution surfaces:

- `run_control`
- `thread_control`
- `execution`
- `model`
- `tool`
- `workflow`
- `background_task`

Candidate actions:

- `abort_requested`
- `abort_intent_recorded`
- `abort_deferred_for_approval_decline`
- `abort_propagated`
- `abort_observed`
- `abort_completed`

Emit when:

- user/system requests abort for a run or thread
- runtime records abort intent for a not-yet-prepared run
- abort must wait for a parked approval decline to persist the denied tool result
- abort propagates across delayed or remote boundaries
- model/tool/workflow/task execution changes behavior because cancellation was observed
- final run/step/task state records cancellation

Skip:

- local forwarding of an already-known `AbortSignal`
- repeated checks that do not change behavior
- expected AbortError as an error Pulse
- active `AbortController` registration unless it changes runtime state

Expected AbortError under an already-aborted signal is cancellation, not an error.

## Runtime Surface Rules

### Agent Controller And Session

Apply if Pulse covers current interactive agent runs.

Emit:

- `agent.run_started`
- `agent.run_finished`
- inbound `content.introduced`
- `signal.delivery_decided`
- `thread_control.follow_up_queued`
- `thread_control.follow_up_drained`
- `thread_control.follow_up_requeued`
- `tool_approval.required`
- `tool_approval.approved`
- `tool_approval.declined`
- `tool_approval.policy_granted` as a ChangePulse
- `tool.suspended`
- `tool.resumed`
- `tool.suspension_cancelled`
- `run_control.abort_requested`
- `run_control.abort_deferred_for_approval_decline`
- `run_control.abort_completed`
- `agent_config.mode_changed`
- `agent_config.model_changed`
- `agent_config.subagent_model_changed`
- `agent_config.om_model_changed`
- `model.fallback_used`
- `model.route_selected`

Skip:

- `display_state_changed`
- per-delta `message_update`
- `tool_input_delta` by default
- wholesale `state_changed` snapshots
- `usage_update` unless usage/cost export is in first scope

### Channels

Emit:

- normalized content entering the signal pipeline
- external relationships for platform thread id, message id, author id, and channel id
- `channel.session_rejected` only if refused inbound session creation needs auditability
- `tool_approval.stale_ignored` when a platform approval action has no matching parked gate and core refuses execution

Skip:

- adapter render modes
- typing/status output
- outgoing message edits
- chat SDK subscription setup
- platform thread history as separate content in the initial spec; today it is flattened into the resulting message text

### Tools, Approvals, And Suspensions

Emit:

- tool call start/result/error facts that explain execution
- tool approval required/approved/declined
- approval policy grants that change session behavior
- tool suspension/resume/cancelled facts
- `uses_tool_definition` from tool call, approval, resume, and background task execution to the tool definition

Skip:

- streaming tool input deltas unless chunk-level replay is in scope
- UI-only pending approval/suspension display projections

### Background Tasks

Emit task lifecycle facts only when tied to agent/tool/run execution:

- `background_task.enqueued`
- `background_task.running`
- `background_task.output`
- `background_task.suspended`
- `background_task.resumed`
- `background_task.cancelled`
- `background_task.completed`
- `background_task.failed`
- `background_task.retry_scheduled`
- `background_task.recovered`

Use reason/status attributes to distinguish failed, timed out, cancelled, retried, and recovered outcomes.

Skip:

- lifecycle pubsub transport
- SSE snapshots
- cleanup deletes
- subscribe/unsubscribe/ack mechanics
- active AbortController registration unless task state changes
- standalone task-manager observability unrelated to agent/tool runs

Relationships:

- `parent_of` from originating tool call Pulse to task lifecycle Pulses
- `uses_tool_definition` from task execution to the tool definition
- `resume_of` from resumed task Pulse to suspended task Pulse
- `included_in_model_input` if task result later becomes model-visible

### File-Routed Agents And Skills

Emit:

- `agent_config.resolved` when an effective runtime config is selected for use
- `agent_config.definition_warning` only for warnings that affect effective runtime behavior
- `definition.enabled` / `definition.disabled` ChangePulses for runtime-scoped active skill/tool/instruction changes
- `skill_metadata.included` when available skill metadata is injected into the system message

Skip:

- `agentConfig()` and `agentInstructions()` identity helpers
- every `resolveAgentSkills()` call
- `WorkspaceSkills.list/get/refresh` internals
- duplicate Pulses for both skill resolution and skill metadata injection when injection is the only model-visible fact

Relationships:

- `uses_config_version`
- `uses_instruction_version`
- `uses_tool_definition`
- `uses_definition`
- `included_in_model_input`

### Workflows

Emit:

- workflow run start/suspend/resume/restart/cancel/complete/fail
- step start/suspend/resume/complete/fail
- workflow definition/version selected for a run
- `resume_of` when a run or step continues from a suspended segment

Skip:

- internal snapshot storage shape
- worker subscription mechanics
- dynamic workflow catalog CRUD unless it changes an active definition used by a run

### Schedules

Emit:

- `schedule.fire_received`
- material prepare changes that alter prompt, params, provider options, or skip
- `schedule.skipped`
- `schedule.failed`
- `schedule.completed`
- `schedule.aborted`
- schedule-introduced content
- threaded schedule `signal.delivery_decided`
- resulting run linkage

Skip:

- worker group consumption
- trigger-row writes as the primary Pulse fact
- self-clean deletes unless separately modeled as admin/config changes
- hook plumbing that does not alter input or outcome

Relationships:

- `uses_definition` from schedule fire to schedule definition
- `introduced_content` from schedule fire to prompt content
- `schedule_triggered` from schedule fire to resulting signal/run when `parent_of` is too weak
- `queued_signal` / `drained_signal` when schedule delivery is delayed before model visibility

### Experiments And Evals

Experiment/eval events fit the export model but are optional for first scope unless evaluation export is a launch requirement.

Emit if in scope:

- `experiment.run_started`
- `experiment.item_completed`
- `experiment.run_finished`
- `experiment.observer_failed`
- `experiment.hook_failed`
- `scorer.started`
- `scorer.completed`
- `scorer.failed`
- `score.recorded`

Skip:

- experiment storage progress updates
- dataset CRUD/list/read
- observer callback delivery as a second fact
- best-effort score persistence failures unless diagnosing eval storage
- analytics queries

Relationships:

- `parent_of` from experiment run to item/scorer Pulses
- `uses_definition` from item/scorer run to target/scorer definitions
- `scored_target` from score/item to target trace/flow/run
- `uses_model_settings` for LLM-as-judge model calls

### Provider And Model Decisions

Emit:

- concrete selected model/provider for a model call
- fallback route used, including selected model versus requested model when available
- effective provider options that materially change behavior
- usage/cost facts if metrics export is in first scope

Skip:

- generated provider capability table updates as runtime Pulses
- static provider registry churn
- info-message-only fallback notices without structured route data

## Snapshot Rules

Avoid SnapshotPulse by default.

Allowed:

- materialized Flow index
- materialized active-definition index
- materialized context/model-input index
- materialized run/control status index

Not allowed by default:

- exported SnapshotPulse carrying repeated message arrays
- Flow envelope duplicating active config/content refs
- UI display state snapshots
- background task stream snapshots
- SnapshotPulse for Agent Signal `mode: 'snapshot'`

If reconstruction becomes unbounded, prefer read-model checkpoints before adding exported SnapshotPulse.

## Worked Scenario: Delayed Agent Signal

Active run receives a follow-up signal while a model iteration is in progress.

Emit routing decision:

```ts
{
  type: 'decision',
  surface: 'signal',
  action: 'delivery_decided',
  attributes: {
    signalId: 'sig_1',
    decision: 'deliver',
    runId: 'run_1'
  }
}
```

Emit queue state:

```ts
{
  type: 'state',
  surface: 'signal_queue',
  action: 'enqueued',
  attributes: {
    signalId: 'sig_1',
    scope: 'pending',
    runId: 'run_1'
  }
}
```

Emit model visibility:

```ts
{
  type: 'input',
  surface: 'signal',
  action: 'drained_to_context',
  attributes: {
    signalId: 'sig_1',
    scope: 'pending',
    modelInputId: 'model_input_2',
    forcedContinuation: true
  }
}
```

Relationships:

- `queued_signal`: queue ChangePulse -> delivery Pulse
- `drained_signal`: drain Pulse -> queue ChangePulse
- `introduced_content`: drain Pulse -> signal content ref
- `included_in_model_input`: drain Pulse or content ref -> model input endpoint

## Worked Scenario: Agent Controller Follow-Up

User sends a follow-up while a run is active.

```ts
{
  type: 'state',
  surface: 'thread_control',
  action: 'follow_up_queued',
  attributes: {
    threadId: 'thread_1',
    activeRunId: 'run_1',
    queuedContentId: 'content_followup_1'
  }
}
```

Relationships:

- `introduced_content`: inbound content Pulse -> follow-up content ref
- `queued_follow_up`: queue ChangePulse -> follow-up content ref
- `included_in_model_input`: follow-up content ref -> later model input endpoint, emitted only when drained

Do not infer model visibility from queue time.

## Worked Scenario: Background Task

Tool call starts a background task and later suspends.

```ts
{
  type: 'state',
  surface: 'background_task',
  action: 'running',
  attributes: {
    taskId: 'task_1',
    toolName: 'longSearch',
    toolCallId: 'tool_call_1',
    runId: 'run_1'
  }
}
```

```ts
{
  type: 'state',
  surface: 'background_task',
  action: 'suspended',
  attributes: {
    taskId: 'task_1',
    toolCallId: 'tool_call_1',
    suspendPayloadContentId: 'content_suspend_1'
  }
}
```

Relationships:

- `parent_of`: tool call Pulse -> task Pulse
- `uses_tool_definition`: task Pulse -> tool definition
- `introduced_content`: suspend Pulse -> suspend payload content ref, when payload is exported
- `resume_of`: resumed task Pulse -> suspended task Pulse

Do not emit pubsub subscribe/publish/ack facts for the task lifecycle transport.

## Worked Scenario: Skill Metadata In Model Input

SkillsProcessor injects available skills into a system message.

```ts
{
  type: 'input',
  surface: 'model',
  action: 'skill_metadata_included',
  attributes: {
    modelInputId: 'model_input_1',
    format: 'xml',
    skillCount: 3
  }
}
```

Relationships:

- `introduced_content`: skill metadata Pulse -> injected system-message content ref
- `uses_definition`: model input endpoint -> each included skill definition
- `included_in_model_input`: injected content ref -> model input endpoint

Do not emit separate low-level skill list/get/refresh Pulses unless those calls change active runtime applicability.

## Worked Scenario: Schedule Fire

Schedule introduces a prompt and wakes an agent run.

```ts
{
  type: 'input',
  surface: 'schedule',
  action: 'fire_received',
  attributes: {
    scheduleId: 'schedule_daily_report',
    agentId: 'reports',
    triggerKind: 'cron',
    scheduledFireAt: '2026-08-10T12:00:00.000Z'
  }
}
```

Relationships:

- `uses_definition`: schedule fire Pulse -> schedule definition
- `introduced_content`: schedule fire Pulse -> prompt content ref
- `schedule_triggered`: schedule fire Pulse -> resulting run or signal Pulse
- `queued_signal` / `drained_signal` if schedule delivery is delayed before model visibility

Do not emit trigger-row storage writes as the primary schedule fact.

## Worked Scenario: Context Compaction

When context is compacted, do not emit a full replacement message array.

```ts
{
  type: 'state',
  surface: 'context',
  action: 'compacted',
  attributes: {
    reason: 'context_window',
    removedCount: 42,
    summaryContentId: 'content_summary_1'
  }
}
```

Relationships:

- `removed_content` from compaction ChangePulse to removed content refs
- `compacted_to` from old content refs to summary content ref
- `introduced_content` from compaction ChangePulse to summary content ref

## Worked Scenario: Abort

Thread abort targets a local run.

Emit request:

```ts
{
  type: 'decision',
  surface: 'thread_control',
  action: 'abort_requested',
  attributes: {
    threadId: 'thread_1',
    resolvedRunId: 'run_1'
  }
}
```

Emit observation:

```ts
{
  type: 'state',
  surface: 'model',
  action: 'abort_observed',
  attributes: {
    runId: 'run_1',
    expected: true,
    stoppedChunkCollection: true
  }
}
```

Emit completion:

```ts
{
  type: 'state',
  surface: 'run_control',
  action: 'abort_completed',
  attributes: {
    runId: 'run_1'
  }
}
```

Do not emit an error Pulse for expected cancellation.

## Open Spec Questions

- Exact TypeScript shapes for `attributes` per surface/action.
- Whether `signal.drained_to_context` should collapse into generic `content.introduced`.
- Whether `after_response_boundary` should be promoted to core.
- Whether model input order should use sequence metadata, `next_context_item`, or both.
- Whether `updates_state_lane`, `applies_state_signal`, `notification_signal_for`, and `summary_signal_for` should be core.
- Exact content ref shape and external content storage rules.
- Which experiment/eval facts are first-scope versus second-scope.
- Whether `task_result_included_in_model_input` is needed or `included_in_model_input` is enough.
