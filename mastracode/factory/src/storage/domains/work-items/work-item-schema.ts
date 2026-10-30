import type { CollectionSchema } from '@mastra/core/storage';

export type WorkItemProvider =
  | 'github'
  | 'gitlab'
  | 'jira'
  | 'linear'
  | 'slack'
  | 'incidentio'
  | 'factory'
  | (string & {});

export const WORK_ITEM_KINDS = ['issue', 'pull_request', 'merge_request', 'thread', 'incident', 'follow_up'] as const;
export type WorkItemKind = (typeof WORK_ITEM_KINDS)[number];

/** The work itself; external identities and facts belong to its sources. */
export const FACTORY_WORK_ITEMS_SCHEMA: CollectionSchema = {
  name: 'factory_work_items',
  columns: {
    id: { type: 'uuid-pk' },
    org_id: { type: 'text' },
    factory_project_id: { type: 'text' },
    title: { type: 'text' },
    parent_work_item_id: { type: 'text', nullable: true },
    revision: { type: 'integer', default: 1 },
    created_at: { type: 'timestamp' },
    updated_at: { type: 'timestamp' },
  },
  indexes: [{ name: 'factory_work_items_org_project_idx', columns: ['org_id', 'factory_project_id'] }],
};

/** Several external records can describe one work item. Native work has no source. */
export const FACTORY_WORK_ITEM_SOURCES_SCHEMA: CollectionSchema = {
  name: 'factory_work_item_sources',
  columns: {
    id: { type: 'uuid-pk' },
    org_id: { type: 'text' },
    factory_project_id: { type: 'text' },
    work_item_id: { type: 'text' },
    provider: { type: 'text' },
    kind: { type: 'text' },
    integration_id: { type: 'text' },
    source_type: { type: 'text' },
    workspace_id: { type: 'text', nullable: true },
    external_id: { type: 'text' },
    source_key: { type: 'text', nullable: true },
    url: { type: 'text', nullable: true },
    key: { type: 'text', nullable: true },
    state: { type: 'text', nullable: true },
    labels: { type: 'json' },
    author: { type: 'text', nullable: true },
    metadata: { type: 'json', nullable: true },
    revision: { type: 'integer', default: 1 },
    synced_at: { type: 'timestamp', nullable: true },
    created_at: { type: 'timestamp' },
    updated_at: { type: 'timestamp' },
  },
  uniqueIndexes: [
    {
      name: 'factory_work_item_sources_project_provider_external_unique',
      columns: ['org_id', 'factory_project_id', 'provider', 'external_id'],
    },
  ],
  indexes: [
    { name: 'factory_work_item_sources_work_item_idx', columns: ['work_item_id'] },
    { name: 'factory_work_item_sources_source_key_idx', columns: ['source_key'] },
  ],
};

/** Placement/process state. Its id preserves every legacy card reference. */
export const FACTORY_BOARD_ITEMS_SCHEMA: CollectionSchema = {
  name: 'factory_board_items',
  columns: {
    id: { type: 'uuid-pk' },
    org_id: { type: 'text' },
    factory_project_id: { type: 'text' },
    work_item_id: { type: 'text' },
    board: { type: 'text', nullable: true },
    parent_board_item_id: { type: 'text', nullable: true },
    stages: { type: 'json' },
    stage_history: { type: 'json' },
    sessions: { type: 'json' },
    metadata: { type: 'json', nullable: true },
    revision: { type: 'integer', default: 1 },
    created_by: { type: 'text' },
    created_at: { type: 'timestamp' },
    updated_at: { type: 'timestamp' },
    migrated_from_updated_at: { type: 'timestamp', nullable: true },
    migrated_from_hash: { type: 'text', nullable: true },
  },
  uniqueIndexes: [{ name: 'factory_board_items_work_item_unique', columns: ['work_item_id'] }],
  indexes: [
    {
      name: 'factory_board_items_org_project_created_at_id_idx',
      columns: ['org_id', 'factory_project_id', 'created_at', 'id'],
    },
    {
      name: 'factory_board_items_project_parent_idx',
      columns: ['org_id', 'factory_project_id', 'parent_board_item_id'],
    },
  ],
};

export interface WorkItemDbRecord extends Record<string, unknown> {
  id: string;
  org_id: string;
  factory_project_id: string;
  title: string;
  parent_work_item_id: string | null;
  revision: number;
  created_at: Date;
  updated_at: Date;
}

export interface WorkItemSourceDbRecord extends Record<string, unknown> {
  id: string;
  org_id: string;
  factory_project_id: string;
  work_item_id: string;
  provider: string;
  kind: string;
  integration_id: string;
  source_type: string;
  workspace_id: string | null;
  external_id: string;
  source_key: string | null;
  url: string | null;
  key: string | null;
  state: string | null;
  labels: string[];
  author: string | null;
  metadata: Record<string, unknown> | null;
  revision: number;
  synced_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

export interface BoardItemDbRecord extends Record<string, unknown> {
  id: string;
  org_id: string;
  factory_project_id: string;
  work_item_id: string;
  board: string | null;
  parent_board_item_id: string | null;
  stages: string[];
  stage_history: unknown[];
  sessions: Record<string, unknown>;
  metadata: Record<string, unknown> | null;
  revision: number;
  created_by: string;
  created_at: Date;
  updated_at: Date;
  migrated_from_updated_at: Date | null;
  migrated_from_hash: string | null;
}
