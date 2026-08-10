# Current Branch Refresh Audit

Date: 2026-08-10

Scope: Pulse-relevant changes in `packages/core/src` since the earlier `pulse/code_audit` pass.

This is an addendum. The earlier audit files remain historical snapshots of what was inspected then; this file records what now looks stale, newly important, or newly skippable after recent core churn.

## Method

- Reviewed recent `packages/core/src` commits and changed-file frequency from the last several weeks.
- Re-read the existing code audit summaries, especially `05`, `11`, and `12`.
- Spot-checked current source for high-churn or Pulse-relevant surfaces: agent signals, agent controller sessions/channels, background tasks, file-routed agents, skills, durable run control, and experiments.
- Aligned apply/skip calls with the current working model in `../pulse-export-spec.md`.

## Summary

The previous audit is still directionally right, but several candidate surfaces have moved from "interesting gap" to "first-class Pulse requirement":

- Agent Signals need queue, drain, delivery-decision, and model-visibility facts. A signal accepted into a queue is not enough to reconstruct model input.
- Abort/control now deserves explicit Pulse coverage because cancellation can cross run/process boundaries and affects whether later signals attach to the old run or start a new one.
- Agent Controller and channels are now the current interactive session surface that supersedes much of the older Harness-only framing.
- Background tasks are user-visible execution primitives when spawned by agent/tool runs; their lifecycle should be Pulsed selectively.
- File-routed agents, dynamic skills, model selection, approval policies, and experiment setup/teardown are definition/config provenance surfaces.
- Generated provider registry churn remains mostly out of scope unless a concrete model call uses a capability, route, fallback, or cost decision.

## Recent Change Clusters

| Cluster | Representative files | Audit impact |
| --- | --- | --- |
| Agent signal delivery and wake paths | `agent/thread-stream-runtime.ts`, durable signal-drain steps, `agent-controller/session.ts` | Apply. Queueing, delivery decision, drain, and model-input inclusion are distinct reconstruction facts. |
| Abort and cancellation | `agent/durable/abort-transport.ts`, `agent-controller/session.ts`, `agent-controller/session-run-engine.ts`, durable LLM/tool steps | Apply. Abort intent, propagation, observation, deferred approval decline, and completion are all user-visible run-control facts. |
| Agent Controller/channels | `agent-controller/*`, `channels/agent-controller-channels.ts`, `channels/agent-channels.ts` | Apply selectively. Treat inbound content, approvals, suspensions, model/mode selection, and message IDs as Pulse/relationship candidates; skip display mirrors and transport-only UI state. |
| Background tasks | `background-tasks/manager.ts`, `background-tasks/workflow.ts`, stream-until-idle helpers | Apply selectively. Lifecycle and result injection matter; pubsub ack/subscription mechanics are infrastructure unless they affect retry/recovery semantics. |
| File-routed agents and skills | `agent/fs-routing/index.ts`, `skills/*`, `processors/processors/skills.ts` | Apply as definition/config provenance. Runtime should reference resolved definitions instead of copying full config every time. |
| Experiments and evals | `datasets/experiment/*`, `evals/*` | Apply selectively. Experiment run/item/scorer lifecycle is Pulse-like; dataset CRUD and bookkeeping storage are not initial Pulse scope. |
| Dynamic workflows/schedules | `workflows/*`, `schedules/worker.ts` | Apply selectively. User workflow lifecycle and schedule-fired actions matter; storage snapshots and worker bookkeeping mostly skip. |
| Provider registry/capabilities | `llm/model/provider-*` | Mostly skip. Generated capability tables are definitions; concrete model call decisions can reference them. |

## Updated Candidate Surfaces

### Agent Signals and Model Visibility

Verdict: **apply**.

Current code makes the earlier Agent Signals question sharper: a signal can be accepted, queued, delivered to an active run, used to wake an idle run, persisted as a notification, and later drained into model-visible context. Reconstruction needs at least two semantic moments:

- `signal.queued` or `signal.arrived`: the system received a signal and attached it to a thread/run decision point.
- `signal.drained_to_model_input`: the signal became visible to the model, with ordering relative to other content.

`signal.delivery_decided` remains useful, but only as a routing fact. `action: deliver` alone does not prove model visibility.

Likely Pulse/relationship candidates:

- `signal.arrived`
- `signal.delivery_decided`
- `signal.queued`
- `signal.drained_to_context`
- `notification_signal.persisted`
- relationships: `queued_for_run`, `drained_into_model_input`, `woke_run`, `interrupted_run`, `replaced_or_removed_context`

### Abort and Run Control

Verdict: **apply**.

Abort behavior now spans local streams, durable runs, parked approval gates, background tasks, and cross-process durable agents. This is not just telemetry; it changes the causal graph of a conversation.

Candidate Pulse facts:

- `abort.requested`
- `abort.propagated`
- `abort.observed`
- `abort.deferred_for_approval_decline`
- `abort.completed`
- `run.terminated` with reason `aborted`

The important relationship is from the abort to the affected run/tool/task and to any follow-up signal that waits for idle state before starting a new run.

### Agent Controller and Channels

Verdict: **apply selectively**.

The current agent-controller/session code is now the best "interactive runtime" audit target. It owns inbound messages/signals, active run identity, abort state, approvals, suspended tools, model/mode persistence, notification signals, and thread settings.

