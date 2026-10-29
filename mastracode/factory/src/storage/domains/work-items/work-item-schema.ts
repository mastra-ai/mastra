/**
 * Provider work items and board items.
 *
 * A *work item* says what the work is: the GitHub issue, GitLab merge request,
 * Jira issue, Linear issue, Slack thread, incident.io follow-up, or Factory
 * card it points at, with the provider's key, title, state, labels and author.
 * Provider sync writes only work items.
 *
 * A *board item* says where that work sits in a Factory project: its board,
 * stages, sessions, claim, revision and Factory-owned metadata (process state
 * and trust stamps). Rules, transitions and people moving cards write only
 * board items, so a provider sync can never make a stage move stale.
 *
 * A board item keeps the id the legacy `work_items` row had, so every
 * `work_item_id` column elsewhere (comments, subscriptions, run bindings, rule
 * state) now holds a board item id without a row rewrite.
 */

import type { CollectionSchema } from '@mastra/core/storage';

import type { FactoryTriageType } from '../../../rules/types.js';

/** Known providers; custom integrations keep their integration id as the provider. */
export type WorkItemProvider =
  | 'github'
  | 'gitlab'
  | 'jira'
  | 'linear'
  | 'slack'
  | 'incidentio'
  | 'factory'
  | (string & {});

export type WorkItemKind = 'issue' | 'pull_request' | 'merge_request' | 'thread' | 'incident' | 'follow_up';

export const FACTORY_WORK_ITEMS_SCHEMA: CollectionSchema = {
  name: 'factory_work_items',
  columns: {
    id: { type: 'uuid-pk' },
    org_id: { type: 'text' },
    factory_project_id: { type: 'text' },
    provider: { type: 'text' },
    kind: { type: 'text' },
    /** The integration that filed it (`ExternalWorkItemSource.integrationId`). */
    integration_id: { type: 'text' },
    /** The integration's own source type (`ExternalWorkItemSource.type`). */
    source_type: { type: 'text' },
    workspace_id: { type: 'text', nullable: true },
    /** Provider-scoped id, workspace-qualified when the provider has one. */
    external_id: { type: 'text' },
    /** `externalSourceKey(...)` of the source; null for Factory-native cards. */
    source_key: { type: 'text', nullable: true },
    url: { type: 'text', nullable: true },
    /** What a person reads: `acme/app#12`, `ENG-42`, `INC-7`. */
    key: { type: 'text', nullable: true },
    title: { type: 'text' },
    state: { type: 'text', nullable: true },
    labels: { type: 'json' },
    author: { type: 'text', nullable: true },
    /** The provider's own parent (a sub-issue's parent), not Factory's card link. */
    parent_work_item_id: { type: 'text', nullable: true },
    /** Provider facts without a column of their own. */
    metadata: { type: 'json', nullable: true },
    revision: { type: 'integer', default: 1 },
    synced_at: { type: 'timestamp', nullable: true },
    created_at: { type: 'timestamp' },
    updated_at: { type: 'timestamp' },
  },
  uniqueIndexes: [
    {
      name: 'factory_work_items_project_provider_external_unique',
      columns: ['org_id', 'factory_project_id', 'provider', 'external_id'],
    },
  ],
  indexes: [
    // A platform message carries only its source, no org or project.
    { name: 'factory_work_items_source_key_idx', columns: ['source_key'] },
    { name: 'factory_work_items_org_project_idx', columns: ['org_id', 'factory_project_id'] },
  ],
};

export const FACTORY_BOARD_ITEMS_SCHEMA: CollectionSchema = {
  name: 'factory_board_items',
  columns: {
    id: { type: 'uuid-pk' },
    org_id: { type: 'text' },
    factory_project_id: { type: 'text' },
    work_item_id: { type: 'text' },
    board: { type: 'text', nullable: true },
    claim_key: { type: 'text', nullable: true },
    /** Factory's own card-to-card link (a Review card to the issue card it came from). */
    parent_board_item_id: { type: 'text', nullable: true },
    stages: { type: 'json' },
    stage_history: { type: 'json' },
    sessions: { type: 'json' },
    /** Factory-owned keys only: process state and trust stamps. */
    metadata: { type: 'json', nullable: true },
    triage_type: { type: 'text', nullable: true },
    autonomy_armed_at: { type: 'timestamp', nullable: true },
    plans_preapproved_at: { type: 'timestamp', nullable: true },
    accepted_at: { type: 'timestamp', nullable: true },
    comment_count: { type: 'integer', default: 0 },
    feed_activity_at: { type: 'timestamp', nullable: true },
    revision: { type: 'integer', default: 1 },
    created_by: { type: 'text' },
    created_at: { type: 'timestamp' },
    updated_at: { type: 'timestamp' },
    /**
     * The legacy `work_items.updated_at` this row was copied from. The split
     * migration re-copies a legacy row whose `updated_at` is newer, which is how
     * a rolling deploy picks up cards an older replica changed after cutover.
     * Null for board items created after the split.
     */
    migrated_from_updated_at: { type: 'timestamp', nullable: true },
  },
  uniqueIndexes: [
    { name: 'factory_board_items_work_item_unique', columns: ['work_item_id'] },
    // One live card per claimed external record per org; NULL keys never collide.
    { name: 'factory_board_items_org_claim_key_unique', columns: ['org_id', 'claim_key'] },
  ],
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
  provider: string;
  kind: string;
  integration_id: string;
  source_type: string;
  workspace_id: string | null;
  external_id: string;
  source_key: string | null;
  url: string | null;
  key: string | null;
  title: string;
  state: string | null;
  labels: string[];
  author: string | null;
  parent_work_item_id: string | null;
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
  claim_key: string | null;
  parent_board_item_id: string | null;
  stages: string[];
  stage_history: unknown[];
  sessions: Record<string, unknown>;
  metadata: Record<string, unknown> | null;
  triage_type: FactoryTriageType | null;
  autonomy_armed_at: Date | null;
  plans_preapproved_at: Date | null;
  accepted_at: Date | null;
  comment_count: number;
  feed_activity_at: Date | null;
  revision: number;
  created_by: string;
  created_at: Date;
  updated_at: Date;
  migrated_from_updated_at: Date | null;
}
