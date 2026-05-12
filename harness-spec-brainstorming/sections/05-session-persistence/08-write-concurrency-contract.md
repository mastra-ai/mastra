### 5.8 Write-concurrency contract

Every active `SessionRecord` has at most **one owner** at a time, and storage
permits at most one active record for a `(harnessName, resourceId, threadId)`
pair (§2.2/§5.2). The owner is the Harness instance that holds the live
`Session` object. All durable writes to that record — queue append, pending
approval gates, tool-context pending suspension/question/plan registration,
`currentRun` transitions, display snapshots, mode / model switch, permission
grant/revoke/policy changes, `setState`, lifecycle transitions, debounced
flushes — go through the owner. Storage adapters never see concurrent writers
for the same `(harnessName, sessionId)` under normal operation, and the same
thread/resource pair inside one Harness namespace never has a second active
session writer.

This makes "the live `Session` instance is the runtime authority" (§5.4) an
enforceable invariant rather than a convention. There is no separate Harness
`ThreadRuntime` lease in v1: the unique active session lease is the lock on the
mutable thread runtime state that Harness owns.

Orientation diagram (write authority only; lease rules below remain
authoritative):

<figure>
  <svg role="img" aria-labelledby="hx-write-concurrency-title hx-write-concurrency-desc" viewBox="0 0 1040 430" width="100%" style="max-width: 1100px; height: auto; display: block; margin: 1.5rem auto; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 18px; padding: 16px; box-sizing: border-box;">
    <title id="hx-write-concurrency-title">Session write-concurrency authority</title>
    <desc id="hx-write-concurrency-desc">One live owner holds the session lease, serializes durable writes, renews parent and descendant leases, and fences stale owners through version and lease checks.</desc>
    <defs>
      <marker id="ah-write-concurrency" markerWidth="10" markerHeight="10" refX="8" refY="5" orient="auto">
        <path d="M0,0 L10,5 L0,10 Z" fill="#334155" />
      </marker>
    </defs>

    <rect style="fill: #eef2ff; stroke: #6366f1; stroke-width: 2.5; rx: 16;" x="70" y="170" width="190" height="72" />
    <text style="font: 600 17px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #0f172a;" x="165" y="200" text-anchor="middle">Live Session owner</text>
    <text style="font: 500 13.5px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #475569;" x="165" y="223" text-anchor="middle">ownerId + in-memory queue</text>

    <rect style="fill: #ecfdf5; stroke: #22c55e; stroke-width: 2; rx: 14;" x="330" y="65" width="210" height="72" />
    <text style="font: 600 17px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #0f172a;" x="435" y="95" text-anchor="middle">Session lease</text>
    <text style="font: 500 13.5px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #475569;" x="435" y="118" text-anchor="middle">acquire / renew / release</text>

    <rect style="fill: #ecfdf5; stroke: #22c55e; stroke-width: 2; rx: 14;" x="330" y="270" width="210" height="72" />
    <text style="font: 600 17px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #0f172a;" x="435" y="300" text-anchor="middle">saveSession CAS</text>
    <text style="font: 500 13.5px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #475569;" x="435" y="323" text-anchor="middle">ownerId + ifVersion</text>

    <rect style="fill: #f8fafc; stroke: #94a3b8; stroke-width: 2; rx: 14;" x="610" y="65" width="205" height="72" />
    <text style="font: 600 17px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #0f172a;" x="713" y="95" text-anchor="middle">Subtree renewal</text>
    <text style="font: 500 13.5px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #475569;" x="713" y="118" text-anchor="middle">parent + descendants</text>

    <rect style="fill: #f8fafc; stroke: #94a3b8; stroke-width: 2; rx: 14;" x="610" y="270" width="205" height="72" />
    <text style="font: 600 17px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #0f172a;" x="713" y="300" text-anchor="middle">Durable mutations</text>
    <text style="font: 500 13.5px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #475569;" x="713" y="323" text-anchor="middle">queue / state / run / close</text>

    <rect style="fill: #fff7ed; stroke: #f97316; stroke-width: 2; rx: 14;" x="870" y="170" width="140" height="72" />
    <text style="font: 600 17px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #0f172a;" x="940" y="200" text-anchor="middle">Stale owner</text>
    <text style="font: 500 13.5px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #475569;" x="940" y="223" text-anchor="middle">fenced on failure</text>

    <path style="stroke: #334155; stroke-width: 2.2; fill: none; marker-end: url(#ah-write-concurrency);" d="M260 194 C295 155 315 120 329 103" />
    <path style="stroke: #334155; stroke-width: 2.2; fill: none; marker-end: url(#ah-write-concurrency);" d="M260 218 C295 255 315 290 329 304" />
    <path style="stroke: #334155; stroke-width: 2.2; fill: none; marker-end: url(#ah-write-concurrency);" d="M540 101 L609 101" />
    <path style="stroke: #334155; stroke-width: 2.2; fill: none; marker-end: url(#ah-write-concurrency);" d="M540 306 L609 306" />
    <path style="stroke: #64748b; stroke-width: 2; fill: none; stroke-dasharray: 7 7; marker-end: url(#ah-write-concurrency);" d="M815 101 C875 115 925 145 938 169" />
    <path style="stroke: #64748b; stroke-width: 2; fill: none; stroke-dasharray: 7 7; marker-end: url(#ah-write-concurrency);" d="M815 306 C875 285 925 252 938 243" />
  </svg>
  <figcaption>The active session lease is the thread-runtime write authority; stale or stolen owners stop before mutating durable state or provider-visible work.</figcaption>
