# Learnings Summary

Status: second pass completed.

## Main Result

The branch refresh should not add a new top-level export family. The refreshed surfaces fit the existing model:

- runtime facts as Pulses
- behavior/config mutations as ChangePulses
- reusable bodies as definitions/reference bodies
- reconstruction and applicability as exported relationships

## Decisions

- Agent Controller and channels replace the older Harness-only framing for current interactive runtime coverage.
- Export semantic controller/session facts: inbound content, signal routing, run start/end, approvals, suspensions/resumes, follow-up queue, abort, and model/mode/session setting changes.
- Do not export `display_state_changed` as a Pulse. It is a projection over other facts.
- Background task lifecycle applies only when the task is tied to an agent/tool/run.
- Background task pubsub, worker subscription, cleanup, and stream snapshot mechanics stay out unless they change task retry/recovery semantics.
- File-routed agents and skills use the definition/reference model from `fit_exploration_04/`.
- Skills metadata injection is a model-input visibility fact, not a low-level resolver fact.
- Experiments/evals should be modeled as run/item/scorer/score Pulses plus relationships, not as a separate export family.
- Schedule fires should be modeled when they introduce content, wake a run, skip, fail, or abort. Schedule trigger-row persistence is bookkeeping.
- Provider registry updates stay reference-only unless a concrete model call uses a capability, selected model, provider option, or fallback route.

## Initial Spec Impact

Required for initial spec if Pulse covers current interactive agent runs:

- Agent Controller/session facts
- channel content identity and external relationships
- model input visibility for content/signals/skill metadata
- tool approval and suspension/resume
- abort/run-control facts from current model
- definition references for file-routed agents, skills, tools, models, workflows, schedules, and scorers

Can defer from initial spec:

- experiment/eval coverage, unless evaluation export is part of launch
- broad channel platform history reconstruction
- standalone background task observability
- generated provider capability change tracking
- UI display projection export

## Handoff Source Passes

Line-level implementation planning should focus on:

1. `packages/core/src/agent-controller/session.ts`: setting changes, follow-up queue, abort, approval, suspension/resume.
2. `packages/core/src/agent-controller/session-run-engine.ts`: stream-to-message/content boundaries, tool approval/suspension chunks, finish/fallback, usage.
3. `packages/core/src/channels/agent-controller-channels.ts`: inbound controller dispatch, stale approval hook, session resolver refusal.
4. `packages/core/src/channels/agent-channels.ts`: external message/thread identity, attachment/content construction, agent signal handoff.
5. `packages/core/src/background-tasks/manager.ts`: enqueue/cancel/resume/recover/lifecycle publish boundaries.
6. `packages/core/src/background-tasks/workflow.ts`: executor start/progress/suspend/timeout/retry/completion semantics.
7. `packages/core/src/agent/fs-routing/index.ts`: definition precedence, collision warnings, schedule/subagent assembly.
8. `packages/core/src/skills/agent-skills-resolver.ts`: definition identity and agent-vs-workspace precedence.
9. `packages/core/src/processors/processors/skills.ts`: skill metadata model-input injection.
10. `packages/core/src/datasets/experiment/events.ts`: semantic observer event mapping.
11. `packages/core/src/datasets/experiment/scorer.ts` and `packages/core/src/evals/base.ts`: scorer definition/use, score emission, target trace relationships.
12. `packages/core/src/schedules/worker.ts`: schedule fire, skip/fail/abort, content introduction, run linking.

See `08-implementation-handoff.md` for concrete emit/avoid boundaries.

## Risks

- Exporting display mirrors would reintroduce snapshots.
- Exporting pubsub mechanics would turn Pulse into infrastructure telemetry.
- Exporting experiment storage bookkeeping would blur runtime facts with admin persistence.
- Treating provider registry churn as runtime events would create noise without explaining any run.
- Using existing product event names verbatim can leak implementation concerns into the Pulse vocabulary.
- Channel history is currently flattened before entering the signal pipeline, so precise platform-message reconstruction requires a separate future design.
