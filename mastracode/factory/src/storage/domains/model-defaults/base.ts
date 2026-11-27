import { isThinkingLevelSetting } from '@mastra/code-sdk/thinking';
import type { ThinkingLevelSetting } from '@mastra/code-sdk/thinking';
import { FactoryStorageDomain, UniqueViolationError } from '@mastra/core/storage';
import type { CollectionSchema, FactoryStorageOps } from '@mastra/core/storage';

import { DEFAULT_THINKING_LEVEL } from '../../../default-thinking-level.js';
import {
  defaultModelPack,
  EMPTY_MODEL_PACK_SET,
  LEGACY_MODEL_PACK_ID,
  legacyModelPackSet,
  withDefaultModel,
} from '../../../model-packs.js';
import type { ModelPack, ModelPackSet } from '../../../model-packs.js';

export interface ModelDefaultRecord {
  orgId: string;
  userId: string;
  modelId: string;
  thinkingLevel: ThinkingLevelSetting;
  modelPacks: ModelPack[];
  defaultModelPackId: string;
  updatedAt: Date;
}

export const USER_DEFAULT_MODELS_SCHEMA: CollectionSchema = {
  name: 'user_default_models',
  columns: {
    id: { type: 'uuid-pk' },
    org_id: { type: 'text' },
    user_id: { type: 'text' },
    model_id: { type: 'text' },
    thinking_level: { type: 'text', nullable: true },
    model_packs: { type: 'json', nullable: true },
    default_model_pack_id: { type: 'text', nullable: true },
    updated_at: { type: 'timestamp' },
  },
  uniqueIndexes: [{ name: 'user_default_models_org_user_key', columns: ['org_id', 'user_id'] }],
};

interface ModelDefaultDbRow extends Record<string, unknown> {
  id: string;
  org_id: string;
  user_id: string;
  model_id: string;
  thinking_level: string | null;
  model_packs: ModelPack[] | null;
  default_model_pack_id: string | null;
  updated_at: Date;
}

type ModelPackColumns = Pick<
  ModelDefaultDbRow,
  'model_id' | 'thinking_level' | 'model_packs' | 'default_model_pack_id' | 'updated_at'
>;

type ModelPackSetChange = (current: ModelPackSet | null) => ModelPackSet;

function toRecord(row: ModelDefaultDbRow): ModelDefaultRecord {
  const thinkingLevel = isThinkingLevelSetting(row.thinking_level) ? row.thinking_level : DEFAULT_THINKING_LEVEL;
  return {
    orgId: row.org_id,
    userId: row.user_id,
    modelId: row.model_id,
    thinkingLevel,
    modelPacks: row.model_packs ?? legacyModelPackSet(row.model_id, thinkingLevel).modelPacks,
    defaultModelPackId: row.default_model_pack_id ?? LEGACY_MODEL_PACK_ID,
    updatedAt: row.updated_at,
  };
}

function toColumns(set: ModelPackSet): ModelPackColumns {
  const pack = defaultModelPack(set);
  const first = pack?.models[0];
  if (!pack || !first) throw new Error('A personal model pack set needs a default pack with a model');
  return {
    model_id: first.modelId,
    thinking_level: first.thinkingLevel,
    model_packs: set.modelPacks,
    default_model_pack_id: pack.id,
    updated_at: new Date(),
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
    return this.#upsert({ orgId, userId }, current =>
      withDefaultModel(current ?? EMPTY_MODEL_PACK_SET, modelId, DEFAULT_THINKING_LEVEL),
    );
  }

  async setModelPacks({
    orgId,
    userId,
    modelPacks,
    defaultModelPackId,
  }: {
    orgId: string;
    userId: string;
    modelPacks: ModelPack[];
    defaultModelPackId: string | null;
  }): Promise<ModelDefaultRecord | null> {
    if (modelPacks.length === 0) {
      await this.clear({ orgId, userId });
      return null;
    }
    return this.#upsert({ orgId, userId }, () => ({ modelPacks, defaultModelPackId }));
  }

  async #upsert(
    { orgId, userId }: { orgId: string; userId: string },
    change: ModelPackSetChange,
  ): Promise<ModelDefaultRecord> {
    const updateExisting = () =>
      this.#db.updateAtomic<ModelDefaultDbRow>('user_default_models', { org_id: orgId, user_id: userId }, current =>
        toColumns(change(toRecord(current))),
      );

    const updated = await updateExisting();
    if (updated) return toRecord(updated);

    try {
      return toRecord(
        await this.#db.insertOne<ModelDefaultDbRow>('user_default_models', {
          org_id: orgId,
          user_id: userId,
          ...toColumns(change(null)),
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
