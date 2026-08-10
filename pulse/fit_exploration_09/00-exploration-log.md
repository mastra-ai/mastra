# Exploration Log

## 2026-08-10 - Prep

Read:

- `pulse/fit_exploration_procedure.md`
- `pulse/experiment-backlog.md`
- `pulse/code_audit/13-current-branch-refresh.md`

Assumptions:

- Earlier explorations are historical records and should not be modified.
- The branch refresh should be tested as an integration pass, not as a replacement for the Agent Signals, relationship graph, or definition explorations.
- The current Pulse export candidate has only Pulses, ChangePulses, definitions/reference bodies, and exported relationships; adding new top-level families requires strong evidence.

Tried:

1. Framed the branch refresh as a fit exploration.
   - Result: appropriate because the code audit found multiple changed runtime surfaces after the earlier audit.
   - Concern: scope can become too broad unless each surface is classified as initial-spec, defer, or skip.

2. Seeded the exploration from `code_audit/13-current-branch-refresh.md`.
   - Result: this gives the exploration a concrete source/audit boundary.
   - Concern: the refresh audit is summary-level; line-level source reads are still needed before final decisions.

Risk noticed:

- Agent Controller and channels can pull Pulse toward product/UI telemetry if display-state mirrors and adapter rendering are not kept out.
- Background tasks can pull Pulse toward worker/pubsub infrastructure if lifecycle facts are not separated from delivery mechanics.
- Experiments/evals can look like their own domain, but they may fit better as composed run/item/scorer Pulses plus relationships.

## 2026-08-10 - Source-Backed Integration Pass

Read:

- `pulse/current-model.md`
- `pulse/pulse-export-spec.md`
- `pulse/fit_exploration_04/05-learnings-summary.md`
- `pulse/fit_exploration_05/05-learnings-summary.md`
- `pulse/fit_exploration_08/05-learnings-summary.md`
- `packages/core/src/agent-controller/session.ts`
- `packages/core/src/agent-controller/session-run-engine.ts`
- `packages/core/src/channels/agent-controller-channels.ts`
- `packages/core/src/channels/agent-channels.ts`
- `packages/core/src/background-tasks/manager.ts`
- `packages/core/src/background-tasks/workflow.ts`
- `packages/core/src/background-tasks/types.ts`
- `packages/core/src/agent/fs-routing/index.ts`
- `packages/core/src/skills/agent-skills-resolver.ts`
- `packages/core/src/processors/processors/skills.ts`
- `packages/core/src/datasets/experiment/index.ts`
- `packages/core/src/datasets/experiment/events.ts`
- `packages/core/src/datasets/experiment/scorer.ts`
- focused references in `packages/core/src/schedules/worker.ts` and workflow runtime files

Assumptions:

- Pulse export should follow the initial draft in `pulse-export-spec.md` unless a source family fails to fit.
- Existing stream chunks and controller events are source event families, not automatically exported Pulse records.
- Reader value is reconstruction/explanation of a run, not mirroring every in-memory UI reducer state.

Tried:

1. Mapped Agent Controller events to Pulse families.
   - Result: inbound messages/signals, run start/end, tool approval, tool suspension/resume, mode/model/subagent-model setting changes, and abort fit existing Pulse/ChangePulse families.
   - Concern: `display_state_changed` is tempting because it is easy to consume, but it is a projection and would reintroduce snapshots.

2. Mapped channel inbound handling.
   - Result: external message/thread ids, author/channel attributes, provider metadata, and request context are relationships/metadata on content-introducing Pulses.
   - Concern: channel history is currently flattened into a user text block. Pulse can only reconstruct what entered Mastra unless platform history is separately modeled as content items later.

3. Mapped background tasks.
   - Result: `task.running`, `task.output`, `task.suspended`, `task.resumed`, `task.completed`, `task.failed`, and `task.cancelled` fit as task/tool lifecycle Pulses when connected to a tool call.
   - Concern: manager publish points include pubsub fan-out and stream snapshots. Emit at lifecycle boundaries, not every subscription/projection boundary.

4. Mapped file-routed agents and skills.
   - Result: file routing is definition assembly and precedence. SkillsProcessor creates model-visible system content that should be anchored with `included_in_model_input`.
   - Concern: dynamic instructions/skills need stable enough definition identity or scoped ChangePulses with inline/referenced bodies.

5. Mapped experiments/evals.
   - Result: `ExperimentEventDispatcher` already emits versioned semantic events for run start, item completed, and run finished. These map directly to Pulses. Scorer runs and score records are already runtime facts with target correlation context.
   - Concern: observer delivery, storage writes, and persistence progress should not double-count as separate Pulse facts.

6. Sampled schedules/workflows.
   - Result: schedule fire creates a concrete agent prompt/signal with schedule metadata; workflow run/step lifecycle remains an existing Pulse domain.
   - Concern: schedule trigger rows are useful for UI linkability but should not be confused with the content/run facts themselves.

Risk noticed:

- Some branch-refresh surfaces already have product events that are more convenient than ideal. Pulse instrumentation should choose semantic boundaries, not blindly wrap existing events.
- Provider/model fallback notice currently surfaces as an `info` event. Pulse should capture the concrete model route/fallback decision, not only the rendered notice text.

## 2026-08-10 - Second Pass: Implementation Handoff

Read:

- `pulse/fit_exploration_09/05-learnings-summary.md`
- `pulse/fit_exploration_09/06-source-notes.md`
- `pulse/fit_exploration_09/07-decision-record.md`
- focused source anchors for controller session, background task lifecycle, skill injection, schedule execution, and experiment observer dispatch

Assumptions:

- The main modeling decision is settled enough: no new branch-refresh export family.
- The remaining value is to identify exact candidate emit boundaries and explicit non-boundaries.
- This is still research/handoff. It should not prescribe concrete code APIs or implementation storage yet.

Tried:

1. Converted each apply surface into "emit here / avoid here" guidance.
   - Result: implementation planning can start with Agent Controller/session, background tasks, skill injection, schedule fire, and optional experiment/eval mapping.
   - Concern: some boundaries still depend on where the eventual Pulse writer is wired. The handoff names semantic boundaries, not final function calls.

2. Checked whether a second pass changes the export family.
   - Result: it does not. The second pass strengthens the skip/defer guidance instead.

Risk noticed:

- If implementation hooks at existing event fan-out points, it may double-emit display and semantic facts.
- If implementation hooks only at low-level stream chunks, it may miss higher-level decisions like stale approvals, policy grants, schedule skip reasons, and follow-up requeues.
