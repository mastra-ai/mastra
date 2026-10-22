Closes #26214

On the default engine, if a run crashes partway through a `.parallel()` block or a `.foreach()` and you call `run.restart()`, the steps that had already finished run again.

## Root cause

- **Parallel:** finished arms aren't checkpointed until the whole block ends. A crash snapshot still lists a finished arm as active, so restart runs it again.
- **Foreach:** per-item results are only persisted when the foreach suspends, fails or completes. If it crashes in between, the snapshot has no record of which items finished, so restart runs every item again.

## Fix

- `handlers/control-flow.ts`, parallel: persist each successful arm with phase `parallel-arm-end.<i>`. The restart loop keeps main's `break`. Nothing observable through the public API changes if it becomes `continue`, so that edit isn't in this PR.
- `handlers/control-flow.ts`, foreach: when an item succeeds, record `{[index]: {output, nestedRunId?}}` in `metadata.foreachProgress` on the foreach's `running` result, before any await. On restart, `prevForeachOutput` is seeded from that progress, so only unfinished items get queued. The progress is stripped from `stepInfo` and never reaches the final result.
- **Checkpoints are serialized and coalesced.** There is at most one item-end checkpoint write in flight. Items that finish while it runs are folded into the next write, and writes are at least `FOREACH_CHECKPOINT_INTERVAL_MS` (1000 ms) apart. The first write goes out right away. When the foreach ends, the pending timer is cancelled and the dirty state is dropped, because the final step-result write supersedes it. The write doesn't hold a queue slot.
- **Error path:** the foreach waits for the checkpoint chain to settle, then deletes its `activeStepsPath` entry in `finally`. On a failed checkpoint write it ends the span with an error and rethrows the first error. The run rejects, the same as any other `persistStepUpdate` failure.
- `handlers/step.ts`: once a sibling item has finished, the item-start write is skipped. The checkpoint owns the stored snapshot from then on. Without the skip, every start write re-serializes all finished outputs, which brings back the n² bytes the coalescing removes (see the benchmark).
- `default.ts` + `handlers/entry.ts`: a per-run queue (`serializeSnapshotWrite`) orders every step-update write in a run (start, end, `parallel-arm-end`, `foreach-item-end`). Each write takes its slot synchronously when `persistStepUpdate` is called, before it awaits storage. Without this, an older write can land after a newer one: a sibling arm's start write can erase a finished arm, and an older foreach checkpoint can erase finished items. The queue is keyed by `runId`, so nested workflows (each with its own run) don't wait on each other. A failed write doesn't block later ones.
- **Inngest:** `supportsRestartCheckpoints()` is `true` on `DefaultExecutionEngine` and `false` on `InngestExecutionEngine`. Inngest has no `restart()` and memoizes durable operations by position, so arm-end and item-end checkpoints, the progress read on restart, and the write queue are all off there. Inngest keeps exactly main's step-update operations.
- **DurableAgent:** parallel tool calls run through `.foreach(toolCallStep)` (`durable-loop-builder.ts`), so this fix also stops finished tool calls re-running after a crash. The restart test harness now clones snapshots on write, because `InMemoryStore` stored them by reference and live mutations leaked into checkpoints.
- `utils.ts`: `ForeachProgress` type plus `getForeachProgress` / `omitForeachProgress` helpers.

The evented engine is out of scope. It already writes per-item foreach results and re-queues only null items (`loop.ts:461-488`). This PR doesn't touch the evented foreach code that open PR #27932 changes.

## Proof

`packages/core/src/workflows/restart-mid-block.test.ts`, 13 tests, built on crash snapshots captured from real runs, plus one DurableAgent test and one Inngest test:

| test | fails with the fix reverted? |
|---|---|
| parallel arm finished before the crash is not re-run | yes |
| 3-arm parallel, unfinished arm between finished ones | yes |
| foreach, concurrency 1 and 3: finished items not re-run | yes (re-runs `[0..4]`) |
| older checkpoint can't overwrite a newer one (writes resolved out of order) | yes (`expected [] to contain ['1','3']`) |
| failed checkpoint write: no write left in flight, `activeStepsPath` cleaned, span errored | yes (`expected 3 to be 0` writes in flight) |
| foreach snapshot writes stay linear (200 items × 1 KB, bound 10× payload) | yes (21.5 MB vs 2 MB bound) |
| items finished within the last interval re-run after a crash (pins the trade-off) | n/a, documents behaviour |
| sibling arm start write can't overwrite a finished parallel arm (writes resolved out of order) | yes (`a later write dropped the finished arm`) |
| item 2 starts while finished item 1 is publishing progress: progress is already back on the foreach result | yes, when the re-attach moves after the publish await (`a later write dropped checkpointed items`) |
| DurableAgent, 3 parallel tool calls, call 2 hangs, restart after calls 1 and 3 checkpoint: only call 2 re-runs (`durable-agent-tool-concurrency.test.ts`) | yes, on main's `control-flow.ts`/`step.ts`/`utils.ts` (`[1,2,3]`) |
| DurableAgent, crash 200 ms after call 3 finishes: calls 2 and 3 re-run (pins the window) | n/a, documents behaviour |
| Inngest: step-update operations for foreach + parallel equal main's 9-op sequence (`inngest/src/execution-engine.test.ts`) | yes, when the flag is flipped to `true` |
| per-run queue: suspend/resume inside foreach (concurrency 3) | guard, also passes on the old code |
| per-run queue: foreach of nested workflows that each run a foreach | guard |
| suspended items resume with their `suspendPayload` from a fresh process | guard |

