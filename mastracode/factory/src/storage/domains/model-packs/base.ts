import { FactoryStorageDomain, UniqueViolationError } from '@mastra/core/storage';
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

export interface ActiveModelPackRecord {
  orgId: string;
  userId: string;
  packId: string;
  models: { build: string; plan: string; fast: string };
  updatedAt: Date;
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

export const ACTIVE_MODEL_PACKS_SCHEMA: CollectionSchema = {
  name: 'active_model_packs',
  columns: {
    id: { type: 'uuid-pk' },
    org_id: { type: 'text' },
    user_id: { type: 'text' },
    pack_id: { type: 'text' },
    build_model_id: { type: 'text' },
    plan_model_id: { type: 'text' },
    fast_model_id: { type: 'text' },
    updated_at: { type: 'timestamp' },
  },
  uniqueIndexes: [{ name: 'active_model_packs_org_user_key', columns: ['org_id', 'user_id'] }],
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

interface ActiveModelPackDbRow extends Record<string, unknown> {
  id: string;
  org_id: string;
  user_id: string;
  pack_id: string;
  build_model_id: string;
  plan_model_id: string;
  fast_model_id: string;
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

function toActiveModelPack(row: ActiveModelPackDbRow): ActiveModelPackRecord {
  return {
    orgId: row.org_id,
    userId: row.user_id,
    packId: row.pack_id,
    models: { build: row.build_model_id, plan: row.plan_model_id, fast: row.fast_model_id },
    updatedAt: row.updated_at,
  };
}

export class ModelPacksStorage extends FactoryStorageDomain {
  constructor() {
    super('model-packs');
  }

  async init(): Promise<void> {
    await this.ensureCollections([MODEL_PACKS_SCHEMA, ACTIVE_MODEL_PACKS_SCHEMA]);
  }

  async dangerouslyClearAll(): Promise<void> {
    await this.ops.deleteMany('active_model_packs', {});
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
      await this.#db.updateMany(
        'active_model_packs',
        { org_id: orgId, pack_id: `custom:${existing.id}` },
        {
          build_model_id: input.models.build,
          plan_model_id: input.models.plan,
          fast_model_id: input.models.fast,
          updated_at: now,
        },
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

  async setActive({
    orgId,
    userId,
    packId,
    models,
  }: {
    orgId: string;
    userId: string;
    packId: string;
    models: ActiveModelPackRecord['models'];
  }): Promise<ActiveModelPackRecord> {
    const now = new Date();
    const values = {
      pack_id: packId,
      build_model_id: models.build,
      plan_model_id: models.plan,
      fast_model_id: models.fast,
      updated_at: now,
    };
    const updateExisting = () =>
      this.#db.updateAtomic<ActiveModelPackDbRow>(
        'active_model_packs',
        { org_id: orgId, user_id: userId },
        () => values,
      );

    const updated = await updateExisting();
    if (updated) return toActiveModelPack(updated);

    try {
      return toActiveModelPack(
        await this.#db.insertOne<ActiveModelPackDbRow>('active_model_packs', {
          org_id: orgId,
          user_id: userId,
          ...values,
        }),
      );
    } catch (error) {
      if (!(error instanceof UniqueViolationError)) throw error;
      const row = await updateExisting();
      if (!row) throw error;
      return toActiveModelPack(row);
    }
  }

  async getActive({ orgId, userId }: { orgId: string; userId: string }): Promise<ActiveModelPackRecord | null> {
    const row = await this.#db.findOne<ActiveModelPackDbRow>('active_model_packs', {
      org_id: orgId,
      user_id: userId,
    });
    return row ? toActiveModelPack(row) : null;
  }

  async clearActive({ orgId, userId }: { orgId: string; userId: string }): Promise<boolean> {
    return (await this.#db.deleteMany('active_model_packs', { org_id: orgId, user_id: userId })) > 0;
  }

  async delete({ orgId, id }: { orgId: string; id: string }): Promise<boolean> {
    const deleted = (await this.#db.deleteMany('model_packs', { org_id: orgId, id })) > 0;
    if (deleted) {
      await this.#db.deleteMany('active_model_packs', { org_id: orgId, pack_id: `custom:${id}` });
    }
    return deleted;
  }
}
