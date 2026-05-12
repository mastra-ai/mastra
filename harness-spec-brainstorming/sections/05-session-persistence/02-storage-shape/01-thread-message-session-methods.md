### 5.2a Thread, Message, and Session Methods

Orientation diagram (method-family grouping and storage ownership only; the
TypeScript signatures below remain authoritative for arguments, return shapes,
and per-method invariants):

<figure>
  <svg role="img" aria-labelledby="hx-tms-methods-title hx-tms-methods-desc" viewBox="0 0 1040 500" width="100%" style="max-width: 1100px; height: auto; display: block; margin: 1.5rem auto; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 18px; padding: 16px; box-sizing: border-box;">
    <title id="hx-tms-methods-title">Thread, message, and session storage method groups</title>
    <desc id="hx-tms-methods-desc">The Harness layer calls three method families on HarnessStorageDomain. Thread and message methods read and write shared MemoryStorage rows. Session methods read and write durable SessionRecord rows under the active-key uniqueness and lease+version CAS guards.</desc>
    <defs>
      <marker id="ah-tms-methods" markerWidth="10" markerHeight="10" refX="8" refY="5" orient="auto">
        <path d="M0,0 L10,5 L0,10 Z" fill="#334155" />
      </marker>
    </defs>

    <rect style="fill: #eef2ff; stroke: #6366f1; stroke-width: 2.5; rx: 16;" x="40" y="28" width="960" height="68" />
    <text style="font: 600 18px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #0f172a;" x="520" y="58" text-anchor="middle">Harness layer</text>
    <text style="font: 500 13px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #475569;" x="520" y="80" text-anchor="middle">resource/session checks, lifecycle, lease acquisition</text>

    <rect style="fill: #f8fafc; stroke: #94a3b8; stroke-width: 2; rx: 14;" x="40" y="140" width="300" height="120" />
    <text style="font: 600 17px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #0f172a;" x="190" y="172" text-anchor="middle">Thread methods</text>
    <text style="font: 500 13px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #475569;" x="190" y="198" text-anchor="middle">save / load / list / delete</text>
    <text style="font: 500 12px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #64748b;" x="190" y="220" text-anchor="middle">app metadata writes scoped to</text>
    <text style="font: 500 12px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #64748b;" x="190" y="237" text-anchor="middle">metadata.app[key]; clone composes</text>
    <text style="font: 500 12px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #64748b;" x="190" y="254" text-anchor="middle">via thread + message primitives</text>

    <rect style="fill: #f8fafc; stroke: #94a3b8; stroke-width: 2; rx: 14;" x="370" y="140" width="300" height="120" />
    <text style="font: 600 17px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #0f172a;" x="520" y="172" text-anchor="middle">Message methods</text>
    <text style="font: 500 13px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #475569;" x="520" y="198" text-anchor="middle">append / list</text>
    <text style="font: 500 12px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #64748b;" x="520" y="220" text-anchor="middle">single committed-append path</text>
    <text style="font: 500 12px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #64748b;" x="520" y="237" text-anchor="middle">over the shared memory thread log;</text>
    <text style="font: 500 12px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #64748b;" x="520" y="254" text-anchor="middle">stable (createdAt, id) total order</text>

    <rect style="fill: #f8fafc; stroke: #94a3b8; stroke-width: 2; rx: 14;" x="700" y="140" width="300" height="120" />
    <text style="font: 600 17px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #0f172a;" x="850" y="172" text-anchor="middle">Session methods</text>
    <text style="font: 500 13px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #475569;" x="850" y="198" text-anchor="middle">create-or-load / save / load / list / delete</text>
    <text style="font: 500 12px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #64748b;" x="850" y="220" text-anchor="middle">atomic active-session admission +</text>
    <text style="font: 500 12px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #64748b;" x="850" y="237" text-anchor="middle">initial lease; saveSession requires</text>
    <text style="font: 500 12px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #64748b;" x="850" y="254" text-anchor="middle">unexpired owner + ifVersion CAS</text>

    <rect style="fill: #ecfdf5; stroke: #22c55e; stroke-width: 2; rx: 14;" x="40" y="300" width="630" height="80" />
    <text style="font: 600 17px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #0f172a;" x="355" y="330" text-anchor="middle">Shared MemoryStorage rows</text>
    <text style="font: 500 13px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #475569;" x="355" y="354" text-anchor="middle">thread rows + persisted message log (no Harness-only mirror log)</text>

    <rect style="fill: #eef2ff; stroke: #6366f1; stroke-width: 2; rx: 14;" x="700" y="300" width="300" height="80" />
    <text style="font: 600 17px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #0f172a;" x="850" y="330" text-anchor="middle">SessionRecord rows</text>
    <text style="font: 500 13px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #475569;" x="850" y="354" text-anchor="middle">durable Harness ledger</text>

    <path style="stroke: #334155; stroke-width: 2.2; fill: none; marker-end: url(#ah-tms-methods);" d="M260 96 L190 139" />
    <path style="stroke: #334155; stroke-width: 2.2; fill: none; marker-end: url(#ah-tms-methods);" d="M520 96 L520 139" />
    <path style="stroke: #334155; stroke-width: 2.2; fill: none; marker-end: url(#ah-tms-methods);" d="M780 96 L850 139" />

    <path style="stroke: #334155; stroke-width: 2.2; fill: none; marker-end: url(#ah-tms-methods);" d="M190 260 L210 299" />
    <path style="stroke: #334155; stroke-width: 2.2; fill: none; marker-end: url(#ah-tms-methods);" d="M520 260 L520 299" />
    <path style="stroke: #334155; stroke-width: 2.2; fill: none; marker-end: url(#ah-tms-methods);" d="M850 260 L850 299" />

    <rect style="fill: #fff7ed; stroke: #f97316; stroke-width: 2; rx: 14;" x="40" y="410" width="960" height="74" />
    <text style="font: 600 15px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #0f172a;" x="520" y="436" text-anchor="middle">Storage-enforced guards</text>
    <text style="font: 500 13px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #475569;" x="520" y="458" text-anchor="middle">active-key uniqueness on (harnessName, resourceId, threadId) · lease owner check · ifVersion CAS · tenant-safe not-found</text>
    <text style="font: 500 12px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #64748b;" x="520" y="476" text-anchor="middle">direct-ID primitives do not enforce resource scoping; the Harness layer cross-checks before returning</text>
  </svg>
  <figcaption>Method families call into shared memory rows for thread/message work and into the Harness session ledger for active-session creation, hydration, and CAS-fenced writes.</figcaption>
