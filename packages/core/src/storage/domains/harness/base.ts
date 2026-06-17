import { StorageDomain } from '../base';
import type { HarnessPendingItemRecord, SessionRecord, SessionRecordUpdate } from './types';

export abstract class HarnessStorage extends StorageDomain {
  constructor() {
    super({
      component: 'STORAGE',
      name: 'HARNESS',
    });
  }

  abstract loadSession(sessionId: string): Promise<SessionRecord | null>;

  abstract saveSession(record: SessionRecord): Promise<void>;

  abstract listSessions(): Promise<SessionRecord[]>;

  async updateSession(sessionId: string, updates: SessionRecordUpdate): Promise<SessionRecord> {
    const record = await this.loadSession(sessionId);
    if (!record) {
      throw new Error(`Harness session "${sessionId}" was not found`);
    }

    const next: SessionRecord = {
      ...record,
      ...updates,
      id: record.id,
      createdAt: record.createdAt,
      lastActivityAt: updates.lastActivityAt ?? new Date(),
    };
    await this.saveSession(next);
    return next;
  }

  async appendPendingItem(sessionId: string, item: HarnessPendingItemRecord): Promise<SessionRecord> {
    const record = await this.loadSession(sessionId);
    if (!record) {
      throw new Error(`Harness session "${sessionId}" was not found`);
    }

    if (record.pending?.some(existing => existing.id === item.id)) {
      throw new Error(`Harness pending item "${item.id}" already exists on session "${sessionId}"`);
    }

    return this.updateSession(sessionId, {
      pending: [...(record.pending ?? []), item],
    });
  }

  async updatePendingItem(
    sessionId: string,
    pendingItemId: string,
    updates: Partial<Omit<HarnessPendingItemRecord, 'id' | 'sessionId' | 'createdAt'>>,
  ): Promise<SessionRecord> {
    const record = await this.loadSession(sessionId);
    if (!record) {
      throw new Error(`Harness session "${sessionId}" was not found`);
    }

    let found = false;
    const pending = (record.pending ?? []).map(item => {
      if (item.id !== pendingItemId) return item;
      found = true;
      return {
        ...item,
        ...updates,
        id: item.id,
        sessionId: item.sessionId,
        createdAt: item.createdAt,
        updatedAt: new Date(),
      };
    });

    if (!found) {
      throw new Error(`Harness pending item "${pendingItemId}" was not found on session "${sessionId}"`);
    }

    return this.updateSession(sessionId, { pending });
  }

  async removePendingItem(sessionId: string, pendingItemId: string): Promise<SessionRecord> {
    const record = await this.loadSession(sessionId);
    if (!record) {
      throw new Error(`Harness session "${sessionId}" was not found`);
    }

    return this.updateSession(sessionId, {
      pending: (record.pending ?? []).filter(item => item.id !== pendingItemId),
    });
  }
}
