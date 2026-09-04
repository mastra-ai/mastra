import type { CollectionSchema } from '@mastra/core/storage';

export const WORK_ITEM_COMMENTS_SCHEMA: CollectionSchema = {
  name: 'work_item_comments',
  columns: {
    id: { type: 'uuid-pk' },
    org_id: { type: 'text' },
    factory_project_id: { type: 'text' },
    work_item_id: { type: 'text' },
    kind: { type: 'text', default: 'comment' },
    body: { type: 'text' },
    body_format: { type: 'text', default: 'markdown' },
    author_kind: { type: 'text' },
    author_id: { type: 'text' },
    author_display_name: { type: 'text', nullable: true },
    author_avatar_url: { type: 'text', nullable: true },
    author_external: { type: 'json', nullable: true },
    reply_to_comment_id: { type: 'text', nullable: true },
    reply_quote: { type: 'text', nullable: true },
    reply_to_author_id: { type: 'text', nullable: true },
    reply_to_author_name: { type: 'text', nullable: true },
    mentions: { type: 'json' },
    external_source: { type: 'json', nullable: true },
    source_key: { type: 'text', nullable: true },
    occurred_at: { type: 'timestamp' },
    edited_at: { type: 'timestamp', nullable: true },
    deleted_at: { type: 'timestamp', nullable: true },
    deleted_by: { type: 'text', nullable: true },
    revision: { type: 'integer', default: 1 },
    created_at: { type: 'timestamp' },
    updated_at: { type: 'timestamp' },
  },
  uniqueIndexes: [
    {
      name: 'work_item_comments_project_source_key_unique',
      columns: ['factory_project_id', 'source_key'],
      whereNotNull: 'source_key',
    },
  ],
  indexes: [
    {
      name: 'work_item_comments_feed_idx',
      columns: ['org_id', 'factory_project_id', 'work_item_id', 'occurred_at', 'id'],
    },
  ],
};

export const WORK_ITEM_COMMENT_MENTIONS_SCHEMA: CollectionSchema = {
  name: 'work_item_comment_mentions',
  columns: {
    id: { type: 'uuid-pk' },
    comment_id: { type: 'text' },
    mentioned_kind: { type: 'text' },
    mentioned_id: { type: 'text' },
    author_id: { type: 'text' },
    org_id: { type: 'text' },
    factory_project_id: { type: 'text' },
    work_item_id: { type: 'text' },
    occurred_at: { type: 'timestamp' },
  },
  uniqueIndexes: [
    {
      name: 'work_item_comment_mentions_comment_target_unique',
      columns: ['comment_id', 'mentioned_kind', 'mentioned_id'],
    },
  ],
  indexes: [
    {
      name: 'work_item_comment_mentions_inbox_idx',
      columns: ['org_id', 'factory_project_id', 'mentioned_id', 'occurred_at', 'id'],
    },
    {
      name: 'work_item_comment_mentions_item_idx',
      columns: ['org_id', 'factory_project_id', 'work_item_id'],
    },
  ],
};

export const WORK_ITEM_ACTIVITY_SCHEMA: CollectionSchema = {
  name: 'work_item_activity',
  columns: {
    id: { type: 'uuid-pk' },
    org_id: { type: 'text' },
    factory_project_id: { type: 'text' },
    work_item_id: { type: 'text' },
    participant_id: { type: 'text' },
    occurrence: { type: 'integer', default: 1 },
    latest_comment_id: { type: 'text' },
    latest_author_id: { type: 'text' },
    latest_author_name: { type: 'text', nullable: true },
    occurred_at: { type: 'timestamp' },
    created_at: { type: 'timestamp' },
    updated_at: { type: 'timestamp' },
  },
  uniqueIndexes: [
    {
      name: 'work_item_activity_item_participant_unique',
      columns: ['work_item_id', 'participant_id'],
    },
  ],
  indexes: [
    {
      name: 'work_item_activity_inbox_idx',
      columns: ['org_id', 'factory_project_id', 'participant_id', 'occurred_at', 'id'],
    },
    {
      name: 'work_item_activity_item_idx',
      columns: ['org_id', 'factory_project_id', 'work_item_id'],
    },
  ],
};