</figure>

```ts
interface HarnessStorageDomain {
    // Threads. These are Harness-facing wrappers around the shared memory
    // thread rows; they preserve unknown thread metadata for legacy
    // compatibility (§11.2) while the harness layer protects v1-owned runtime
    // fields through typed Session APIs. Public app metadata writes are
    // constrained to `metadata.app[key]` (§5.1); top-level metadata keys are
    // reserved for Harness, Mastra, MemoryStorage, channel adapters, legacy
    // compatibility, and future framework use. App metadata updates must
    // preserve every unknown top-level key and every unrelated `metadata.app`
    // key. `threadId` is globally unique within the bound Harness namespace.
    // Like `loadSession`, the direct-ID primitives do NOT enforce resource
    // scoping by themselves — the Harness storage view scopes to `harnessName`,
    // and the harness layer cross-checks each record's `resourceId` before
    // returning to a caller or cascading destructive work (see §2.3).
    // `saveThread` must not overwrite an existing thread with a different
    // `harnessName` or `resourceId`; adapters surface that as a typed collision
    // and the harness maps tenant-hidden collisions to not-found/no-create
    // semantics. `listThreads` takes `resourceId` alongside `ListThreadsOptions`
    // and filters by the bound `harnessName` plus `resourceId` at the storage
    // layer for efficiency. Public thread listings are ordered by
    // `(updatedAt DESC, id DESC)` unless a route later defines a narrower
    // filter-specific order; the cursor binds to that order and the resource
    // scope.
    // Harness v1 does not add a storage resource catalog or `listResources`
    // authority. Local known-resource helpers may derive distinct observed
    // resource IDs from thread/session rows already inside the bound Harness
    // namespace, but tenancy and authorization still come from resource-scoped
    // thread/session lookup and cross-checks, not membership in that derived
    // diagnostic list.
    saveThread(record: HarnessThread): Promise<void>;
    loadThread(opts: { threadId: string }): Promise<HarnessThread | null>;
    listThreads(opts: { resourceId: string } & ListThreadsOptions): Promise<ListPage<HarnessThread>>;
    deleteThread(opts: { threadId: string }): Promise<void>;

    // Messages. These are direct shared thread-log primitives, not a separate
    // Harness-only log. App-facing and server operations must first verify the
    // owning thread/session `harnessName` and `resourceId` before appending or
    // listing by `threadId`; storage-level message reads are not a tenant
    // boundary by themselves. Persisted rows must be mappable to both the memory-domain
    // `MastraDBMessage` shape used by processors and the public
    // `HarnessMessage` projection used by Session/threads APIs. Durable file
    // inputs stored in messages are stable `PersistedAttachment` refs; raw
    // URLs, provider temporary URLs, process-local paths, and live handles are
    // normalized before the append or rejected before admission.
    //
    // `appendMessages` is the single committed-message append path for a
    // Harness turn. If the configured agent/memory pipeline already persists
    // the accepted user/assistant messages through `MemoryStorage.saveMessages`,
    // the Harness adapter delegates to that same write; it must not also
    // dual-write the same message into unrelated rows. Duplicate message IDs in
    // one thread are idempotent only when the normalized persisted payload
    // matches; the same ID with different content, role, attachment refs, or
    // correlation metadata is a storage conflict.
    //
    // Ordering is stable and total. Public chronological listings are ordered
    // by `(createdAt, id)` ascending. Recent-window reads may scan descending,
    // but ties still use the same ID tie-breaker and the returned set must be
    // deterministic across restart, projection, and memory-context reads.
    // Cursors encode the last stable key observed by the issuing adapter, plus
    // the requested order/scope. New messages committed after a forward
    // chronological cursor appear on later pages; descending recent-window
    // cursors do not promise to reveal earlier concurrent inserts without a
    // fresh read from the head.
    appendMessages(opts: { threadId: string; messages: HarnessMessage[] }): Promise<void>;
    listMessages(opts: { threadId: string } & ListMessagesOptions): Promise<ListPage<HarnessMessage>>;

    // Thread clone is composed by the Harness layer from these thread/message
    // primitives rather than a separate storage operation. It loads and
    // resource-checks the source thread, saves a new thread in the same bound
    // `(harnessName, resourceId)` namespace, then appends a full
    // message-by-message snapshot of the source log with fresh message IDs and
    // stable `(createdAt, id)` ordering. Source thread rows and source
    // SessionRecords are not mutated or leased. Messages committed to the
    // source after clone reads its snapshot are not included. V1 does not expose
    // message filters, limits, cross-resource clone, or clone-specific
    // idempotency keys; partial clone/pagination policy would require a future
    // clone-specific issue rather than reusing read-navigation cursors.
    //
    // The clone copies no SessionRecord, channel binding, queue/admission,
    // pending item, current-run, permission/grant, token, goal, display,
    // workspace, wakeup, inbox/action/outbox, tombstone, or memory/OM row.
    // The new thread receives only fresh thread identity, title/title override,
    // optional `metadata.app`, and Harness-owned clone provenance metadata.
    // Reserved top-level thread metadata from §11.2, including legacy mode/model
    // defaults, token/working-memory fields, channel fields, project path, and
    // subagent fork markers, is not copied from the source.

    // Sessions (new in v1)
    // `saveSession` updates an existing SessionRecord under lease + version
    // CAS. It is not the creation path for active records; creation goes
    // through `createOrLoadActiveSession(...)` so concurrent cold starts cannot
    // produce duplicate active sessions for one thread/resource. The adapter
    // must verify `ownerId` is the current unexpired lease owner and
    // `ifVersion` matches in the same conditional write. A stale/expired owner
    // or version mismatch is distinguishable from transient adapter failure so
    // the owner can apply §5.8's proof-before-retry rule. The unexpired-owner
    // check uses the same lease time source described under session leases
    // below. Once `closingAt` is present, ordinary session mutators must not
    // call `saveSession` except for close-owned terminalization writes; the
    // closing marker advances `version`, so stale in-flight writes from the old
    // live owner fail CAS even before the in-process closing guard rejects them.
    saveSession(
      record: SessionRecord,
      opts: { ownerId: string; ifVersion: number },
    ): Promise<{ version: number }>;

    // Atomic active-session admission. Inserts `record` only when no active
    // SessionRecord exists for the same `(harnessName, resourceId, threadId)`, otherwise
    // returns the existing active-key owner without overwriting it. Closed records
    // (`closedAt !== undefined`) do not participate, so a terminally closed
    // session still allows later thread reuse. Closing records
    // (`closingAt !== undefined && closedAt === undefined`) do participate:
    // they reserve the active key, are not hydratable for new work, and are
    // returned so the harness can surface `HarnessSessionClosingError` or
    // resume/finalize the idempotent close path rather than creating a
    // replacement row behind a half-closed owner. If this call creates a new row, the candidate
    // `sessionId` must not already exist in the adapter's session-ID keyspace
    // for that `harnessName`; session IDs remain globally unique within the
    // Harness namespace even for closed rows. Adapters must
    // surface session-ID collisions and active-key corruption as typed storage
    // outcomes, not raw unique-violation leaks. The harness maps same-resource
    // deterministic-ID collisions to `HarnessSessionConflictError`,
    // cross-resource or cross-harness collisions to tenant-safe not-found
    // semantics per §2.3/HC-012/HC-045, and duplicate active-key rows to
    // `HarnessSessionCorruptError`. When this call creates the record, it also
    // installs the caller's initial lease: `created: true` implies
    // `leaseAcquired: true` and
    // `expiresAt` is present. `storageNow` is the time source used to compute
    // that expiry. When it returns an existing record,
    // `created: false` implies `leaseAcquired: false`; `expiresAt`, when
    // present, describes the existing row's current lease for diagnostics only,
    // and `storageNow` describes the adapter's current lease-comparison time.
    // The harness layer cross-checks any caller-required `sessionId` against
    // the returned record and throws `HarnessSessionConflictError` on mismatch;
    // otherwise it applies the normal lease policy with `acquireSessionLease`
    // before hydrating the returned existing record.
    createOrLoadActiveSession(
      record: SessionRecord,
      opts: { initialLease: { ownerId: string; ttlMs: number } },
    ): Promise<{
      record: SessionRecord;
      created: boolean;
      leaseAcquired: boolean;
      version: number;
      expiresAt?: number;
      storageNow: number;
    }>;

    // Direct ID lookup. Returns the record regardless of `closedAt` — this is
    // the path that powers history APIs and `harness.session({ sessionId })`
    // (which throws `HarnessSessionClosedError` for closed records — see §5.5).
    //
    // This primitive does NOT enforce resource scoping or active-key
    // uniqueness; it returns whatever record matches the ID inside the bound
    // Harness namespace. The harness layer cross-checks `harnessName` and
    // `resourceId` against the returned record before surfacing it to a caller
    // and throws `HarnessSessionNotFoundError` on mismatch (see §2.3). Before
    // granting a lease for an active direct-ID record, the harness also confirms
    // `loadSessionByThread({ threadId, resourceId })` in the same namespace
    // returns the same `sessionId`; a different active row is corruption and
    // fails closed with `HarnessSessionCorruptError`. Adapters do not need to
    // implement tenant authorization themselves.
    loadSession(opts: { sessionId: string }): Promise<SessionRecord | null>;

    // Lookup by (thread, resource). Returns only **non-closed active-key owner**
    // records, defined as `closedAt === undefined` (including Closing records).
    // Returns `null` when no active-key owner exists,
    // even if one or more closed records match the (harnessName, resourceId, threadId) pair.
    // This is what makes `harness.session({ threadId, resourceId })` create a
    // fresh session after a previous one was closed, while preventing creation
    // during a bounded close that has not reached `closedAt` yet (see §5.3).
    // This is a read path, not a create path; callers that may create must use
    // `createOrLoadActiveSession(...)` instead.
    //
    // Harness v1 requires a zero-or-one active-session invariant for each
    // `(harnessName, resourceId, threadId)`: the active `SessionRecord` is the
    // thread's runtime owner (§2.2). Storage implementations must enforce that
    // invariant with a partial unique constraint, transaction/upsert/CAS
    // equivalent, or backend-native single-writer primitive. If corruption or
    // operator tooling leaves multiple active records for the pair,
    // `loadSessionByThread(...)` must not choose one. It fails closed by
    // throwing or surfacing `HarnessSessionCorruptError` reason
    // `duplicate_active_session`, including the active IDs when available,
    // rather than choosing an arbitrary owner for queue/run state.
    loadSessionByThread(opts: { threadId: string; resourceId: string }): Promise<SessionRecord | null>;

    // Listing. Closed records are excluded by default; pass `includeClosed: true`
    // to surface them for history / audit views. Closing records are included
    // in default listings because they still reserve the active key; summaries
    // expose `closingAt` / `closeDeadlineAt` so clients do not treat them as
    // ordinary active sessions.
    // Session summaries are ordered by `(lastActivityAt DESC, sessionId DESC)`
    // for resource navigation. Child-session walks use `(createdAt ASC,
    // sessionId ASC)` so close/delete cascades can make deterministic forward
    // progress through a subtree. Cursors bind to `includeClosed` and the
    // parent/resource scope. A child whose `closedAt` commits during an
    // `includeClosed: true` walk remains eligible for later pages; a force
    // delete or tenant-hidden row may be skipped without leaking existence.
    listSessions(opts: { resourceId: string } & ListSessionsOptions): Promise<ListPage<SessionSummary>>;
    listChildSessions(opts: {
      parentSessionId: string;
      includeClosed?: boolean;
      limit?: number;
      cursor?: string;
    }): Promise<ListPage<SessionSummary>>;

    // Direct storage delete. This primitive is not an app-facing tenant
    // boundary: `harness.deleteSession({ sessionId, resourceId })` must load
    // and cross-check the record's `resourceId` before calling it. Dependent
    // ledger cleanup, delete fencing, and force-delete semantics are owned by
    // §5.5. Adapters may implement the §5.5 cascade behind this primitive or
    // expose internal indexed helpers to the harness layer; either way, the
    // public storage contract is the same terminal delete outcome.
    deleteSession(opts: { sessionId: string }): Promise<void>;

```
