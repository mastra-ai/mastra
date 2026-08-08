export type ThreadSignalRunStatus = 'idle' | 'running' | 'suspended' | 'completed' | 'failed' | 'aborted';

export interface ThreadSignalRunSnapshot {
  runId?: string;
  status: ThreadSignalRunStatus;
  updatedAt: string;
}

export interface ThreadSignalChunk {
  type: string;
  runId?: string;
  payload?: unknown;
  data?: unknown;
  [key: string]: unknown;
}

export interface ThreadSignalsClientOptions {
  baseUrl: string;
  agentId: string;
  apiPrefix?: string;
  headers?: Record<string, string>;
  credentials?: 'omit' | 'same-origin' | 'include';
  fetch?: typeof globalThis.fetch;
  abortSignal?: AbortSignal;
}

export interface ThreadTarget {
  resourceId?: string;
  threadId: string;
}

export interface ThreadMessageInput {
  message: unknown;
  resourceId?: string;
  threadId: string;
  [key: string]: unknown;
}

export interface ThreadToolApprovalInput extends ThreadTarget {
  toolCallId: string;
  approved: boolean;
  requestContext?: Record<string, unknown>;
  messages?: unknown;
  streamOptions?: Record<string, unknown>;
}

export interface ThreadMessageAccepted {
  accepted: true;
  runId: string;
  signal?: unknown;
}

export interface ThreadToolApprovalAccepted extends ThreadMessageAccepted {
  toolCallId: string;
}

export interface ThreadMessageHistoryOptions {
  resourceId?: string;
  page?: number;
  perPage?: number;
  orderBy?: Record<string, unknown>;
  filter?: Record<string, unknown>;
  include?: Record<string, unknown>;
  includeSystemReminders?: boolean;
  requestContext?: Record<string, unknown>;
}

export interface ThreadMessageHistory<TMessage = unknown> {
  messages: TMessage[];
  total: number;
  page: number;
  perPage: number;
  hasMore: boolean;
}

export interface ProcessThreadSignalsOptions {
  onChunk: (chunk: ThreadSignalChunk) => void | Promise<void>;
  onSnapshot?: (snapshot: ThreadSignalRunSnapshot) => void | Promise<void>;
  reconnect?:
    | boolean
    | {
        maxRetries?: number;
        delayMs?: number;
      };
}

export interface ThreadSignalsSubscription {
  readonly snapshot: ThreadSignalRunSnapshot;
  processDataStream(options: ProcessThreadSignalsOptions): Promise<void>;
  abort(): Promise<boolean>;
  unsubscribe(): void;
}
