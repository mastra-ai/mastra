import type { CollectionSchema } from '@mastra/core/storage';

/** A project's boards. `board_key` is the id cards reference (`work_items.board`). */
export const FACTORY_BOARDS_SCHEMA: CollectionSchema = {
  name: 'factory_boards',
  columns: {
    id: { type: 'uuid-pk' },
    org_id: { type: 'text' },
    factory_project_id: { type: 'text' },
    board_key: { type: 'text' },
    name: { type: 'text' },
    description: { type: 'text', nullable: true },
    position: { type: 'integer' },
    // Rises on every write to the board or its phases; the compare-and-set token for edits.
    revision: { type: 'integer' },
    created_by: { type: 'text' },
    created_at: { type: 'timestamp' },
    updated_by: { type: 'text' },
    updated_at: { type: 'timestamp' },
  },
  uniqueIndexes: [{ name: 'factory_boards_project_key', columns: ['org_id', 'factory_project_id', 'board_key'] }],
  indexes: [{ name: 'factory_boards_project', columns: ['org_id', 'factory_project_id'] }],
};

/** A board's ordered phases. `phase_key` is the stage id cards sit in. */
export const FACTORY_BOARD_PHASES_SCHEMA: CollectionSchema = {
  name: 'factory_board_phases',
  columns: {
    id: { type: 'uuid-pk' },
    org_id: { type: 'text' },
    factory_project_id: { type: 'text' },
    board_key: { type: 'text' },
    phase_key: { type: 'text' },
    position: { type: 'integer' },
    name: { type: 'text' },
    description: { type: 'text', nullable: true },
    kind: { type: 'text' },
    // { skill?, context?, instructions? }; room for other runner types later.
    runner: { type: 'json', nullable: true },
    next_phases: { type: 'json', nullable: true },
    auto_start: { type: 'boolean', default: false },
    auto_start_when: { type: 'json', nullable: true },
    exit_tool: { type: 'json', nullable: true },
  },
  uniqueIndexes: [
    {
      name: 'factory_board_phases_project_board_phase',
      columns: ['org_id', 'factory_project_id', 'board_key', 'phase_key'],
    },
  ],
  indexes: [{ name: 'factory_board_phases_project', columns: ['org_id', 'factory_project_id'] }],
};

/**
 * A project's ordered intake routes: where new cards matching `when_condition` land and whether
 * an agent may start them without a person.
 */
export const FACTORY_INTAKE_ROUTES_SCHEMA: CollectionSchema = {
  name: 'factory_intake_routes',
  columns: {
    id: { type: 'uuid-pk' },
    org_id: { type: 'text' },
    factory_project_id: { type: 'text' },
    name: { type: 'text' },
    enabled: { type: 'boolean', default: true },
    position: { type: 'integer' },
    // A card RuleGroup; null matches every card. Not named `when`, which is an SQL keyword.
    when_condition: { type: 'json', nullable: true },
    // Null leaves placement to the label routes, bindings and integration defaults.
    board_key: { type: 'text', nullable: true },
    phase_key: { type: 'text', nullable: true },
    hold: { type: 'text' },
    // Rises on every write to the route, including a move; the compare-and-set token for edits.
    revision: { type: 'integer' },
    created_by: { type: 'text' },
    created_at: { type: 'timestamp' },
    updated_by: { type: 'text' },
    updated_at: { type: 'timestamp' },
  },
  uniqueIndexes: [
    { name: 'factory_intake_routes_project_position', columns: ['org_id', 'factory_project_id', 'position'] },
  ],
  indexes: [{ name: 'factory_intake_routes_project', columns: ['org_id', 'factory_project_id'] }],
};

/**
 * One row per project that every write adding, deleting or moving intake routes upserts first,
 * inside its transaction. The upsert holds the row until commit, so those writes on one project
 * run one after another and positions stay 0..n-1 with no gaps.
 */
export const FACTORY_INTAKE_ROUTE_LOCKS_SCHEMA: CollectionSchema = {
  name: 'factory_intake_route_locks',
  columns: {
    id: { type: 'uuid-pk' },
    org_id: { type: 'text' },
    factory_project_id: { type: 'text' },
    locked_at: { type: 'timestamp' },
  },
  uniqueIndexes: [{ name: 'factory_intake_route_locks_project', columns: ['org_id', 'factory_project_id'] }],
};

/**
 * One row per project whose `version` is replaced inside every board write, so other replicas
 * can tell their cached boards are stale with one indexed read.
 */
export const FACTORY_BOARD_DEFINITION_VERSIONS_SCHEMA: CollectionSchema = {
  name: 'factory_board_definition_versions',
  columns: {
    id: { type: 'uuid-pk' },
    org_id: { type: 'text' },
    factory_project_id: { type: 'text' },
    version: { type: 'text' },
    updated_at: { type: 'timestamp' },
  },
  uniqueIndexes: [{ name: 'factory_board_definition_versions_project', columns: ['org_id', 'factory_project_id'] }],
};