</figure>

**Lease lifecycle.**

- `harness.session(...)` acquires the lease as part of hydration. The harness
instance has a stable `ownerId` (process-scoped UUID, generated at
construction).
- Fresh active sessions are admitted through `createOrLoadActiveSession(...)`.
  When that call creates the row, it installs the caller's initial lease in the
  same atomic storage operation using `ttlMs = sessions.lockTtlMs`. When it
  returns an existing row, the resolver applies the lock policy below before
  hydrating it.
- The owner renews the lease on every flush. Synchronous (durable) flushes
always renew; debounced flushes renew opportunistically. A separate keep-alive
interval (default `sessions.lockRenewMs`, `10s`) renews the lease even if no
flush has happened, so a long-idle but in-memory session keeps its claim.
Keep-alive renewal owns lease liveness; flush-driven renewal is opportunistic,
and overlapping same-owner renewals are harmless. If renewal cannot prove the
same `ownerId` still owns an unexpired lease, the instance marks ownership lost,
stops accepting new admissions/resumes, stops queue drain and provider-visible
work, emits an `error` event, and requires a fresh `harness.session(...)`
acquisition before any mutation can continue. Lease renewal failure is not
treated like debounced flush backoff: once ownership cannot be proven, safety
beats liveness and the live owner fences itself before doing more work. Agent
signals that already crossed the acceptance boundary follow §5.7's
post-acceptance durability boundary, but a stale owner must not flush new
durable state, project outbox items, or make new provider-visible calls from
completions observed after ownership was lost.
- `session.close()` enters Closing under the current parent/root lease, renews
that lease while waiting for live work to settle, and releases it only after
`closedAt` is written or after another owner fences the close owner.
`harness.shutdown()` releases the lease cleanly. Idle eviction (§5.4) also
releases — eviction is a release, not a steal.
- On owner crash, the lease expires after `sessions.lockTtlMs` (default `30s`)
and the record becomes hydratable again.
- Lease expiry checks use the storage time contract in §5.2 and the validation
  rules in §9. Initial lease installation, acquire, renew, `saveSession`
  owner-expiry checks, `'steal'`, `'wait'`, and descendant lease mirroring all
  compare expiry with storage-authoritative time or a declared bounded
  `sessions.maxClockSkewMs`.

**Acquisition under contention.** `harness.session({ threadId, resourceId })`
first resolves the unique active record for that pair, then applies the lease
policy. If `harness.session({ sessionId })` or the thread/resource resolver
finds an unexpired lease held by a different `ownerId`, the behavior is
governed by `sessions.lockMode`:

**`'fail'` (default)**

Behavior: Throw `HarnessSessionLockedError` immediately. Caller decides whether
to retry, surface to the user, or use deployment-specific routing outside the v1
contract to reach the owning instance. Honest, fast, no hidden waiting.

**`'wait'`**

