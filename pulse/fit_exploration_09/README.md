# Branch Refresh Integration Exploration

This exploration tests the Pulse impact of the current branch refresh captured in `../code_audit/13-current-branch-refresh.md`.

The goal is not to re-audit every changed core file. The goal is to decide which refreshed source surfaces belong in the initial Pulse export model, which should be deferred, and which are only implementation details.

## Boundary

In scope:

- Agent Controller sessions and channels as the current interactive runtime surface
- background task lifecycle when tied to agent/tool execution
- file-routed agent definitions, skills, and model/input injection
- experiment/eval run, item, hook, scorer, and score lifecycle
- dynamic workflow/schedule facts that affect runtime reconstruction
- provider/model capability decisions when used by an actual model call
- existing Agent Signal and abort conclusions only where they intersect the refreshed surfaces

Out of scope:

- rewriting earlier `fit_exploration_*` outputs
- implementation changes
- broad provider registry churn
- storage cleanup, pubsub subscription mechanics, and UI display mirrors
- examples and reference material

## Inputs

Read:

- `../fit_exploration_procedure.md`
- `../current-model.md`
- `../pulse-export-spec.md`
- `../code_audit/13-current-branch-refresh.md`
- `../fit_exploration_04/05-learnings-summary.md`
- `../fit_exploration_05/05-learnings-summary.md`
- `../fit_exploration_08/05-learnings-summary.md`
- `packages/core/src/agent-controller/session.ts`
- `packages/core/src/agent-controller/session-run-engine.ts`
- `packages/core/src/channels/agent-controller-channels.ts`
- `packages/core/src/channels/agent-channels.ts`
- `packages/core/src/background-tasks/manager.ts`
- `packages/core/src/background-tasks/workflow.ts`
- `packages/core/src/agent/fs-routing/index.ts`
- `packages/core/src/skills/agent-skills-resolver.ts`
- `packages/core/src/processors/processors/skills.ts`
- `packages/core/src/datasets/experiment/index.ts`
- `packages/core/src/datasets/experiment/types.ts`

## Main Question

Can the branch-refresh surfaces be represented as Pulses, ChangePulses, definitions, and exported relationships without adding another top-level export family?

## Expected Output

By the end of this exploration, produce:

- a refreshed family fit matrix for branch-refresh surfaces
- concrete Pulse-shaped examples for at least Agent Controller, background tasks, file-routed skills, and experiments
- a decision on which branch-refresh surfaces block the initial spec
- a source-audit handoff list for line-level implementation planning

## Result

Second pass completed.

Branch-refresh surfaces do not require a new top-level export family. The strongest model remains:

- runtime facts as `ObservationPulse`
- scoped behavior/config changes as `ChangePulse`
- reusable bodies as referenced definitions
- reconstruction/applicability as exported relationships

The initial spec should include Agent Controller/session facts, background task lifecycle tied to tool execution, file-routed definition applicability, skill model-visibility, schedule-fired agent content, and experiment observer events. It should defer UI display mirrors, pubsub/subscription mechanics, storage cleanup/bookkeeping, generated provider registry churn, and broad dataset CRUD.

See `08-implementation-handoff.md` for the concrete emit/avoid boundaries to use before implementation planning.
