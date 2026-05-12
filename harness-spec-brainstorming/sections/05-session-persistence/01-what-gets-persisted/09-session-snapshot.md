### 5.1c Session Snapshot

```ts
interface SessionSnapshot {
  summary: SessionListItem;
  // Full JSON-safe session state included for the existing
  // `GET /sessions/:sessionId` state-read contract. Wire clients use the HTTP
  // `ETag` header from §13.3 for conditional writes, not this body as a CAS
  // token.
  state: Record<string, JsonValue>;
  currentRun?: SessionRunProjection;
  queue: {
    depth: number;
    queuedItemIds: string[];
  };
  // Session-owned prompts use the normalized first-party projection from
  // §13.4. Descendant prompts are fetched through `/subagent-inbox` so the
  // owning session URL remains explicit.
  pendingInbox: PendingInboxItem[];
  durableWork: DurableWorkSnapshotWindow;
  subagentInboxCursor?: {
    route: 'subagent-inbox';
    parentSessionId: string;
    // Route handle only. Clients obtain actual page cursors from
    // `/subagent-inbox` responses.
  };
  displayState?: HarnessDisplayStateSnapshotV1;
  goal?: GoalState | null;
  channelBindings: SessionChannelBindingSummary[];
  tokenUsage: TokenUsage;
  messages: {
    cursor: SessionMessageCursor;
    // Optional bounded convenience window. Servers must not embed unbounded
    // history in the snapshot; clients follow `cursor` when more history is
    // needed.
    recent?: SessionMessageWindow;
  };
}

`SessionListItem` and `SessionSnapshot` are bounded read projections over
`SessionRecord` and source-specific storage rows. They are not persisted rows.
Their route and wire contracts are owned by §13.

`SessionActivityTimeline` is a bounded read model, not a persisted
`SessionRecord` field, durable event stream, or generic activity ledger. It is
an optional UX projection; core controller recovery uses `SessionSnapshot`,
thread-message pagination, `/subagent-inbox`, and operation result lookup
instead of this timeline. It is assembled at read time from existing
authorities: the persisted thread/message log, structured `tool_call` /
`tool_result` message parts, retained
message-result and queue-result evidence, session-owned pending inbox
projections, goal state and decisions, descendant subagent summaries when the
caller opts into `includeDescendants`, `DurableWorkSummary`, redacted channel
diagnostics, and file references only when those references already exist in
committed messages, tool results, workspace projections, outbox summaries, or an
application-owned datastore. File-reference entries carry metadata or stable
anchors only; they are not generated-file bytes, portable artifact fetch
handles, or a `HarnessArtifact` surface (§11.5, §15.3).

Activity entries never settle SDK promises, prove provider delivery, claim or
retry source rows, mutate storage, replace result lookup, or act as read-state /
notification anchors. Their `entryId` values are deterministic and useful for
UI de-dupe while the underlying source evidence exists; they are not unbounded
durable cursors. One `SessionActivityTimeline` response must not contain two
entries with the same `entryId` in the same `sessionId` scope. When multiple
source authorities describe the same display occurrence, the projection uses one
activity entry with multiple `sourceRefs` or chooses the most specific
source-authoritative entry; distinct visible transitions in the same operation
chain may still appear as separate entries. When a source row, result, or
tombstone expires, the activity route omits that detail or returns only the
retained `expired` summary allowed by the source-specific read contract. Deleted
sessions use the normal tenant-safe deleted/not-found behavior.

Entries are sorted by `occurredAt` ascending; ties are broken by `sessionId` and
then `entryId` lexicographic order. The cursor is a forward seek token over that
composite key plus the addressed session, `includeDescendants` flag, and route
scope. A cursor issued with one `includeDescendants` value is not valid for the
other value and rejects as a wrong-filter validation error before scanning. It
promises monotonic forward progress, not position-stable or gapless re-reads: a
later page contains entries after the last returned `(occurredAt, sessionId,
entryId)` that are still visible under the source authorities. A late-arriving
or backfilled entry whose key sorts at or before the client's current cursor may
be skipped by later pages; clients that require operation settlement use result
lookup, not the activity timeline. If a cursor advances over a region whose
source rows or tombstones were compacted, force-deleted, or made tenant-hidden,
the route skips that region and returns only still-visible entries; clients may
render local gap markers, but the server does not leak deleted or expired source
IDs through cursor errors. Malformed, expired, or wrong-scope cursor tokens
still reject as validation errors before any source scan. The ordering is
best-effort across independently-mutable authorities and may vary slightly
across reads when entries from different sources share the same `occurredAt`.

Live-only `text_delta`, typing indicators, stream progress, custom tool
progress, live `tool_start` / `tool_end` details that do not land in
message/run/source state, local harness control-plane observations, SSE event
IDs, and SSE buffers are not reconstructed as activity history. Clients may
merge live event projections and local gap markers into their own UI, but those
client-local entries are not returned by `SessionActivityTimeline`.

`DurableWorkSummary` is a read model, not a persisted `SessionRecord` field and
not a generic work ledger. It is derived at read time from the existing
source-specific authorities: accepted signal/result evidence and
`OperationAdmissionTombstone` for signal-driven messages, `QueueAdmissionReceipt`
and `pendingQueue` for queue items, `GoalState.lastDecision` plus queue receipts
for goal continuations, `InboxResponseReceipt` for accepted pending responses,
`HarnessWakeupItem` for scheduled/proactive work that names this session,
`ChannelInboxItem`, `ChannelActionReceipt`, and `ChannelOutboxItem` for channel
work scoped to this session, and background-task rows only under the §5.1
classification above: a `BackgroundTaskReconstructableRow` may be summarized
from its own stable executor/completion metadata, while a
`BackgroundTaskDiagnosticRow` may be linked only when its `ownerRef` points to
an already-authoritative Harness durable row that proves the
namespace/resource/session. A raw background-task row with `status:
'completed'` but without that proof is excluded from
`durableWork` and remains at most a background-task diagnostic (§13.2, §15.1).

The projection is bounded by server configuration, uses epoch milliseconds, and
omits raw payloads, request context, prompt/attachment bodies, token strings,
provider receipts, claim IDs, hashes, and unredacted error messages. Terminal
items follow the source row's retention policy: while a compact tombstone still
identifies a prior operation the summary may report `expired`; after the source
evidence expires or a session is deleted, ordinary reads omit the item or use
tenant-safe not-found/deleted-session behavior. `sourceDurability` describes the
evidence behind the row. A `live-only` or `best-effort` summary is advisory and
must not settle SDK promises, prove channel delivery, or replace result lookup,
channel diagnostics, or background-task scoped read routes.

// `pendingQueue` holds items added via `session.queue(...)` only.
```
