# Leases

Several leases coordinate agent work across processes. Each one has an owner, a TTL, and a renewal loop at roughly a third of the TTL. Expiry is how a dead process is noticed: whoever held the lease stops renewing, and the next claimant can take it once the TTL runs out.

They protect different things and react differently when lost, so they are not interchangeable.

| Lease                 | Protects                                                      | Lives in                                           | Key                                                                             | Owner               | TTL / renewal                                   | When lost                                                          |
| --------------------- | ------------------------------------------------------------- | -------------------------------------------------- | ------------------------------------------------------------------------------- | ------------------- | ----------------------------------------------- | ------------------------------------------------------------------ |
| Run ownership         | One execution drives a durable run; stale writes are rejected | Workflows store, or the agent's pubsub as fallback | `runId` (storage), `mastra:durable-agent-execution:v1:[agentId,runId]` (pubsub) | Execution id        | 30s / 10s                                       | Execution aborts; its writes and publishes are rejected or dropped |
| Thread lease          | One active run per memory thread                              | Agent's pubsub                                     | `resourceId` + NUL + `threadId`                                                 | Run id              | 15s / 5s (env-configurable)                     | Renewal stops; the current run still finishes                      |
| Thread claim lease    | One process owns a claimed thread                             | Agent's pubsub                                     | `thread-claim:` + thread key                                                    | Process source id   | Same as thread lease                            | Claim unsubscribes and calls `onOwnershipLost`                     |
| Evented step fence    | A redelivered `workflow.step.run` does not run a step twice   | `mastra.pubsub`                                    | `workflow-step-run:${runId}:${eventId}`                                         | Random per delivery | 30s / 10s                                       | Nothing; best effort                                               |
| Background task lease | One worker runs a background tool call                        | The task row in storage                            | Task id                                                                         | Worker id           | `leaseDurationMs` (default 30s) / a third of it | The worker aborts its local run once another worker reclaims it    |

## Pubsub leases: `LeaseProvider`

Every pubsub-backed lease uses the `LeaseProvider` interface in `src/events/pubsub.ts`: `acquireLease`, `renewLease`, `releaseLease`, `transferLease`, and `getLeaseOwner`. `transferLease` hands a lease from one owner to another atomically, so no third party can acquire it in between.

`EventEmitterPubSub` (in-process map), `UnixSocketPubSub`, `@mastra/redis-streams`, and `@mastra/valkey-streams` implement it. `CachingPubSub` exposes its inner pubsub's provider through `getLeaseProvider()`. A pubsub without lease support (for example `@mastra/google-cloud-pubsub`) resolves to `NoopLeaseProvider`, where every acquire succeeds: single-process behavior, no cross-process exclusion. Each caller resolves its provider itself (`resolveLeaseProvider` in `execution-fence.ts`, `#resolveLeaseProvider` in `thread-stream-runtime.ts`, `#getLeaseProvider` in the evented workflow processor).

Pubsub leases expire on the backend's clock (Redis `PEXPIRE`, or `Date.now()` in-process).

## Run ownership

Files: `execution-fence.ts`, `run-fence-scope.ts`, `run-registry.ts`, `../../storage/run-fencing.ts`.

