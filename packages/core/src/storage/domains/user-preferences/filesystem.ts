import type { FilesystemDB } from '../../filesystem-db';
import type {
  StorageUpdateUserPreferencesInput,
  StorageUserPreferencesAgentStudio,
  StorageUserPreferencesType,
} from '../../types';
import { UserPreferencesStorage } from './base';

const FILE_NAME = 'user-preferences.json';

export class FilesystemUserPreferencesStorage extends UserPreferencesStorage {
  private db: FilesystemDB;

  constructor({ db }: { db: FilesystemDB }) {
    super();
    this.db = db;
  }

  override async init(): Promise<void> {
    await this.db.init();
  }

  async dangerouslyClearAll(): Promise<void> {
    this.db.clearDomain(FILE_NAME);
  }

  async get(userId: string): Promise<StorageUserPreferencesType | null> {
    await this.init();
    const data = this.db.readDomain<StorageUserPreferencesType>(FILE_NAME);
    const record = data[userId];
    return record ? structuredClone(record) : null;
  }

  async update(userId: string, patch: StorageUpdateUserPreferencesInput): Promise<StorageUserPreferencesType> {
    await this.init();
    const data = this.db.readDomain<StorageUserPreferencesType>(FILE_NAME);
    const existing = data[userId];
    const now = new Date();

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

    data[userId] = merged;
    this.db.writeDomain(FILE_NAME, data);
    return structuredClone(merged);
  }

  async delete(userId: string): Promise<void> {
    await this.init();
    const data = this.db.readDomain<StorageUserPreferencesType>(FILE_NAME);
    if (userId in data) {
      delete data[userId];
      this.db.writeDomain(FILE_NAME, data);
    }
  }
}

function mergeAgentStudio(
  existing: StorageUserPreferencesAgentStudio,
  patch: Partial<StorageUserPreferencesAgentStudio> | undefined,
): StorageUserPreferencesAgentStudio {
  if (!patch) return { ...existing };
  return { ...existing, ...patch };
}