- Workflow suite, one file at a time with `--maxWorkers=1` and a 2 GB heap: all 32 files pass. `workflow.test.ts` was run in five `-t` chunks (≈329 tests, 0 failed), because it runs out of heap even alone at 2 GB, on the PR head before these changes too. `evented-workflow.test.ts`: 161 passed / 5 skipped, with one unhandled `ERR_INVALID_STATE` from `EventedRun` stream close. That error is identical on fca916bb71, so it predates this work.
- DurableAgent `__tests__`: all 142 files pass, one at a time.
- Inngest (`inngest-cli dev` 1.27), one file at a time: 33 files pass. Every failure was compared with the PR head before review (fca916bb71) and fails the same way there: `create-inngest-agent` (2), `resume-runtime-rehydration` (1), `inngest-durable-agent-suite` (4 of 245). `index.test.ts` is too slow to finish in one run, so its `foreach` and `parallel|multiple chains` tests were run separately: 11/12 and 18/19 pass. The foreach failure ("keeps the first failure…") also fails at fca916bb71. The parallel failure needs a real `OPENAI_API_KEY`. `resume-nested-workflow` failed once and passed 3/3 on re-run.
- `tsc --noEmit` (core and inngest), `oxlint` and `oxfmt --check` are clean.

### Storage cost: file-backed LibSQL and PostgreSQL 15

Three variants: main, this PR before review (one full snapshot write per item), and this PR now (coalesced). The harness is on `scratch/26214-checkpoint-storage-bench`. Each item returns a payload of the given size, and items have no delay unless the row says so. Numbers are the median of 3 runs unless marked.

