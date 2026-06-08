import { HarnessStorage } from './base';
import type { SessionRecord } from './types';

function cloneSessionRecord(record: SessionRecord): SessionRecord {
  return {
    ...record,
    createdAt: new Date(record.createdAt),
    lastActivityAt: new Date(record.lastActivityAt),
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
}
