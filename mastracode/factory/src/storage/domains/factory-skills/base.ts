import { FactoryStorageDomain, UniqueViolationError } from '@mastra/core/storage';
import type { CollectionSchema, FactoryStorageOps } from '@mastra/core/storage';

/** A skill a Factory's users wrote, which board phases can run. */
export interface FactorySkillRecord {
  orgId: string;
  factoryProjectId: string;
  name: string;
  description: string;
  content: string;
  createdAt: Date;
  updatedAt: Date;
}

const COLLECTION = 'factory_skill_library';

export const FACTORY_SKILL_LIBRARY_SCHEMA: CollectionSchema = {
  name: COLLECTION,
  columns: {
    id: { type: 'uuid-pk' },
    org_id: { type: 'text' },
    factory_project_id: { type: 'text' },
    name: { type: 'text' },
    description: { type: 'text' },
    content: { type: 'text' },
    created_at: { type: 'timestamp' },
    updated_at: { type: 'timestamp' },
  },
  uniqueIndexes: [{ name: 'factory_skill_library_name_key', columns: ['org_id', 'factory_project_id', 'name'] }],
};

interface FactorySkillDbRow extends Record<string, unknown> {
  id: string;
  org_id: string;
  factory_project_id: string;
  name: string;
  description: string;
  content: string;
  created_at: Date;
  updated_at: Date;
}

interface FactoryKey {
  orgId: string;
  factoryProjectId: string;
}

interface SkillKey extends FactoryKey {
  name: string;
}

function toRecord(row: FactorySkillDbRow): FactorySkillRecord {
  return {
    orgId: row.org_id,
    factoryProjectId: row.factory_project_id,
    name: row.name,
    description: row.description,
    content: row.content,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function where(key: SkillKey) {
  return { org_id: key.orgId, factory_project_id: key.factoryProjectId, name: key.name };
}

export class FactorySkillLibraryStorage extends FactoryStorageDomain {
  constructor() {
    super('skill-library');
  }

  async init(): Promise<void> {
    await this.ensureCollections([FACTORY_SKILL_LIBRARY_SCHEMA]);
  }

  async dangerouslyClearAll(): Promise<void> {
    await this.ops.deleteMany(COLLECTION, {});
  }

  get #db(): FactoryStorageOps {
    return this.ops;
  }

  async list({ orgId, factoryProjectId }: FactoryKey): Promise<FactorySkillRecord[]> {
    const rows = await this.#db.findMany<FactorySkillDbRow>(COLLECTION, {
      org_id: orgId,
      factory_project_id: factoryProjectId,
    });
    return rows.map(toRecord).sort((a, b) => a.name.localeCompare(b.name));
  }

  async get(key: SkillKey): Promise<FactorySkillRecord | null> {
    const row = await this.#db.findOne<FactorySkillDbRow>(COLLECTION, where(key));
    return row ? toRecord(row) : null;
  }

  /** Creates the skill, or returns `null` when the Factory already has one by that name. */
  async create(input: SkillKey & { description: string; content: string }): Promise<FactorySkillRecord | null> {
    const now = new Date();
    try {
      return toRecord(
        await this.#db.insertOne<FactorySkillDbRow>(COLLECTION, {
          ...where(input),
          description: input.description,
          content: input.content,
          created_at: now,
          updated_at: now,
        }),
      );
    } catch (error) {
      if (error instanceof UniqueViolationError) return null;
      throw error;
    }
  }

  /** Updates the skill's description and body, or returns `null` when it does not exist. */
  async update(input: SkillKey & { description: string; content: string }): Promise<FactorySkillRecord | null> {
    const row = await this.#db.updateAtomic<FactorySkillDbRow>(COLLECTION, where(input), () => ({
      description: input.description,
      content: input.content,
      updated_at: new Date(),
    }));
    return row ? toRecord(row) : null;
  }

  async delete(key: SkillKey): Promise<boolean> {
    return (await this.#db.deleteMany(COLLECTION, where(key))) > 0;
  }
}
