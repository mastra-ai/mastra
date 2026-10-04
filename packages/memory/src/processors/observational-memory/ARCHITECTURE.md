# Observational Memory: Architecture, Known Problems, and Direction

This document explains how Observational Memory (OM) stores and moves state, what has to stay true for the main agent to see every message, where that currently breaks, and how we plan to fix it.

It is a living document. The "Known problems" and "Direction" sections record what has been verified, how it was verified, and what is still unproven. Update them when that changes.

## Vocabulary

- **Actor**: the main agent whose context OM manages.
- **Observer**: the model call that turns raw messages into observations.
- **Reflector**: the model call that compresses accumulated observations into a shorter reflection.
- **Record / generation**: one `ObservationalMemoryRecord` row. Each reflection creates a new record (`generationCount + 1`); the previous record is retired but kept as history. Only the newest record ("the head") is read for context.
- **Chunk**: one buffered observation (`BufferedObservationChunk`, `packages/core/src/storage/types.ts`), produced in the background and not yet visible to the actor.
- **Cursor**: `record.lastObservedAt`. Messages created at or before it count as observed.

## The record

Each record holds two append-only parts plus a few counters and markers:

| Field                                                                            | Meaning                                                                                                                                                   |
| -------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `activeObservations`                                                             | Observations the actor sees, as one string. Activation appends to it; reflection replaces it in a **new** record.                                         |
| `bufferedObservationChunks`                                                      | Ordered list of chunks waiting to be activated. Buffering appends to it; activation removes a prefix.                                                     |
| `lastObservedAt`                                                                 | The cursor. Activation moves it to the last activated chunk's `lastObservedAt`.                                                                           |
| `lastBufferedAtTime` / `lastBufferedAtTokens`                                    | Where background buffering has reached (ahead of the cursor).                                                                                             |
| `observedMessageIds`                                                             | Safety set for sync observation. Deliberately **not** updated by activation, because AI SDK can reuse message IDs (`inmemory.ts` `swapBufferedToActive`). |
| `bufferedReflection`, `reflectedObservationLineCount`                            | A background reflection plus how many leading lines of `activeObservations` it covers.                                                                    |
| `pendingMessageTokens`                                                           | Persisted count of unobserved message tokens.                                                                                                             |
| `isObserving`, `isReflecting`, `isBufferingObservation`, `isBufferingReflection` | Durable flags. These are **hints, not locks**; stale ones are cleared with the help of `operation-registry.ts`.                                           |

Deciding which messages are unobserved (`getUnobservedMessages`, `observational-memory.ts`) combines three sources: `observedMessageIds`, completion markers inside messages, and the cursor.

### The invariant that makes a timestamp cursor sufficient

> **The buffered list continues right after the cursor.** `chunks[0]` starts just after `lastObservedAt`, and each chunk follows the previous one.

Buffering appends chunks in order, and activation always takes a prefix (`swapBufferedToActive` slices `chunks.slice(0, n)` and moves the cursor to the last activated chunk). While the invariant holds, the cursor never moves past unobserved messages, so a single timestamp is enough and per-message ID sets aren't needed.

**Every loss path found so far comes from something breaking this invariant.**

## Lifecycle (as on `main`)

This section describes `main`. Behavior that exists only on the open #22078 branch is marked as such.

### Thresholds

