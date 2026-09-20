import { FactoryStorageDomain, UniqueViolationError } from '@mastra/core/storage';
import type { CollectionSchema, FactoryStorageOps } from '@mastra/core/storage';

/**
 * Where one platform connection's knowledge imports go. `mode: 'all'` (the
 * default when no row exists) syncs into every Factory project; `'selected'`
 * restricts the sync to the listed project ids. One row per connection —
 * platform connection ids are globally unique, so the connection id alone
 * keys the row; `org_id` is kept for tenancy-scoped listing and audit.
 */
export interface KnowledgeImporterRoutingRecord {
  orgId: string;
  connectionId: string;
  integrationId: string;
  mode: 'all' | 'selected';
  projectIds: string[];
  createdAt: Date;
  updatedAt: Date;
}

export const KNOWLEDGE_IMPORTER_ROUTING_SCHEMA: CollectionSchema = {
  name: 'knowledge_importer_routing',
  columns: {
    id: { type: 'uuid-pk' },
    org_id: { type: 'text' },
    connection_id: { type: 'text' },
    integration_id: { type: 'text' },
    mode: { type: 'text' },
    project_ids: { type: 'json' },
    created_at: { type: 'timestamp' },
    updated_at: { type: 'timestamp' },
  },
  uniqueIndexes: [{ name: 'knowledge_importer_routing_connection_key', columns: ['connection_id'] }],
  indexes: [{ name: 'knowledge_importer_routing_org_idx', columns: ['org_id'] }],
};

interface RoutingDbRow extends Record<string, unknown> {
  id: string;
  org_id: string;
  connection_id: string;
  integration_id: string;
  mode: 'all' | 'selected';
  project_ids: string[];
  created_at: Date;
  updated_at: Date;
}

function toRecord(row: RoutingDbRow): KnowledgeImporterRoutingRecord {
  return {
    orgId: row.org_id,
    connectionId: row.connection_id,
    integrationId: row.integration_id,
    mode: row.mode,
    projectIds: row.project_ids ?? [],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export class KnowledgeImporterRoutingStorage extends FactoryStorageDomain {
  constructor() {
    super('importer-routing');
  }

  async init(): Promise<void> {
    await this.ensureCollections([KNOWLEDGE_IMPORTER_ROUTING_SCHEMA]);
  }

  async dangerouslyClearAll(): Promise<void> {
    await this.ops.deleteMany('knowledge_importer_routing', {});
  }

  get #db(): FactoryStorageOps {
    return this.ops;
  }

  /** The connection's routing, or `null` when never saved (treat as `mode: 'all'`). */
  async get(connectionId: string): Promise<KnowledgeImporterRoutingRecord | null> {
    const row = await this.#db.findOne<RoutingDbRow>('knowledge_importer_routing', { connection_id: connectionId });
    return row ? toRecord(row) : null;
  }

  /** Upsert the connection's routing (concurrent first writes resolved via insert-then-catch). */
  async set(input: {
    orgId: string;
    connectionId: string;
    integrationId: string;
    mode: 'all' | 'selected';
    projectIds: string[];
  }): Promise<KnowledgeImporterRoutingRecord> {
    const now = new Date();
    const columns: Partial<RoutingDbRow> = {
      org_id: input.orgId,
      integration_id: input.integrationId,
      mode: input.mode,
      project_ids: input.projectIds,
      updated_at: now,
    };
    const updateExisting = () =>
      this.#db.updateAtomic<RoutingDbRow>(
        'knowledge_importer_routing',
        { connection_id: input.connectionId },
        () => columns,
      );

    const updated = await updateExisting();
    if (updated) return toRecord(updated);

    try {
      const row = await this.#db.insertOne<RoutingDbRow>('knowledge_importer_routing', {
        connection_id: input.connectionId,
        ...columns,
        created_at: now,
      });
      return toRecord(row);
    } catch (error) {
      if (!(error instanceof UniqueViolationError)) throw error;
      const row = await updateExisting();
      if (!row) throw error;
      return toRecord(row);
    }
  }
}
