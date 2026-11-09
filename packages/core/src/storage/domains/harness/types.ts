export type HarnessSessionOrigin = 'top-level' | 'subagent-tool' | 'direct-local' | 'remote-resolve';

export type HarnessPendingItemKind = 'tool-approval' | 'tool-suspension' | 'question' | 'plan-approval';

export type HarnessPendingItemStatus = 'pending' | 'responded' | 'canceled' | 'failed';

export interface HarnessPendingItemRecord {
  id: string;
  kind: HarnessPendingItemKind;
  status: HarnessPendingItemStatus;
  sessionId: string;
  runId?: string | null;
  traceId?: string | null;
  runtimeCompatibilityGeneration?: string | null;
  createdAt: Date;
  updatedAt: Date;
  payload?: Record<string, unknown>;
  response?: Record<string, unknown>;
}

export interface SessionRecord {
  id: string;
  ownerId: string;
  resourceId: string;
  threadId: string;
  parentSessionId?: string;
  subagentDepth?: number;
  source?: {
    type: HarnessSessionOrigin;
    parentSessionId?: string;
    parentRunId?: string | null;
    parentTraceId?: string | null;
    subagentType?: string;
  };
  origin: HarnessSessionOrigin;
  runtimeCompatibilityGeneration?: string | null;
  /** @deprecated Conversation mode is stored in thread metadata. */
  modeId: string;
  /** @deprecated Conversation model selection is stored in thread metadata. */
  modelId: string;
  title?: string;
  metadata?: Record<string, unknown>;
  /** @deprecated Conversation state is stored in thread metadata. */
  state?: Record<string, unknown>;
  /** @deprecated Pending suspensions are recovered from thread run snapshots. */
  pending?: HarnessPendingItemRecord[];
  createdAt: Date;
  lastActivityAt: Date;
  closingAt?: Date | null;
  closeDeadlineAt?: Date | null;
  closedAt?: Date | null;
  deletedAt?: Date | null;
}

export type SessionRecordUpdate = Partial<
  Omit<SessionRecord, 'id' | 'createdAt'> & {
    lastActivityAt: Date;
  }
>;
