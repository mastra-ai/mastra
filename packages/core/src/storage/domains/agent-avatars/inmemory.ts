import type { StorageAgentAvatarType } from '../../types';
import type { InMemoryDB } from '../inmemory-db';
import type { StoragePutAgentAvatarInput } from './base';
import { AgentAvatarsStorage } from './base';

/**
 * In-memory implementation of AgentAvatarsStorage. Backed by the shared
 * InMemoryDB so avatars clear together with the rest of the in-memory data.
 */
export class InMemoryAgentAvatarsStorage extends AgentAvatarsStorage {
  private db: InMemoryDB;

  constructor({ db }: { db: InMemoryDB }) {
    super();
    this.db = db;
  }

  async init(): Promise<void> {
    // No-op for in-memory store.
  }

  async put({ agentId, data, mime }: StoragePutAgentAvatarInput): Promise<void> {
    const existing = this.db.agentAvatars.get(agentId);
    const now = new Date();
    const row: StorageAgentAvatarType = {
      agentId,
      data,
      mime,
      sizeBytes: Buffer.byteLength(data, 'base64'),
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    };
    this.db.agentAvatars.set(agentId, row);
  }

  async get(agentId: string): Promise<StorageAgentAvatarType | null> {
    return this.db.agentAvatars.get(agentId) ?? null;
  }

  async delete(agentId: string): Promise<void> {
    this.db.agentAvatars.delete(agentId);
  }

  async dangerouslyClearAll(): Promise<void> {
    this.db.agentAvatars.clear();
  }
}
