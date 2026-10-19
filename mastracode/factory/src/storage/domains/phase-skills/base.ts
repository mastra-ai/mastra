import { FactoryStorageDomain, UniqueViolationError } from '@mastra/core/storage';
import type { CollectionSchema, FactoryStorageOps } from '@mastra/core/storage';

/**
 * What a Factory runs when a card enters one board phase, in place of the
 * board's built-in kickoff: a skill from the Factory's skill library, or a prompt.
 */
export type PhaseKickoff = { skillName: string; prompt: null } | { skillName: null; prompt: string };

export type PhaseSkillRecord = PhaseKickoff & {
  orgId: string;
  factoryProjectId: string;
  boardId: string;
  phaseId: string;
  updatedAt: Date;
};

const COLLECTION = 'factory_phase_kickoffs';

export const FACTORY_PHASE_SKILLS_SCHEMA: CollectionSchema = {
  name: COLLECTION,
  columns: {
    id: { type: 'uuid-pk' },
    org_id: { type: 'text' },
    factory_project_id: { type: 'text' },
    board_id: { type: 'text' },
    phase_id: { type: 'text' },
    skill_name: { type: 'text', nullable: true },
    prompt: { type: 'text', nullable: true },
    updated_at: { type: 'timestamp' },
  },
  uniqueIndexes: [
    {
      name: 'factory_phase_kickoffs_phase_key',
      columns: ['org_id', 'factory_project_id', 'board_id', 'phase_id'],
    },
  ],
};

interface PhaseSkillDbRow extends Record<string, unknown> {
  id: string;
  org_id: string;
  factory_project_id: string;
  board_id: string;
  phase_id: string;
  skill_name: string | null;
  prompt: string | null;
  updated_at: Date;
}

interface PhaseKey {
  orgId: string;
  factoryProjectId: string;
  boardId: string;
  phaseId: string;
}

function toRecord(row: PhaseSkillDbRow): PhaseSkillRecord {
  const base = {
    orgId: row.org_id,
    factoryProjectId: row.factory_project_id,
    boardId: row.board_id,
    phaseId: row.phase_id,
    updatedAt: row.updated_at,
  };
  return row.skill_name !== null
    ? { ...base, skillName: row.skill_name, prompt: null }
    : { ...base, skillName: null, prompt: row.prompt ?? '' };
}

function where(key: PhaseKey) {
  return {
    org_id: key.orgId,
    factory_project_id: key.factoryProjectId,
    board_id: key.boardId,
    phase_id: key.phaseId,
  };
}

export class PhaseSkillsStorage extends FactoryStorageDomain {
  constructor() {
    super('phase-skills');
  }

  async init(): Promise<void> {
    await this.ensureCollections([FACTORY_PHASE_SKILLS_SCHEMA]);
  }

  async dangerouslyClearAll(): Promise<void> {
    await this.ops.deleteMany(COLLECTION, {});
  }

  get #db(): FactoryStorageOps {
    return this.ops;
  }

  async list({ orgId, factoryProjectId }: { orgId: string; factoryProjectId: string }): Promise<PhaseSkillRecord[]> {
    const rows = await this.#db.findMany<PhaseSkillDbRow>(COLLECTION, {
      org_id: orgId,
      factory_project_id: factoryProjectId,
    });
    return rows.map(toRecord);
  }

  async get(key: PhaseKey): Promise<PhaseSkillRecord | null> {
    const row = await this.#db.findOne<PhaseSkillDbRow>(COLLECTION, where(key));
    return row ? toRecord(row) : null;
  }

  async set(input: PhaseKey & PhaseKickoff): Promise<PhaseSkillRecord> {
    const values = { skill_name: input.skillName, prompt: input.prompt, updated_at: new Date() };
    const updateExisting = () => this.#db.updateAtomic<PhaseSkillDbRow>(COLLECTION, where(input), () => values);

    const updated = await updateExisting();
    if (updated) return toRecord(updated);

    try {
      return toRecord(await this.#db.insertOne<PhaseSkillDbRow>(COLLECTION, { ...where(input), ...values }));
    } catch (error) {
      if (!(error instanceof UniqueViolationError)) throw error;
      const row = await updateExisting();
      if (!row) throw error;
      return toRecord(row);
    }
  }

  async clear(key: PhaseKey): Promise<boolean> {
    return (await this.#db.deleteMany(COLLECTION, where(key))) > 0;
  }

  /** Sends every phase that ran `skillName` back to its board's built-in kickoff. */
  async clearSkill({
    orgId,
    factoryProjectId,
    skillName,
  }: {
    orgId: string;
    factoryProjectId: string;
    skillName: string;
  }): Promise<number> {
    return this.#db.deleteMany(COLLECTION, {
      org_id: orgId,
      factory_project_id: factoryProjectId,
      skill_name: skillName,
    });
  }

  /** Removes every kickoff on `boardId`, e.g. when the board is deleted. */
  async clearBoard({
    orgId,
    factoryProjectId,
    boardId,
  }: {
    orgId: string;
    factoryProjectId: string;
    boardId: string;
  }): Promise<number> {
    return this.#db.deleteMany(COLLECTION, { org_id: orgId, factory_project_id: factoryProjectId, board_id: boardId });
  }
}
