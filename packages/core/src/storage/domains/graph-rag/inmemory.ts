import type { InMemoryDB } from '../inmemory-db';
import type { StorageGraphRAGEntry } from './base';
import { GraphRAGStorage } from './base';

export class GraphRAGInMemory extends GraphRAGStorage {
  private db: InMemoryDB;

  constructor({ db }: { db: InMemoryDB }) {
    super();
    this.db = db;
  }

  async dangerouslyClearAll(): Promise<void> {
    this.db.graphs.clear();
  }

  async saveGraph({ graphId, data }: { graphId: string; data: Record<string, unknown> }): Promise<void> {
    const now = new Date();
    const existing = this.db.graphs.get(graphId);
    this.db.graphs.set(graphId, {
      graphId,
      data,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    });
  }

  async loadGraph({ graphId }: { graphId: string }): Promise<Record<string, unknown> | null> {
    const entry = this.db.graphs.get(graphId);
    if (!entry) return null;
    return JSON.parse(JSON.stringify(entry.data));
  }

  async deleteGraph({ graphId }: { graphId: string }): Promise<void> {
    this.db.graphs.delete(graphId);
  }

  async listGraphs(): Promise<StorageGraphRAGEntry[]> {
    return Array.from(this.db.graphs.values()).map(entry => ({
      ...entry,
      createdAt: new Date(entry.createdAt),
      updatedAt: new Date(entry.updatedAt),
    }));
  }
}
