# Implementation Handoff

This file turns the branch-refresh exploration into a concrete implementation-planning checklist.

It names semantic Pulse boundaries. It does not decide where the Pulse writer lives.

## Global Rule

Emit where a user-visible or reconstructable fact becomes true.

Do not emit at every existing event fan-out point. Existing controller events, stream chunks, pubsub messages, observer callbacks, and storage writes are source material, not automatic Pulse boundaries.

## Agent Controller And Session

Primary source:

- `packages/core/src/agent-controller/session.ts`
- `packages/core/src/agent-controller/session-run-engine.ts`

Emit:

- `agent.run_started` when `SessionRunEngine.processStream()` starts processing a run and emits `agent_start`.
- `agent.run_finished` when `Session.finishAgentRun()` emits terminal `agent_end`, with reason `complete`, `error`, `suspended`, or `aborted`.
- `content.introduced` for user/channel message content before it is sent through `sendSignal()`.
- `signal.delivery_decided` from the accepted `agent.sendSignal()` action when available.
- `thread_control.follow_up_queued` when `followUp()` delays content behind an active run.
- `thread_control.follow_up_drained` when `drainFollowUpQueue()` successfully hands the queued content to the agent.
- `thread_control.follow_up_requeued` when `drainFollowUpQueue()` catches setup failure and requeues the content.
- `tool_approval.required` when `SessionRunEngine` receives `tool-call-approval` and arms the approval gate.
- `tool_approval.approved` or `tool_approval.declined` when the parked gate resolves and the approval/decline is driven into the agent.
- `tool_approval.policy_granted` as a ChangePulse when `always_allow_category`, `grantCategory()`, or `grantTool()` changes session behavior.
- `tool.suspended` when `tool-call-suspended` registers a suspension.
- `tool.resumed` when `resumeToolCall()` sends resume data to the agent.
- `tool.suspension_cancelled` when abort/error retracts a parked suspension.
- `run_control.abort_requested` when `abortRun()` first records abort intent.
- `run_control.abort_deferred_for_approval_decline` when abort is parked behind an approval denial.
- `run_control.abort_completed` when terminal `agent_end` reason is `aborted`.
- `agent_config.mode_changed`, `agent_config.model_changed`, `agent_config.subagent_model_changed`, and `agent_config.om_model_changed` as ChangePulses when session setting changes are emitted.
- `model.fallback_used` or `model.route_selected` when finish provider metadata reveals server-side fallback.

Avoid:

- `display_state_changed`.
- `message_update` for every text/reasoning delta unless chunk-level content export is explicitly in scope.
- `tool_input_delta` as a Pulse by default; treat final tool call args/result as the stronger boundary.
- `usage_update` as a standalone Pulse unless usage aggregation is in initial scope.
- `state_changed` wholesale snapshots. Emit specific setting ChangePulses instead.

Relationships:

- `introduced_content` from inbound content Pulse to content ref.
- `included_in_model_input` from content refs/Pulses to model input endpoint.
- `queued_follow_up` or `queued_signal` from queue ChangePulse to delayed content.
- `resume_of` from resumed tool/run segment to suspended segment.
- `uses_tool_definition` from tool call/approval/resume facts to tool definition.
- `uses_model_settings` from model call/route facts to effective model settings.

## Channels

Primary source:

- `packages/core/src/channels/agent-channels.ts`
- `packages/core/src/channels/agent-controller-channels.ts`

Emit:

- `content.introduced` for the normalized content that reaches the signal pipeline.
- external relationships for platform thread id, platform message id, author id, and channel id when present.
- `channel.session_rejected` only if refused inbound session creation needs auditability.
- `tool_approval.stale_ignored` when an approval/decline action has no matching parked gate and core refuses execution.

Avoid:

- adapter render mode decisions.
- typing/status output.
- outgoing message edits.
- chat SDK subscription setup.
- flattened platform thread history as separate content in the initial spec; it is currently just part of the resulting message text.

Relationships:

- `external_parent` or an external-id relationship from Pulse/content to platform message/thread ids.
- `stale_approval_for` only if implementation can identify the original approval-required Pulse; otherwise use runId/toolCallId metadata.

## Background Tasks

Primary source:

- `packages/core/src/background-tasks/manager.ts`
- `packages/core/src/background-tasks/workflow.ts`
- `packages/core/src/background-tasks/types.ts`

Emit:

- `background_task.enqueued` after storage creates a task and backpressure does not reject/fallback-sync it.
- `background_task.running` when task status changes to `running`.
- `background_task.output` for progress/output chunks only when they are user-visible or re-enter the agent stream/context.
- `background_task.suspended` when wrapped suspend persists `status: suspended`.
- `background_task.resumed` when resume changes task status back to `running`.
- `background_task.cancelled` when cancel changes task status to `cancelled`.
- `background_task.completed` when terminal success persists result.
- `background_task.failed` for terminal failure and timeout, with reason distinguishing `failed` from `timed_out`.
- `background_task.retry_scheduled` when retry bookkeeping increments retry count and loops.
- `background_task.recovered` when stale running task is moved back to pending or failed after process loss.

Avoid:

