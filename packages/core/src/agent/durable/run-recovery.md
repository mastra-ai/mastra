# Durable run recovery

A durable agent run whose process dies stays `running` in storage with nobody driving it. Recovery restarts it in another process (or the same one after a restart) from its last persisted snapshot.

Recovery only takes runs that are orphaned. Whether a run is orphaned is decided by run ownership; see [leases.md](./leases.md) for how claims, generations, and fencing work. This file covers what recovery does with that.

## Prerequisites

- The agent is registered on a `Mastra` instance with storage (`DURABLE_AGENT_RECOVER_NO_MASTRA`, `DURABLE_AGENT_RECOVER_NO_STORAGE` otherwise).
- The run has a persisted `running` snapshot. `listActiveRuns()` and `recover()` read nothing else. A plain `DurableAgent` writes `running` snapshots only when `recovery.durableAgents` is `'auto'`, or when a user `shouldPersistSnapshot` includes `running`. `EventedAgent` always writes them.
- The workflows store supports run fencing. Without it recovery still works, but liveness comes from the pubsub lease and a superseded execution's writes are not rejected. `recoverActiveRuns()` and `recover()` warn once per store when that applies.

## Entry points

| Entry point                                           | What it does                                                                                                                                                                                                              |
| ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `agent.recover(runId, { force?, abortSignal?, ... })` | Recovers one run and returns its stream.                                                                                                                                                                                  |
| `agent.recoverActiveRuns({ runId?, ...listOptions })` | Recovers every run `listActiveRuns()` finds (or one `runId`), awaits each, and returns `{ recovered, succeeded, failed }`. No streams.                                                                                    |
| `mastra.recoverAllDurableAgents()`                    | Calls `recoverActiveRuns()` on every registered durable agent and schedules re-checks for skipped runs.                                                                                                                   |
| Boot                                                  | With `recovery: { durableAgents: 'auto' }`, the built server calls `recoverAllDurableAgents()` at startup, and `mastra dev` triggers it through `/__restart-active-workflow-runs`. A custom server has to call it itself. |
| `POST /agents/:agentId/recover`                       | Server route over `recover()`. Run-state conflicts map to 409.                                                                                                                                                            |

## When a run is recovered

`recover()` takes a run only if all of these hold:

1. Its snapshot exists, is `running`, and belongs to this agent.
2. This process is not already recovering it.
3. This process is not executing it.
4. No other execution holds a live claim on it, unless `force` is set.
5. For a run without an ownership record (started by a version from before ownership records existed), its thread lease is not held. A run without a thread, or a pubsub without leases, gives no signal, so such a run counts as not live.