Behavior: Block (with caller-controllable timeout via `sessions.lockWaitMs`,
default `5s`) until the existing lease is released or expires, then attempt a
fresh `acquireSessionLease(...)`. `lockWaitMs` is only a caller-side budget; it
is not compared to `lockTtlMs`, and it never authorizes ownership from a cached
`expiresAt`. Friendlier for browser reconnect flows where the previous tab's
lease is about to TTL out. Recommended setting for Mastra Server SSE
deployments.

**`'steal'`**

Behavior: Force-acquire by bumping the record's `version` and invalidating the
previous owner's writes. The previous owner's next flush fails with
`HarnessStorageError` and that owner drops the in-memory `Session` after
surfacing an `error` event. Reserved for operator tools and tests; **not
recommended** as a default.

**Operator-only fence.** `lockMode: 'steal'` is valid only on explicitly
privileged operator/test code paths. Selecting it must emit a
`session.lease.stolen` audit event carrying the steal timestamp, requesting
actor identity, and a free-form reason string; v1 routes that admit it must
record this before the version bump commits. The policy must not be
selectable by `RemoteSession`, `@mastra/client-js` `HarnessClient`, channel
ingress (§14.2), recovery workers (§5.7), background-task executors, or
goal-continuation paths. `RemoteSession` operation options do not carry a
`lockMode` field (§4.8e); §13.3 routes do not accept `lockMode` on any
request payload. The defaults — `'fail'` for ordinary contention,
`'wait'` for browser-reconnect retry-on-busy — remain unchanged.


`acquireSessionLease(...)` only succeeds for active records. If storage observes
`closedAt` during acquisition, the harness maps that result to
`HarnessSessionClosedError` or re-runs resolution for thread-based lookups; it
must not hydrate a closed row just because it was active when first read.
If storage observes `closingAt` with `closedAt` absent, normal hydration and
admission fail with `HarnessSessionClosingError`; only `closeSession(...)` and
`deleteSession(...)` may acquire or continue ownership for close finalization or
delete repair.

**Conflict detection.** Every `saveSession(record, { ownerId, ifVersion })` is
conditional on the stored `version` matching `ifVersion`. The storage adapter
increments `version` on success and returns the new value. On mismatch, the call
rejects with `HarnessStorageError`. The owner may rehydrate, re-apply its
in-memory delta, and retry only after first renewing or otherwise proving that
the same `ownerId` still holds the current, unexpired lease. If that proof
fails, the owner treats the mismatch as ownership loss: it drops the in-memory
`Session` after surfacing an `error` event and does not continue admission,
queue drain, pending-item resume, or provider-visible work. This handles benign
adapter conflicts without allowing a stale owner to keep mutating after a
`'steal'` or expired lease.

**Closing write fence.** Writing `closingAt` is itself a durable session write
that advances `version` and arms an in-process guard on the live `Session`.
After that point, ordinary mutators on the target session or any active
descendant reject before saving, even if they run in the same process and still
hold object references. Only close-owned terminalization writes may persist
while `closingAt` is present and `closedAt` is absent. If ignored tool work
later
tries to save with the pre-closing `ifVersion`, storage CAS rejects it; if it
tries through the live `Session` API after observing the marker, the API rejects
with `HarnessSessionClosingError` or `HarnessSessionClosedError`.

**`setState` atomicity** is a *within-process* guarantee: the owner serialises
updaters through a single in-memory queue, so `setState(prev => next)` is always
read-modify-write against the latest state. Cross-process atomicity is not
promised, because cross-process writers are not promised — that's what the lease
is for. Remote object-form state patches use the same session-level
`SessionRecord.version` as their `ETag` / `If-Match` validator (§13.2), not an
independent field-level `stateVersion`; any intervening durable session write
can force the remote caller to refetch and recompute.

