import { HarnessStorage } from './base';
import type { HarnessPendingItemRecord, SessionRecord, SessionRecordUpdate } from './types';

function clonePendingItemRecord(item: HarnessPendingItemRecord): HarnessPendingItemRecord {
  return {
    ...item,
    createdAt: new Date(item.createdAt),
    updatedAt: new Date(item.updatedAt),
    payload: item.payload ? structuredClone(item.payload) : undefined,
    response: item.response ? structuredClone(item.response) : undefined,
  };
}

function cloneSessionRecord(record: SessionRecord): SessionRecord {
  return {
    ...record,
    source: record.source ? { ...record.source } : undefined,
    metadata: record.metadata ? structuredClone(record.metadata) : undefined,
    state: record.state ? structuredClone(record.state) : undefined,
    pending: record.pending ? record.pending.map(clonePendingItemRecord) : undefined,
    createdAt: new Date(record.createdAt),
    lastActivityAt: new Date(record.lastActivityAt),
    closingAt: record.closingAt ? new Date(record.closingAt) : record.closingAt,
    closeDeadlineAt: record.closeDeadlineAt ? new Date(record.closeDeadlineAt) : record.closeDeadlineAt,
    closedAt: record.closedAt ? new Date(record.closedAt) : record.closedAt,
    deletedAt: record.deletedAt ? new Date(record.deletedAt) : record.deletedAt,
  };
}

export class InMemoryHarness extends HarnessStorage {
  readonly #sessions = new Map<string, SessionRecord>();

  async dangerouslyClearAll(): Promise<void> {
    this.#sessions.clear();
  }

  async loadSession(sessionId: string): Promise<SessionRecord | null> {
    const record = this.#sessions.get(sessionId);
    return record ? cloneSessionRecord(record) : null;
  }

  async saveSession(record: SessionRecord): Promise<void> {
    this.#sessions.set(record.id, cloneSessionRecord(record));
  }

  async listSessions(): Promise<SessionRecord[]> {
    return [...this.#sessions.values()].map(cloneSessionRecord);
  }

  override async updateSession(sessionId: string, updates: SessionRecordUpdate): Promise<SessionRecord> {
    const record = this.#sessions.get(sessionId);
    if (!record) {
      throw new Error(`Harness session "${sessionId}" was not found`);
    }

    const next = cloneSessionRecord({
      ...record,
      ...updates,
      id: record.id,
      createdAt: record.createdAt,
      lastActivityAt: updates.lastActivityAt ?? new Date(),
    });
    this.#sessions.set(sessionId, next);
    return cloneSessionRecord(next);
  }
}