- `publishLifecycleEvent()` as the sole conceptual boundary. It is transport; use the state change it carries.
- result-topic subscribers and SSE stream snapshots.
- cleanup deletes.
- pubsub subscribe/unsubscribe/ack.
- active AbortController registration unless it changes task state.

Relationships:

- `parent_of` from originating tool call Pulse to task lifecycle Pulses.
- `uses_tool_definition` from task execution to the tool definition.
- `resume_of` from resumed task Pulse to suspended task Pulse.
- `included_in_model_input` if task result later becomes model-visible.
- `task_result_included_in_model_input` only if a more specific traversal is needed.

## File-Routed Agents And Skills

Primary source:

- `packages/core/src/agent/fs-routing/index.ts`
- `packages/core/src/skills/agent-skills-resolver.ts`
- `packages/core/src/processors/processors/skills.ts`

Emit:

- `agent_config.resolved` when a file-routed agent's effective runtime config is selected for use.
- `agent_config.definition_warning` only for warnings that affect the effective config, such as ignored instructions/tools/skills, collision winners, invalid schedules, or missing instructions.
- `definition.enabled` / `definition.disabled` ChangePulses for runtime-scoped active skill/tool/instruction changes.
- `skill_metadata.included` when `SkillsProcessor.processInputStep()` injects available skill metadata into the system message.

Avoid:

- `agentConfig()` and `agentInstructions()` identity helpers.
- every `resolveAgentSkills()` call unless it changes active runtime applicability.
- `WorkspaceSkills.list/get/refresh` internals.
- duplicate Pulses for both skill resolution and skill metadata injection when the injected metadata is the only model-visible fact.

Relationships:

- `uses_config_version` from run/model input to resolved agent config definition.
- `uses_instruction_version` from model input to effective instructions.
- `uses_tool_definition` from tool call to tool definition.
- `uses_definition` from model input to skill definitions included in metadata.
- `included_in_model_input` from injected skills-system-message content to the model input endpoint.

Definition identity open item:

- File path plus content hash is the safest minimum identity for file-routed definitions until a deployed version id exists.

## Schedules

Primary source:

- `packages/core/src/schedules/worker.ts`

Emit:

- `schedule.fire_received` when `executeAgentSchedule()` begins handling a schedule fire.
- `schedule.prepare_completed` only if handler/hooks materially alter prompt, params, provider options, or skip.
- `schedule.skipped` when prepare returns `null`, a thread is blocked, or no runnable input exists.
- `schedule.failed` when agent/thread resolution or input validation fails.
- `content.introduced` when a schedule prompt is sent as a signal or threadless generation input.
- `signal.delivery_decided` for threaded schedule signals using the accepted action.
- `agent.run_started` relationship to the schedule fire when a wake/generate starts a run.
- `schedule.completed` when threadless generation succeeds or threaded wake/deliver/persist/discard is accepted.
- `schedule.aborted` when threadless generation aborts.

Avoid:

- worker group consumption.
- trigger-row storage writes as the primary Pulse fact.
- schedule self-clean deletes, unless they are separately modeled as admin/config changes.
- hook invocation plumbing if it does not alter effective run input or outcome.

Relationships:

- `uses_definition` from schedule fire to schedule definition.
- `introduced_content` from schedule fire to prompt content.
- `schedule_triggered` from schedule fire to resulting run if generic `parent_of` is too weak.
- `queued_signal` / `drained_signal` when schedule delivery is delayed before model visibility.

## Experiments And Evals

Primary source:

- `packages/core/src/datasets/experiment/events.ts`
- `packages/core/src/datasets/experiment/index.ts`
- `packages/core/src/datasets/experiment/scorer.ts`
- `packages/core/src/evals/base.ts`

Emit if evaluation export is in scope:

- `experiment.run_started` from `ExperimentEventDispatcher` run-start event.
- `experiment.item_completed` from item-completed event.
- `experiment.run_finished` from run-finished event.
- `experiment.observer_failed` if observer failure aborts the run.
- `experiment.hook_failed` for hook failures that affect run/item outcome.
- `scorer.started`, `scorer.completed`, `scorer.failed`, and `score.recorded` around scorer execution and score emission.

Avoid:

- experiment storage progress updates.
- dataset CRUD/list/read.
- best-effort score persistence failures as separate runtime facts unless they are the subject of evaluation-storage diagnostics.
- observer callback delivery as a second Pulse in addition to the semantic experiment event.

Relationships:

- `parent_of` from experiment run to item/scorer Pulses.
- `uses_definition` from item/scorer run to target/scorer definitions.
- `external_parent` or `scored_target` from score/item to target trace/flow.
- `uses_model_settings` for LLM-as-judge model calls.

## Provider And Model Decisions

Emit:

- concrete selected model/provider for a model call.
- fallback route used, including selected model versus requested model when available.
- effective provider options that materially change behavior.
- usage/cost facts if metrics export is in first scope.

Avoid:

- generated provider capability table updates as runtime Pulses.
- info-message-only fallback notices without the structured route decision.

## Next Implementation Audit Order

1. Agent Controller/session and SessionRunEngine.
2. Background task lifecycle.
3. SkillsProcessor model-input injection plus definition identity.
4. Schedule fire.
5. Optional experiments/evals.