**Subagent sessions** share the parent's lease for write ownership. A child
session still has its own `threadId`, so the active-session uniqueness rule
applies independently to the child `(harnessName, resourceId, threadId)`;
sharing the parent lease is an ownership-routing rule, not shared thread
identity. The child has **no separately-acquirable, separately-renewable
lease**: there is no `acquireSessionLease(child.sessionId, …)` call anywhere in
the contract. When the parent owner creates a child record through
`createOrLoadActiveSession(...)`, it uses the same `harnessName`, `ownerId`, and
a TTL no later than the parent's current lease expiry, so the child cannot
outlive proven parent ownership. **Parent/root renewal uses
`renewSessionLeaseSubtree(...)` (§5.2) to extend the parent/root and every
active descendant lease entry** on the same storage-linearized renewal cycle
(capped at the new parent expiry) so descendant `saveSession(...)` writes under
the same `ownerId` continue to satisfy the storage-level lease check while the
parent is healthy. Subtree renewal failure is ordinary lease renewal failure for
the parent/root owner: it marks local ownership lost, stops mutations and
provider-visible work, emits an `error` event, and requires fresh acquisition
before continuing. A child session's record is owned by whichever instance owns
the parent. When the parent live owner marks ownership lost, any live child
sessions under that owner mark ownership lost and stop mutations in the same
local failure path. A subagent run never spans Harness instances, so there's
nothing to coordinate. The child's `version` still advances independently for
conflict detection against operator tools that touch the record directly (e.g.
an admin closing a subagent session).

**Distributed routing for child requests.** When a request addressed to
`child.sessionId` (inbox response, mode/model patch, close, …) lands on an
instance that does not currently own the parent's lease, the resolver loads the
child record by `sessionId`, reads `parentSessionId`, and applies the parent's
`lockMode` on the **parent** record — never on the child. Walking
`parentSessionId` to the root yields the same authority, since the entire active
chain shares one `ownerId`; deployments may apply the policy on any ancestor up
to the root. Under `'fail'` the child caller receives
`HarnessSessionLockedError` whose `currentOwnerId` / `expiresAt` describe the
parent/root's lease (so clients route the request to the holding instance, not
search for a child-level owner). Under `'wait'` the child caller blocks ≤
`sessions.lockWaitMs` and then proceeds only through a fresh storage lease
acquisition on the parent/root. Under `'steal'` (operator-only) the child
request fences the previous parent owner through the same storage-time expiry
and owner transition rules; the previous owner's next flush against the parent
**and** any descendant fails under the same CAS / lease rule above. `'steal'`
while a parent close cascade is mid-walk can leave descendants in
partially-closed state, which the new owner repairs idempotently by re-issuing
`closeSession({ sessionId: parentSessionId })` per §5.5. A child write that
observes a parent already closed (lease released by close, not by eviction)
fails with `HarnessSessionClosedError`, not `HarnessSessionLockedError`.

**Lifecycle cascade.** Parent close cascades to all active descendants per §5.5
— not only live descendants. The cascade installs `closingAt` /
`closeDeadlineAt` top-down, then terminalizes bottom-up, is idempotent against
`closingAt` and `closedAt`, and asserts cross-harness and cross-tenant safety
per descendant. Eviction and shutdown only release the lease.

**Storage interface.** §5.2 already lists the primitives this contract requires:
`createOrLoadActiveSession`, `acquireSessionLease`, `renewSessionLease`,
`renewSessionLeaseSubtree`, `releaseSessionLease`, and the `{ ownerId,
ifVersion }` form of `saveSession`.
Adapters that don't have a native lease primitive can implement leases on top of
the same `version` field — `acquire` becomes a conditional UPDATE that sets
`ownerId` and `leaseExpiresAt` only if the existing values are absent or
expired.

**Errors raised.**

- `HarnessSessionLockedError` — `harness.session(...)` could not acquire the
lease under `lockMode: 'fail'`. Includes `currentOwnerId` and `expiresAt` for
diagnostic logging and for clients that want to route the request to the holding
instance.
- `HarnessStorageError` — durable write rejected by the adapter. After one
transparent retry, surfaced to the caller.

**Configuration.** §9 defines the knobs:

```ts
sessions: {
  lockMode?: 'fail' | 'wait' | 'steal';   // default 'fail'
  lockTtlMs?: number;                     // default 30_000
  lockRenewMs?: number;                   // default 10_000
  lockWaitMs?: number;                    // default 5_000 (used only when lockMode = 'wait')
  maxClockSkewMs?: number;                // required when lease expiry is not storage-authoritative
  // ...other session knobs
}
```

---
