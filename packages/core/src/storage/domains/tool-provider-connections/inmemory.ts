import type {
  StorageDeleteToolProviderConnectionInput,
  StorageListToolProviderConnectionsInput,
  StorageToolProviderConnection,
  StorageToolProviderConnectionKey,
  StorageUpsertToolProviderConnectionInput,
} from '../../types';
import type { InMemoryDB } from '../inmemory-db';
import { ToolProviderConnectionsStorage } from './base';

/** Build the composite key used by the in-memory tool-provider-connections Map. */
function connKey(authorId: string, providerId: string, connectionId: string): string {
  return `${authorId}\u0000${providerId}\u0000${connectionId}`;
}

/**
 * In-memory implementation of ToolProviderConnectionsStorage. Backed by the
 * shared InMemoryDB Map so tests can clear and inspect rows alongside other
 * domains.
 *
 * Atomicity is provided by the JavaScript single-threaded event loop.
 */
export class InMemoryToolProviderConnectionsStorage extends ToolProviderConnectionsStorage {
  private db: InMemoryDB;

  constructor({ db }: { db: InMemoryDB }) {
    super();
    this.db = db;
  }

  async init(): Promise<void> {
    // No-op for in-memory store.
  }

  async dangerouslyClearAll(): Promise<void> {
    this.db.toolProviderConnections.clear();
  }

  async getConnectionById({
    authorId,
    providerId,
    connectionId,
  }: StorageToolProviderConnectionKey): Promise<StorageToolProviderConnection | null> {
    return this.db.toolProviderConnections.get(connKey(authorId, providerId, connectionId)) ?? null;
  }

  async upsertConnection(input: StorageUpsertToolProviderConnectionInput): Promise<StorageToolProviderConnection> {
    const key = connKey(input.authorId, input.providerId, input.connectionId);
    const existing = this.db.toolProviderConnections.get(key);
    const now = new Date();
    const row: StorageToolProviderConnection = {
      authorId: input.authorId,
      providerId: input.providerId,
      toolkit: input.toolkit,
      connectionId: input.connectionId,
      label: input.label,
      scope: input.scope ?? existing?.scope ?? 'per-author',
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    };
    this.db.toolProviderConnections.set(key, row);
    return row;
  }

  async listConnectionsByAuthor({
    authorId,
    providerId,
    toolkit,
    scope,
  }: StorageListToolProviderConnectionsInput): Promise<StorageToolProviderConnection[]> {
    const rows: StorageToolProviderConnection[] = [];
    for (const row of this.db.toolProviderConnections.values()) {
      if (authorId !== undefined && row.authorId !== authorId) continue;
      if (providerId && row.providerId !== providerId) continue;
      if (toolkit && row.toolkit !== toolkit) continue;
      if (scope && row.scope !== scope) continue;
      rows.push(row);
    }
    return rows;
  }

  async deleteConnection({
    authorId,
    providerId,
    connectionId,
  }: StorageDeleteToolProviderConnectionInput): Promise<void> {
    this.db.toolProviderConnections.delete(connKey(authorId, providerId, connectionId));
  }
}
