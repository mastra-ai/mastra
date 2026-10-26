import type { CollectionSchema } from '@mastra/core/storage';

/**
 * One row per project that has stored boards. `revision` rises on every write
 * of the project's boards and routes: writers compare-and-set it inside the
 * write transaction, and board caches compare it to decide whether to reload.
 */
export const FACTORY_BOARD_SETS_SCHEMA: CollectionSchema = {
  name: 'factory_board_sets',
  columns: {
    id: { type: 'uuid-pk' },
    org_id: { type: 'text' },
    factory_project_id: { type: 'text' },
    revision: { type: 'integer' },
    updated_by: { type: 'text' },
    updated_at: { type: 'timestamp' },
  },
  uniqueIndexes: [{ name: 'factory_board_sets_project_unique', columns: ['org_id', 'factory_project_id'] }],
};

const scopeColumns = {
  org_id: { type: 'text' },
  factory_project_id: { type: 'text' },
} as const;

const projectIndex = (table: string) => ({ name: `${table}_project_idx`, columns: ['org_id', 'factory_project_id'] });

export const FACTORY_BOARDS_SCHEMA: CollectionSchema = {
  name: 'factory_boards',
  columns: {
    id: { type: 'uuid-pk' },
    ...scopeColumns,
    /** Stable public id, kept when the board is rewritten. */
    board_id: { type: 'text' },
    key: { type: 'text' },
    name: { type: 'text' },
    description: { type: 'text', nullable: true },
    position: { type: 'integer' },
    created_by: { type: 'text' },
    created_at: { type: 'timestamp' },
  },
  uniqueIndexes: [{ name: 'factory_boards_project_key_unique', columns: ['org_id', 'factory_project_id', 'key'] }],
  indexes: [projectIndex('factory_boards')],
};

export const FACTORY_BOARD_PHASES_SCHEMA: CollectionSchema = {
  name: 'factory_board_phases',
  columns: {
    id: { type: 'uuid-pk' },
    ...scopeColumns,
    board_key: { type: 'text' },
    key: { type: 'text' },
    name: { type: 'text' },
    description: { type: 'text', nullable: true },
    position: { type: 'integer' },
    kind: { type: 'text' },
    runner: { type: 'json', nullable: true },
    next_phases: { type: 'json', nullable: true },
    exit_tool: { type: 'text', nullable: true },
    auto_approve_when: { type: 'json', nullable: true },
    manual_entry: { type: 'boolean', default: false },
  },
  uniqueIndexes: [
    {
      name: 'factory_board_phases_project_key_unique',
      columns: ['org_id', 'factory_project_id', 'board_key', 'key'],
    },
  ],
  indexes: [projectIndex('factory_board_phases')],
};

export const FACTORY_INTAKE_ROUTES_SCHEMA: CollectionSchema = {
  name: 'factory_intake_routes',
  columns: {
    id: { type: 'uuid-pk' },
    ...scopeColumns,
    position: { type: 'integer' },
    condition: { type: 'json', nullable: true },
    board_key: { type: 'text' },
    phase_key: { type: 'text', nullable: true },
    enabled: { type: 'boolean', default: true },
  },
  uniqueIndexes: [
    {
      name: 'factory_intake_routes_project_position_unique',
      columns: ['org_id', 'factory_project_id', 'position'],
    },
  ],
  indexes: [projectIndex('factory_intake_routes')],
};

export const FACTORY_BOARD_EVENT_ROUTES_SCHEMA: CollectionSchema = {
  name: 'factory_board_event_routes',
  columns: {
    id: { type: 'uuid-pk' },
    ...scopeColumns,
    board_key: { type: 'text' },
    position: { type: 'integer' },
    event: { type: 'text' },
    from_phases: { type: 'json', nullable: true },
    condition: { type: 'json', nullable: true },
    to_phase_key: { type: 'text' },
    enabled: { type: 'boolean', default: true },
  },
  uniqueIndexes: [
    {
      name: 'factory_board_event_routes_project_position_unique',
      columns: ['org_id', 'factory_project_id', 'board_key', 'position'],
    },
  ],
  indexes: [projectIndex('factory_board_event_routes')],
};

export const BOARD_DEFINITION_COLLECTIONS = [
  FACTORY_BOARDS_SCHEMA.name,
  FACTORY_BOARD_PHASES_SCHEMA.name,
  FACTORY_INTAKE_ROUTES_SCHEMA.name,
  FACTORY_BOARD_EVENT_ROUTES_SCHEMA.name,
] as const;
