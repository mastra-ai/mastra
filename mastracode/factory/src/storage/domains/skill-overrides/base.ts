import { FactoryStorageDomain, UniqueViolationError } from '@mastra/core/storage';
import type { CollectionSchema, FactoryStorageOps } from '@mastra/core/storage';

/**
 * User-customized overrides of the bundled Factory skills. The bundled
 * `SKILL.md` files remain the canonical defaults; a row here replaces the
 * description/body of the named skill for the org. Deleting the row resets
 * the skill to its bundled default. One row per `(org, skill name)`; the
 * sentinel `local` org is used in no-auth mode.
 */
export interface SkillOverrideRecord {
  orgId: string;
  name: string;
  description: string;
  /** Markdown body (frontmatter-free). */
  content: string;
  createdAt: Date;
  updatedAt: Date;
}

export const SKILL_OVERRIDES_SCHEMA: CollectionSchema = {
  name: 'factory_skill_overrides',
  columns: {
    id: { type: 'uuid-pk' },
    org_id: { type: 'text' },
    name: { type: 'text' },
    description: { type: 'text' },
    content: { type: 'text' },
    created_at: { type: 'timestamp' },
    updated_at: { type: 'timestamp' },
  },
  uniqueIndexes: [{ name: 'factory_skill_overrides_org_name_key', columns: ['org_id', 'name'] }],
};

interface SkillOverrideDbRow extends Record<string, unknown> {
  id: string;
  org_id: string;
  name: string;
  description: string;
  content: string;
  created_at: Date;
  updated_at: Date;
}

function toRecord(row: SkillOverrideDbRow): SkillOverrideRecord {
  return {
    orgId: row.org_id,
    name: row.name,
    description: row.description,
    content: row.content,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export class SkillOverridesStorage extends FactoryStorageDomain {
  constructor() {
    super('skill-overrides');
  }

  async init(): Promise<void> {
    await this.ensureCollections([SKILL_OVERRIDES_SCHEMA]);
  }

  async dangerouslyClearAll(): Promise<void> {
    await this.ops.deleteMany('factory_skill_overrides', {});
  }

  get #db(): FactoryStorageOps {
    return this.ops;
  }

  async get({ orgId, name }: { orgId: string; name: string }): Promise<SkillOverrideRecord | null> {
    const row = await this.#db.findOne<SkillOverrideDbRow>('factory_skill_overrides', { org_id: orgId, name });
    return row ? toRecord(row) : null;
  }

  async list({ orgId }: { orgId: string }): Promise<SkillOverrideRecord[]> {
    const rows = await this.#db.findMany<SkillOverrideDbRow>('factory_skill_overrides', { org_id: orgId });
    return rows.map(toRecord).sort((a, b) => a.name.localeCompare(b.name));
  }

  /** Insert or replace the override for `(org, name)`. */
  async upsert({
    orgId,
    name,
    description,
    content,
  }: {
    orgId: string;
    name: string;
    description: string;
    content: string;
  }): Promise<SkillOverrideRecord> {
    const now = new Date();
    const updateExisting = () =>
      this.#db.updateAtomic<SkillOverrideDbRow>('factory_skill_overrides', { org_id: orgId, name }, () => ({
        description,
        content,
        updated_at: now,
      }));

    const updated = await updateExisting();
    if (updated) return toRecord(updated);

    try {
      const row = await this.#db.insertOne<SkillOverrideDbRow>('factory_skill_overrides', {
        org_id: orgId,
        name,
        description,
        content,
        created_at: now,
        updated_at: now,
      });
      return toRecord(row);
    } catch (error) {
      if (!(error instanceof UniqueViolationError)) throw error;
      // Lost the first-write race — apply the write to the winning row.
      const row = await updateExisting();
      if (!row) throw error;
      return toRecord(row);
    }
  }

  /** Delete the override, restoring the bundled default. Returns whether a row existed. */
  async delete({ orgId, name }: { orgId: string; name: string }): Promise<boolean> {
    const deleted = await this.#db.deleteMany('factory_skill_overrides', { org_id: orgId, name });
    return deleted > 0;
  }
}
