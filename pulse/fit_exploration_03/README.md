# Fit Exploration 03

This exploration tests whether Pulse should remain a single event shape or become one member of a small append-only export family.

The main pressure comes from comments after `fit_exploration_02`: repeated message arrays, context truncation/removal, state signal snapshots/deltas, thread-to-thread ordering, Agent Signals, and Harness v1.

## What Changed Since Exploration 02

- `flow` is the preferred name for a full execution.
- `threadId` is a grouping id only. It does not encode order.
- `previousFlowId` or an equivalent relationship is needed to order flows inside a thread.
- `surface` and `action` should be typed sets, not arbitrary saved names.
- `primitive` should be optional and often inherited from parent/flow context.
- Duration-like values are allowed in `data` when they are meaningful measurements, but Pulse should not rebuild spans.
- `Definition` and `Flow` may be export shapes, or they may be reducible to `Change` and `Relationship`.
- `Delta` should not be a separate export shape. Delta-like behavior belongs inside `Change` operations.
- Full `messages` arrays should not be exported as repeated Pulse attributes.

## Test Boundary

In scope:

- reduced export family: `Pulse`, `Change`, `Relationship`, and maybe `Snapshot`
- expanded export family: `Pulse`, `Flow`, `Definition`, `Change`, `Relationship`, `Snapshot`
- message/context representation without exporting full message arrays
- state-signal snapshots and deltas
- Agent Signal delivery and acceptance
- Harness v1 run, thread, suspension, approval, subagent, and task behavior
- typed `surface` and surface-specific `action` vocab candidates

Out of scope:

- implementation design
- storage schema design
- migration design
- UI presentation beyond naming pressure
- mapping to OpenTelemetry beyond compatible ids
- admin/org/query/storage plumbing that does not describe a user primitive

## Inputs Read

- `pulse/AGENTS.md`
- `pulse/fit_exploration_procedure.md`
- `pulse/scope-expansion-after-02.md`
- `pulse/fit_exploration_02/05-learnings-summary.md`
- `packages/core/AGENTS.md`
- `packages/core/src/agent/signals.ts`
- `packages/core/src/agent/state-signals.ts`
- `packages/core/src/signals/signal-provider.ts`
- `packages/core/src/signals/task-signal-provider.ts`
- `packages/core/src/processors/send-signal.ts`
- `packages/core/src/loop/workflows/agentic-execution/signal-drain-step.ts`
- `packages/core/src/harness/types.ts`
- `packages/core/src/harness/harness.ts`
- `packages/core/src/harness/session.ts`
- `packages/core/src/harness/session-run-engine.ts`
- `packages/core/src/storage/domains/harness/types.ts`
- `packages/core/src/storage/domains/harness/base.ts`
- `packages/core/src/agent/message-list/message-list.ts`
- `packages/core/src/agent/message-list/state/MessageStateManager.ts`
- `packages/core/src/agent/message-list/merge/MessageMerger.ts`
- `packages/core/src/loop/workflows/agentic-execution/build-messages-from-chunks.ts`
- `packages/core/src/processors/memory/message-history.ts`
- `packages/core/src/processors/processors/message-selection.ts`

## Output Files

- `00-exploration-log.md`
- `01-shape-fit-rules.md`
- `02-family-fit-matrix.md`
- `03-worked-examples.md`
- `04-open-questions.md`
- `05-learnings-summary.md`
- `06-source-notes.md`
- `07-export-family-comparison.md`
- `08-message-context-fit.md`
- `09-agent-signals-fit.md`
- `10-harness-v1-fit.md`
- `11-surface-action-vocab.md`

Related audit addendum:

- `pulse/code_audit/12-harness-agent-config-pulse-candidates.md`
