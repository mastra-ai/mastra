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
    // Factory tools the phase grants the session working the card there, e.g. ["factory_record_review_verdict"].
    tools: { type: 'json', nullable: true },
  },
  uniqueIndexes: [
    {
      name: 'factory_board_phases_project_board_phase',
      columns: ['org_id', 'factory_project_id', 'board_key', 'phase_key'],
    },
  ],
  indexes: [{ name: 'factory_board_phases_project', columns: ['org_id', 'factory_project_id'] }],
};

/** A project's ordered intake routes: where new cards matching `when_condition` land. */
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
    board_key: { type: 'text' },
    // Null lands the card in the board's first phase.
    phase_key: { type: 'text', nullable: true },
    // The status events the route handles (`StatusEvent`s). Null on rows written before routes named
    // events: those place new cards, as `['work_item.created']`.
    on_events: { type: 'json', nullable: true },
    // No longer read or written: a route moves a card into any phase. Kept so existing tables match.
    allow_working_phase: { type: 'boolean', nullable: true },
    // True files a pull request on the card of the issue it closes instead of a new card. Null on rows written before it.
    join_closed_issue: { type: 'boolean', nullable: true },
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
    // Keys of the default routes Factory added to the project (`DEFAULT_INTAKE_ROUTES`), so each is
    // added once. Null on rows written before the list: those projects got `outside-authors`.
    seeded_defaults: { type: 'json', nullable: true },
    // Board keys in the order intake checks them, separate from the sidebar's `position`. Null
    // until first derived from the route list (`deriveIntakeOrder`).
    intake_order: { type: 'json', nullable: true },
    // The one-time intake order migration: when the order was derived, and how the old and new
    // evaluators compared over the project's recent cards. Null until it ran.
    intake_order_migration: { type: 'json', nullable: true },
  },
  uniqueIndexes: [{ name: 'factory_intake_route_locks_project', columns: ['org_id', 'factory_project_id'] }],
};

/**
 * One row per arrival intake decided on, keyed by the arrival's decision, so a redelivery updates
 * it instead of adding another. A `not_routed` row is an item no board took; it holds the arrival
 * so Route again can file it, and is resolved once a card is filed for its source.
 */
export const FACTORY_INTAKE_DECISIONS_SCHEMA: CollectionSchema = {
  name: 'factory_intake_decisions',
  columns: {
    id: { type: 'uuid-pk' },
    org_id: { type: 'text' },
    factory_project_id: { type: 'text' },
    idempotency_key: { type: 'text' },
    outcome: { type: 'text' },
    evaluator: { type: 'text' },
    board_key: { type: 'text', nullable: true },
    route_id: { type: 'text', nullable: true },
    reason: { type: 'text', nullable: true },
    source_key: { type: 'text', nullable: true },
    title: { type: 'text' },
    url: { type: 'text', nullable: true },
    // The `upsertLinkedWorkItem` decision as it arrived; Route again files it.
    arrival: { type: 'json', nullable: true },
    decided_at: { type: 'timestamp' },
    resolved_at: { type: 'timestamp', nullable: true },
    resolved_by: { type: 'text', nullable: true },
  },
  uniqueIndexes: [
    { name: 'factory_intake_decisions_key', columns: ['org_id', 'factory_project_id', 'idempotency_key'] },
  ],
  indexes: [
    { name: 'factory_intake_decisions_project', columns: ['org_id', 'factory_project_id', 'outcome', 'decided_at'] },
    { name: 'factory_intake_decisions_source', columns: ['org_id', 'factory_project_id', 'source_key'] },
  ],
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
    // Keys of the boards Factory stored in the project (Work, app and seed boards); each is stored
    // once, so one the project deleted stays deleted. Null on projects stored before the list.
    seeded_boards: { type: 'json', nullable: true },
    // Keys of the board migrations applied to the project, so each runs once: a field a user
    // later sets back to an old default is never rewritten again. Null before the first one.
    applied_migrations: { type: 'json', nullable: true },
  },
  uniqueIndexes: [{ name: 'factory_board_definition_versions_project', columns: ['org_id', 'factory_project_id'] }],
};
