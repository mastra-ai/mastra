---
'@mastra/core': patch
---

Durable agents now honor `onIterationComplete` callback return values and delegation bail signals in the loop predicate, closing three behavioral parity gaps with the regular agent:

- **Delegation bail** — When an `onDelegationComplete` hook calls `ctx.bail()`, the durable loop now stops at the next predicate evaluation instead of continuing indefinitely. The `delegationBailed` flag propagates through `DurableAgenticExecutionOutput` and `baseIterationStateSchema`.

- **`onIterationComplete` callback dispatch** — The durable predicate now calls `onIterationComplete` directly (read from `globalRunRegistry`) and honors its return value: `{ continue: false }` stops the loop, `{ continue: true }` forces continuation when `maxSteps` allows, and `{ feedback }` injects a user message for the next LLM turn.

- **Two-phase stop (`pendingFeedbackStop`)** — `onIterationComplete` returning `{ continue: false, feedback: '...' }` now schedules exactly one more LLM turn before stopping, matching the regular agent's behavior. The `pendingFeedbackStop` flag is persisted in `baseIterationStateSchema` across iterations.

Signal drain (bugs 5 and 11) is deferred — `DurableAgent` does not yet participate in `agentThreadStreamRuntime` and has no `sendMessage` / signal infrastructure.

Scenario tests `delegation-complete-bail` and `stop-condition-long-loop` now run on the durable engine. The `aimock-scenario` harness no longer drops `stopWhen`, `delegation`, or `onIterationComplete` for durable runs.