| store | items × output | c | variant | runs | writes | bytes written | largest | wall (ms) | disk growth | bytes vs main | wall vs main |
|---|---|---|---|---|---|---|---|---|---|---|---|
| libsql | 1000 × 2KB | 1 | main | 3 | 1003 | 10 MB | 4.05 MB | 431 | 13 MB | 1.00× | 1.00× |
| libsql | 1000 × 2KB | 1 | PR now | 3 | 5 | 6.09 MB | 4.05 MB | 204 | 13 MB | 0.58× | 0.47× |
| libsql | 1000 × 2KB | 1 | PR before review | 1 | 2003 | 2055 MB | 4.05 MB | 19564 | 12 MB | 196.88× | 45.39× |
| libsql | 1000 × 2KB | 10 | main | 3 | 1003 | 10 MB | 4.05 MB | 414 | 13 MB | 1.00× | 1.00× |
| libsql | 1000 × 2KB | 10 | PR now | 3 | 14 | 6.18 MB | 4.05 MB | 153 | 13 MB | 0.59× | 0.37× |
| libsql | 1000 × 2KB | 10 | PR before review | 1 | 2003 | 2039 MB | 4.05 MB | 21680 | 12 MB | 195.50× | 52.37× |
| libsql | 1000 × 32KB | 1 | main | 3 | 1003 | 100 MB | 64 MB | 1829 | 160 MB | 1.00× | 1.00× |
| libsql | 1000 × 32KB | 1 | PR now | 3 | 5 | 96 MB | 64 MB | 1639 | 160 MB | 0.96× | 0.90× |
| libsql | 1000 × 32KB | 1 | PR before review | 1 | DNF: exit 1 | | | | | | |
| libsql | 1000 × 32KB | 10 | main | 3 | 1003 | 100 MB | 64 MB | 1845 | 160 MB | 1.00× | 1.00× |
| libsql | 1000 × 32KB | 10 | PR now | 3 | 14 | 97 MB | 64 MB | 1575 | 160 MB | 0.96× | 0.85× |
| libsql | 1000 × 32KB | 10 | PR before review | 1 | DNF: exit 124 | | | | | | |
| libsql | 5000 × 2KB | 1 | main | 4 | 5003 | 152 MB | 20 MB | 3379 | 50 MB | 1.00× | 1.00× |
| libsql | 5000 × 2KB | 1 | PR now | 4 | 5 | 30 MB | 20 MB | 646 | 50 MB | 0.20× | 0.19× |
| libsql | 5000 × 2KB | 10 | main | 3 | 5003 | 152 MB | 20 MB | 3209 | 50 MB | 1.00× | 1.00× |
| libsql | 5000 × 2KB | 10 | PR now | 3 | 14 | 31 MB | 20 MB | 632 | 50 MB | 0.20× | 0.20× |
| libsql | 5000 × 32KB | 1 | main | 3 | 5003 | 602 MB | 320 MB | 10784 | 803 MB | 1.00× | 1.00× |
| libsql | 5000 × 32KB | 1 | PR now | 3 | 5 | 481 MB | 320 MB | 7853 | 803 MB | 0.80× | 0.73× |
| libsql | 5000 × 32KB | 10 | main | 3 | 5003 | 602 MB | 320 MB | 10913 | 803 MB | 1.00× | 1.00× |
| libsql | 5000 × 32KB | 10 | PR now | 3 | 14 | 481 MB | 320 MB | 8516 | 803 MB | 0.80× | 0.78× |
| libsql | 1000 × 256KB | 1 | main | 3 | 1003 | 772 MB | 512 MB | 13848 | 1285 MB | 1.00× | 1.00× |
| libsql | 1000 × 256KB | 1 | PR now | 3 | 5 | 768 MB | 512 MB | 13759 | 1285 MB | 0.99× | 0.99× |
| libsql | 1000 × 256KB | 10 | main | 3 | 1003 | 772 MB | 512 MB | 12667 | 1285 MB | 1.00× | 1.00× |
| libsql | 1000 × 256KB | 10 | PR now | 3 | 14 | 774 MB | 512 MB | 12573 | 1285 MB | 1.00× | 0.99× |
| pg | 1000 × 2KB | 1 | main | 3 | 1003 | 10 MB | 4.05 MB | 3413 | 4.39 MB | 1.00× | 1.00× |
| pg | 1000 × 2KB | 1 | PR now | 3 | 5 | 6.09 MB | 4.05 MB | 190 | 0.24 MB | 0.58× | 0.06× |
| pg | 1000 × 2KB | 10 | main | 3 | 1003 | 10 MB | 4.05 MB | 1818 | 4.38 MB | 1.00× | 1.00× |
| pg | 1000 × 2KB | 10 | PR now | 3 | 14 | 8.16 MB | 4.05 MB | 300 | 0.30 MB | 0.78× | 0.17× |
| pg | 1000 × 32KB | 1 | main | 3 | 1003 | 100 MB | 64 MB | 4890 | 5.59 MB | 1.00× | 1.00× |
| pg | 1000 × 32KB | 1 | PR now | 3 | 5 | 96 MB | 64 MB | 2038 | 1.43 MB | 0.96× | 0.42× |
| pg | 1000 × 32KB | 10 | main | 3 | 1003 | 100 MB | 64 MB | 3749 | 5.60 MB | 1.00× | 1.00× |
| pg | 1000 × 32KB | 10 | PR now | 3 | 14 | 128 MB | 64 MB | 2638 | 1.93 MB | 1.28× | 0.70× |
| pg | 5000 × 2KB | 1 | main | 3 | 5003 | 152 MB | 20 MB | 49855 | 73 MB | 1.00× | 1.00× |
| pg | 5000 × 2KB | 1 | PR now | 3 | 5 | 30 MB | 20 MB | 858 | 0.70 MB | 0.20× | 0.02× |
| pg | 5000 × 2KB | 10 | main | 3 | 5003 | 152 MB | 20 MB | 45507 | 78 MB | 1.00× | 1.00× |
| pg | 5000 × 2KB | 10 | PR now | 3 | 14 | 41 MB | 20 MB | 1066 | 1.05 MB | 0.27× | 0.02× |
| pg | 5000 × 32KB | 1 | main | 1 | DNF: exit 1 | | | | | | |
| pg | 5000 × 32KB | 1 | PR now | 1 | DNF: exit 1 | | | | | | |
| pg | 5000 × 32KB | 10 | main | 1 | DNF: exit 1 | | | | | | |
| pg | 5000 × 32KB | 10 | PR now | 1 | DNF: exit 1 | | | | | | |
| pg | 1000 × 256KB | 1 | main | 1 | DNF: exit 1 | | | | | | |
| pg | 1000 × 256KB | 1 | PR now | 1 | DNF: exit 1 | | | | | | |
| pg | 1000 × 256KB | 10 | main | 1 | DNF: exit 1 | | | | | | |
| pg | 1000 × 256KB | 10 | PR now | 1 | DNF: exit 1 | | | | | | |

