### 5.8 Write-concurrency contract

Every persisted `SessionRecord` has at most **one owner** at a time. The owner is the Harness instance that holds the live `Session` object. All durable writes to that record — queue append, pending approval / suspension / question / plan registration, mode / model switch, `setState`, lifecycle transitions, debounced flushes — go through the owner. Storage adapters never see concurrent writers for the same `sessionId` under normal operation.

This makes "the live `Session` instance is the runtime authority" (§5.4) an enforceable invariant rather than a convention.

**Lease lifecycle.**

- `harness.session(...)` acquires the lease as part of hydration. The harness instance has a stable `ownerId` (process-scoped UUID, generated at construction).
- The owner renews the lease on every flush. Synchronous (durable) flushes always renew; debounced flushes renew opportunistically. A separate keep-alive interval (default `sessions.lockRenewMs`, `10s`) renews the lease even if no flush has happened, so a long-idle but in-memory session keeps its claim.
- `session.close()` and `harness.shutdown()` release the lease cleanly. Idle eviction (§5.4) also releases — eviction is a release, not a steal.
- On owner crash, the lease expires after `sessions.lockTtlMs` (default `30s`) and the record becomes hydratable again.

**Acquisition under contention.** If `harness.session({ sessionId })` finds an unexpired lease held by a different `ownerId`, the behaviour is governed by `sessions.lockMode`:

| `lockMode` | Behaviour |
|---|---|
| `'fail'` (default) | Throw `HarnessSessionLockedError` immediately. Caller decides whether to retry, surface to the user, or route the request to the owning instance. Honest, fast, no hidden waiting. |
| `'wait'` | Block (with caller-controllable timeout via `sessions.lockWaitMs`, default `5s`) until the existing lease is released or expires, then acquire. Friendlier for browser reconnect flows where the previous tab's lease is about to TTL out. Recommended setting for Mastra Server SSE deployments. |
| `'steal'` | Force-acquire by bumping the record's `version` and invalidating the previous owner's writes. The previous owner's next flush fails with `HarnessStorageError` and that owner drops the in-memory `Session` after surfacing an `error` event. Reserved for operator tools and tests; **not recommended** as a default. |

**Conflict detection.** Every `saveSession(record, { ownerId, ifVersion })` is conditional on the stored `version` matching `ifVersion`. The storage adapter increments `version` on success and returns the new value. On mismatch, the call rejects with `HarnessStorageError`. The owner then re-hydrates the record, re-applies its in-memory delta, and retries once before surfacing the failure to the originating call. This handles the rare case where a `'steal'` happened or a clock-skewed adapter let two writers commit.

**`setState` atomicity** is a *within-process* guarantee: the owner serialises updaters through a single in-memory queue, so `setState(prev => next)` is always read-modify-write against the latest state. Cross-process atomicity is not promised, because cross-process writers are not promised — that's what the lease is for.

**Subagent sessions** share the parent's lease. A child session's record is owned by whichever instance owns the parent. A subagent run never spans Harness instances, so there's nothing to coordinate. The child's `version` still advances independently for conflict detection against operator tools that touch the record directly (e.g. an admin closing a subagent session).

**Storage interface.** §5.2 already lists the four primitives this contract requires: `acquireSessionLease`, `renewSessionLease`, `releaseSessionLease`, and the `{ ownerId, ifVersion }` form of `saveSession`. Adapters that don't have a native lease primitive can implement leases on top of the same `version` field — `acquire` becomes a conditional UPDATE that sets `ownerId` and `leaseExpiresAt` only if the existing values are absent or expired.

**Errors raised.**

- `HarnessSessionLockedError` — `harness.session(...)` could not acquire the lease under `lockMode: 'fail'`. Includes `currentOwnerId` and `expiresAt` for diagnostic logging and for clients that want to route the request to the holding instance.
- `HarnessStorageError` — durable write rejected by the adapter. After one transparent retry, surfaced to the caller.

**Configuration.** §9 defines the knobs:

```ts
sessions: {
  lockMode?: 'fail' | 'wait' | 'steal';   // default 'fail'
  lockTtlMs?: number;                     // default 30_000
  lockRenewMs?: number;                   // default 10_000
  lockWaitMs?: number;                    // default 5_000 (used only when lockMode = 'wait')
  // ...other session knobs
}
```

---
