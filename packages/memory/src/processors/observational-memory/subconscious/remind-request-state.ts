export const REMINDER_TURN_DEADLINE_MS = 120_000;

export type RemindRequestFailureStatus =
  | 'timed_out'
  | 'model_failed'
  | 'aborted'
  | 'delivery_failed'
  | 'delivery_unknown';
export type RemindRequestStatus = 'pending' | 'terminal_sending' | 'replied' | RemindRequestFailureStatus;

export type RemindConversation = {
  remindThreadId: string;
  resourceId: string;
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
  terminalSequence?: number;
  terminalSignalId?: string;
  terminalAt?: number;
  failure?: { status: RemindRequestFailureStatus; message: string };
};

export type RemindTerminalReservation =
  | { outcome: 'reserved'; record: RemindRequestRecord }
  | { outcome: 'duplicate'; record: RemindRequestRecord }
  | { outcome: 'rejected'; reason: 'unknown' | 'wrong_conversation' | 'terminal'; record?: RemindRequestRecord };

function sameConversation(a: RemindConversation, b: RemindConversation): boolean {
  return a.remindThreadId === b.remindThreadId && a.resourceId === b.resourceId;
}

export class RemindRequestRegistry {
  readonly #entries = new Map<string, RemindRequestRecord>();
  readonly #deadlineTimers = new Map<string, ReturnType<typeof setTimeout>>();
  readonly #terminalOrder: string[] = [];
  readonly #deadlineMs: number;
  readonly #maxTerminalEntries: number;

  constructor(options: { deadlineMs?: number; maxTerminalEntries?: number } = {}) {
    this.#deadlineMs = options.deadlineMs ?? REMINDER_TURN_DEADLINE_MS;
    this.#maxTerminalEntries = options.maxTerminalEntries ?? 1_000;
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
    };
    this.#entries.set(args.correlationId, record);

    const timer = setTimeout(() => {
      this.fail(args.correlationId, 'timed_out', `Memory question timed out after ${deadlineMs}ms`);
    }, deadlineMs);
    timer.unref?.();
    this.#deadlineTimers.set(args.correlationId, timer);
    return record;
  }

  get(correlationId: string): RemindRequestRecord | undefined {
    return this.#entries.get(correlationId);
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
    if (record.status !== 'pending') return { outcome: 'rejected', reason: 'terminal', record };

    record.status = 'terminal_sending';
    record.terminalSequence = 1;
    record.terminalSignalId = `remind-answer:${correlationId}:terminal`;
    this.#clearDeadline(correlationId);
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
    if (!record || (record.status !== 'pending' && record.status !== 'terminal_sending')) return;
    if (status === 'timed_out' && record.status === 'terminal_sending') return;
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

  #clearDeadline(correlationId: string): void {
    const timer = this.#deadlineTimers.get(correlationId);
    if (timer) clearTimeout(timer);
    this.#deadlineTimers.delete(correlationId);
  }
}
