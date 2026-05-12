### 5.1a.1 Thread and Session Records

Orientation diagram (record relationships only; the TypeScript shapes below
remain the authoritative field inventory):

<figure>
  <svg role="img" aria-labelledby="hx-thread-session-title hx-thread-session-desc" viewBox="0 0 1040 480" width="100%" style="max-width: 1100px; height: auto; display: block; margin: 1.5rem auto; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 18px; padding: 16px; box-sizing: border-box;">
    <title id="hx-thread-session-title">Thread and session record composition</title>
    <desc id="hx-thread-session-desc">A HarnessThread row joins the active SessionRecord through the (harnessName, resourceId, threadId) active key. The session row composes in-flight pending work and per-session state slots under one lease.</desc>
    <defs>
      <marker id="ah-thread-session" markerWidth="10" markerHeight="10" refX="8" refY="5" orient="auto">
        <path d="M0,0 L10,5 L0,10 Z" fill="#334155" />
      </marker>
    </defs>

    <rect style="fill: #f8fafc; stroke: #94a3b8; stroke-width: 2; rx: 14;" x="40" y="30" width="240" height="80" />
    <text style="font: 600 18px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #0f172a;" x="160" y="62" text-anchor="middle">HarnessThread</text>
    <text style="font: 500 14px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #475569;" x="160" y="85" text-anchor="middle">conversation row + app metadata</text>

    <rect style="fill: #eef2ff; stroke: #6366f1; stroke-width: 2.5; rx: 16;" x="380" y="30" width="280" height="80" />
    <text style="font: 600 18px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #0f172a;" x="520" y="62" text-anchor="middle">Active SessionRecord</text>
    <text style="font: 500 14px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #475569;" x="520" y="85" text-anchor="middle">durable runtime row for the thread</text>

    <rect style="fill: #ecfdf5; stroke: #22c55e; stroke-width: 2; rx: 14;" x="760" y="30" width="240" height="80" />
    <text style="font: 600 18px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #0f172a;" x="880" y="62" text-anchor="middle">Lease + version</text>
    <text style="font: 500 14px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #475569;" x="880" y="85" text-anchor="middle">CAS, owner, expiry</text>

    <rect style="fill: #fff7ed; stroke: #f97316; stroke-width: 2; rx: 14;" x="40" y="170" width="220" height="80" />
    <text style="font: 600 17px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #0f172a;" x="150" y="201" text-anchor="middle">Pending queue</text>
    <text style="font: 500 13px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #475569;" x="150" y="224" text-anchor="middle">queue items + admission receipts</text>

    <rect style="fill: #ecfeff; stroke: #06b6d4; stroke-width: 2; rx: 14;" x="290" y="170" width="220" height="80" />
    <text style="font: 600 17px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #0f172a;" x="400" y="201" text-anchor="middle">Pending inbox slots</text>
    <text style="font: 500 13px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #475569;" x="400" y="224" text-anchor="middle">approval / suspension / question / plan</text>

    <rect style="fill: #ecfeff; stroke: #06b6d4; stroke-width: 2; rx: 14;" x="540" y="170" width="220" height="80" />
    <text style="font: 600 17px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #0f172a;" x="650" y="201" text-anchor="middle">Inbox response receipts</text>
    <text style="font: 500 13px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #475569;" x="650" y="224" text-anchor="middle">two-phase resume idempotency</text>

    <rect style="fill: #fff7ed; stroke: #f97316; stroke-width: 2; rx: 14;" x="790" y="170" width="210" height="80" />
    <text style="font: 600 17px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #0f172a;" x="895" y="201" text-anchor="middle">currentRun</text>
    <text style="font: 500 13px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #475569;" x="895" y="224" text-anchor="middle">operational state + run ref</text>

    <rect style="fill: #f8fafc; stroke: #94a3b8; stroke-width: 2; rx: 14;" x="40" y="310" width="180" height="76" />
    <text style="font: 600 16px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #0f172a;" x="130" y="340" text-anchor="middle">Permissions</text>
    <text style="font: 500 13px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #475569;" x="130" y="362" text-anchor="middle">rules + grants</text>

    <rect style="fill: #f8fafc; stroke: #94a3b8; stroke-width: 2; rx: 14;" x="240" y="310" width="180" height="76" />
    <text style="font: 600 16px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #0f172a;" x="330" y="340" text-anchor="middle">OM config</text>
    <text style="font: 500 13px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #475569;" x="330" y="362" text-anchor="middle">scope + model defaults</text>

    <rect style="fill: #f8fafc; stroke: #94a3b8; stroke-width: 2; rx: 14;" x="440" y="310" width="180" height="76" />
    <text style="font: 600 16px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #0f172a;" x="530" y="340" text-anchor="middle">Goal</text>
    <text style="font: 500 13px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #475569;" x="530" y="362" text-anchor="middle">judge decision receipt</text>

    <rect style="fill: #f8fafc; stroke: #94a3b8; stroke-width: 2; rx: 14;" x="640" y="310" width="180" height="76" />
    <text style="font: 600 16px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #0f172a;" x="730" y="340" text-anchor="middle">Workspace</text>
    <text style="font: 500 13px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #475569;" x="730" y="362" text-anchor="middle">provider + durability</text>

    <rect style="fill: #f8fafc; stroke: #94a3b8; stroke-width: 2; rx: 14;" x="840" y="310" width="160" height="76" />
    <text style="font: 600 16px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #0f172a;" x="920" y="340" text-anchor="middle">displayState</text>
    <text style="font: 500 13px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #475569;" x="920" y="362" text-anchor="middle">render snapshot</text>

    <path style="stroke: #334155; stroke-width: 2.2; fill: none; marker-end: url(#ah-thread-session);" d="M280 70 L379 70" />
    <path style="stroke: #64748b; stroke-width: 2; fill: none; stroke-dasharray: 6 6; marker-end: url(#ah-thread-session);" d="M660 70 L759 70" />

    <path style="stroke: #334155; stroke-width: 2.2; fill: none; marker-end: url(#ah-thread-session);" d="M460 110 C320 130 200 145 160 169" />
    <path style="stroke: #334155; stroke-width: 2.2; fill: none; marker-end: url(#ah-thread-session);" d="M500 110 L420 169" />
    <path style="stroke: #334155; stroke-width: 2.2; fill: none; marker-end: url(#ah-thread-session);" d="M560 110 L630 169" />
    <path style="stroke: #334155; stroke-width: 2.2; fill: none; marker-end: url(#ah-thread-session);" d="M600 110 C760 130 840 145 880 169" />

    <path style="stroke: #64748b; stroke-width: 1.8; fill: none; stroke-dasharray: 5 5;" d="M520 250 L520 290" />
    <text style="font: 500 12px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #64748b;" x="535" y="278">per-session state below</text>

    <path style="stroke: #94a3b8; stroke-width: 1.8; fill: none; marker-end: url(#ah-thread-session);" d="M460 250 L150 309" />
    <path style="stroke: #94a3b8; stroke-width: 1.8; fill: none; marker-end: url(#ah-thread-session);" d="M495 250 L330 309" />
    <path style="stroke: #94a3b8; stroke-width: 1.8; fill: none; marker-end: url(#ah-thread-session);" d="M540 250 L530 309" />
    <path style="stroke: #94a3b8; stroke-width: 1.8; fill: none; marker-end: url(#ah-thread-session);" d="M575 250 L730 309" />
    <path style="stroke: #94a3b8; stroke-width: 1.8; fill: none; marker-end: url(#ah-thread-session);" d="M615 250 L900 309" />

    <text style="font: 500 12px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #334155;" x="320" y="62">active key</text>
    <text style="font: 500 12px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #334155;" x="697" y="62">lease guard</text>

    <rect style="fill: none; stroke: #cbd5e1; stroke-width: 1.5; stroke-dasharray: 4 4; rx: 12;" x="20" y="150" width="1000" height="110" />
    <text style="font: 500 12px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #64748b;" x="30" y="165">in-flight pending work</text>

    <rect style="fill: none; stroke: #cbd5e1; stroke-width: 1.5; stroke-dasharray: 4 4; rx: 12;" x="20" y="290" width="1000" height="106" />
    <text style="font: 500 12px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #64748b;" x="30" y="305">per-session state slots</text>
  </svg>
  <figcaption>The session row owns one in-flight pending work band and one per-session state band, with the thread row joining it through the active-key tuple and the lease band guarding writes.</figcaption>