| Setting                                            | Effect                                                                                                                                                                                                                                                              |
| -------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `messageTokens` (threshold)                        | Observation is due once pending message tokens reach it (`getStatus`: `shouldObserve = pendingTokens >= threshold`).                                                                                                                                                |
| `bufferTokens`                                     | Async buffering interval. Below the threshold, each interval boundary crossed starts one background buffer op (`BufferingCoordinator.shouldTriggerAsyncObservation`; the interval halves near the threshold). `getStatus` only buffers while `pending < threshold`. |
| `bufferActivation`                                 | How much of the pending messages one activation should remove; the rest is kept as a raw tail (retention floor).                                                                                                                                                    |
| `blockAfter`                                       | Forces maximum activation when pending tokens reach it. (#22078 adds an async band `threshold <= pending < blockAfter` that keeps buffering and never blocks; not on `main`.)                                                                                       |
| Reflection `observationTokens`, `bufferActivation` | When reflection is due, and when to start a background reflection ahead of it.                                                                                                                                                                                      |

### Per turn (`observation-turn/turn.ts`, `observation-turn/step.ts`)

**Step 0** (before the first model call of a turn):

1. Activate ready chunks (`om.activate`), then remove the activated messages from the live `MessageList`.
2. `reflector.maybeReflect`: activate a buffered reflection, start a background one, or reflect synchronously.

**Every step:**

1. `getStatus`, which computes `shouldBuffer`, `shouldObserve`, and `canActivate`.
2. If `shouldBuffer`: seal and persist the safe prefix of candidates synchronously, then call `om.buffer()` fire-and-forget.
3. If observation is due, run the threshold pipeline: `waitForBuffering`, activate chunks in a loop, reflect if anything activated, then sync-observe only the uncovered tail (#25060).

### Background buffering (`observation-strategies/async-buffer.ts`)

1. The Observer call runs outside any lock.
2. `persist()` appends the chunk with `updateBufferedObservations` to the record id captured when the op started.
3. Observation groups are indexed, the thread title and extracted values are saved, and the buffering-end marker is emitted.

(#22078 adds a `pendingChunkWrites` phase so activation waits only for the chunk append, emits the end marker right after the append, and retargets the append to whichever record is the head at persist time.)

### Activation (`ObservationalMemory.activate`)

1. If `isBufferingObservation` is set and a buffer op runs in this process, wait for the **whole** op (Observer call, append, indexing) up to 60s, then proceed regardless.
2. Re-fetch the head record and its chunks.
3. Call `storage.swapBufferedToActive({ id: head.id, bufferedChunks })`. In InMemory, OracleDB, and Convex this **reads, then writes**: the stored list is replaced with what's left of the caller's chunks, so a chunk appended between the fetch and the swap is dropped.
4. The caller removes the activated messages from the live `MessageList`.

### Sync observation (`observation-strategies/sync.ts`, `resource-scoped.ts`, `base.ts`)

1. `prepare()` re-reads the head's `activeObservations`; the Observer call runs; `process()` composes the new text (`wrapObservations` / `replaceOrAppendThreadSection`).
2. `persist()` first patches thread metadata (`lastObservedMessageCursor`, and per-thread `lastObservedAt` in resource scope), then commits `updateActiveObservations({ id: record.id, observations })` with last-write-wins semantics.
3. `run()` then emits the completion end marker. `filterObservedMessages` (`message-utils.ts`) removes live messages at or before the thread cursor and before the last completed end marker.

### Reflection (`reflector-runner.ts`)

- **Sync** (`maybeReflect`, then the reflector call, then `createReflectionGeneration({ currentRecord: record })`): reflects the `activeObservations` snapshot taken **before** the Reflector call, and passes that same snapshot as `currentRecord`.
- **Buffered** (`tryActivateBufferedReflection`, then `swapBufferedReflectionToActive`): the adapter re-reads the record and keeps the observation lines after `reflectedObservationLineCount`, so observations activated during the Reflector call survive.
- **Both** create the new generation from the caller's `currentRecord` snapshot, which (InMemory, `inmemory.ts`):
  - copies `lastObservedAt` from `currentRecord`;
  - starts with **no buffered chunks** and `lastBufferedAtTime: null`;
  - resets `pendingMessageTokens` to 0.

## Concurrency model today

| Mechanism                                                                                              | Scope                                                  | What it covers                                                                                                                       |
| ------------------------------------------------------------------------------------------------------ | ------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------ |
| `BufferingCoordinator` static maps (`asyncBufferingOps`, `lastBufferedBoundary`, `lastBufferedAtTime`) | Process-wide, keyed by `thread:<id>` / `resource:<id>` | Dedupes buffer ops; lets activation wait for a buffer op. Shared across `ObservationalMemory` and `Memory` instances in one process. |
| `operation-registry.ts`                                                                                | Process-wide, keyed by record ID                       | Tells live ops apart from stale durable flags.                                                                                       |
| Durable `is*` flags                                                                                    | Cross-process                                          | Hints only; nothing waits on them as locks.                                                                                          |
| Step 0 ordering                                                                                        | One turn                                               | Activation runs before reflection. Nothing orders operations **across** turns, instances, or processes.                              |
| Adapter locking                                                                                        | Per adapter                                            | Not uniform; see below.                                                                                                              |

Durable agents make the cross-process case ordinary: `MessageList` is serialized between durable steps, OM ends and starts a turn each iteration (`processor.ts`), and a step can run in a different process from the one that started a buffer op. Process-static coordination never sees the other process, so **storage has to carry correctness on its own**.

What each adapter does today:

| Adapter    | Observation activation swap                                               | Reflection rollover                     | Chunk append `cycleId` dedup | Notes                                                                      |
| ---------- | ------------------------------------------------------------------------- | --------------------------------------- | ---------------------------- | -------------------------------------------------------------------------- |
| InMemory   | read, write back caller's remaining list                                  | from caller snapshot                    | yes                          | single process                                                             |
| LibSQL     | client write lock + transaction                                           | same                                    | yes                          | serializes only within one client and process; head query has no tie-break |
| PostgreSQL | read then update, no advisory lock                                        | advisory lock (#24923), caller snapshot | yes                          | the two operations don't share a lock                                      |
| MySQL      | locks the current row                                                     | creates a new row from caller snapshot  | yes                          | the row lock doesn't stop a new head from appearing                        |
| MongoDB    | read then update                                                          | insert from caller snapshot             | **no**                       | no transactions used; standalone deployments have none                     |
| OracleDB   | row lock (`lockOMRow`), but writes back the caller's remaining list       | from caller snapshot                    | **no**                       | timestamp round-trip depends on the host time zone (F1)                    |
| Convex     | server mutation `omSwapBuffered`, writes back the caller's remaining list | built client-side from caller snapshot  | **no**                       | each server mutation is a serializable transaction                         |

There is no OM-level lock that makes observation activation and reflection rollover exclude each other.

## Invariants we want

1. **Coverage:** at every step, each message reaches the actor exactly once: raw, or through an observation or reflection that covers it.
2. **No discarded work:** a finished observation (chunk or activated text) is never dropped unless a committed reflection already covers it.
3. **List continuity:** the invariant above. The buffered list continues right after the cursor on the **head** record.
4. **Policy can't break correctness:** thresholds, `blockAfter`, and cache-aware timing decide _when_ the actor's view changes, never _whether_ coverage holds.

## Known problems

Status key: **proven** = reproduced by a probe; **source-read** = follows from reading the code but not probed; **hypothesis** = plausible from the code, to be decided by a test.

### P1. Reflection rollover strands buffered chunks (main, proven; fixed in PR 1)

- **Mechanism:** `createReflectionGeneration` doesn't copy `bufferedObservationChunks` or `lastBufferedAtTime`. Chunks waiting on the old head are left on a retired record and never activated. Breaks invariants 2 and 3.
- **Adapters:** omitted in all seven (InMemory, LibSQL, PostgreSQL, MySQL, MongoDB, OracleDB, Convex).
- **Recovery:** the cursor isn't advanced, so the source messages are observed again later, in **larger batches** with worse quality.
- **Evidence:** an internal BEAM benchmark audit found 620 stranded chunks. Across all of them, the replacing observation covered more messages than the original:

  | min   | median | p90 | max |
  | ----- | ------ | --- | --- |
  | 1.17× | 1.75×  | 2×  | 5×  |

  These are provenance-window sizes, not exact Observer inputs. A targeted 8-pair spot check found 5 replacements that lost local specificity. Two of those lost details that appear nowhere else in later context:
  - Terraform output names;
  - a correct warning about a mathematical error.

  A second sample of 8 previously unexamined high-load replacement windows (12.5k–21.9k raw-text tokens) rated 5 comparable and 3 mixed, and useful details were still lost. "Comparable" doesn't mean the same questions remain answerable: a single missing detail can fail a question.

  How much this costs overall is **unknown**. Nothing measures how many questions depend on stranded chunks or their score impact. For scale only: if 20 of the 620 chunks each held the only evidence for a different question, losing it could cost up to 10 points on a 200-question run. That figure is illustrative, not measured. Neither small audit refutes the long-running empirical observation below.

- **History:** in months of use, larger Observer inputs consistently produced lower-quality observations. That's why a long-context Observer model (Gemini Flash) was originally recommended. Buffering reduced that sensitivity, and stranding brings it back.
- **Related:** issue #25372 (agent misses recent user content). Stranding is a credible but **unconfirmed** contributor; several mechanisms are likely involved.

### P2. Writing a chunk to the new head skips the cursor (#22078 head `4161e237`, proven)

- **Mechanism:**
  1. `async-buffer.ts` `persist()` retargets an in-flight chunk to whichever record is the head at persist time.
  2. If a rollover happened in between, the ready chunks are stranded on the old head (P1).
  3. The late chunk becomes `chunks[0]` of the new head, even though it doesn't start at the cursor.
  4. Activating it moves the cursor past the stranded chunk's messages, so they are **never observed again**.
- **Effect:** breaks invariant 3 and causes permanent loss. Before the retarget, both chunks were stranded and nothing was lost.
- **Evidence:** a ready+late probe fails on `4161e237` and passes on main `056427cd`.
- **Fix:** the retarget is only correct together with carry-forward.

### P3. Step-0 reflection retires the generation an in-flight write targets (#22078, proven)

- **Mechanism:**
  1. In the async band, step 0 defers observation activation while a chunk write is in flight, but still runs `maybeReflect`.
  2. Reflection creates a new head.
  3. The write lands on the retired record, which is P1 again.
- **Why it's new:** on main, step 0 waits for the buffer op before reflecting, so this path doesn't exist there.
- **Evidence:** reproduced with real `om.buffer()` and InMemory storage (`__tests__/buffer-write-generation.test.ts` on #22078).

### P4. Observation activation commits to a retired generation (main, proven; fixed in PR 1)

- **Mechanism:**
  1. `activate()` re-fetches the head.
  2. Rollover commits a new head.
  3. `swapBufferedToActive` writes the activated observations to the retired record.
  4. The caller still removes the activated messages from the live `MessageList`.
- **Effect:** for the rest of that turn the actor sees **neither** the source messages nor the observation. From the actor's point of view that's data loss for the turn. The next turn reloads the raw messages, because the new head's cursor didn't move.
- **Reachability:** needs overlapping operations: async work, overlapping `generate()` calls, several OM/`Memory` instances, several processes, or durable-agent steps on different workers.
- **Evidence:** reproduced with real OM on InMemory, LibSQL, and live PostgreSQL (PG's observation swap doesn't take the reflection's advisory lock), and end to end with two overlapping `Agent.generate()` calls using separate `Memory` instances on one LibSQL thread. It behaves the same on #22078 and on main.
- **Frequency:** unmeasured.

### P5. The swap drops a concurrently appended chunk (main, proven; fixed in PR 1)

- **Mechanism:** InMemory (`inmemory.ts` `swapBufferedToActive`), OracleDB (`observational-buffering.ts`), and Convex (`omSwapBuffered`) write back what's left of the chunk list the caller read.
- **Mitigation:** in-process only, via the activation wait (and #22078's `pendingChunkWrites`). Across processes there is none.
- **Related:** MongoDB, OracleDB, and Convex don't dedupe a retried append by `cycleId`, so a retry stores the chunk twice.

### P6. Sync reflection uses a stale snapshot (main, proven; fixed in PR 1)

- **Mechanism:**
  1. Sync reflection reads `activeObservations` before the Reflector call.
  2. It commits with `createReflectionGeneration({ currentRecord: <that snapshot> })`.
  3. Observations activated during the Reflector call are missing from the new head.
  4. The new head's cursor is copied from the stale snapshot, so those messages get observed again.
- **Effect:** duplicated work and P1-style quality cost rather than permanent loss.
- **Contrast:** buffered reflection activation re-reads the record in the adapter and keeps unreflected lines.

### P7. Cross-process work has no coordination (main, by design; storage lifecycle fixed in PR 1)

All in-process coordination (static maps, registry) is invisible to other processes. Durable flags are hints, and adapter locking differs (see the table above).

### H1. Activation can move the cursor backward; a retried append can re-add an activated chunk (main, proven; fixed in PR 1)

Activation sets the cursor to the last activated chunk's `lastObservedAt` unconditionally. A chunk appended after a sync observation already passed its range could move the cursor **backward**. `cycleId` dedup only checks the current list, so a retried append after activation re-adds the chunk.

### H2. Sync observation commit can overwrite a concurrent activation (main, proven; fixed in PR 1)

`updateActiveObservations` replaces `activeObservations` wholesale with text built from an earlier head read. Text appended by a concurrent activation in between is overwritten. A prefix check can't detect this safely: resource scope rewrites the middle of the text when it merges a same-day `<thread>` section (`observation-strategies/base.ts` `replaceOrAppendThreadSection`).

### H3. Sync observation patches the thread cursor and end marker before (and regardless of) the commit (main, proven; fixed in PR 1)

`sync.ts` and `resource-scoped.ts` patch the thread's `lastObservedMessageCursor` (and per-thread `lastObservedAt`) before `updateActiveObservations`, and `base.ts` emits the completion end marker after it without checking where the commit landed. `filterObservedMessages` removes live messages on that basis, so an aborted commit, or one that landed on a retired record, still removes context. A P4 variant.

### F1. OracleDB shifted timestamps by the host's DST offset (proven, pre-existing; fixed for OM in PR 1)

Oracle's shared OM suite failed two cursor round-trip tests under a non-UTC host time zone (`TZ` = PDT: `09:00Z` instead of `10:00Z` for a January date) and passed under `TZ=UTC`. A shifted cursor can skip or re-observe messages.

- **Root cause:** node-oracledb binds a bare `Date` as `TIMESTAMP WITH LOCAL TIME ZONE`, which the server converts with the session's time zone. That is a fixed offset captured at connect time (`-07:00` for a process started in PDT), so an instant on the other side of a DST change is **stored** an hour off. Reads are correct. A direct probe stored `2024-01-15T10:00Z` as `09:00Z` with a bare `Date` and as `10:00Z` with an explicit `DB_TYPE_TIMESTAMP_TZ` bind.
- **Fix (PR 1):** every OM timestamp bind uses `timestampBind()` (`DB_TYPE_TIMESTAMP_TZ`). The shared OM suite passes 96/96 in both PDT and UTC.
- **Not fixed (outside OM):** the same bare-`Date` binds in Oracle's thread, resource, and observability paths. Under PDT, 4 shared-suite tests fail there on `main` and on this stack (thread sort with identical timestamps, resource dates, two trace date-range filters). Already-stored OM rows written before the fix keep their shifted values.

### Smaller notes

- A buffered reflection written to a record that has since been retired is discarded: wasted Reflector work, no coverage loss.
- LibSQL's head query ordered by `generationCount DESC` only, so with duplicate rows for one generation (which exist in some databases, see PG's `om-generation-concurrency.test.ts`) its head was nondeterministic. PR 1 gives every adapter PostgreSQL's order, `generationCount DESC, createdAt ASC, id ASC`.
- **LibSQL interactive transactions and `SQLITE_BUSY` (pre-existing; fixed for OM in PR 1).** `@libsql/client` local clients use a pool of connections over a synchronous driver. A write transaction held open across `await`s makes any other write in the same process, on another pooled connection, block the event loop until `busy_timeout` and then fail with `SQLITE_BUSY` (`database is locked` / `cannot commit transaction - SQL statements in progress`). On `main`, OM appends and pending-token writes racing `saveMessages` on one file database fail this way (62 errors in a 40+40-write repro). A durable agent with OM on a LibSQL file hit it every turn on PR 1's first, transactional LibSQL adapter. PR 1's LibSQL OM writes never hold a transaction open (see the per-adapter primitive). **Not fixed:** LibSQL's other interactive transactions (for example `deleteMessages`, thread cloning) can still fail this way against concurrent same-process writes.

## Direction (approved)

Correctness lives at the storage boundary, because that's the only thing every process passes through. The in-process queue adds ordering and priority, not correctness. #22078 lands last, rebased on both.

### D1. Lossless, cross-process-safe storage lifecycle (PR 1)

**Liveness marker.** Every adapter gains a nullable `supersededBy` column/field. A row is live iff it's null. Rollover sets the retired row's `supersededBy` to the successor id in the same critical section that creates the successor, and it is never cleared. A lookup key has at most one live row, and it is the head. Every lifecycle write locks or conditions the **target row by primary key** and requires `supersededBy IS NULL`; no latest-generation range query runs inside a critical section. This beat re-running the head query inside each lock: that needed a named lock plus deadlock retries on MySQL, a post-lock re-read on Oracle, and left standalone MongoDB (no multi-document transactions) unprotected.

- **Head order** everywhere: `generationCount DESC, createdAt ASC, id ASC`.
- **Backfill** at OM init (SQL adapters and MongoDB): for lookup keys with more than one live row, mark rows strictly older than the canonical head as superseded by it, with the head's ordering key embedded in the update's condition so a racing rollover can't leave a key without a live row. Cost: one aggregate over the OM table per process start.
- **Convex** has no backfill; every OM lifecycle mutation compares its target to the canonical head and retires it if it isn't the head.
- **Initialization** uses a deterministic generation-0 id derived from the lookup key, inserted only if absent.
- **Mixed-version window:** processes on an older adapter version neither set nor check `supersededBy`. Rows they retire stay live until the next start of any new-version process. Protection is complete once every process is upgraded (and, for Convex, the functions are redeployed).
- **Known edge:** if all OM rows for a key are deleted and the key is re-initialized, a stale in-flight writer holding the old generation-0 id writes into the new record.

**Operation contract** (`packages/core/src/storage/types.ts`, additive):

- `createReflectionGeneration` / `swapBufferedReflectionToActive` build the successor from the **stored** row, not the caller's snapshot: chunks are **moved** (in order), and the cursor, buffering markers, flags, and counters are carried. If the stored text grew by appends after the snapshot (activation), the appended tail is kept after the reflection. A non-append rewrite creates nothing. A retired target creates nothing and returns the head. Optional `newRecordId` lets the caller tell whether its reflection applied.
- `updateBufferedObservations` appends to the head (resolving a retired id), skips a duplicate `cycleId` or a chunk wholly covered by the cursor, and reports `{ persisted, recordId }`.
- `swapBufferedToActive` activates a prefix of the **stored** list, never moves the cursor backward, and returns `retired: true` for a retired target.
- `updateActiveObservations` returns `{ applied: false, reason: 'retired' | 'conflict' }` instead of writing to a retired row, with an optional exact-text compare-and-set (`expectedActiveObservations`).
- `setPendingMessageTokens` and `setBufferingObservationFlag` on a retired id go to the head. The other flag writes (`setObservingFlag`, `setReflectingFlag`, `setBufferingReflectionFlag`) are hints and still write the row they name. `updateBufferedReflection` deliberately stays on the row it names: its `reflectedObservationLineCount` counts lines of that row's text, so moving it to the head would cut the wrong lines at swap time. A buffered reflection written to a retired row is discarded with it (wasted work, no coverage loss).
- The successor copies `config`, `metadata`, and `observedTimezone` from the stored row.

**Per-adapter primitive:** InMemory: no `await` inside a critical section. LibSQL: no interactive transaction (see the `SQLITE_BUSY` note above). Each write reads its row, computes, and writes with a statement whose condition matches every column as read, retrying (at most 10 times) when another process changed the row; rollover is one atomic `batch` (guarded retire, then an insert that only fires if the retire applied); the client write lock still orders writes within a process. PostgreSQL and MySQL: transaction + `SELECT … FOR UPDATE` on the target row by id (PG keeps its advisory lock for generation creation). MongoDB: single-document conditional updates only (identical on standalone and replica sets); rollover fences the old document with a small `pendingSuccessor` payload, inserts the successor (its unique `id` index makes that idempotent), then clears the old document's chunks; any reader that finds a fenced head without a successor rolls it forward. OracleDB: transaction + `lockOMRow` (`SELECT … FOR UPDATE` by id); the column arrives through the memory-schema repeatable migration (schema version 2), and the backfill also runs on every `OracleStore.init()` because unchanged repeatable migrations are skipped. Convex: one server mutation per operation, including rollover and initialize. Convex users must redeploy functions after upgrading.

**Memory layer:** activation retries on `retired` and only removes messages from the live `MessageList` after a head commit; sync and resource-scoped commits pass `expectedActiveObservations`, recompose against the fresh head on conflict, and patch the thread cursor and emit the end marker only after a successful head commit; reflection side effects (suppression, `notifyReflectionCommitted`, end marker) run only when the reflection applied; a skipped append isn't indexed and emits no end marker.

Implementation notes (PR 1):

- **Bounded retries.** Activation re-reads the head at most 3 times after `retired`. A sync commit recomposes and retries at most 3 times; if it still doesn't land, the cycle ends with a failed marker and `observed: false`, so nothing is removed from context and the next step tries again. A reflection that didn't apply ends with a failed marker but doesn't fail the turn.
- **Reflection snapshots are copies.** The InMemory store hands out live record references, so a record held across the Reflector call would change under it and look "unchanged" at commit time. The reflector and `reflect()` copy the record before reading it.
- **"Applied" for older adapters.** A reflection applied iff the returned record's id is the requested `newRecordId`. Adapters that predate `newRecordId` ignore it and don't report `supersededBy`; for those, a returned record other than the reflected one counts as applied (their old behavior).
- **Retried appends.** A transient error after the write landed makes `withRetry` append again, which storage skips. A skip on the first attempt is final (cycle ids are unique). After a retry the buffer checks the head for its `cycleId` (or its text already activated) before treating a skip as "never landed". Known edge: if the chunk landed, was activated, and a reflection rolled the record over, all inside the retry window, the check misses it; the chunk's observations are on the head but its observation group isn't indexed for recall, and the cycle reports failed.
- **Retired-id resolution is bounded per hop, not per rollover.** Every adapter resolves a retired id by jumping to the canonical head (MySQL with a plain, non-locking head read, then a primary-key lock, so no range locks) and only follows `supersededBy` for rollovers committed after that read, at most 3 hops. A caller holding an id many rollovers old still lands on the head (shared test C16).
- **Recall hints after a move.** Observation groups are indexed with the record id they were written to. After rollover moves a chunk, that hint names the retired record; `findGroupTimeline` (`tools/om-observations.ts`) treats the hint as a primary-key read and falls back to scanning generations for the group, which finds it once, on the head.
- **Convex duplicates the lifecycle rules.** The server module is bundled into the user's Convex deployment and can't import `@mastra/core` at runtime, so `server/observational-memory.ts` carries copies of the covered-chunk, max-cursor, reflection-text, and append-only rules; a parity test (`server/observational-memory.test.ts`) checks they decide exactly like the core helpers. Its canonical head helper reads the top two rows of `by_lookup_key` and, on a generation tie, all tied rows, because that index orders ties by `_creationTime`, not the canonical order. Convex's shared storage suite needs a live deployment (`CONVEX_TEST_URL`), so Convex is covered by server-mutation unit tests against a mocked ctx, not end to end.
- **Async-buffer chunks are the only chunk producer** (`git grep "updateBufferedObservations("` under `packages/memory/src`), so the `lastObservedAt = max message time + 1ms` convention behind the covered-chunk rule holds for every stored chunk.

Status after PR 1 (base = `main` at `6a721a8e`, probes run in a separate base worktree with base builds; all model calls mocked):

| Problem           | Evidence on `main`                                                                                                                                                                                                                            | Evidence on PR 1                                                                                                                                                       |
| ----------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| P1, P6            | Real OM, gated Reflector, 3 consecutive rollovers (InMemory, LibSQL): the observation activated during the Reflector call is missing from the new head and a chunk buffered during it stays on the retired record, its message never observed | The new head holds the reflection, the activated observation, and the moved chunk; the chunk activates on the head; no unobserved messages                             |
| P4, H3            | Activation paused across a rollover (InMemory, LibSQL, PG), a failed sync commit, a PG rollover holding the old row, two overlapping `Agent.generate()` calls: 8 of 11 checks find the actor without the source and the fact                  | 11/11: the swap reports `retired` (PG: waits on the rollover's row lock) and activation retries on the head; a failed sync commit leaves the source in the next prompt |
| P5, H1, dedup, P7 | Two OS processes on one LibSQL file and one PG schema, 250 jittered append/activate/rollover iterations, 3 seeds: 2173 violations (chunks lost or stranded on retired records, chunks activated twice on PG)                                  | 0 violations; exactly one live record per key                                                                                                                          |
| Durable agents    | —                                                                                                                                                                                                                                             | `createDurableAgent` + OM on a LibSQL file, 16 iterations across buffering, 2 activations, and 2 rollovers: every actor prompt holds every user fact                   |

Per adapter, the shared lifecycle tests and two-store races fail on the `main` adapter (LibSQL 7/8, PG 8/9, MySQL 7/9, MongoDB 23/23, Oracle 10/11, Convex 26 server tests) and pass on PR 1. Not proven: Convex end to end (no local backend), a real multi-worker Inngest run, mixed-version deployments, real-world frequency, and BEAM impact. P2 and P3 belong to #22078 and are closed in PR 3.

### D2. Per-thread/resource commit queue (PR 2)

- **Where:** a process-wide queue keyed like the coordinator (`thread:<id>` / `resource:<id>`), static so that every `ObservationalMemory` and `Memory` instance in the process shares it. A queue per instance would **not** cover the P4 repro.
- **Queued operations:** chunk appends, observation activation, sync-observation commits, and reflection activation (rollover).
- **Not queued:** Observer and Reflector model calls, including buffered reflection generation, indexing, and title generation. Only the commits are queued.
- **Ordering:** reflection activation goes to the **front** of the queue, so a due reflection isn't held behind chunk commits and the actor doesn't take two cache misses.
- **Fresh head:** every queued operation looks up the head when it runs, never at enqueue time.
- Verified with a seeded interleaving fuzz harness (base expected to fail, storage-only and full stack expected clean).

### D3. #22078 rebased on D1 and D2 (PR 3)

What #22078 keeps: the async-band policy; per-record `blockAfter` resolution; the input-bucket fix; E2E teardown drain and the fastembed cache path; tests.

What it drops, as D1 and D2 make them unnecessary: `pendingChunkWrites` and the activation deferral/timeout logic, and the retarget (D1 makes appends land on the head). Removing each guard has to be justified by a test that fails without D1 and D2. The ready+late probe (P2) and `buffer-write-generation.test.ts` (P3) become passing regression tests.

## Deferred / out of scope

- Chunks already stranded in existing databases stay where they are (no adoption or cleanup migration).
- #25372 chronology/speaker distortion in observations, agent evidence-selection failures, BEAM regeneration, and an investigation spike for those.
- Durable-agent gaps: a worker dying mid-buffer loses that cycle; a resumed turn across workers isn't rehydrated; durable finalize swallows OM persist errors at `warn`.
- A real multi-worker Inngest run; cross-process behavior is tested with two OS processes sharing LibSQL and PostgreSQL plus per-adapter cross-connection tests.

## PR stack

| #   | Branch                                 | Base                       | Scope                                                                    |
| --- | -------------------------------------- | -------------------------- | ------------------------------------------------------------------------ |
| 1   | `fix/om-lossless-rollover`             | `main`                     | D1: storage contract, `supersededBy`, all seven adapters, memory callers |
| 2   | `fix/om-commit-queue`                  | `fix/om-lossless-rollover` | D2: in-process commit queue, interleaving fuzz harness                   |
| 3   | `fix/om-async-band-buffering` (#22078) | `fix/om-commit-queue`      | D3: async band rebased, superseded guards removed                        |

Related history:

- #21215: observation `blockAfter` docs semantics.
- #21282: closed attempt at a sync fallback above `blockAfter`.
- #22210: closed lease-based cross-process buffer claims (36 packages); evidence that a claims system is too large.
- #24863: failed-cycle cursor fix.
- #24923: PG advisory lock for generation creation; returns an existing newer generation instead of duplicating.
- #20110: LibSQL per-client write lock.
- #25060: post-activation tail observation, merged at `056427cd`.
- #19768: docs/implementation mismatch.

## Open questions

- How much P1 actually costs in fidelity and question answerability (needs a source-aligned comparison, not provenance-window sizes), and whether fixing it measurably changes BEAM scores. Measure this on states created or replayed through the new code; rescanning old snapshots will still show the 620 historical strandings.

## Tests that cover this area

- `stores/_test-utils/src/domains/memory/observational-memory.ts`: shared OM conformance suite, run by every adapter.
- `stores/pg/src/storage/domains/memory/om-generation-concurrency.test.ts`: PG cross-connection generation creation.
- `__tests__/threshold-activation-tail.test.ts`: post-activation tail observation (#25060).
- `stores/_test-utils/src/domains/memory/observational-memory.ts` C1–C17: the PR 1 lifecycle contract (rollover carry-forward and text rules, retired targets, append dedup and covered chunks, stored-list activation, cursor monotonicity, liveness marker, canonical head, deterministic initialization).
- `stores/_test-utils/src/domains/memory/observational-memory-concurrency.ts`: six two-store races (25 iterations each, invariant-checked), run per networked adapter by `stores/<adapter>/src/storage/domains/memory/om-lifecycle-concurrency.test.ts` (LibSQL with the second store in a child process), next to each adapter's `supersededBy` upgrade, backfill-vs-rollover, and adapter-specific tests (MongoDB crash recovery and roll-forward, Oracle timestamp binds, LibSQL same-process writes).
- `__tests__/lifecycle-safety.test.ts`: memory-layer behavior on retired and conflicting commits (P4, P6, H2, H3, reflection not applied, covered appends).
- The probes for P2 and P4 live outside the repo and are ported into the stack as regression tests: the ready+late rollover probe and the activation-vs-reflection probe matrix including the two-agent LibSQL repro.
