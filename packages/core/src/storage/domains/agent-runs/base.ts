import { StorageDomain } from '../base';

/** Current lifecycle state of an agent run. */
export type AgentRunStatus = 'created' | 'running' | 'suspended' | 'finished' | 'error' | 'cancelled';

/**
 * Storage-owned lifecycle events.
 *
 * Stream chunk names such as `text-delta`, `tool-call`, `file`, or
 * `background-task-completed` can also be stored in `AgentRunEvent.type`, but
 * the stream package remains the source of truth for that vocabulary.
 */
export type AgentRunLifecycleEventType =
  | 'run-start'
  | 'run-finish'
  | 'run-error'
  | 'run-suspended'
  | 'run-resumed'
  | 'approval-required'
  | 'approval-resolved';

export type AgentRunEventType = AgentRunLifecycleEventType | (string & {});

/** Structured error summary stored on the run aggregate. */
export type AgentRunError = {
  message: string;
  code?: string;
  stack?: string;
  details?: unknown;
};

export type AgentRunToolCall = {
  toolCallId: string;
  toolName: string;
  status: 'pending' | 'running' | 'awaiting-approval' | 'suspended';
  args?: unknown;
  createdAt?: Date;
  updatedAt?: Date;
  metadata?: Record<string, unknown>;
};

/** Compact, queryable projection of the current state for a single agent run. */
export type AgentRun = {
  runId: string;
  agentId: string;
  threadId?: string | null;
  resourceId?: string | null;
  status: AgentRunStatus;
  createdAt: Date;
  updatedAt: Date;
  startedAt?: Date | null;
  finishedAt?: Date | null;
  error?: AgentRunError | null;
  finalMessageId?: string | null;
  finalOutput?: unknown;
  /**
   * Denormalized UI state for reload/reconnect paths. The append-only event log
   * remains the history; this field prevents reactive UIs from scanning events
   * just to render current approvals or suspended tools.
   */
  pendingToolCalls?: AgentRunToolCall[];
  /** Highest event index currently persisted for this run. Storage-managed. */
  lastEventIndex?: number | null;
  /** Number of events currently persisted for this run. Storage-managed. */
  eventCount?: number;
  metadata?: Record<string, unknown>;
};

/** Fields that can be patched on an existing run aggregate. */
export type AgentRunUpdate = Partial<
  Pick<
    AgentRun,
    | 'threadId'
    | 'resourceId'
    | 'status'
    | 'updatedAt'
    | 'startedAt'
    | 'finishedAt'
    | 'error'
    | 'finalMessageId'
    | 'finalOutput'
    | 'pendingToolCalls'
    | 'metadata'
  >
>;

/** Append-only event row for a run. */
export type AgentRunEvent = {
  runId: string;
  /**
   * Monotonic per-run position. This mirrors the PubSub `Event.index` field so
   * storage-backed UIs can tail events with the same offset vocabulary.
   */
  index: number;
  type: AgentRunEventType;
  data?: unknown;
  createdAt: Date;
};

/** Event write payload. Storage assigns the next per-run index when omitted. */
export type AgentRunEventInput = Omit<AgentRunEvent, 'index'> & {
  index?: number;
};

/** Filter and pagination options for listing agent runs. */
export type AgentRunListFilter = {
  agentId?: string;
  threadId?: string | null;
  resourceId?: string | null;
  status?: AgentRunStatus | AgentRunStatus[];
  dateFilterBy?: 'createdAt' | 'updatedAt' | 'startedAt' | 'finishedAt';
  /** Start of the date range, inclusive. */
  fromDate?: Date;
  /** End of the date range, exclusive. */
  toDate?: Date;
  orderBy?: 'createdAt' | 'updatedAt' | 'startedAt' | 'finishedAt';
  orderDirection?: 'asc' | 'desc';
  page?: number;
  perPage?: number;
};

export type AgentRunListResult = {
  runs: AgentRun[];
  total: number;
};

/** Options for tailing a run's ordered event log. */
export type AgentRunEventListOptions = {
  /** Return events with index greater than this value. */
  afterIndex?: number;
  /** Return events with index greater than or equal to this value. */
  fromIndex?: number;
  /** Return events with index less than or equal to this value. */
  toIndex?: number;
  limit?: number;
  orderDirection?: 'asc' | 'desc';
};

export type AgentRunEventListResult = {
  events: AgentRunEvent[];
  total: number;
};

export type AgentRunDeleteFilter = {
  agentId?: string;
  threadId?: string | null;
  resourceId?: string | null;
  status?: AgentRunStatus | AgentRunStatus[];
  beforeDate?: Date;
  dateFilterBy?: 'createdAt' | 'updatedAt' | 'finishedAt';
};

/**
 * Storage domain for agent run lifecycle state.
 *
 * This domain is a durable, queryable projection for application UIs. It does
 * not replace PubSub/SSE streaming or observability traces.
 */
export abstract class AgentRunsStorage extends StorageDomain {
  constructor() {
    super({
      component: 'STORAGE',
      name: 'AGENT_RUNS',
    });
  }

  /** Insert a new run aggregate. Throws if a run with the same runId already exists. */
  abstract createRun(run: AgentRun): Promise<AgentRun>;

  /**
   * Partially update a run aggregate. Throws if the run does not exist.
   *
   * The run ID, agent ID, last event index, and event count are storage-owned
   * identity/projection fields and must not be patched through this method.
   */
  abstract updateRun(runId: string, update: AgentRunUpdate): Promise<AgentRun>;

  /** Get a single run aggregate by ID. Returns null if not found. */
  abstract getRun(runId: string): Promise<AgentRun | null>;

  /** List run aggregates by common UI-facing filters. */
  abstract listRuns(filter?: AgentRunListFilter): Promise<AgentRunListResult>;

  /**
   * Append one ordered event. Storage assigns the next per-run index when omitted.
   *
   * Throws if the run does not exist. Appending an older replayed event must not
   * move the run aggregate's `updatedAt` backwards.
   */
  abstract appendEvent(event: AgentRunEventInput): Promise<AgentRunEvent>;

  /**
   * Append multiple ordered events for one run. Storage assigns missing per-run
   * indexes in input order.
   *
   * Implementations should reject mixed-run batches and duplicate indexes
   * without partially writing the batch. Appending older replayed events must not
   * move the run aggregate's `updatedAt` backwards.
   */
  abstract appendEvents(events: AgentRunEventInput[]): Promise<AgentRunEvent[]>;

  /** List ordered events for a run. */
  abstract listEvents(runId: string, opts?: AgentRunEventListOptions): Promise<AgentRunEventListResult>;

  /** Delete a run and its events. */
  abstract deleteRun(runId: string): Promise<void>;

  /** Delete runs matching a retention/cleanup filter. Returns the number of deleted runs. */
  abstract deleteRuns(filter: AgentRunDeleteFilter): Promise<number>;
}
