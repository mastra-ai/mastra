### 15.3 Deferred Items

The following are resolved as v1 deferrals, not forgotten requirements. §11.5
is the canonical scope-decision list; entries below add only the
verification-specific consequence and tests/invariants the deferral implies.

- **Durable heartbeat as a first-class Harness API.** Deferred by the
  canonical §11.5 v1 scope decision. Verification consequence:
  `onInterval(...)` remains process-local; restart-safe heartbeat is modeled
  through `HarnessWakeupItem` rows (§5.1e, §15.1 "Scheduled/proactive
  wakeup"). Wakeup recovery acceptance is owned by the §15.2 wakeup rows;
  this deferral does not add a heartbeat-specific test row.
- **Generic MCP/app callback ledgers.** Deferred by §11.5. Verification
  consequence: resumed work must not depend on process-local MCP
  client/session objects; unavailable bindings fail closed and emit no
  Harness-visible recovery proof (§15.1 "Future MCP/app callbacks",
  "MCP runtime status observation").
- **Generic non-read external action receipts.** Deferred by §11.5.
  Verification consequence: §15.1 "Generic non-read external tool effects"
  governs the at-least-once vs lookup-before-execute boundary. Other
  providers need source-specific receipts before Harness can claim duplicate
  suppression of provider side effects.
- **Generic durable work ledger/table.** Deferred by §11.5. Verification
  consequence: `SessionListItem.durableWork` /
  `SessionSnapshot.durableWork` are derived read projections over existing
  source-specific rows; the read model is bounded, redacted, derived, and
  never a cross-source claim/lookup substrate (§15.1 "Durable work status
  read model").
- **Workspace filesystem event ingestion into memory.** Deferred by §11.5
  scope (no `HarnessArtifact` / no filesystem-watcher memory ingestion).
  Verification consequence: workspace file mutations are durable workspace
  state and ordinary tool side effects; v1 has no generic filesystem
  watcher, workspace-file event stream, audit-scanner worker, or non-message
  observational-memory ingestion path. Safe fallback: agents summarize
  important file changes through committed messages or explicit tool
  results; products that need file activity views may build
  provider-specific diagnostics from `WorkspaceFilesystemAudit` without
  treating those rows as memory inputs or recovery proof.
- **First-class durable agent-produced artifact records.** Deferred by
  §11.5 (HC-055). Verification consequence: §15.1 "Agent-produced output
  artifacts" invariant form remains authoritative; portable artifact
  list/fetch APIs and `artifact_*` events stay absent. Remote clients
  cannot browse generated workspace files through portable Harness session
  routes.
- **Operator repair APIs beyond dispatch.** v1 specifies
  `dispatchOutbox(...)`, dead-letter/undeliverable row states, and explicit
  migration constraints. Read-only channel diagnostics are included only as
  redacted, side-effect-free session-scoped summaries plus optional
  operator-only channel-wide diagnostics (§14.8). Product-specific repair,
  binding migration UI, manual replay/re-projection, per-row retrigger,
  administrative reconciliation, retry/retarget controls, and stuck-session
  repair routes are deferred; the safe fallback is no automatic retargeting,
  no diagnostic-surface mutation, and no hidden retry after terminal
  `dead`/`undeliverable`.
- **Channel buttons for non-idempotent resume kinds.** Tool approvals,
  suspensions, questions, and plan approvals are channel-action eligible
  only after their resume path proves `resumeAttemptId = responseId`
  de-dupe. Until then the bridge renders direct-session instructions or
  leaves the item for first-party clients/operator repair instead of
  claiming exactly-once action application.
- **Automatic closed-session garbage collection and session-history
  retention.** v1 has no automatic closed-session TTL, no session-history
  retention config knob, no storage sweeper contract, and no built-in
  cleanup worker for closed `SessionRecord` rows. Safe fallback: operators
  or product-owned routines call the existing resource-scoped
  `harness.deleteSession({ sessionId, resourceId })` or
  `harness.threads.delete(...)` after their own retention policy no longer
  requires the session row for result lookup, audit, or history. Routine
  cleanup should use non-force delete so the §5.5 delete preconditions
  block unresolved dependents; explicit force delete remains an
  operator/corruption-recovery path. This deferral is not a minimum
  audit/history retention guarantee and does not promise artifact,
  read-state, channel-ledger, attachment, workspace, or source-row
  retention beyond their existing source-specific policies. Retaining a
  closed session does not block thread reuse or consume the active
  `(harnessName, resourceId, threadId)` uniqueness slot; deleting it hides
  the session from `includeClosed` and makes session result/admission
  routes use tenant-safe not-found. Retained source-specific rows, if any,
  keep only their own point-duplicate semantics.
- **Per-principal read-state and notification model.** Deferred by §11.5.
  Verification consequence: read state is product attention state, not a
  Harness recovery primitive. SSE event IDs and `Last-Event-ID` are valid
  only for the §10.5 live replay window and must not be used as durable
  read cursors; tests must assert that rejection. Future first-class
  read/notification state needs principal-level authorization (§13.2) and,
  for timeline cursors, the HC-064 durable timeline identifier decision.
  Safe fallback: products may keep local or application-managed read state
  keyed by authenticated principal plus durable Harness anchors such as
  session/thread IDs, durable message IDs, `runId`, pending `itemId`,
  channel ledger IDs, retained `signalId` / `queuedItemId` evidence, or
  future timeline entry IDs. Retention-bounded operation anchors expire
  with their result/tombstone evidence.
- **Richer result, stream chunk, and typed-generate durability schemas.** v1
  defines only the recovery-minimum `AgentResult` (§4.8), the narrow
  `AgentStream` facade (`runId`, `signalId`, `textStream`), the operation
  result lookup DTOs (§13.3), and identity/hash-only
  `OperationAdmissionTombstone` records (§5.1). Those durability mechanics
  must not be read as defining durable stream chunk replay, a full
  tool/final/error-chunk union, failure-carrying `AgentResult`, retry-safe
  typed synchronous output, or a generate-admission receipt. Safe fallback:
  clients recover missed streams through the §10.5 `412` snapshot path,
  persisted message-history reads, and terminal result lookup by `signalId`
  / `queuedItemId`; callers that need retry-safe work use `queue(...)` or
  untyped signal-driven operations with retained admission evidence.
  Broader `AgentResult` expansion beyond the recovery-minimum success
  envelope is deferred by this item; the §4.8 carrier-identity rule covers
  embedded result identity without expanding the result payload. v1 does
  not add failure-carrying `AgentResult`, structured-output payloads on
  `AgentResult`, or richer provider/tool payload guarantees. Broader
  `AgentStream` chunk/replay schemas are deferred by this item and HC-188.
  Retry-safe typed-generate admission remains out of v1 until a future
  generate-admission receipt specifies the boundary.
