### 5.1a.2 Display Records

```ts
interface HarnessDisplayStateSnapshotV1 {
  schemaVersion: 1;
  capturedAt: number;
  isRunning: boolean;
  currentMessage: HarnessDisplayMessageSnapshotV1 | null;
  tokenUsage: HarnessDisplayTokenUsageSnapshotV1;
  activeTools: HarnessDisplayToolSnapshotV1[];
  toolInputBuffers: Array<{ toolCallId: string; toolName: string; text: string }>;
  pendingApproval: HarnessDisplayPendingApprovalSnapshotV1 | null;
  pendingSuspension: HarnessDisplayPendingSuspensionSnapshotV1 | null;
  pendingQuestion: HarnessDisplayPendingQuestionSnapshotV1 | null;
  pendingPlanApproval: HarnessDisplayPendingPlanSnapshotV1 | null;
  activeSubagents: HarnessDisplaySubagentSnapshotV1[];
  // Display-only projection of file paths inferred from known tool/UI activity.
  // This is not a workspace audit log, not a filesystem mutation ledger, and
  // not an observational-memory ingestion source (§2.7).
  modifiedFiles: Array<{ path: string; operations: string[]; firstModifiedAt: number }>;
  tasks: HarnessDisplayTaskSnapshotV1[];
  previousTasks: HarnessDisplayTaskSnapshotV1[];
}

interface HarnessDisplayTokenUsageSnapshotV1 {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  reasoningTokens?: number;
  cachedInputTokens?: number;
  cacheCreationInputTokens?: number;
  // Included only when the provider-specific payload is canonical JSON;
  // otherwise omitted from display snapshots.
  raw?: JsonValue;
}

interface HarnessDisplayMessageSnapshotV1 {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: JsonValue[];
  createdAt: number;
  stopReason?: 'complete' | 'tool_use' | 'aborted' | 'error';
  errorMessage?: string;
}

interface HarnessDisplayToolSnapshotV1 {
  toolCallId: string;
  toolName: string;
  args?: JsonValue;
  status: 'streaming_input' | 'running' | 'completed' | 'error';
  partialResult?: string;
  result?: JsonValue;
  isError?: boolean;
  shellOutput?: string;
}

interface HarnessDisplayPendingBaseSnapshotV1 {
  itemId: string;
  runId: string;
  toolCallId: string;
  requestedAt: number;
  source: 'parent' | 'subagent';
  subagentToolCallId?: string;
  subagentSessionId?: string;
}

interface HarnessDisplayPendingApprovalSnapshotV1 extends HarnessDisplayPendingBaseSnapshotV1 {
  kind: 'tool-approval';
  toolName: string;
  toolCategory?: ToolCategory;
  approvalReasons: ToolApprovalReasonSource[];
  input?: JsonValue;
}

interface HarnessDisplayPendingSuspensionSnapshotV1 extends HarnessDisplayPendingBaseSnapshotV1 {
  kind: 'tool-suspension';
  toolName: string;
  suspendData?: JsonValue;
  resumeSchema?: JsonValue;
}

interface HarnessDisplayPendingQuestionSnapshotV1 extends HarnessDisplayPendingBaseSnapshotV1 {
  kind: 'question';
  question: string;
  options?: { label: string; description?: string }[];
  selectionMode?: 'single_select' | 'multi_select';
}

interface HarnessDisplayPendingPlanSnapshotV1 extends HarnessDisplayPendingBaseSnapshotV1 {
  kind: 'plan-approval';
  title: string;
  plan: string;
}

interface HarnessDisplaySubagentSnapshotV1 {
  toolCallId: string;
  subagentSessionId?: string;
  agentType: string;
  task: string;
  modelId?: string;
  forked?: boolean;
  toolCalls: Array<{ name: string; isError: boolean }>;
  textDelta?: string;
  status: 'running' | 'completed' | 'error';
  durationMs?: number;
  result?: string;
}

interface HarnessDisplayTaskSnapshotV1 {
  content: string;
  status: 'pending' | 'in_progress' | 'completed';
  activeForm: string;
}

// Snapshot arrays with identity keys (`activeTools`, `toolInputBuffers`,
// `activeSubagents`, and `modifiedFiles`) are ordered by their stable key
// (`toolCallId`, `subagentSessionId` when present otherwise `toolCallId`, or
// `path`) so JSON round-trips are deterministic. If a stored display snapshot is
// missing, malformed, or has an unsupported `schemaVersion`, hydration ignores
// the snapshot and rebuilds from authoritative `SessionRecord` fields plus the
// persisted message log. A persisted snapshot must not resurrect consumed
// pending items, override `currentRun`, or settle operations.
//
// Canonical display projection and rebuild rules:
//
// **`schemaVersion`**
//
// Authoritative source when rebuilding: Constant
//
// Rule: Always `1`.
//
// **`capturedAt`**
//
// Authoritative source when rebuilding: Rebuild time
//
// Rule: Use the time the JSON snapshot was produced. It is not a message commit
// time, pending-item time, or operation-settlement time.
//
// **`isRunning`**
//
// Authoritative source when rebuilding: Repaired `SessionRecord.currentRun`
//
// Rule: `true` only for non-terminal run statuses (`starting`, `running`,
// `waiting`, `resuming`). Queued-but-idle durable work is visible through
// queue/depth and durable-work projections, not by forcing `isRunning`.
//
// **`currentMessage`**
//
// Authoritative source when rebuilding: Harness-scoped persisted thread/message
// log
//
// Rule: Latest committed displayable message for the thread, or `null` when
// none exists. Missed `text_delta` chunks and live stream buffers are not
// synthesized.
//
// **`tokenUsage`**
//
// Authoritative source when rebuilding: `SessionRecord.tokenUsage`
//
// Rule: Direct JSON projection.
//
// **`activeTools`**
//
// Authoritative source when rebuilding: Repaired `currentRun`, canonical
// pending fields, and committed `tool_call` / `tool_result` message parts
//
// Rule: Include only entries backed by current run/pending evidence or
// committed message parts for the active run. `streaming_input`,
// `partialResult`, and `shellOutput` survive rebuild only when they are already
// present as canonical JSON in a usable snapshot; otherwise they clear.
//
// **`toolInputBuffers`**
//
// Authoritative source when rebuilding: Live stream state only
//
// Rule: Empty on rebuild from durable records. A usable stored snapshot may
// carry JSON buffers until superseded, but storage/message replay does not
// reconstruct them.
//
// **`pendingApproval` / `pendingSuspension` / `pendingQuestion` / `pendingPlanApproval`**
//
// Authoritative source when rebuilding: Matching
// `SessionRecord.pendingApproval` / `pendingSuspension` / `pendingQuestion` /
// `pendingPlan` field after pending-state repair
//
// Rule: Direct projection only when the canonical pending field still exists
// with the same `itemId`, `kind`, `runId`, `requestedAt`, and source/owner
// identity. Otherwise `null`.
//
// **`activeSubagents`**
//
// Authoritative source when rebuilding: Parent-side spawn evidence plus
// locatable child `SessionRecord` rows in the same parent/root ownership scope
//
// Rule: Project only children that remain locatable and attributable to this
// parent. A stale parent display snapshot alone cannot prove a child is active
// or keep a subagent-owned pending prompt visible; child-owned prompts are
// recovered from the child session or `/subagent-inbox`.
//
// **`modifiedFiles`**
//
// Authoritative source when rebuilding: Committed messages, durable tool
// results, or product-owned datastore references that already carry explicit
// file paths
//
// Rule: Best-effort display projection. It is empty when no retained durable
// source names a path; Harness does not scan workspaces, infer arbitrary file
// mutations, or treat this field as an artifact or filesystem ledger.
//
// **`tasks` / `previousTasks`**
//
// Authoritative source when rebuilding: No independent Harness v1 task ledger
//
// Rule: Empty on rebuild unless a product-specific adapter also defines and
// verifies a canonical JSON source outside core Harness. Core recovery must not
// infer tasks from events or live scheduler state.
//
//
// Rebuild runs after hydration repair for `currentRun`, pending slots, queue
// receipts, and runtime-dependency drift. If the stored snapshot disagrees with
// those authorities, the conflicting display field is cleared or recomputed; the
// display cache never mutates authoritative records, proves a provider side
// effect, or creates operation-result evidence.

// **Memory context is advisory, not under session write-concurrency.**
// Working memory and observational memory are assembled from Harness-owned
// persisted messages and stored observations at runtime (§1). Their storage
// rows are not guarded by the `SessionRecord` lease or version CAS (§5.8).
// Harness must not treat memory state as the proof boundary for queue,
// channel, wakeup, approval, or goal decisions — those decisions are owned
// by the durable Harness storage records listed above.

```
