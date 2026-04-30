# Observational Memory: Production Readiness Report

## Executive Summary

The Observational Memory (OM) system relies on in-process state (static Maps, instance-level locks, fire-and-forget async operations) for coordination. This design works correctly in a single-process, single-instance, long-lived server environment but has critical issues in horizontally-scaled or serverless deployments where multiple replicas handle requests for the same thread or resource.

The most severe issue is **data loss in resource-scoped OM** — concurrent observations from different replicas overwrite each other's results due to read-modify-write patterns without compare-and-swap or versioning.

---

## In-Process State

### Static Maps

There are 4 static Maps on the `ObservationalMemory` class, shared across all instances within a single Node.js process but invisible to other replicas:

| Static Map                 | Purpose                                                | Horizontal Scaling Problem                                                                                                       |
| -------------------------- | ------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------- |
| `asyncBufferingOps`        | Tracks in-flight async buffering Promises              | Replica B can't await Replica A's in-flight operation. May activate incomplete buffered content.                                 |
| `lastBufferedBoundary`     | Token boundary where buffering was last triggered      | Replica B doesn't know the boundary, re-triggers buffering for the same messages, creating duplicate buffered chunks in storage. |
| `lastBufferedAtTime`       | Timestamp cursor for which messages have been buffered | Same — Replica B re-buffers already-buffered messages.                                                                           |
| `reflectionBufferCycleIds` | CycleId for in-flight buffered reflections             | Minor — affects UI marker display only.                                                                                          |

On serverless cold start or process recycle, all 4 maps start empty. Any in-flight work from the previous invocation is invisible to the new process.

### Instance-Level Mutex

The `withLock()` method uses an in-process `Map<string, Promise<void>>`. The code explicitly acknowledges this limitation:

> "For distributed deployments, external locking (Redis, database locks) would be needed, or accept eventual consistency (acceptable for v1)."

Two replicas can simultaneously acquire the "lock" for the same thread/resource and execute `observe()` concurrently.

### Instance-Level `observedMessageIds` Set

A `Set<string>` that prevents re-observation within a single process lifetime. On a cold start or different replica, this set is empty. The code falls back to `record.observedMessageIds` from storage, which may itself be stale due to the read-modify-write issues described below.

### Operation Registry

`operation-registry.ts` uses a static `Map<string, number>` to track active operations (observing, reflecting, buffering). Process-local only. The stale flag detection pattern — "DB flag says observing is active, but `isOpActiveInProcess()` returns false, so the flag must be stale" — works as partial crash recovery within a single process but cannot coordinate across replicas.

---

## Read-Modify-Write Without Compare-and-Swap

This is the most critical class of problems. The pattern throughout the codebase is:

```text
1. Read record from DB (getObservationalMemory)
2. Modify in memory (call observer/reflector LLM, generate observations)
3. Write back to DB (updateActiveObservations)
```

`updateActiveObservations` is a plain overwrite — no version checking, no CAS, no optimistic concurrency control.

### Affected Operations

| Storage Method               | Fields Overwritten                                                                    | Risk                                                           |
| ---------------------------- | ------------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| `updateActiveObservations`   | `activeObservations`, `observationTokenCount`, `lastObservedAt`, `observedMessageIds` | Last-write-wins clobbers observations                          |
| `swapBufferedToActive`       | Merges buffered chunks into active observations                                       | Two replicas may activate the same chunks, creating duplicates |
| `createReflectionGeneration` | Creates a new generation, increments `generationCount`                                | Two replicas may create duplicate generations                  |
| `updateThread` (metadata)    | `suggestedResponse`, `currentTask`, `lastObservedMessageCursor`                       | Last-write-wins clobbers continuation hints                    |

---

## Scenario Analysis

### Scenario 1: Resource-Scoped OM — Two Threads, Same Resource, Different Replicas

This is the worst case and produces **actual data loss**.

With `scope: 'resource'`, both replicas operate on a shared resource-level record:

1. Replica A observes thread-1 messages → generates `obs1`, writes `observedMessageIds: [msg1, msg2]`
2. Replica B observes thread-2 messages → generates `obs2`, writes `observedMessageIds: [msg3, msg4]`
3. Last write wins: `obs1` is gone, `[msg1, msg2]` are gone from the safeguard set

This is not theoretical — any two agents sharing a `resourceId` that happen to land on different servers will hit this.

### Scenario 2: Same Thread, Concurrent Requests, Different Replicas

1. Replica A reads `record v1`, calls observer LLM (takes seconds)
2. Replica B reads `record v1` (same version), calls observer LLM
3. Replica A writes back `record v2` with `obs1`
4. Replica B writes back `record v2'` with `obs2` — **overwrites `obs1`**

