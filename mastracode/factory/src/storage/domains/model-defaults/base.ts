import { FactoryStorageDomain, UniqueViolationError } from '@mastra/core/storage';
import type { CollectionSchema, FactoryStorageOps } from '@mastra/core/storage';

export interface ModelDefaultRecord {
  orgId: string;
  userId: string;
  modelId: string;
  updatedAt: Date;
}

export const USER_DEFAULT_MODELS_SCHEMA: CollectionSchema = {
  name: 'user_default_models',
  columns: {
    id: { type: 'uuid-pk' },
    org_id: { type: 'text' },
    user_id: { type: 'text' },
    model_id: { type: 'text' },
    updated_at: { type: 'timestamp' },
  },
  uniqueIndexes: [{ name: 'user_default_models_org_user_key', columns: ['org_id', 'user_id'] }],
};

interface ModelDefaultDbRow extends Record<string, unknown> {
  id: string;
  org_id: string;
  user_id: string;
  model_id: string;
  updated_at: Date;
}

function toRecord(row: ModelDefaultDbRow): ModelDefaultRecord {
  return {
    orgId: row.org_id,
    userId: row.user_id,
    modelId: row.model_id,
    updatedAt: row.updated_at,
  };
}

export class ModelDefaultsStorage extends FactoryStorageDomain {
  constructor() {
    super('model-defaults');
  }

  async init(): Promise<void> {
    await this.ensureCollections([USER_DEFAULT_MODELS_SCHEMA]);
  }

  async dangerouslyClearAll(): Promise<void> {
    await this.ops.deleteMany('user_default_models', {});
  }

  get #db(): FactoryStorageOps {
    return this.ops;
  }

  async get({ orgId, userId }: { orgId: string; userId: string }): Promise<ModelDefaultRecord | null> {
    const row = await this.#db.findOne<ModelDefaultDbRow>('user_default_models', {
      org_id: orgId,
      user_id: userId,
    });
    return row ? toRecord(row) : null;
  }

  async set({
    orgId,
    userId,
    modelId,
  }: {
    orgId: string;
    userId: string;
    modelId: string;
  }): Promise<ModelDefaultRecord> {
    const now = new Date();
    const values = { model_id: modelId, updated_at: now };
    const updateExisting = () =>
      this.#db.updateAtomic<ModelDefaultDbRow>('user_default_models', { org_id: orgId, user_id: userId }, () => values);

    const updated = await updateExisting();
    if (updated) return toRecord(updated);

    try {
      return toRecord(
        await this.#db.insertOne<ModelDefaultDbRow>('user_default_models', {
          org_id: orgId,
          user_id: userId,
          ...values,
        }),
      );
    } catch (error) {
      if (!(error instanceof UniqueViolationError)) throw error;
      const row = await updateExisting();
      if (!row) throw error;
      return toRecord(row);
    }
  }

  async clear({ orgId, userId }: { orgId: string; userId: string }): Promise<boolean> {
    return (await this.#db.deleteMany('user_default_models', { org_id: orgId, user_id: userId })) > 0;
  }
}
