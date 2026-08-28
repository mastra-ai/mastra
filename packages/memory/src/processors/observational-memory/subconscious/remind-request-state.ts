export const REMINDER_TURN_DEADLINE_MS = 120_000;

export type RemindRequestFailureStatus =
  | 'timed_out'
  | 'model_failed'
  | 'aborted'
  | 'delivery_failed'
  | 'delivery_unknown';
export type RemindRequestStatus =
  | 'pending'
  | 'partial_sending'
  | 'terminal_sending'
  | 'replied'
  | RemindRequestFailureStatus;

export type RemindConversation = {
  remindThreadId: string;
  resourceId: string;
};

export type RemindRequestActivity = {
  timestamp: number;
  toolName: string;
  action: string;
  status: 'started' | 'completed' | 'failed';
};

export type RemindRequestRecord = {
  correlationId: string;
  conversation: RemindConversation;
  sourceAgentId: string;
  sourceThreadId: string;
  sourceResourceId: string;
  createdAt: number;
  deadlineAt: number;
  status: RemindRequestStatus;
  partialSequence: number;
  recentActivity: RemindRequestActivity[];
  partialSignalId?: string;
  terminalSequence?: number;
  terminalSignalId?: string;
  terminalAt?: number;
  failure?: { status: RemindRequestFailureStatus; message: string };
};

export type RemindCheckpointStatus = 'pending' | 'completed' | 'aborted' | 'failed' | 'timeout' | 'unknown';

export type RemindRequestCheckpoint = {
  correlationId: string;
  status: RemindCheckpointStatus;
  partialSequence: number;
  createdAt?: number;
  deadlineAt?: number;
  terminalAt?: number;
  recentActivity: RemindRequestActivity[];
};

export type RemindPartialReservation =
  | { outcome: 'reserved'; record: RemindRequestRecord; sequence: number; signalId: string }
  | {
      outcome: 'rejected';
      reason: 'unknown' | 'wrong_conversation' | 'in_progress' | 'terminal';
      record?: RemindRequestRecord;
    };

export type RemindTerminalReservation =
  | { outcome: 'reserved'; record: RemindRequestRecord }
  | { outcome: 'duplicate'; record: RemindRequestRecord }
  | {
      outcome: 'rejected';
      reason: 'unknown' | 'wrong_conversation' | 'in_progress' | 'terminal';
      record?: RemindRequestRecord;
    };

function sameConversation(a: RemindConversation, b: RemindConversation): boolean {
  return a.remindThreadId === b.remindThreadId && a.resourceId === b.resourceId;
}

export class RemindRequestRegistry {
  readonly #entries = new Map<string, RemindRequestRecord>();
  readonly #deadlineTimers = new Map<string, ReturnType<typeof setTimeout>>();
  readonly #terminalOrder: string[] = [];
  readonly #deadlineMs: number;
  readonly #maxTerminalEntries: number;
  readonly #maxActivityEntries: number;

  constructor(options: { deadlineMs?: number; maxTerminalEntries?: number; maxActivityEntries?: number } = {}) {
    this.#deadlineMs = options.deadlineMs ?? REMINDER_TURN_DEADLINE_MS;
    this.#maxTerminalEntries = options.maxTerminalEntries ?? 1_000;
    this.#maxActivityEntries = options.maxActivityEntries ?? 12;
  }

  create(args: {
    correlationId: string;
    conversation: RemindConversation;
    sourceAgentId: string;
    sourceThreadId: string;
    sourceResourceId: string;
    deadlineMs?: number;
    now?: number;
  }): RemindRequestRecord {
    if (this.#entries.has(args.correlationId)) {
      throw new Error(`Remind request ${args.correlationId} already exists`);
    }

    const createdAt = args.now ?? Date.now();
    const deadlineMs = args.deadlineMs ?? this.#deadlineMs;
    const record: RemindRequestRecord = {
      correlationId: args.correlationId,
      conversation: { ...args.conversation },
      sourceAgentId: args.sourceAgentId,
      sourceThreadId: args.sourceThreadId,
      sourceResourceId: args.sourceResourceId,
      createdAt,
      deadlineAt: createdAt + deadlineMs,
      status: 'pending',
      partialSequence: 0,
      recentActivity: [],
    };
    this.#entries.set(args.correlationId, record);
    this.#armDeadline(record);
    return record;
  }

  get(correlationId: string): RemindRequestRecord | undefined {
    return this.#entries.get(correlationId);
  }

