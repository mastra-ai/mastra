### 5.1f Permissions, Pending Items, and Inbox Receipts

```ts
// Permissions — plain JSON, no functions, no closures. These rows are durable
// session state: they survive eviction and restart for this active
// `SessionRecord`, but they are not global, not thread metadata, and not
// inherited by child sessions unless an explicit session mutation copies them.
// Approval resolution is defined in §4.2. A pending approval response consumes
// only that item; it never edits these rows implicitly.
interface PermissionRules {
  categories: Partial<Record<ToolCategory, PermissionPolicy>>;  // per-category default
  tools: Partial<Record<string, PermissionPolicy>>;             // per-tool override (wins)
}

interface SessionGrants {
  categories: ToolCategory[];   // granted for the lifetime of this session only
  tools: string[];
}

type ToolApprovalReasonSource = 'tool-config' | 'tool-fn' | 'policy';

// All four "pending" shapes correlate a Mastra agent suspension with
// session-scoped UX. The actual paused execution state lives in the workflow
// snapshot under `MastraStorage.workflows`, keyed by `runId`. The harness only
// stores enough to rebuild the UX and resume through the §4.2 Required Agent
// Resume Boundary:
//
//   resumeBoundary.resumeStream({ runId, resumeAttemptId, resumeData, ... });
//
// The shapes are deliberately distinct because the resume payloads are
// distinct: an approval gate carries `{ approved, reason? }`; a tool
// suspension carries opaque `resumeData` that flows back into the paused
// tool's continuation; a question carries the user's answer; a plan
// approval carries `{ approved, reason? }` and may flip the session's mode.
// `source` distinguishes whether the suspension came from the parent session's
// own turn or from a subagent — drives state-isolation rules in §8.
//
// `itemId` is a stable, session-scoped ID for one pending interaction
// occurrence. It may mirror the underlying agent `toolCallId` only when that ID
// is unique for the pending occurrence; otherwise the harness derives an inbox
// ID from stable run/tool/question/plan data. `requestedAt` is part of the
// identity check so stale action tokens cannot answer a later item that happens
// to reuse the same underlying tool/question/plan handle.

// Pending interaction slot invariant: within one owning `SessionRecord`, a
// non-terminal `currentRun.runId` owns at most one pending interaction across
// `pendingApproval`, `pendingSuspension`, `pendingQuestion`, and `pendingPlan`.
// This is per owning session, not per parent aggregate view: a parent session
// and a subagent session may each have their own pending item for their own
// run, but each item is answered on its owning session. If storage ever contains
// multiple pending fields for the same non-terminal run, the state is corrupt.
// Hydration under the owning session lease may repair it through the §5.7
// corrupted-pending-state path. Non-owner projections and response routes fail
// closed and must not choose a winner or apply a response.

interface PendingApproval {
  kind: 'tool-approval';            // gate: model wants to call a tool, user decides yes/no
  itemId: string;                   // stable pending interaction ID
  runId: string;
  toolCallId: string;
  toolName: string;
  toolCategory?: ToolCategory;      // enables "approve category" UX
  input: JsonValue;                 // serialized JSON-safe tool input
  approvalReasons: ToolApprovalReasonSource[]; // snapshotted additive sources from §4.2
  source: 'parent' | 'subagent';
  subagentToolCallId?: string;
  requestedAt: number;
}

interface PendingToolSuspension {
  kind: 'tool-suspension';          // mid-execution: tool ran, called suspend(data), waiting for external resume
  itemId: string;                   // stable pending interaction ID
  runId: string;
  toolCallId: string;
  toolName: string;
  // The tool's serialised `suspend(...)` payload — what the tool author
  // chose to expose to the resumer (e.g. `{ webhookUrl, expectedSignature }`).
  // Opaque to the harness; rendered by the UI / handed to the external
  // system that produces the resume payload.
  suspendData: JsonValue;
  // Optional JSON-safe resume metadata derived from the registered tool's
  // `resumeSchema` or the current Mastra `SuspendOptions` adapter. This is
  // not a live schema object and is not enough to rehydrate a tool by itself;
  // `currentRun.toolIds` / runtime identity validation still prove the
  // executable surface. It preserves existing schema-aware UX/validation
  // metadata while `resumeData` remains the opaque payload passed through the
  // §4.2 Required Agent Resume Boundary to the paused continuation.
  resumeSchema?: JsonValue;
  resumeLabel?: string | string[];
  source: 'parent' | 'subagent';
  subagentToolCallId?: string;
  requestedAt: number;
}

interface PendingQuestion {
  kind: 'question';
  itemId: string;                   // stable pending interaction ID
  runId: string;
  toolCallId: string;               // ask_user tool's call id
  question: string;
  options?: { label: string; description?: string }[];
  selectionMode?: 'single_select' | 'multi_select';
  source: 'parent' | 'subagent';
  subagentToolCallId?: string;
  requestedAt: number;
}

interface PendingPlanApproval {
  kind: 'plan-approval';
  itemId: string;                   // stable pending interaction ID
  runId: string;
  toolCallId: string;               // submit_plan tool's call id
  title: string;
  plan: string;                     // markdown body
  source: 'parent' | 'subagent';
  subagentToolCallId?: string;
  requestedAt: number;
}

The first-party client `PendingInboxItem` view model in §13.4 is a projection of
these four pending shapes plus routing metadata from §10.2 / §13.2. It is not a
fifth persisted pending record; storage adapters persist only the canonical
fields above and `InboxResponseReceipt` rows below.

interface InboxResponseReceipt {
  responseId: string;
  itemId: string;
  kind: 'tool-approval' | 'tool-suspension' | 'question' | 'plan-approval';
  pendingRequestedAt: number;
  responseHash: string;
  response: JsonValue;
  status: 'accepted' | 'applied' | 'failed' | 'dead';
  attempts: number;
  runId: string;
  resumeAttemptId: string;          // passed to the agent resume boundary for de-dupe
  result?: InboxResponseResult;
  error?: { code: string; message: string };
  goalJudge?: {                    // present only for goal judge question auto-answers (§4.7)
    goalId: string;
    goalRevision: number;
    judgeModelId: string;
    source: {
      runId: string;
      itemId: string;
      requestedAt: number;
    };
  };
  nextAttemptAt?: number;
  acceptedAt: number;
  appliedAt?: number;
  failedAt?: number;
  deadAt?: number;
  updatedAt: number;
}
```
