import { FactoryStorageDomain, UniqueViolationError } from '@mastra/core/storage';
import type { CollectionSchema, FactoryStorageOps } from '@mastra/core/storage';

/**
 * A user's persisted memory (observational-memory) configuration. The
 * DB-backed tenant counterpart of the local `settings.json` OM fields
 * (`observerModelOverride`, `reflectorModelOverride`, `omObservationThreshold`,
 * `omReflectionThreshold`, `omObserveAttachments`): one row per `(org, user)`,
 * every knob nullable so only explicitly-changed values are stored.
 */
export interface MemorySettingsRecord {
  orgId: string;
  userId: string;
  observerModelId: string | null;
  reflectorModelId: string | null;
  observationThreshold: number | null;
  reflectionThreshold: number | null;
  observeAttachments: 'auto' | boolean | null;
  createdAt: Date;
  updatedAt: Date;
}

/** Partial update — only the provided knobs are written. */
export interface MemorySettingsPatch {
  observerModelId?: string;
  reflectorModelId?: string;
  observationThreshold?: number;
  reflectionThreshold?: number;
  observeAttachments?: 'auto' | boolean;
}

/**
 * Knobs written only when the stored value is still unset (`NULL`). The check
 * happens inside the backend's atomic-update primitive, so a concurrent
 * explicit write to the same knob is never clobbered by a fill.
 */
export interface MemorySettingsFillIfUnset {
  observerModelId?: string;
  reflectorModelId?: string;
}

export const MEMORY_SETTINGS_SCHEMA: CollectionSchema = {
  name: 'memory_settings',
  columns: {
    id: { type: 'uuid-pk' },
    org_id: { type: 'text' },
    user_id: { type: 'text' },
    observer_model_id: { type: 'text', nullable: true },
    reflector_model_id: { type: 'text', nullable: true },
    observation_threshold: { type: 'integer', nullable: true },
    reflection_threshold: { type: 'integer', nullable: true },
    // 'auto' | true | false — json keeps the tri-state without string encoding.
    observe_attachments: { type: 'json', nullable: true },
    created_at: { type: 'timestamp' },
    updated_at: { type: 'timestamp' },
  },
  uniqueIndexes: [{ name: 'memory_settings_org_user_key', columns: ['org_id', 'user_id'] }],
};

interface MemorySettingsDbRow extends Record<string, unknown> {
  id: string;
  org_id: string;
  user_id: string;
  observer_model_id: string | null;
  reflector_model_id: string | null;
  observation_threshold: number | null;
  reflection_threshold: number | null;
  observe_attachments: 'auto' | boolean | null;
  created_at: Date;
  updated_at: Date;
}

function toRecord(row: MemorySettingsDbRow): MemorySettingsRecord {
  return {
    orgId: row.org_id,
    userId: row.user_id,
    observerModelId: row.observer_model_id,
    reflectorModelId: row.reflector_model_id,
    observationThreshold: row.observation_threshold,
    reflectionThreshold: row.reflection_threshold,
    observeAttachments: row.observe_attachments,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function patchToColumns(patch: MemorySettingsPatch): Partial<MemorySettingsDbRow> {
  const columns: Partial<MemorySettingsDbRow> = {};
  if (patch.observerModelId !== undefined) columns.observer_model_id = patch.observerModelId;
  if (patch.reflectorModelId !== undefined) columns.reflector_model_id = patch.reflectorModelId;
  if (patch.observationThreshold !== undefined) columns.observation_threshold = patch.observationThreshold;
  if (patch.reflectionThreshold !== undefined) columns.reflection_threshold = patch.reflectionThreshold;
  if (patch.observeAttachments !== undefined) columns.observe_attachments = patch.observeAttachments;
  return columns;
}

export class MemorySettingsStorage extends FactoryStorageDomain {
  constructor() {
    super('memory-settings');
  }

  async init(): Promise<void> {
    await this.ensureCollections([MEMORY_SETTINGS_SCHEMA]);
  }

  async dangerouslyClearAll(): Promise<void> {
    await this.ops.deleteMany('memory_settings', {});
  }

  get #db(): FactoryStorageOps {
    return this.ops;
  }

  async get({ orgId, userId }: { orgId: string; userId: string }): Promise<MemorySettingsRecord | null> {
    const row = await this.#db.findOne<MemorySettingsDbRow>('memory_settings', { org_id: orgId, user_id: userId });
    return row ? toRecord(row) : null;
  }

  /**
   * Upsert the user's row, writing only the knobs present in `patch`.
   * `fillIfUnset` knobs are written only where the stored value is still
   * `NULL`, decided inside the atomic update so concurrent explicit writes
   * win over fills. Concurrent first writes are resolved via the shared
   * insert-then-catch-unique-violation pattern (see `queue_health`).
   */
  async patch({
    orgId,
    userId,
    patch,
    fillIfUnset,
  }: {
    orgId: string;
    userId: string;
    patch: MemorySettingsPatch;
    fillIfUnset?: MemorySettingsFillIfUnset;
  }): Promise<MemorySettingsRecord> {
    const now = new Date();
    const updateExisting = () =>
      this.#db.updateAtomic<MemorySettingsDbRow>('memory_settings', { org_id: orgId, user_id: userId }, row => {
        const columns: Partial<MemorySettingsDbRow> = { ...patchToColumns(patch), updated_at: now };
        if (fillIfUnset?.observerModelId !== undefined && row.observer_model_id == null) {
          columns.observer_model_id = patch.observerModelId ?? fillIfUnset.observerModelId;
        }
        if (fillIfUnset?.reflectorModelId !== undefined && row.reflector_model_id == null) {
          columns.reflector_model_id = patch.reflectorModelId ?? fillIfUnset.reflectorModelId;
        }
        return columns;
      });

    const updated = await updateExisting();
    if (updated) return toRecord(updated);

    try {
      const row = await this.#db.insertOne<MemorySettingsDbRow>('memory_settings', {
        org_id: orgId,
        user_id: userId,
        observer_model_id: fillIfUnset?.observerModelId ?? null,
        reflector_model_id: fillIfUnset?.reflectorModelId ?? null,
        observation_threshold: null,
        reflection_threshold: null,
        observe_attachments: null,
        ...patchToColumns(patch),
        created_at: now,
        updated_at: now,
      });
      return toRecord(row);
    } catch (error) {
      if (!(error instanceof UniqueViolationError)) throw error;
      // Lost the first-write race — apply the patch to the winning row.
      const row = await updateExisting();
      if (!row) throw error;
      return toRecord(row);
    }
  }
}