  openCorrelationIds(conversation: RemindConversation): string[] {
    return [...this.#entries.values()]
      .filter(
        record =>
          sameConversation(record.conversation, conversation) &&
          (record.status === 'pending' || record.status === 'partial_sending' || record.status === 'terminal_sending'),
      )
      .map(record => record.correlationId);
  }

  recordActivity(
    correlationId: string,
    activity: Omit<RemindRequestActivity, 'timestamp'> & { timestamp?: number },
  ): void {
    const record = this.#entries.get(correlationId);
    if (!record) return;
    record.recentActivity.push({ ...activity, timestamp: activity.timestamp ?? Date.now() });
    record.recentActivity = record.recentActivity.slice(-this.#maxActivityEntries);
  }

  checkpoint(
    correlationIds: readonly string[],
    timedOut = false,
    source?: { agentId: string; threadId: string; resourceId: string },
  ): {
    requests: RemindRequestCheckpoint[];
    outstanding: boolean;
    outstandingCorrelationIds: string[];
  } {
    const requests: RemindRequestCheckpoint[] = correlationIds.map(correlationId => {
      const record = this.#entries.get(correlationId);
      if (
        !record ||
        (source &&
          (record.sourceAgentId !== source.agentId ||
            record.sourceThreadId !== source.threadId ||
            record.sourceResourceId !== source.resourceId))
      ) {
        return { correlationId, status: 'unknown', partialSequence: 0, recentActivity: [] };
      }
      const pending =
        record.status === 'pending' || record.status === 'partial_sending' || record.status === 'terminal_sending';
      const status: RemindCheckpointStatus = pending
        ? timedOut
          ? 'timeout'
          : 'pending'
        : record.status === 'replied'
          ? 'completed'
          : record.status === 'aborted'
            ? 'aborted'
            : 'failed';
      return {
        correlationId,
        status,
        partialSequence: record.partialSequence,
        createdAt: record.createdAt,
        deadlineAt: record.deadlineAt,
        terminalAt: record.terminalAt,
        recentActivity: record.recentActivity.map(activity => ({ ...activity })),
      };
    });
    const outstandingCorrelationIds = requests
      .filter(request => request.status === 'pending' || request.status === 'timeout')
      .map(request => request.correlationId);
    return {
      requests,
      outstanding: outstandingCorrelationIds.length > 0,
      outstandingCorrelationIds,
    };
  }

  reservePartial(correlationId: string, conversation: RemindConversation): RemindPartialReservation {
    const record = this.#entries.get(correlationId);
    if (!record) return { outcome: 'rejected', reason: 'unknown' };
    if (!sameConversation(record.conversation, conversation)) {
      return { outcome: 'rejected', reason: 'wrong_conversation', record };
    }
    if (record.status === 'partial_sending' || record.status === 'terminal_sending') {
      return { outcome: 'rejected', reason: 'in_progress', record };
    }
    if (record.status !== 'pending') return { outcome: 'rejected', reason: 'terminal', record };

    const sequence = record.partialSequence + 1;
    const signalId = `remind-answer:${correlationId}:partial:${sequence}`;
    record.status = 'partial_sending';
    record.partialSignalId = signalId;
    return { outcome: 'reserved', record, sequence, signalId };
  }

  markPartialDelivered(correlationId: string, sequence: number): void {
    const record = this.#entries.get(correlationId);
    if (!record || record.status !== 'partial_sending' || record.partialSequence + 1 !== sequence) return;
    record.partialSequence = sequence;
    record.partialSignalId = undefined;
    record.status = 'pending';
  }

  reserveTerminal(correlationId: string, conversation: RemindConversation): RemindTerminalReservation {
    const record = this.#entries.get(correlationId);
    if (!record) return { outcome: 'rejected', reason: 'unknown' };
    if (!sameConversation(record.conversation, conversation)) {
      return { outcome: 'rejected', reason: 'wrong_conversation', record };
    }
    if (record.status === 'terminal_sending' || record.status === 'replied') {
      return { outcome: 'duplicate', record };
    }
    if (record.status === 'partial_sending') return { outcome: 'rejected', reason: 'in_progress', record };
    if (record.status !== 'pending') return { outcome: 'rejected', reason: 'terminal', record };
    if (Date.now() >= record.deadlineAt) {
      this.fail(
        correlationId,
        'timed_out',
        `Memory question timed out after ${record.deadlineAt - record.createdAt}ms`,
      );
      return { outcome: 'rejected', reason: 'terminal', record };
    }

    record.status = 'terminal_sending';
    record.terminalSequence = record.partialSequence + 1;
    record.terminalSignalId = `remind-answer:${correlationId}:terminal`;
    return { outcome: 'reserved', record };
  }

  markReplied(correlationId: string): void {
    const record = this.#entries.get(correlationId);
    if (!record || record.status !== 'terminal_sending') return;
    record.status = 'replied';
    record.terminalAt = Date.now();
    this.#clearDeadline(correlationId);
    this.#retainTerminal(correlationId);
  }

  fail(correlationId: string, status: RemindRequestFailureStatus, message: string): void {
    const record = this.#entries.get(correlationId);
    if (
      !record ||
      (record.status !== 'pending' && record.status !== 'partial_sending' && record.status !== 'terminal_sending')
    ) {
      return;
    }
    record.status = status;
    record.terminalAt = Date.now();
    record.failure = { status, message };
    this.#clearDeadline(correlationId);
    this.#retainTerminal(correlationId);
  }

  dispose(): void {
    for (const timer of this.#deadlineTimers.values()) clearTimeout(timer);
    this.#deadlineTimers.clear();
    this.#terminalOrder.length = 0;
    this.#entries.clear();
  }

  #retainTerminal(correlationId: string): void {
    this.#terminalOrder.push(correlationId);
    while (this.#terminalOrder.length > this.#maxTerminalEntries) {
      const expiredCorrelationId = this.#terminalOrder.shift();
      if (expiredCorrelationId) this.#entries.delete(expiredCorrelationId);
    }
  }

  #armDeadline(record: RemindRequestRecord): void {
    this.#clearDeadline(record.correlationId);
    const remainingMs = Math.max(0, record.deadlineAt - Date.now());
    const timer = setTimeout(() => {
      this.fail(
        record.correlationId,
        'timed_out',
        `Memory question timed out after ${record.deadlineAt - record.createdAt}ms`,
      );
    }, remainingMs);
    timer.unref?.();
    this.#deadlineTimers.set(record.correlationId, timer);
  }

  #clearDeadline(correlationId: string): void {
    const timer = this.#deadlineTimers.get(correlationId);
    if (timer) clearTimeout(timer);
    this.#deadlineTimers.delete(correlationId);
  }
}
