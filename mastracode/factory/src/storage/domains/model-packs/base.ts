import { FactoryStorageDomain } from '@mastra/core/storage';
import type { CollectionSchema, FactoryStorageOps } from '@mastra/core/storage';

/** A saved custom model pack: one model per mode (build / plan / fast). */
export interface ModelPackRecord {
  id: string;
  orgId: string;
  createdBy: string;
  name: string;
  models: { build: string; plan: string; fast: string };
  createdAt: Date;
  updatedAt: Date;
}

export interface UpsertModelPackInput {
  name: string;
  models: { build: string; plan: string; fast: string };
}

export const MODEL_PACKS_SCHEMA: CollectionSchema = {
  name: 'model_packs',
  columns: {
    id: { type: 'uuid-pk' },
    org_id: { type: 'text' },
    created_by: { type: 'text' },
    name: { type: 'text' },
    build_model_id: { type: 'text' },
    plan_model_id: { type: 'text' },
    fast_model_id: { type: 'text' },
    created_at: { type: 'timestamp' },
    updated_at: { type: 'timestamp' },
  },
  indexes: [{ name: 'model_packs_org_name_idx', columns: ['org_id', 'name'] }],
};

interface ModelPackDbRow extends Record<string, unknown> {
  id: string;
  org_id: string;
  created_by: string;
  name: string;
  build_model_id: string;
  plan_model_id: string;
  fast_model_id: string;
  created_at: Date;
  updated_at: Date;
}

function toModelPack(row: ModelPackDbRow): ModelPackRecord {
  return {
    id: row.id,
    orgId: row.org_id,
    createdBy: row.created_by,
    name: row.name,
    models: { build: row.build_model_id, plan: row.plan_model_id, fast: row.fast_model_id },
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export class ModelPacksStorage extends FactoryStorageDomain {
  constructor() {
    super('model-packs');
  }

  async init(): Promise<void> {
    await this.ensureCollections([MODEL_PACKS_SCHEMA]);
  }

  async dangerouslyClearAll(): Promise<void> {
    await this.ops.deleteMany('model_packs', {});
  }

  get #db(): FactoryStorageOps {
    return this.ops;
  }

  /** Create or replace a pack by `(orgId, name)` — mirrors the settings.json upsert semantics. */
  async upsert({
    orgId,
    userId,
    input,
  }: {
    orgId: string;
    userId: string;
    input: UpsertModelPackInput;
  }): Promise<ModelPackRecord> {
    const now = new Date();
    const existing = await this.#db.findOne<ModelPackDbRow>('model_packs', { org_id: orgId, name: input.name });
    if (existing) {
      const row = await this.#db.updateAtomic<ModelPackDbRow>(
        'model_packs',
        { org_id: orgId, id: existing.id },
        () => ({
          build_model_id: input.models.build,
          plan_model_id: input.models.plan,
          fast_model_id: input.models.fast,
          updated_at: now,
        }),
      );
      return toModelPack(row ?? existing);
    }
    const row = await this.#db.insertOne<ModelPackDbRow>('model_packs', {
      org_id: orgId,
      created_by: userId,
      name: input.name,
      build_model_id: input.models.build,
      plan_model_id: input.models.plan,
      fast_model_id: input.models.fast,
      created_at: now,
      updated_at: now,
    });
    return toModelPack(row);
  }

  async list({ orgId }: { orgId: string }): Promise<ModelPackRecord[]> {
    const rows = await this.#db.findMany<ModelPackDbRow>(
      'model_packs',
      { org_id: orgId },
      { orderBy: [['name', 'asc']] },
    );
    return rows.map(toModelPack);
  }

  async get({ orgId, id }: { orgId: string; id: string }): Promise<ModelPackRecord | null> {
    const row = await this.#db.findOne<ModelPackDbRow>('model_packs', { org_id: orgId, id });
    return row ? toModelPack(row) : null;
  }

  async delete({ orgId, id }: { orgId: string; id: string }): Promise<boolean> {
    return (await this.#db.deleteMany('model_packs', { org_id: orgId, id })) > 0;
  }
}
