import { FactoryStorageDomain } from '@mastra/core/storage';
import type { CollectionSchema, FactoryStorageOps } from '@mastra/core/storage';

/** A project's edited copy of one Factory skill's SKILL.md. */
export interface SkillOverrideRecord {
  orgId: string;
  projectId: string;
  skillName: string;
  /** The full edited SKILL.md, frontmatter included. */
  content: string;
  /** sha256 of the original SKILL.md the edit was made against. */
  baseHash: string;
  updatedBy: string;
  updatedAt: Date;
}

/** Every override of one project, read at one revision. */
export interface SkillOverrideSnapshot {
  revision: number;
  overrides: SkillOverrideRecord[];
}

interface ProjectScope {
  orgId: string;
  projectId: string;
}

interface SkillScope extends ProjectScope {
  skillName: string;
}

export const SKILL_OVERRIDES_SCHEMA: CollectionSchema = {
  name: 'factory_skill_overrides',
  columns: {
    id: { type: 'uuid-pk' },
    org_id: { type: 'text' },
    factory_project_id: { type: 'text' },
    skill_name: { type: 'text' },
    content: { type: 'text' },
    base_hash: { type: 'text' },
    updated_by: { type: 'text' },
    updated_at: { type: 'timestamp' },
  },
  uniqueIndexes: [
    { name: 'factory_skill_overrides_scope_key', columns: ['org_id', 'factory_project_id', 'skill_name'] },
  ],
};

/**
 * One row per project whose `revision` is incremented in the same transaction as every save and
 * revert, so skill sources can tell an unchanged override set from one indexed row read.
 */
export const SKILL_OVERRIDE_REVISIONS_SCHEMA: CollectionSchema = {
  name: 'factory_skill_override_revisions',
  columns: {
    id: { type: 'uuid-pk' },
    org_id: { type: 'text' },
    factory_project_id: { type: 'text' },
    revision: { type: 'integer', default: 0 },
    updated_at: { type: 'timestamp' },
  },
  uniqueIndexes: [{ name: 'factory_skill_override_revisions_scope_key', columns: ['org_id', 'factory_project_id'] }],
};

interface SkillOverrideDbRow extends Record<string, unknown> {
  id: string;
  org_id: string;
  factory_project_id: string;
  skill_name: string;
  content: string;
  base_hash: string;
  updated_by: string;
  updated_at: Date;
}

interface RevisionDbRow extends Record<string, unknown> {
  id: string;
  org_id: string;
  factory_project_id: string;
  revision: number;
  updated_at: Date;
}

function toRecord(row: SkillOverrideDbRow): SkillOverrideRecord {
  return {
    orgId: row.org_id,
    projectId: row.factory_project_id,
    skillName: row.skill_name,
    content: row.content,
    baseHash: row.base_hash,
    updatedBy: row.updated_by,
    updatedAt: row.updated_at,
  };
}

const projectWhere = ({ orgId, projectId }: ProjectScope) => ({ org_id: orgId, factory_project_id: projectId });

export class SkillOverridesStorage extends FactoryStorageDomain {
  constructor() {
    super('skill-overrides');
  }

  async init(): Promise<void> {
    await this.ensureCollections([SKILL_OVERRIDES_SCHEMA, SKILL_OVERRIDE_REVISIONS_SCHEMA]);
  }

  async dangerouslyClearAll(): Promise<void> {
    await this.ops.deleteMany('factory_skill_overrides', {});
    await this.ops.deleteMany('factory_skill_override_revisions', {});
  }

  get #db(): FactoryStorageOps {
    return this.ops;
  }

  /** 0 until the project's first save. */
  async revision(scope: ProjectScope): Promise<number> {
    const row = await this.#db.findOne<RevisionDbRow>('factory_skill_override_revisions', projectWhere(scope));
    return row?.revision ?? 0;
  }

  async list(scope: ProjectScope): Promise<SkillOverrideRecord[]> {
    const rows = await this.#db.findMany<SkillOverrideDbRow>('factory_skill_overrides', projectWhere(scope), {
      orderBy: [['skill_name', 'asc']],
    });
    return rows.map(toRecord);
  }

  /**
   * Reads the revision before the rows, so a write landing in between pairs newer rows with an
   * older revision: the caller re-reads at the next check instead of caching stale rows as current.
   */
  async snapshot(scope: ProjectScope): Promise<SkillOverrideSnapshot> {
    const revision = await this.revision(scope);
    return { revision, overrides: await this.list(scope) };
  }

  async get({ skillName, ...scope }: SkillScope): Promise<SkillOverrideRecord | null> {
    const row = await this.#db.findOne<SkillOverrideDbRow>('factory_skill_overrides', {
      ...projectWhere(scope),
      skill_name: skillName,
    });
    return row ? toRecord(row) : null;
  }

  async upsert({
    content,
    baseHash,
    updatedBy,
    skillName,
    ...scope
  }: SkillScope & { content: string; baseHash: string; updatedBy: string }): Promise<SkillOverrideRecord> {
    await this.#ensureRevisionRow(scope);
    return this.storage.withTransaction(async ops => {
      const now = await this.#bumpRevision(ops, scope);
      const row = await ops.upsertOne<SkillOverrideDbRow>(
        'factory_skill_overrides',
        ['org_id', 'factory_project_id', 'skill_name'],
        {
          ...projectWhere(scope),
          skill_name: skillName,
          content,
          base_hash: baseHash,
          updated_by: updatedBy,
          updated_at: now,
        },
      );
      return toRecord(row);
    });
  }

  /** False when the skill had no override; the revision only moves when a row was removed. */
  async delete({ skillName, ...scope }: SkillScope): Promise<boolean> {
    await this.#ensureRevisionRow(scope);
    return this.storage.withTransaction(async ops => {
      // Lock the revision row first so the delete and the bump commit together.
      let deleted = false;
      await ops.updateAtomic<RevisionDbRow>('factory_skill_override_revisions', projectWhere(scope), async row => {
        deleted =
          (await ops.deleteMany('factory_skill_overrides', { ...projectWhere(scope), skill_name: skillName })) > 0;
        return deleted ? { revision: row.revision + 1, updated_at: new Date() } : null;
      });
      return deleted;
    });
  }

  /**
   * Created outside the write transaction: on Postgres a lost insert race would abort the
   * transaction, while `upsertOne` here retries it as an update.
   */
  async #ensureRevisionRow(scope: ProjectScope): Promise<void> {
    if (await this.#db.findOne('factory_skill_override_revisions', projectWhere(scope))) return;
    await this.#db.upsertOne<RevisionDbRow>('factory_skill_override_revisions', ['org_id', 'factory_project_id'], {
      ...projectWhere(scope),
      updated_at: new Date(),
    });
  }

  /** Locks the project's revision row, so concurrent writers to one project serialize behind it. */
  async #bumpRevision(ops: FactoryStorageOps, scope: ProjectScope): Promise<Date> {
    const now = new Date();
    const row = await ops.updateAtomic<RevisionDbRow>('factory_skill_override_revisions', projectWhere(scope), row => ({
      revision: row.revision + 1,
      updated_at: now,
    }));
    if (!row) throw new Error('Skill override revision row is missing');
    return now;
  }
}
