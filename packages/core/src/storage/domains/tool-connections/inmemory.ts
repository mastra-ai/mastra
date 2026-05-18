import type {
  StorageDeleteToolConnectionInput,
  StorageListToolConnectionsInput,
  StorageToolConnection,
  StorageToolConnectionKey,
  StorageUpsertToolConnectionInput,
} from '../../types';
import type { InMemoryDB } from '../inmemory-db';
import { ToolConnectionsStorage } from './base';

/** Build the composite key used by the in-memory tool-connections Map. */
function connKey(authorId: string, providerId: string, connectionId: string): string {
  return `${authorId}\u0000${providerId}\u0000${connectionId}`;
}

/**
 * In-memory implementation of ToolConnectionsStorage. Backed by the shared
 * InMemoryDB Map so tests can clear and inspect rows alongside other domains.
 *
 * Atomicity is provided by the JavaScript single-threaded event loop.
 */
export class InMemoryToolConnectionsStorage extends ToolConnectionsStorage {
  private db: InMemoryDB;

  constructor({ db }: { db: InMemoryDB }) {
    super();
    this.db = db;
  }

  async init(): Promise<void> {
    // No-op for in-memory store.
  }

  async dangerouslyClearAll(): Promise<void> {
    this.db.toolConnections.clear();
  }

  async get({ authorId, providerId, connectionId }: StorageToolConnectionKey): Promise<StorageToolConnection | null> {
    return this.db.toolConnections.get(connKey(authorId, providerId, connectionId)) ?? null;
  }

  async upsert(input: StorageUpsertToolConnectionInput): Promise<StorageToolConnection> {
    const key = connKey(input.authorId, input.providerId, input.connectionId);
    const existing = this.db.toolConnections.get(key);
    const now = new Date();
    const row: StorageToolConnection = {
      authorId: input.authorId,
      providerId: input.providerId,
      toolService: input.toolService,
      connectionId: input.connectionId,
      label: input.label,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    };
    this.db.toolConnections.set(key, row);
    return row;
  }

  async list({ authorId, providerId, toolService }: StorageListToolConnectionsInput): Promise<StorageToolConnection[]> {
    const rows: StorageToolConnection[] = [];
    for (const row of this.db.toolConnections.values()) {
      if (authorId !== undefined && row.authorId !== authorId) continue;
      if (providerId && row.providerId !== providerId) continue;
      if (toolService && row.toolService !== toolService) continue;
      rows.push(row);
    }
    return rows;
  }

  async delete({ authorId, providerId, connectionId }: StorageDeleteToolConnectionInput): Promise<void> {
    this.db.toolConnections.delete(connKey(authorId, providerId, connectionId));
  }
}
