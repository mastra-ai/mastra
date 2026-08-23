import { isThinkingLevelSetting } from '@mastra/code-sdk/onboarding/settings';
import type { ThinkingLevelSetting } from '@mastra/code-sdk/onboarding/settings';
import { FactoryStorageDomain, UniqueViolationError } from '@mastra/core/storage';
import type { CollectionSchema, FactoryStorageOps } from '@mastra/core/storage';

/** Org row used when auth is disabled (local mode). */
export const LOCAL_TITLE_SETTINGS_ORG_ID = 'local';

/** Effective thread-title configuration after applying the nullable-knob defaults. */
export interface TitleGenerationSetting {
  enabled: boolean;
  /** `null` → the provider-aware cheap-model pack. */
  modelId: string | null;
  /** `null` → no thinking-level override. */
  thinkingLevel: ThinkingLevelSetting | null;
}

export function resolveTitleGenerationSetting(record: TitleSettingsRecord | null | undefined): TitleGenerationSetting {
  if (!record) return { enabled: true, modelId: null, thinkingLevel: null };
  return {
    enabled: record.enabled ?? true,
    modelId: record.modelId,
    thinkingLevel: record.thinkingLevel && isThinkingLevelSetting(record.thinkingLevel) ? record.thinkingLevel : null,
  };
}

/**
 * An org's thread-title generation configuration — one row per org, every knob
 * nullable so only explicitly-changed values are stored. `null` knobs fall
 * back to the defaults: enabled, the provider-aware cheap-model pack, no
 * thinking-level override.
 */
export interface TitleSettingsRecord {
  orgId: string;
  enabled: boolean | null;
  modelId: string | null;
  thinkingLevel: string | null;
  createdAt: Date;
  updatedAt: Date;
}

/** Partial update — only the provided knobs are written; `null` clears a knob. */
export interface TitleSettingsPatch {
  enabled?: boolean;
  modelId?: string | null;
  thinkingLevel?: string | null;
}

export const TITLE_SETTINGS_SCHEMA: CollectionSchema = {
  name: 'title_settings',
  columns: {
    id: { type: 'uuid-pk' },
    org_id: { type: 'text' },
    enabled: { type: 'json', nullable: true },
    model_id: { type: 'text', nullable: true },
    thinking_level: { type: 'text', nullable: true },
    created_at: { type: 'timestamp' },
    updated_at: { type: 'timestamp' },
  },
  uniqueIndexes: [{ name: 'title_settings_org_key', columns: ['org_id'] }],
};

interface TitleSettingsDbRow extends Record<string, unknown> {
  id: string;
  org_id: string;
  enabled: boolean | null;
  model_id: string | null;
  thinking_level: string | null;
  created_at: Date;
  updated_at: Date;
}

function toRecord(row: TitleSettingsDbRow): TitleSettingsRecord {
  return {
    orgId: row.org_id,
    enabled: row.enabled,
    modelId: row.model_id,
    thinkingLevel: row.thinking_level,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function patchToColumns(patch: TitleSettingsPatch): Partial<TitleSettingsDbRow> {
  const columns: Partial<TitleSettingsDbRow> = {};
  if (patch.enabled !== undefined) columns.enabled = patch.enabled;
  if (patch.modelId !== undefined) columns.model_id = patch.modelId;
  if (patch.thinkingLevel !== undefined) columns.thinking_level = patch.thinkingLevel;
  return columns;
}

export class TitleSettingsStorage extends FactoryStorageDomain {
  constructor() {
    super('title-settings');
  }

  async init(): Promise<void> {
    await this.ensureCollections([TITLE_SETTINGS_SCHEMA]);
  }

  async dangerouslyClearAll(): Promise<void> {
    await this.ops.deleteMany('title_settings', {});
  }

  get #db(): FactoryStorageOps {
    return this.ops;
  }

  async get({ orgId }: { orgId: string }): Promise<TitleSettingsRecord | null> {
    const row = await this.#db.findOne<TitleSettingsDbRow>('title_settings', { org_id: orgId });
    return row ? toRecord(row) : null;
  }

  async patch({ orgId, patch }: { orgId: string; patch: TitleSettingsPatch }): Promise<TitleSettingsRecord> {
    const now = new Date();
    const updateExisting = () =>
      this.#db.updateAtomic<TitleSettingsDbRow>('title_settings', { org_id: orgId }, row => ({
        ...patchToColumns(patch),
        updated_at: now,
      }));

    const updated = await updateExisting();
    if (updated) return toRecord(updated);

    try {
      const row = await this.#db.insertOne<TitleSettingsDbRow>('title_settings', {
        org_id: orgId,
        enabled: null,
        model_id: null,
        thinking_level: null,
        ...patchToColumns(patch),
        created_at: now,
        updated_at: now,
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
