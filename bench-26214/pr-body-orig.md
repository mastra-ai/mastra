> Opened by @user_01KNA8J74D4RF84RXSDRX26BS9

Closes #26214

On the default engine, if a run crashes partway through a `.parallel()` block or a `.foreach()` and you call `run.restart()`, the steps that had already finished run again.

## Root cause

- **Parallel:** the restart loop stops at the first arm that isn't in `restart.activeStepsPath` (`break`), so arms after it never get marked running. Also, finished arms aren't checkpointed until the whole block ends, so a crash snapshot still lists a finished arm as active, and restart runs it again.
- **Foreach:** per-item results are only persisted when the foreach suspends, fails or completes. If it crashes in between, the snapshot has no record of which items finished, so restart runs every item again.

## Fix

- `handlers/control-flow.ts`, parallel: `continue` instead of `break` for arms not in `activeStepsPath`, and persist each successful arm with phase `parallel-arm-end.<i>`.
- `handlers/control-flow.ts`, foreach: on each item success, write the foreach as `running` with `metadata.foreachProgress = {[index]: {output, nestedRunId?}}` (phase `foreach-item-end.<k>`). On restart, seed `prevForeachOutput` from it so only the unfinished items get queued. The progress is stripped from `stepInfo`, so it never reaches the final result, and the foreach's `activeStepsPath` entry is cleared once every item has ended. A resumed foreach keeps its `suspendPayload` in the checkpoint.
- The checkpoint write runs alongside the queue and is awaited before the foreach returns. Awaiting it inside the worker held the queue slot, so a sibling's suspend could stop the queue before the next item started. That broke the existing partial-concurrency suspend/resume test.
- `handlers/step.ts`: per-item `stepInfo` omits `foreachProgress`, and the item-start write merges the latest progress, so a stale sibling start write can't drop finished items.
- `utils.ts`: `ForeachProgress` type plus `getForeachProgress` / `omitForeachProgress` helpers. No casts.

The evented engine is out of scope. It already writes per-item foreach results and re-queues only null items (`loop.ts:461-488`). This PR doesn't touch the evented foreach code that open PR #27932 changes.

## Proof

- New `packages/core/src/workflows/restart-mid-block.test.ts` has 4 tests built on real-run crash snapshots: a parallel arm that finished before the crash, a 3-arm parallel where the unfinished arm sits between finished ones, and foreach at concurrency 1 and 3.
  - **Fix reverted** (handlers + `utils.ts` checked out from base): **4/4 fail**. A finished arm is called again (`expected "vi.fn()" to not be called at all, but actually been called 1 times`), and the foreach re-runs `[0, 1, 2, 3, 4]` instead of `[2, 3, 4]`.
  - **With the fix:** 4/4 pass.
- Workflow suite (`vitest run src/workflows --maxWorkers=2` under `timeout`): 1375 passed, 9 skipped, 0 failed.
- `tsc --noEmit`, `oxlint` and `oxfmt --check` are clean.
- Snapshot growth for a 400-item foreach (concurrency 4, MockStore, measured as JSON bytes per `persistWorkflowSnapshot`):

  | | writes | total bytes written | largest snapshot | final snapshot |
  |---|---|---|---|---|
  | without fix | 403 | 797,030 (~0.80 MB) | 6,577 | 6,577 |
  | with fix | 803 | 5,444,334 (~5.44 MB) | 11,719 | 6,577 |

  The final snapshot is the same size. Total bytes written grow quadratically with item count, because each checkpoint rewrites all progress so far (about 6.8x here).

## Unverified

- Real storage adapters (Postgres, LibSQL, etc.). Only MockStore was used.
- Nested workflows inside a foreach on restart: `nestedRunId` is carried in progress, but no test covers it.
- Durable/Inngest-style engines that wrap `persistStepUpdate` in `wrapDurableOperation` with the new phases.

## Open questions

1. Are quadratic total snapshot writes for large foreach blocks acceptable, or should this wait for an append-only progress API? Per-item snapshot writes were shelved before because of storage growth.

## Risk: medium

This changes when snapshots are written during parallel and foreach execution on the default engine, and how many get written. Restart and resume paths are covered by the existing suite.

<!-- This is an auto-generated comment: release notes by coderabbit.ai -->

<!-- coderabbit-ai-generated:v1 -->

## ELI5

If a workflow crashes, work that already finished is not done again. The workflow now remembers completed parallel arms and `.foreach()` items, then resumes only unfinished work.

## Changes

- Checkpoints successful `.parallel()` arms during execution.
- Skips completed parallel arms during restart.
- Persists completed `.foreach()` item outputs and nested run IDs.
- Restores foreach progress and resumed suspend payloads.
- Prevents stale item-start updates from removing completed progress.
- Adds `ForeachProgress`, `getForeachProgress`, and `omitForeachProgress`.
- Adds regression tests for parallel and foreach restart scenarios.
- Adds a patch changeset for `@mastra/core`.

## Validation

- Workflow suite: `1375 passed, 9 skipped, 0 failed`.
- `tsc --noEmit`, `oxlint`, and `oxfmt --check` reported clean.
- Reported snapshot size increased from approximately 0.80 MB to 5.44 MB for a 400-item foreach.
- Real storage adapters, nested workflows inside foreach, evented engines, and durable/Inngest-style engines were not tested.

<!-- end of auto-generated comment: release notes by coderabbit.ai -->
