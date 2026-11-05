import { FactoryStorageDomain, UniqueViolationError } from '@mastra/core/storage';
import type { CollectionSchema, FactoryStorageOps } from '@mastra/core/storage';

export interface VoiceSettingsRecord {
  orgId: string;
  userId: string;
  provider: string;
  model: string;
  updatedAt: Date;
}

export const VOICE_SETTINGS_SCHEMA: CollectionSchema = {
  name: 'voice_settings',
  columns: {
    id: { type: 'uuid-pk' },
    org_id: { type: 'text' },
    user_id: { type: 'text' },
    provider: { type: 'text' },
    model: { type: 'text' },
    updated_at: { type: 'timestamp' },
  },
  uniqueIndexes: [{ name: 'voice_settings_org_user_key', columns: ['org_id', 'user_id'] }],
};

interface VoiceSettingsDbRow extends Record<string, unknown> {
  id: string;
  org_id: string;
  user_id: string;
  provider: string;
  model: string;
  updated_at: Date;
}

function toRecord(row: VoiceSettingsDbRow): VoiceSettingsRecord {
  return {
    orgId: row.org_id,
    userId: row.user_id,
    provider: row.provider,
    model: row.model,
    updatedAt: row.updated_at,
  };
}

export class VoiceSettingsStorage extends FactoryStorageDomain {
  constructor() {
    super('voice-settings');
  }

  async init(): Promise<void> {
    await this.ensureCollections([VOICE_SETTINGS_SCHEMA]);
  }

  async dangerouslyClearAll(): Promise<void> {
    await this.ops.deleteMany('voice_settings', {});
  }

  get #db(): FactoryStorageOps {
    return this.ops;
  }

  async get({ orgId, userId }: { orgId: string; userId: string }): Promise<VoiceSettingsRecord | null> {
    const row = await this.#db.findOne<VoiceSettingsDbRow>('voice_settings', { org_id: orgId, user_id: userId });
    return row ? toRecord(row) : null;
  }

  async set({
    orgId,
    userId,
    provider,
    model,
  }: {
    orgId: string;
    userId: string;
    provider: string;
    model: string;
  }): Promise<VoiceSettingsRecord> {
    const values = { provider, model, updated_at: new Date() };
    const updateExisting = () =>
      this.#db.updateAtomic<VoiceSettingsDbRow>('voice_settings', { org_id: orgId, user_id: userId }, () => values);

    const updated = await updateExisting();
    if (updated) return toRecord(updated);

    try {
      return toRecord(
        await this.#db.insertOne<VoiceSettingsDbRow>('voice_settings', { org_id: orgId, user_id: userId, ...values }),
      );
    } catch (error) {
      if (!(error instanceof UniqueViolationError)) throw error;
      const row = await updateExisting();
      if (!row) throw error;
      return toRecord(row);
    }
  }

  async clear({ orgId, userId }: { orgId: string; userId: string }): Promise<boolean> {
    return (await this.#db.deleteMany('voice_settings', { org_id: orgId, user_id: userId })) > 0;
  }
}
