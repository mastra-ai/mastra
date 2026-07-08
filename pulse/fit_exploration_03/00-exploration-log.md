# Exploration Log

## 2026-06-23 - Seed Pass

Read:

- `pulse/AGENTS.md`
- `pulse/fit_exploration_procedure.md`
- `pulse/scope-expansion-after-02.md`
- `pulse/fit_exploration_02/05-learnings-summary.md`
- `packages/core/AGENTS.md`

Assumptions:

- This pass is documentation and shape exploration only.
- Historical exploration folders should not be rewritten.
- Comments since exploration 02 are current inputs for exploration 03.
- Harness UI display events are source material, not automatically Pulse events.

Tried:

1. Treating the reduced export family as the primary test.
   - Result: Start from `Pulse | Change | Relationship`, with `Snapshot` under pressure.
   - Concern: `Change` can become a dumping ground if it absorbs definitions, context edits, snapshots, and config changes without strict actions.

2. Treating the expanded export family as the control.
   - Result: Keep `Flow`, `Definition`, and `Snapshot` as explicit comparison points.
   - Concern: The expanded family may weaken the simplicity of Pulse unless each extra shape removes concrete duplication or append-only pain.

3. Treating message arrays as reconstruction output, not export input.
   - Result: Explore messages as content pulses plus context changes/relationships.
   - Concern: Read models become more complex. This only works if reconstruction is bounded by snapshots or stable message/content ids.

## 2026-06-23 - Source Refresh

Read:

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

Observed:

- Agent Signals already distinguish `user`, `state`, `reactive`, and `notification`.
- State signals already have `snapshot` and `delta` modes plus cache keys and versions.
- The processor runner records message-list mutations as `add`, `addSystem`, `removeByIds`, and `clear`.
- Harness events are heavily UI/read-model oriented: message updates, display state, workspace status, OM status, task updates, subagent activity, tool approval/suspension, usage updates.
- Harness storage tracks sessions and pending items, including `tool-approval`, `tool-suspension`, `question`, and `plan-approval`.
- The run engine repeatedly emits complete `HarnessMessage` snapshots as text/tool/reasoning deltas arrive.
- `buildMessagesFromChunks` already reconstructs a final DB message from lower-level stream chunks, which is closer to a Pulse-friendly source than `message_update`.

Risk noticed:

- If Pulse consumes the Harness event bus directly, it will inherit UI display semantics and repeated snapshots.
- If Pulse consumes only final message storage, it will miss useful stream/progress observations.
- Agent state signals blur observation and state mutation. They should probably create both a Pulse and a Change, or only a Change plus a Relationship, depending on use.