</figure>

```ts
interface HarnessThread {
  id: string;
  harnessName: string;
  resourceId: string;
  title?: string;                 // user-facing conversation label; not app metadata
  createdAt: number;
  updatedAt: number;
  metadata?: ThreadMetadata;
}

type ThreadMetadata = Record<string, unknown> & {
  // Public application-owned thread metadata. `session.setThreadSetting(...)`
  // may write only into this nested object, one key at a time. Top-level
  // thread metadata keys are reserved for Harness, Mastra, MemoryStorage,
  // channel adapters, migration compatibility, and future framework use.
  app?: Record<string, JsonValue>;
  clone?: ThreadCloneMetadata;
};

// `threads.clone(...)` writes Harness-owned clone provenance into top-level
// metadata so legacy readers can identify the source without letting
// application metadata spoof it. The clone provenance is informational only and
// is not consulted for session hydration, channel routing, memory scope, or
// subagent ownership.
type ThreadCloneMetadata = {
  sourceThreadId: string;
  clonedAt: number;
};

// `harnessName` is the registered Mastra Harness key (`default` for
// single-harness sugar). It is assigned when the durable row is created and is
// immutable for that row's lifetime. Session-local nested records inherit the
// owning `SessionRecord.harnessName`; independently loadable records such as
// threads, session summaries, tombstones, channel rows, callback bindings,
// wakeups, and outbox/action/inbox rows persist it directly so shared storage
// adapters can enforce the same namespace as the server route/registry.

interface SessionRecord {
  id: string;
  harnessName: string;
  resourceId: string;
  threadId: string;
  parentSessionId?: string;          // subagent linkage

  // Per-session runtime defaults. `modeId` is seeded at session creation from
  // the configured default mode (`default: true`, otherwise `modes[0]`) and
  // changed by `session.switchMode(...)` / approved plan-mode flips. `modelId`
  // is seeded at session creation/bootstrap from legacy metadata or immutable
  // HarnessConfig fallback only when no selected model exists; once written, it
  // is authoritative over config until `session.switchModel(...)` commits.
  modeId: string;
  modelId: string;
  subagentModelOverrides: Record<string, string>;

  // Permissions
  permissionRules: PermissionRules;
  sessionGrants: SessionGrants;

  // Counters
  tokenUsage: TokenUsage;

  // In-flight state (resumable across restarts). For an active record this is
  // the only Harness-owned runtime state for the `(harnessName, resourceId, threadId)` pair.
  // `pendingQueue.length` is bounded by `sessions.maxQueueDepth` (§9). The
  // capacity check and the durable append are linearised under the active
  // session/thread owner's write lease (§5.8); admission past the cap rejects with
  // `HarnessQueueFullError` before touching storage.
  pendingQueue: QueuedItem[];
  // Durable idempotency receipts for queue admissions, keyed by admissionId.
  // These remain after the item leaves `pendingQueue` so late exact retries
  // cannot append a second standalone turn. They also record the signal
  // acceptance boundary once a queued item drains, so recovery can distinguish
  // pre-acceptance admission retry from post-acceptance run reconciliation.
  // Only terminal receipts (`completed`, post-acceptance `failed`, or `dead`)
  // with no pendingQueue/currentRun/pending-item reference may drop full result
  // evidence after `sessions.admissionReceiptRetentionMs`; live `queued`,
  // `admitting`, `accepted`, and retryable `admission_failed` receipts are
  // retained. When full evidence is compacted before the admission tombstone
  // window expires, storage keeps a compact `OperationAdmissionTombstone`
  // indexed by both admission key and public result key. While that tombstone
  // remains, storage has enough identity evidence to support the §4.4
  // duplicate/conflict contract and result lookup returns `expired`. After the
  // tombstone expires or the session is deleted, storage no longer has duplicate
  // evidence; lookup uses the normal tenant-safe not-found response.
  queueAdmissionReceipts?: Record<string, QueueAdmissionReceipt>;
  // Pending interaction fields are the canonical persisted inbox surface. For
  // one owning SessionRecord and one non-terminal currentRun.runId, at most one
  // of these fields may reference that run. Registration and harness-authored
  // approval gates validate this slot under the session lease before writing.
  pendingApproval?: PendingApproval;
  pendingSuspension?: PendingToolSuspension;
  pendingQuestion?: PendingQuestion;
  pendingPlan?: PendingPlanApproval;
  // Idempotency receipts for external inbox responses, keyed by responseId.
  // Used by channel action retries so a provider callback cannot resume the
  // same suspended run twice after a crash between session resume and channel
  // receipt update. Receipts older than
  // `sessions.inboxResponseReceiptRetentionMs` are compacted on hydrate/flush.
  inboxResponseReceipts?: Record<string, InboxResponseReceipt>;
  // Narrow operational projection for the currently known active or recently
  // interrupted run on this session. This is not an admission ledger, event
  // log, outbox receipt, or replacement for agent/workflow run storage.
  currentRun?: HarnessRunOperationalState;
  // Debounced display snapshot used to rebuild `getDisplayState()` after
  // hydration. It is a cache of renderable session state, not durable event
  // replay; stale or missing snapshots are rebuilt from the record fields
  // above plus the persisted message log. The persisted value is the
  // JSON-serializable snapshot shape below, never the richer in-process render
  // model an implementation may use internally.
  displayState?: HarnessDisplayStateSnapshotV1;

  // Observational memory config. These are the JSON-safe resolved defaults and
  // session-level model overrides used to rebuild the OM wrapper after
  // hydration. The SessionRecord does not store active observations, buffered
  // chunks/reflections, OM history generations, raw config blobs, provider
  // clients, functions, or processor locks; those remain advisory MemoryStorage
  // rows outside the session lease/CAS boundary.
  observationalMemory?: {
    scope?: 'thread' | 'resource';
    observerModelId?: string;
    reflectorModelId?: string;
    observationThreshold?: number;
    reflectionThreshold?: number;
  };

  // Active goal — set via `session.setGoal(...)`, evaluated after each
  // assistant turn. `GoalState.lastDecision` is also the session-local
  // judge/continuation receipt for the latest judged assistant turn. See §4.7.
  goal?: GoalState;

  // Per-session workspace state (only populated under `kind: 'per-session'`
  // after a workspace is materialised). `providerId` is the registered
  // provider's stable identity (e.g. 'e2b', 'daytona', 'modal'); factory
  // shorthand may store only the reserved non-durable diagnostic identity.
  // `durability: 'durable'` records the opaque provider `state` and optional
  // `generation` reported through the §9 `onStateChange` hook and fed back to
  // `provider.resume({ state, ... })` after restart.
  // `durability: 'ephemeral'` records identity only so restart/eviction loss
  // is visible as `HarnessWorkspaceLostError`; the identity is not a durable
  // rehydration-matching key, and the harness never creates a replacement
  // workspace for the same active session.
  //
  // `lostAt` is the authoritative loss marker. During rehydration (§5.7c),
  // the recovery path must check `lostAt` before reading `state` or
  // `generation`. When set, the session fails closed with
  // `HarnessWorkspaceLostError`, using the stored `lostReason` when present,
  // and does not call `provider.resume(...)`. The `lostAt` flag is sticky:
  // it survives subsequent persistence cycles. Recovery from a lost
  // workspace requires explicit operator repair (§15.3's "Operator repair
  // APIs beyond dispatch" deferral covers stuck-session/workspace repair
  // routes) or product-owned workspace migration; no implicit re-attach
  // occurs. Both the harness crash-recovery path and any runtime
  // provider-probe that writes `lostAt` must do so under the session lease
  // with CAS (§5.8); a malformed `lostAt` without a `lostReason` still
  // fails closed.
  //
  // See §2.7 and §9.
  workspace?: {
    providerId: string;
    durability: 'durable' | 'ephemeral';
    state?: JsonValue;
    generation?: string;
    lostAt?: number;
    lostReason?: HarnessWorkspaceLostError['reason'];
  };

  // User-defined custom state (typed via TState generic on Harness).
  // The v1 root state is a plain JSON object; richer values belong behind
  // stable references in workspace files, attachments, or app-owned storage.
  state: Record<string, JsonValue>;

  // Lifecycle
  createdAt: number;
  lastActivityAt: number;
  closingAt?: number;             // closeSession has durably entered the bounded closing phase
  closeDeadlineAt?: number;       // storage-time deadline for live work before forced terminal close
  closedAt?: number;

  // Write-concurrency — see §5.8.
  version: number;            // Monotonically incremented on every successful saveSession.
                              //   Used for optimistic-CAS conflict detection and
                              //   remote state PATCH validators (§13.2).
  ownerId?: string;           // ownerId of the Harness instance currently holding the lease,
                              //   or undefined if the record is unowned (no live Session).
  leaseExpiresAt?: number;    // Epoch ms — when the current lease TTLs out. Adapters that
                               //   provide a native lease primitive may store this implicitly.
}

// JSON-serializable point-in-time display snapshot. This is the public
// getDisplayState / subscribeDisplayState shape and the only shape that may be
// stored in SessionRecord.displayState or returned over HTTP. Implementations
// may keep richer in-process maps, Date objects, or live buffers internally,
// but they must normalize to this shape before storage, HTTP, or portable API
// delivery. Unknown payload slots are included only when they are canonical
// JSON; non-JSON or lossy values are omitted from the snapshot rather than
// being persisted. The authoritative recovery state remains the durable
// pending/currentRun/queue/message records above.
```
