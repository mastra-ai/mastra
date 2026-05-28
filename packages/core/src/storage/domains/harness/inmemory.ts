import { HarnessStorage } from './base';
import type { SessionRecord } from './types';

export class InMemoryHarness extends HarnessStorage {
  readonly #sessions = new Map<string, SessionRecord>();

  async dangerouslyClearAll(): Promise<void> {
    this.#sessions.clear();
  }

  async loadSession(sessionId: string): Promise<SessionRecord | null> {
    return this.#sessions.get(sessionId) ?? null;
  }

  async saveSession(record: SessionRecord): Promise<void> {
    this.#sessions.set(record.id, record);
  }

  async listSessions(): Promise<SessionRecord[]> {
    return [...this.#sessions.values()];
  }
}