The checks happen in that order. The claim in step 4 is atomic with the check, so no other execution can claim the run once it succeeds. With storage fencing, no other execution can write to the run from that moment either. With a pubsub lease, an execution that lost the run can still write until it notices the loss (see [`force`](#force)).

## The sequence

1. **Validate.** Load the snapshot and reject a missing, foreign, or suspended run before touching ownership.
2. **Pin the agent version.** A run that was executing a stored agent version is recovered on that version: `recover()` resolves it and delegates to it. This happens before claiming, so the claim is never held by one agent object while another drives the run. If the pinned version was deleted, the current definition is used.
3. **Claim locally.** A second `recover()` of the same run in this process fails with `DURABLE_AGENT_RECOVER_ALREADY_IN_PROGRESS`.
4. **Refuse a local execution.** If this process still executes the run, fail with `DURABLE_AGENT_RECOVER_RUN_ACTIVE_LOCALLY`. `force` does not override this: taking it over would replace the live execution's registry entry mid-flight.
5. **Claim the run** in `recover` mode, or `takeover` mode under `force`.
6. **Reload the snapshot.** The previous owner may have finished or suspended while the claim was in flight. Everything after this uses the reloaded snapshot, never the pre-claim copy. A run that suspended in the meantime is refused and the claim released.
7. **Rebuild state.** Rehydrate the message list, memory, request context, and tracing span from the snapshot, then raise the memory store's fence to the claim's generation.
8. **Announce.** With a storage claim, publish `ownership-claimed` on the run stream so readers, including the superseded execution's own caller, drop older-generation events from then on.
9. **Register the stream** and, for a run on a memory thread, the thread run.
10. **Restart** the workflow from the snapshot under the claim. On a non-suspended terminal, while still owned, delete the run's snapshots, as `stream()` and `resume()` do.

If setup fails before the workflow restarts, any claim taken is settled and released, and `recover()` throws. A failure after the restart is published as an error event on the run stream (and passed to `onError`), unless another execution took the run over, in which case the thread lease and run topic are left to that execution.

## What the redo does

The workflow restarts from the last persisted snapshot. Every step after it runs again, including model calls and tool calls.

Writes from the redo land on the same rows the crashed execution wrote. Message and part ids come from the snapshot's state, not freshly generated, so a redo upserts rather than appends. This holds for crashes anywhere in the run, including with `savePerStep: true`, where memory can be one step ahead of the snapshot. No reconciliation pass runs. A real model can produce different content on the redo; the redo overwrites what the crashed execution flushed.

One edge: on the default engine, `map-final-output` publishes `finish` before its result is saved. If the saved snapshot already shows it succeeded, the engine continues past it instead of re-running it, so the recovered stream would never see `finish`. Recovery republishes `finish` from the saved result in that case. The evented engine re-runs finished steps, so it publishes `finish` itself.

## Refusals and errors

| Error id                                    | Meaning                                                                                                                                                                        | In `recoverActiveRuns()`                       |
| ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------- |
| `DURABLE_AGENT_RUN_ACTIVE`                  | Another execution holds a live claim, or the thread lease of an untracked run is held. `details`: `liveBy` (`claim` or `thread-lease`), `holder`, `leaseExpiresAt`, `retryAt`. | `skipped`, reason `run-active`, with `retryAt` |
| `DURABLE_AGENT_RECOVER_RUN_ACTIVE_LOCALLY`  | This process is executing the run.                                                                                                                                             | `skipped`, reason `run-active-locally`         |
| `DURABLE_AGENT_RECOVER_ALREADY_IN_PROGRESS` | This process is already recovering the run.                                                                                                                                    | `skipped`, reason `already-in-progress`        |
| `DURABLE_AGENT_RECOVER_RUN_SUSPENDED`       | The run is suspended; call `resume()`.                                                                                                                                         | left out                                       |
| `DURABLE_AGENT_EXECUTION_CONFLICT`          | A `force` takeover lost to a concurrent claimer.                                                                                                                               | not raised (no `force`)                        |
| `DURABLE_AGENT_RECOVER_SNAPSHOT_NOT_FOUND`  | No snapshot: the run finished and was cleaned up, or `running` snapshots are not persisted.                                                                                    | left out                                       |
| `DURABLE_AGENT_RECOVER_AGENT_MISMATCH`      | The run belongs to another agent.                                                                                                                                              | `failed`                                       |

The server maps the first five to 409 so clients can tell a run-state conflict from a bad request.

`recoverActiveRuns()` leaves out runs that finished or suspended between discovery and their turn. With an explicit `runId`, it applies the same rules: a run that is not `running` is not attempted.

## Timing

**After a hard crash** the crashed execution's claim stays live until it expires: 30s after its last renewal, on the store's clock. Renewals happen every 10s, so a run becomes recoverable 20–30s after the crash. Until then a plain `recover()` gets `DURABLE_AGENT_RUN_ACTIVE`; `force` takes it at once. For a run without an ownership record, the wait is the thread lease's TTL (15s by default).

**After a graceful shutdown** `Mastra.shutdown()` abandons executions still running when its drain deadline passes and releases their claims, so the next process recovers them immediately.

**`retryAt`** is when the evidence that the run is live lapses unless renewed: the claim's remaining time, or a full TTL when the backend doesn't report an expiry, clamped to between 1s and one TTL from now. It is computed on the local clock, so clock skew against the store can make it early; an early retry is refused again with a new `retryAt`.

**Boot re-checks.** `recoverAllDurableAgents()` schedules each skipped run with a `retryAt` for another attempt at `retryAt` plus up to 5s of random jitter, which spreads instances that booted together. A re-check that is skipped again is rescheduled. Re-checks stop once the run is recovered, fails, finishes, or suspends. Runs skipped without a `retryAt` (this process is executing or recovering them) are not re-checked. `shutdown()` cancels pending re-checks.

## `force`

`recover(runId, { force: true })` takes the run from a live execution. Use it when the owner is known to be gone (a killed container whose claim hasn't expired yet) or stuck.

With storage fencing, the old execution's writes are rejected from the moment the takeover's claim lands. It notices on its next step check or heartbeat (within 10s), aborts its model call and tools, and writes nothing terminal. Its caller's stream receives the new owner's events, because the run topic is shared and older generations are dropped. Without storage fencing, `force` transfers the pubsub lease; the old execution still stops at its next check, but writes it makes before then are not rejected.

`force` never takes a run this process is executing, and a forced takeover still loses to a concurrent claimer.

## Tools run again

Neither recovery nor takeover can undo a side effect. A tool that was running when the process died runs again on the redo, and a takeover of a stalled execution can run a tool that the old execution is still running. Tools in durable agents should be idempotent. Declaring which tool calls are safe to replay is tracked in #25780.

## Engines

Recovery and ownership apply the same way on both engines. The evented engine's durable loop is registered as an internal workflow, so its events are published `localOnly` and never leave the process. No sibling worker picks up a crashed run's steps from the bus; the run stays stranded until `recover()` restarts it, as on the default engine.

The evented engine stores each loop iteration as a nested run with its own run id. The nested runs are adopted under the parent's claim, so their writes are fenced by the parent's generation.

## Known gaps

- The evented engine re-runs a step that finished before the crash instead of continuing past it (COR-1354).
- Evented durable-agent recovery fails at some crash points (a nested snapshot left `pending` with no active paths, an empty execution path, or a hang). This predates run ownership.