Apply to:

- inbound user content and files as content-bearing Pulses
- `sendSignal` and `sendNotificationSignal` routing outcomes
- tool approval required/approved/declined decisions
- tool suspension/resume decisions
- mode/model/subagent-model setting changes as definition/config Changes
- message IDs, trace IDs, run IDs, and thread IDs as relationships

Skip or defer:

- `display_state_changed` mirrors except when needed to reference a durable user-visible state transition
- adapter rendering details
- transport-only chunks and UI snapshots

Recent changes that stop re-sending whole conversation state reinforce the Pulse rule: do not export full message arrays as repeated snapshots. Export content-bearing moments and relationships that can reconstruct the visible array.

### Background Tasks

Verdict: **apply when tied to agent/tool execution**.

Background tasks are now a distinct lifecycle with enqueue, dispatch, suspend, resume, cancel, completion, failure, retry/recovery, stream output, and result hooks. When a task originated from a tool call in an agent run, it is part of the user's execution history.

Candidate Pulse facts:

- `background_task.enqueued`
- `background_task.running`
- `background_task.output`
- `background_task.suspended`
- `background_task.resumed`
- `background_task.cancelled`
- `background_task.completed`
- `background_task.failed`
- `background_task.recovered_or_restarted`

Relationships should connect task ID, tool call ID, tool name, agent ID, run ID, thread ID, resource ID, and any result injected back into the stream/model context.

Skip:

- storage cleanup
- subscription setup/teardown
- pubsub fan-out mechanics, except where delivery attempt/retry changes task semantics

### File-Routed Agents and Skills

Verdict: **apply as definition/config provenance, usually at the caller boundary**.

File-routed agents and skills clarify the earlier "Definition" question. Agent instructions, tools, skills, workspaces, schedules, subagents, processors, scorers, and model settings are definitions. Runtime events should reference the active definition/version rather than copying the whole object graph into every Pulse.

Candidate facts:

- `definition.created_or_loaded`
- `definition.changed`
- `agent_config.resolved`
- `instructions.changed`
- `skill.enabled`
- `skill.disabled`
- `skill_metadata.included_in_model_input`

Temporary vs permanent changes should be encoded in the Change semantics:

- permanent for remainder-of-run or persisted thread/session updates
- temporary for next-step or next-call overrides

The low-level skill resolver is mostly an implementation detail. Pulse should likely be emitted where the resolved skill set affects a run or model input.

### Experiments and Evals

Verdict: **apply selectively**.

Experiments now have setup/teardown hooks, awaited observers, provenance/grouping, per-run persistence policy, item retries, scorer resolution, tool mocks, and cancellation. These are user-facing evaluation runs, not just storage writes.

Candidate Pulse facts:

- `experiment.run_started`
- `experiment.hook_started`
- `experiment.hook_completed`
- `experiment.hook_failed`
- `experiment.item_started`
- `experiment.item_completed`
- `experiment.item_failed`
- `scorer.started`
- `scorer.completed`
- `scorer.failed`
- `score.recorded`
- `experiment.run_finished`

Skip:

- dataset list/read/update bookkeeping
- best-effort storage progress updates
- analytics queries

### Dynamic Workflows and Schedules

Verdict: **apply selectively**.

Workflow lifecycle remains a core Pulse domain. Recent dynamic workflow and `onStart` work suggests definitions/versioning are also relevant, but storage snapshots should not become exported snapshots by default.

Apply to:

- workflow run start/suspend/resume/complete/fail/cancel
- step start/complete/fail/suspend/resume
- workflow definition/version selected for a run
- schedule-fired action that introduces content or a signal

Skip:

- internal snapshot storage shape
- worker subscription mechanics
- dynamic workflow catalog CRUD unless it changes the active definition used by a run

### Provider Registry and Model Capabilities

Verdict: **mostly skip**.

Generated provider capability files are definitions. They should not emit Pulses by themselves. They become relevant when a concrete model call uses a capability or routing decision.

Apply to:

- selected model ID/provider for a model call
- gateway/fallback/routing decision
- effective provider options
- cost/usage facts if they are part of the exported run record

Skip:

- generated registry updates as runtime events
- static capability table churn

## Adjustments to Earlier Audit Files

- `05-recent-feature-coverage-gaps.md`: the "Harness" gap is now broader than Harness. Treat `agent-controller` and `channels` as the current session/runtime surface.
- `11-pulse-applicability-review.md`: still the right narrowing principle. Add Agent Signals visibility, abort/control, background tasks, file-routed definitions, and experiments as initial-scope candidates.
- `12-harness-agent-config-pulse-candidates.md`: still useful for config provenance, but the stronger current targets are file-routed agents, skills, session model/mode settings, and approval policy changes.

## Next Audit Passes

1. Agent Controller/channels line-level pass for message, signal, approval, suspension, abort, and setting-change events.
2. Background task line-level pass for lifecycle events and result injection back into agent runs.
3. File-routed agent/skills pass for definition identity, resolution timing, and model-input inclusion.
4. Experiment/eval pass for run/item/scorer lifecycle and provenance.
5. Durable agent/workflow pass that merges the abort/signal findings from `fit_exploration_06` through `fit_exploration_08`.