A durable run must have exactly one execution driving it. Without a claim, `recover()` on a live run, or auto-recovery while the original process was still running, produced two executions writing the same snapshot, memory thread, and stream topic (#23734). The claim makes the second execution wait, refuse, or win cleanly, and, with a store that supports fencing, makes storage reject writes from whichever execution lost.

`ExecutionFence.claim()` picks one of two backends per claim, based on whether the workflows store returns `true` from `supportsRunFencing()`.

### Storage backend

The workflows domain keeps an ownership record per run (`mastra_workflow_run_owners`): `generation`, `ownerId`, and `leaseExpiresAt`, with liveness judged on the store's clock.

- `claimRunOwnership` increments the generation. `expectedGeneration` pins a claim to the generation the claimer inspected, so racing claimers resolve to one winner, even with `force`.
- Every write a run makes carries a fence (`runId`, `generation`, `ownerId`). The adapter checks it atomically with the write and throws `RunFenceConflictError` when the fence is no longer current.
- Writes get their fence implicitly. `ExecutionFence` is the `RunFenceScope` installed by `runInRunFenceScope` (AsyncLocalStorage), and adapters call `resolveRunFence()`. A nested workflow run stored under its own runId carries its parent run's fence.
- After claiming, the owner raises the memory domain's fence for the run to the same generation (`raiseRunFence`, stored in `mastra_memory_run_fences`), so memory writes from older generations are rejected as well. The memory fence has no expiry; it only moves forward.
- Release clears `leaseExpiresAt` but keeps the generation and owner. Late writes from the released owner still land until someone claims the run again, so background work that finishes after a normal completion does not fail. An owned execution also stops fencing its writes once it settles; a lost execution keeps fencing them, so they keep being rejected.

### Pubsub backend

Used when the workflows store cannot fence. The lease key is `mastra:durable-agent-execution:v1:[agentId,runId]`, held by the execution id.

This gives liveness and mutual exclusion only. There is no generation, so storage cannot reject a superseded execution's writes; the execution notices loss at its next check or renewal, and anything it writes in between lands. With `NoopLeaseProvider` the claim never expires and every acquire wins.

When `recovery.durableAgents` is `'auto'` and the workflows or memory store cannot fence, `DurableAgent` logs a warning once per store explaining which writes are left unprotected.

### Claim modes

- **acquire**: starting or resuming a run. If another execution holds the run, retries every 100ms for up to 5s, because the previous execution may still be settling after its caller saw it suspend or finish. When that execution is in this process, its settlement wakes the retry early. Then fails with `DURABLE_AGENT_EXECUTION_CONFLICT`.
- **recover**: `recover()` and auto-recovery. A run with a live claim is refused with `DURABLE_AGENT_RUN_ACTIVE`; the error details carry the holder, the lease expiry, and a `retryAt`. A run with no ownership record (started by a version before run ownership) is checked through its thread lease instead (see below). The storage backend pins its claim to the generation it inspected, so a claim made in between wins.
- **takeover**: `recover(runId, { force: true })`. Storage makes one forced claim pinned to the observed generation; if another claimer got in first, that claimant keeps the run. The pubsub backend transfers the lease from the current holder, retrying up to 3 times.

Before claiming, `recover()` refuses a run this process is still executing with `DURABLE_AGENT_RECOVER_RUN_ACTIVE_LOCALLY`, even under `force`: recovering it would replace the live execution's registry entry mid-flight.

### Keeping and losing the claim

- **Heartbeat**: every 10s the execution renews. A renewal that returns `false` means another execution took the run; the fence is marked lost (`superseded`). Backend errors are tolerated until 30s after the last successful renewal, then the fence is marked lost (`unverified`). Loss aborts the execution through `onLost` listeners.
- **Step checks**: `withExecutionFence` wraps each step of the durable loop. It checks ownership before the step, so a superseded execution skips model, tool, and scorer work, and after it, so a stale step fails instead of persisting a `running` snapshot over the new owner's state. Evented workers in another process check the claim where it lives (`assertExecutionOwned`).
- **Publishes**: `fencePubSub` drops publishes from a lost execution, because the run's topics are shared with the new owner's subscribers.
- **Settlement**: `settle()` classifies the end as `owned` (verified; terminal writes run), `orphaned` (unverified but nobody else claimed it; the failure can still be reported), or `superseded` (someone else holds it, or the holder is unknown; nothing is written). The claim is released unless superseded.
- **Shutdown**: `Mastra.shutdown()` calls `abandonDurableAgentExecutions()`. Each local execution is marked lost and its claim released, so another instance can recover the run at once instead of waiting out the TTL. With storage, the run is first claimed under a throwaway owner, which moves the generation past the abandoned execution and rejects its in-flight writes.

### Stream generations

With storage claims, every run-stream event carries the claim's generation, and recovery publishes an `ownership-claimed` event. The stream adapter and thread subscribers drop events older than the newest generation they have seen, so a superseded execution's chunks never reach a consumer after a takeover. Pubsub claims have no generation, so nothing is filtered.

### Tools are not undone

Fencing rejects storage writes and stream events from a lost execution. It cannot undo side effects a tool already caused. A takeover of an execution that stalled mid-tool can run the tool again, so tools in durable agents should be idempotent.

## Thread lease

File: `../thread-stream-runtime.ts`.

Thread-bound runs (signals, `subscribeToThread`, idle wakes) allow at most one active run per memory thread across processes. A message for a busy thread is folded into the running run or queued behind it instead of starting a competing run.

- Key: `resourceId` and `threadId` joined by NUL. Owner: the run id.
- Acquired when a thread-bound run registers; strict registration throws `AgentThreadLeaseConflictError` when another run holds it. When a run finishes and the next queued run starts, the lease is transferred between them so no other process can start a run in the gap. If the transfer fails, the next run falls back to a fresh acquire.
- TTL 15s, renewal every 5s. Override with `MASTRA_AGENT_THREAD_LEASE_TTL_MS` and `MASTRA_AGENT_THREAD_LEASE_RENEW_INTERVAL_MS`.
- When renewal reports the lease gone, renewal stops but the current run is allowed to finish: a duplicate is preferred over dropped messages. Released fire-and-forget when the run ends.
- Recovery uses it as the liveness signal for durable runs without an ownership record (`isRunHoldingThreadLease`). Without a lease-capable pubsub, those runs are treated as not live.

The thread lease does not fence writes. A durable run on a thread holds both its run ownership claim and the thread lease, for different reasons.

## Thread claim lease

File: `../thread-stream-runtime.ts`.

`claimThreadOwnership()` lets a process own an idle thread: it subscribes to the thread and starts runs for incoming signals and peer messages. The claim lease makes that ownership exclusive across processes.

- Key: `thread-claim:` plus the thread key. Owner: the runtime's process source id, not a run.
- If the lease is held, the claimant asks the holder through peer discovery. A holder whose `yieldOwnership()` returns true transfers the lease to the claimant and unsubscribes; the claimant then tries to acquire once more.
- Renewed on the thread lease interval. If a renewal fails and reacquiring fails, the claim unsubscribes and calls `onOwnershipLost`.
- Without a lease-capable pubsub, exclusivity relies on peer discovery alone, and yielding is a silent release.

## Evented step fence

File: `../../workflows/evented/workflow-event-processor/index.ts`.

A broker redelivers a `workflow.step.run` event whose ack deadline passed while the step is still running (#24589). Redeliveries keep the event id; new executions (loop iterations, retries, foreach items) get new events.

- Key: `workflow-step-run:${runId}:${eventId}`. Owner: a random id per `handle()` call. TTL 30s (`STEP_FENCE_TTL_MS`), renewed every 10s.
- A delivery that cannot acquire the lease is a duplicate and is acked and dropped.
- Best effort: if acquiring throws, the step runs anyway; renewal errors are logged.
- On success the lease is kept until it expires, so a late duplicate is still dropped. On failure it is released, so the broker's retry can run the step.

This deduplicates deliveries. It does not fence writes and is independent of run ownership.

## Background task lease

File: `../../background-tasks/manager.ts`.

A background tool call must run on one worker, and another worker must be able to pick it up when that worker dies.

- Stored on the task row as `ownerId` and `leaseExpiresAt`. Claims and renewals are compare-and-set updates through `updateTask(..., { expectedStatus, expectedOwnerId, expectedLeaseExpiresAt })`.
- `leaseDurationMs` defaults to 30s (minimum 3s). One heartbeat renews every lease the manager holds every `max(1s, leaseDurationMs / 3)`.
- Expiry is computed and compared on the worker's clock, unlike the run ownership record, which uses the store's clock. Clock skew between workers shifts when a lease counts as expired.
- Stale recovery reclaims tasks whose lease expired, and schedules another pass at the earliest unexpired lease so a crashed owner's tasks settle without a restart.
- A worker that sees its task reclaimed by another owner aborts its local run.

## Duplication

Each lease has its own renewal loop and constants: 30s/10s is defined separately for run ownership and the evented step fence, the thread leases use 15s/5s, and background tasks are configurable. The two storage leases use unrelated contracts and different clocks. A shared renewing-lease helper (acquire, renew at a third of the TTL, mark lost at a local deadline, release, with a per-caller policy for errors) could replace the pubsub loops, and background tasks could move to the store's clock.
