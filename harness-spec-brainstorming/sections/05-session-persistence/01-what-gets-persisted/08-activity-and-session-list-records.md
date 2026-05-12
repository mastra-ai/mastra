### 5.1b.4 Activity and Session List Records

```ts
interface DurableWorkListSummary {
  activeCount: number;
  waitingCount: number;
  retryingCount: number;
  failedCount: number;
  latest?: Pick<DurableWorkSummary, 'kind' | 'status' | 'sourceDurability' | 'proof' | 'updatedAt' | 'lastError'>;
  // Like pending inbox summaries, list rows do not aggregate descendant work.
  sessionOwnedOnly: true;
}

interface DurableWorkSnapshotWindow {
  active: DurableWorkSummary[];
  recentTerminal: DurableWorkSummary[];
  truncated: boolean;
  nextCursor?: string;
  // The addressed session owns every row in this projection. Descendant-owned
  // work is read from that descendant's snapshot or from source-specific
  // recovery/diagnostic routes such as `/subagent-inbox` and channel diagnostics.
  sessionOwnedOnly: true;
}

interface SessionMessageCursor {
  threadId: string;
  // Fetch through `GET /harness/:name/threads/:threadId/messages` after the
  // route has verified the authenticated resource owns the thread.
  route: 'thread-messages';
  cursor?: string;
}

interface SessionMessageWindow {
  messages: HarnessMessage[];
  nextCursor?: string;
  truncated: boolean;
}

interface ActivityTimelineOptions {
  cursor?: string;
  limit?: number;
  // Defaults to false. When true, the route may include descendant subagent
  // entries only through the ownership and scoping rules in §5.6 / §10.6.
  includeDescendants?: boolean;
}

interface SessionActivityTimeline {
  sessionId: string;
  threadId: string;
  generatedAt: number;
  includeDescendants: boolean;
  entries: ActivityTimelineEntry[];
  nextCursor?: string;
  truncated: boolean;
}

type ActivityTimelineEntryKind =
  | 'message'
  | 'message-tool-call'
  | 'message-tool-result'
  | 'operation-result'
  | 'pending-inbox'
  | 'goal'
  | 'durable-work'
  | 'channel'
  | 'subagent'
  | 'file-reference';

type ActivityTimelineSourceKind =
  | 'thread-message'
  | 'message-part'
  | 'result-lookup'
  | 'session-snapshot'
  | 'pending-inbox'
  | 'subagent-session'
  | 'durable-work-summary'
  | 'channel-diagnostics'
  | 'workspace-projection'
  | 'application-datastore';

interface ActivityTimelineEntry {
  // Deterministic, source-derived ID such as `message:<messageId>` or
  // `message-part:<messageId>:<partIndex>`. When source IDs are only unique
  // inside one session, the deterministic ID includes the owning session or
  // another source-stable disambiguator. It is not an SSE event ID, not a
  // Last-Event-ID replacement, and not a per-viewer read cursor.
  entryId: string;
  kind: ActivityTimelineEntryKind;
  sessionId: string;
  threadId: string;
  occurredAt: number;
  updatedAt?: number;
  runId?: string;
  signalId?: string;
  queuedItemId?: string;
  toolCallId?: string;
  subagentSessionId?: string;
  parentSessionId?: string;
  parentEntryId?: string;
  depth?: number;
  actor?: {
    kind: 'user' | 'assistant' | 'system' | 'tool' | 'channel' | 'goal' | 'subagent' | 'harness';
    label?: string;
    channelId?: string;
    providerId?: string;
  };
  sourceDurability: 'durable' | 'retention-bound' | 'best-effort' | 'live-only';
  sourceRefs: Array<{
    kind: ActivityTimelineSourceKind;
    id: string;
    route?: 'thread-messages' | 'message-result' | 'queue-result' | 'subagent-inbox' | 'channel-diagnostics';
  }>;
  title: string;
  summary?: string;
  // Redacted, display-oriented JSON only. Raw request context, provider payloads,
  // token material, claim IDs, hashes, provider receipts, and unredacted errors
  // are never activity payload.
  payload?: JsonValue;
}

interface SessionListItem {
  sessionId: string;
  harnessName: string;
  resourceId: string;
  threadId: string;
  parentSessionId?: string;
  label?: SessionThreadLabel;
  lifecycle: SessionLifecycleStatus;
  createdAt: number;
  lastActivityAt: number;
  closingAt?: number;
  closeDeadlineAt?: number;
  closedAt?: number;
  modeId: string;
  modelId: string;
  busy: boolean;
  currentRun?: SessionRunProjection;
  queueDepth: number;
  pendingInbox: SessionPendingInboxSummary;
  durableWork: DurableWorkListSummary;
  goal?: SessionGoalSummary;
  channelBinding?: Pick<
    SessionChannelBindingSummary,
    'bindingId' | 'channelId' | 'providerId' | 'platform' | 'status'
  >;
  lastError?: { code: HarnessRowErrorCode; message: string };
}

```
