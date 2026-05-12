### 5.1b.1 Session Summary Records

```ts
interface SessionSummary {
  id: string;
  harnessName: string;
  resourceId: string;
  threadId: string;
  parentSessionId?: string;
  lastActivityAt: number;
  closingAt?: number;
  closeDeadlineAt?: number;
  closedAt?: number;
}

// `SessionSummary` is the storage/index adapter projection. Public
// navigation and reconnect APIs use the bounded read models below so callers do
// not infer UI state from the storage scan shape.

type SessionLifecycleStatus = 'active' | 'closing' | 'closed';
type PendingInboxKind = 'tool-approval' | 'tool-suspension' | 'question' | 'plan-approval';

interface SessionThreadLabel {
  value: string;
  // Labels come from typed thread title state. Public app metadata is not a
  // list-label source.
  source: 'thread-title';
}

interface SessionRunProjection {
  runId: string;
  traceId?: string;
  status: HarnessRunStatus;
  operation: {
    kind: HarnessRunOperationRef['kind'];
    signalId?: string;
    queuedItemId?: string;
    itemId?: string;
    responseId?: string;
    skillName?: string;
  };
  modeId: string;
  modelId: string;
  agentId?: string;
  startedAt: number;
  updatedAt: number;
  terminalAt?: number;
  error?: { code: HarnessRowErrorCode; message: string };
  nonRehydratableToolSurface?: boolean;
}

interface SessionGoalSummary {
  id: string;
  status: GoalState['status'];
  turnsUsed: number;
  maxTurns: number;
  lastDecision?: {
    decision: GoalJudgeDecision['decision'];
    judgedAt: number;
  };
}

interface SessionChannelBindingSummary {
  bindingId: string;
  channelId: string;
  providerId: string;
  platform: string;
  status: ChannelBinding['status'];
  mode?: ChannelBindingMode;
  generation?: number;
  lastInboundAt?: number;
  lastOutboundAt?: number;
  closedReason?: ChannelBinding['closedReason'];
}

interface SessionPendingInboxSummary {
  count: number;
  kinds: PendingInboxKind[];
  // List rows summarize only pending fields owned by this SessionRecord.
  // Descendant prompts are recovered through `/subagent-inbox`, not folded
  // into the parent's list row.
  sessionOwnedOnly: true;
}

```
