import type {
  StorageUpdateUserPreferencesInput,
  StorageUserPreferencesAgentStudio,
  StorageUserPreferencesType,
} from '../../types';
import type { InMemoryDB } from '../inmemory-db';
import { UserPreferencesStorage } from './base';

export class InMemoryUserPreferencesStorage extends UserPreferencesStorage {
  private db: InMemoryDB;

  constructor({ db }: { db: InMemoryDB }) {
    super();
    this.db = db;
  }

  async dangerouslyClearAll(): Promise<void> {
    this.db.userPreferences.clear();
  }

  async get(userId: string): Promise<StorageUserPreferencesType | null> {
    const record = this.db.userPreferences.get(userId);
    return record ? clone(record) : null;
  }

  async update(userId: string, patch: StorageUpdateUserPreferencesInput): Promise<StorageUserPreferencesType> {
    const now = new Date();
    const existing = this.db.userPreferences.get(userId);

    const merged: StorageUserPreferencesType = existing
      ? {
          ...existing,
          agentStudio: mergeAgentStudio(existing.agentStudio, patch.agentStudio),
          metadata:
            patch.metadata !== undefined ? { ...(existing.metadata ?? {}), ...patch.metadata } : existing.metadata,
          updatedAt: now,
        }
      : {
          userId,
          agentStudio: mergeAgentStudio({}, patch.agentStudio),
          metadata: patch.metadata,
          createdAt: now,
          updatedAt: now,
        };

    this.db.userPreferences.set(userId, merged);
    return clone(merged);
  }

  async delete(userId: string): Promise<void> {
    this.db.userPreferences.delete(userId);
  }
}

function mergeAgentStudio(
  existing: StorageUserPreferencesAgentStudio,
  patch: Partial<StorageUserPreferencesAgentStudio> | undefined,
): StorageUserPreferencesAgentStudio {
  if (!patch) return { ...existing };
  return { ...existing, ...patch };
}

function clone(value: StorageUserPreferencesType): StorageUserPreferencesType {
  return structuredClone(value);
}