The in-process `withLock()` mutex prevents this within a single process but not across replicas.

### Scenario 3: Async Buffering Across Replicas

1. Replica A triggers `startAsyncBufferedObservation` (fire-and-forget), stores Promise in `asyncBufferingOps` static map, sets DB flag `isBufferingObservation = true`
2. Replica A's Lambda is frozen or the next request goes to Replica B
3. Replica B's `asyncBufferingOps` map is empty — it can't await Replica A's in-flight operation
4. Replica B calls `tryActivateBufferedObservations`, reads whatever chunks are in storage
5. If Replica A's async op hasn't completed yet, Replica B activates **incomplete** buffered content
6. When Replica A's async op eventually completes (if the process is still alive), it writes additional buffered chunks that have already been "activated" — creating orphaned state

### Scenario 4: Serverless Cold Start

1. Lambda A triggers async buffering, populates all 4 static maps, fires background LLM call
2. Lambda A is frozen/recycled before the background call completes
3. Lambda B starts cold — all static maps are empty
4. Lambda B reads DB: `isBufferingObservation = true` (stale flag from Lambda A)
5. Lambda B calls `isOpActiveInProcess()` → returns `false` (no op in this process)
6. Lambda B clears the stale flag and proceeds
7. Lambda A's background work (if the process was still alive) is lost entirely

### Scenario 5: Concurrent Reflections

1. Replica A reads `record.isReflecting = false`, checks `isOpActiveInProcess()` = false
2. Replica B reads `record.isReflecting = false`, checks `isOpActiveInProcess()` = false
3. Both set the flag to `true` and call `callReflector()`
4. Both generate reflections, both call `createReflectionGeneration`
5. Result: duplicate reflection generations, wasted LLM tokens

This is a classic TOCTOU (time-of-check-to-time-of-use) race on the storage flags.

---

## Thread Metadata Updates

`setThreadOMMetadata` + `updateThread` follows the same read-modify-write pattern:

```text
1. getThreadById (read)
2. setThreadOMMetadata (modify in memory)
3. updateThread (write)
```

Two concurrent observations for the same thread will clobber each other's `suggestedResponse`, `currentTask`, and `lastObservedMessageCursor` values.

---

## Marker Streaming

`writer.custom()` sends observation markers (start, end, activation, failed) to the current request's response stream only. If Replica A performs an observation and Replica B serves the next request, Replica B's client won't see Replica A's markers. Some markers are persisted to storage via `persistMarkerToStorage()`, but this is inconsistent — start markers and buffering-start markers are streamed but not persisted.

---

## Severity Summary

| Issue                                                    | Severity     | Impact                                                              |
| -------------------------------------------------------- | ------------ | ------------------------------------------------------------------- |
| Resource-scoped observation RMW (observations lost)      | **Critical** | Actual data loss — observations from one thread overwrite another's |
| Thread-scoped observation RMW (observations overwritten) | **Critical** | Data loss on concurrent requests for the same thread                |
| TOCTOU on reflection/observation flags                   | **High**     | Duplicate LLM calls, wasted tokens, duplicate generations           |
| Static maps lost on cold start / process recycle         | **High**     | Incomplete activations, duplicate buffering, lost async work        |
| Fire-and-forget operations lost on crash                 | **High**     | Lost background work, stale DB flags                                |
| Thread metadata RMW                                      | **Medium**   | Stale continuation hints (`suggestedResponse`, `currentTask`)       |
| Sealed IDs lost across replicas                          | **Medium**   | Redundant message writes (not data loss, but wasted work)           |
| Instance mutex single-process only                       | **Medium**   | Enables all RMW races above                                         |
| Marker streaming gaps                                    | **Low**      | Incomplete UI feedback for observation progress                     |

---

## What Works Today

- **Single-process, single-instance deployments**: All coordination mechanisms work correctly
- **Crash recovery for stale flags**: The `isOpActiveInProcess()` check detects flags left by crashed processes and clears them
- **Buffered chunks survive in storage**: Even if the process dies, completed buffered chunks are persisted and can be activated on the next request
- **`lastObservedAt` cursor**: Mostly prevents re-observation of the same messages (except for same-timestamp edge cases)

## What Would Be Needed for Multi-Replica Safety

1. **Compare-and-swap or optimistic concurrency** on `updateActiveObservations` — reject writes if the record version has changed
2. **Distributed locks** (Redis, database advisory locks) replacing `withLock()`
3. **Database-backed coordination state** replacing the 4 static Maps
4. **Idempotent activation** — `swapBufferedToActive` should be safe to call twice with the same chunks
5. **Atomic flag transitions** — `isReflecting` and `isBufferingObservation` flags should use conditional updates (e.g., `UPDATE ... SET isReflecting = true WHERE isReflecting = false`)