Notes:
- Before review, the PR wrote ~2 GB for 1k × 2 KB. At 1k × 32 KB it didn't finish: one run exited, and the kernel OOM-killed the other at 7.4 GB RSS. It wasn't run past that.
- PG 5k × 32 KB and 1k × 256 KB fail **on main too**: the final snapshot exceeds jsonb's 256 MB limit (`total size of jsonb object elements exceeds the maximum of 268435455 bytes`). The PR doesn't cause this. The fix belongs in a smaller final snapshot, not in checkpointing.
- Concurrency 10 includes the per-run queue's cost, and coalesced is never slower than main there.

**Slow items** (1 run each; the per-run interval is what bounds writes here, not item count):

| store | items × output | item time | c | variant | writes | bytes written | wall (ms) | bytes vs main | wall vs main |
|---|---|---|---|---|---|---|---|---|---|
| libsql | 300 × 32KB | 100 ms | 1 | main | 303 | 29 MB | 31,019 | 1.00× | 1.00× |
| libsql | 300 × 32KB | 100 ms | 1 | coalesce | 36 | 183 MB | 31,692 | 6.26× | 1.02× |
| pg | 300 × 32KB | 100 ms | 1 | main | 303 | 29 MB | 31,531 | 1.00× | 1.00× |
| pg | 300 × 32KB | 100 ms | 1 | coalesce | 35 | 176 MB | 30,977 | 6.02× | 0.98× |
| libsql | 100 × 32KB | 1 s | 10 | main | 103 | 9.7 MB | 10,169 | 1.00× | 1.00× |
| libsql | 100 × 32KB | 1 s | 10 | coalesce | 23 | 24 MB | 10,212 | 2.49× | 1.00× |
| pg | 100 × 32KB | 1 s | 10 | main | 103 | 9.7 MB | 10,288 | 1.00× | 1.00× |
| pg | 100 × 32KB | 1 s | 10 | coalesce | 23 | 24 MB | 10,263 | 2.49× | 1.00× |

So when items finish slowly, coalesced checkpoints write more bytes than main (2.5–6× here) and the ratio grows with run duration × progress size. Wall time is unchanged. Disk growth after VACUUM on PG: 0.6 → 2.7 MB and 0.27 → 0.48 MB.

**The original 400-item table, re-measured** (LibSQL, tiny outputs, concurrency 4, 1 run):

| | writes | bytes written | largest snapshot | wall (ms) |
|---|---|---|---|---|
| main | 403 | 827 KB | 27,267 | 160 |
| PR before review | 803 | 9.56 MB | 27,267 | 562 |
| PR now | 8 | 54 KB | 27,267 | 69 |

## Crash-replay window

Items that finished within the last checkpoint interval (≤ ~1 s) before a crash are run again on restart. That matches the engine's existing at-least-once behaviour for steps. A dedicated test pins it.

For DurableAgent tool calls this window matters more, because tool calls have side effects. Measured: 3 parallel calls, call 2 hangs, call 3 finishes 300 ms after call 1, and the crash comes 200 ms later. Restart re-runs calls 2 **and 3**. Two options, not decided here:

1. **Keep the 1 s interval everywhere.** A tool call that finished up to ~1 s before a crash runs again. Cost: none beyond the table above.
2. **Flush immediately for the durable tool-call foreach** (internal `checkpointIntervalMs: 0`, prototype `b16c7ca330` on `wip/26214-tool-call-flush-prototype`). Then only call 2 re-runs. Bytes cost if the same flush applied to a 1k × 2 KB foreach on LibSQL (median of 3): c=1: 908 writes / 936 MB / 7.8 s vs 4 writes / 6.1 MB / 151 ms coalesced (~150×). c=10: 101 writes / 99 MB / 904 ms vs 13 writes / 6.2 MB / 165 ms (~16×). For a tool-call step with ≤ 10 calls the extra cost is a handful of small writes. It only gets big for steps with hundreds of calls.

## Unverified

- **Long-running foreach cost** (measured above, but not bounded): with slow items, bytes written scale with run duration × progress size, about one full progress rewrite per second. A one-hour foreach with a 300 MB progress could write on the order of 1 TB. An append-only progress API, or a longer interval, would cap this. That can be a follow-up.
- **Out-of-order start writes:** the per-run queue orders writes by call order. A progress-less start write that was issued before any item finished can still land before the first checkpoint. That costs at-least-once replay, not lost results.
- Inngest checkpoints are off, pinned by a unit test against a mocked `inngestStep.run`. The full Inngest suite was run against a dev server (see Proof).
- Item `startedAt` is no longer persisted mid-foreach once an item has finished, so a snapshot read mid-run shows less per-item start detail.
- Restart after a second crash (crash → restart → crash) isn't tested.

## Risk: medium

This changes when and how often snapshots are written during parallel and foreach execution on the default engine. It adds a per-run write queue for step-update writes and accepts a ≤ 1 s replay window after a crash, including for DurableAgent tool calls unless option 2 is taken. Inngest is unchanged.
