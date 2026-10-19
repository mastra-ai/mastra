import { FactoryStorageDomain } from '@mastra/core/storage';
import type { CollectionSchema, FactoryStorageOps } from '@mastra/core/storage';

import type { BoardPhaseKind } from '../../../boards/define-board.js';

/** One phase of a board a Factory's users built. */
export interface StoredBoardPhase {
  id: string;
  title: string;
  kind: BoardPhaseKind;
  /** Seat a working phase starts; absent for resting and terminal phases. */
  role?: string;
  /** Phases a card can move to from here. */
  next: string[];
}

export interface StoredBoardDefinition {
  initialPhase: string;
  phases: StoredBoardPhase[];
}

/** A board a Factory's users built from the UI or API. */
export interface FactoryBoardRecord {
  orgId: string;
  factoryProjectId: string;
  boardId: string;
  title: string;
  definition: StoredBoardDefinition;
  createdAt: Date;
  updatedAt: Date;
}

const COLLECTION = 'factory_boards';

export const FACTORY_BOARDS_SCHEMA: CollectionSchema = {
  name: COLLECTION,
  columns: {
    id: { type: 'uuid-pk' },
    org_id: { type: 'text' },
    factory_project_id: { type: 'text' },
    board_id: { type: 'text' },
    title: { type: 'text' },
    definition: { type: 'json' },
    created_at: { type: 'timestamp' },
    updated_at: { type: 'timestamp' },
  },
  // Board ids are unique across the deployment because the board registry is keyed by id alone.
  uniqueIndexes: [{ name: 'factory_boards_board_id_key', columns: ['board_id'] }],
};

interface FactoryBoardDbRow extends Record<string, unknown> {
  id: string;
  org_id: string;
  factory_project_id: string;
  board_id: string;
  title: string;
  definition: StoredBoardDefinition;
  created_at: Date;
  updated_at: Date;
}

interface FactoryKey {
  orgId: string;
  factoryProjectId: string;
}

interface BoardKey extends FactoryKey {
  boardId: string;
}

function toRecord(row: FactoryBoardDbRow): FactoryBoardRecord {
  return {
    orgId: row.org_id,
    factoryProjectId: row.factory_project_id,
    boardId: row.board_id,
    title: row.title,
    definition: row.definition,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function where(key: BoardKey) {
  return { org_id: key.orgId, factory_project_id: key.factoryProjectId, board_id: key.boardId };
}

export class FactoryBoardsStorage extends FactoryStorageDomain {
  constructor() {
    super('boards');
  }

  async init(): Promise<void> {
    await this.ensureCollections([FACTORY_BOARDS_SCHEMA]);
  }

  async dangerouslyClearAll(): Promise<void> {
    await this.ops.deleteMany(COLLECTION, {});
  }

  get #db(): FactoryStorageOps {
    return this.ops;
  }

  /** Every stored board in the deployment, for loading the board registry. */
  async listAll(): Promise<FactoryBoardRecord[]> {
    return (await this.#db.findMany<FactoryBoardDbRow>(COLLECTION, {})).map(toRecord);
  }

  async list({ orgId, factoryProjectId }: FactoryKey): Promise<FactoryBoardRecord[]> {
    const rows = await this.#db.findMany<FactoryBoardDbRow>(COLLECTION, {
      org_id: orgId,
      factory_project_id: factoryProjectId,
    });
    return rows.map(toRecord).sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  }

  async get(key: BoardKey): Promise<FactoryBoardRecord | null> {
    const row = await this.#db.findOne<FactoryBoardDbRow>(COLLECTION, where(key));
    return row ? toRecord(row) : null;
  }

  async create(input: BoardKey & { title: string; definition: StoredBoardDefinition }): Promise<FactoryBoardRecord> {
    const now = new Date();
    return toRecord(
      await this.#db.insertOne<FactoryBoardDbRow>(COLLECTION, {
        ...where(input),
        title: input.title,
        definition: input.definition,
        created_at: now,
        updated_at: now,
      }),
    );
  }

  /** Replaces the board's title and phases, or returns `null` when the Factory has no such board. */
  async update(
    input: BoardKey & { title: string; definition: StoredBoardDefinition },
  ): Promise<FactoryBoardRecord | null> {
    const row = await this.#db.updateAtomic<FactoryBoardDbRow>(COLLECTION, where(input), () => ({
      title: input.title,
      definition: input.definition,
      updated_at: new Date(),
    }));
    return row ? toRecord(row) : null;
  }

  async delete(key: BoardKey): Promise<boolean> {
    return (await this.#db.deleteMany(COLLECTION, where(key))) > 0;
  }
}
