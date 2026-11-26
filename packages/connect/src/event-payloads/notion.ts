/**
 * Notion webhook payload types, written by hand from Notion's event
 * reference (https://developers.notion.com/reference/webhooks-events-delivery):
 * Notion publishes no machine-readable schema for its webhooks.
 *
 * `data` follows each event's sample payload. Events the reference gives no
 * sample for carry an optional, untyped `data`.
 */

type NotionParentType = 'page' | 'block' | 'database' | 'data_source' | 'space' | 'workspace' | (string & {});

/** Where the changed entity lives. */
export interface NotionParent {
  id: string;
  type: NotionParentType;
}

/** A person or bot, by id. */
export interface NotionActor {
  id: string;
  type: 'person' | 'bot';
}

/** A Notion webhook body. */
export interface NotionWebhook<Type extends string, Entity extends string, Data> {
  /** Notion's id for the event. */
  id: string;
  /** When the event occurred, as ISO 8601. */
  timestamp: string;
  workspace_id: string;
  workspace_name: string;
  subscription_id: string;
  integration_id: string;
  type: Type;
  /** Who made the change; more than one for aggregated events. */
  authors: NotionActor[];
  /** For public integrations, who can see the entity through the integration. */
  accessible_by?: NotionActor[];
  /** Which delivery attempt this is, from 1 to 8. */
  attempt_number: number;
  /** The API version the event is rendered with. */
  api_version?: string;
  /** The changed object. A linked database is a `block`. */
  entity: { id: string; type: Entity };
  data: Data;
}

type NotionEntityEvent<Type extends string, Entity extends string, Extra = unknown> = NotionWebhook<
  Type,
  Entity,
  { parent: NotionParent } & Extra
>;

type NotionUnsampledEvent<Type extends string, Entity extends string> = Omit<
  NotionWebhook<Type, Entity, never>,
  'data'
> & { data?: Record<string, unknown> };

/** A property changed on a schema, by its id and name. */
export interface NotionSchemaPropertyChange {
  id: string;
  name: string;
  action: 'created' | 'updated' | 'deleted';
}

type UpdatedBlocks = { updated_blocks: Array<{ id: string; type: 'block' }> };
type UpdatedSchema = { updated_properties: NotionSchemaPropertyChange[] };
type CommentData = { page_id: string; discussion_id?: string };

/** Notion webhook payloads by Connect event type: the body's `type`. */
export interface NotionWebhookPayloads {
  'comment.created': NotionEntityEvent<'comment.created', 'comment', CommentData>;
  'comment.deleted': NotionEntityEvent<'comment.deleted', 'comment', CommentData>;
  'comment.updated': NotionEntityEvent<'comment.updated', 'comment', CommentData>;
  'data_source.content_updated': NotionEntityEvent<'data_source.content_updated', 'data_source', UpdatedBlocks>;
  'data_source.created': NotionEntityEvent<'data_source.created', 'data_source'>;
  'data_source.deleted': NotionEntityEvent<'data_source.deleted', 'data_source'>;
  'data_source.moved': NotionEntityEvent<'data_source.moved', 'data_source'>;
  'data_source.schema_updated': NotionEntityEvent<'data_source.schema_updated', 'data_source', UpdatedSchema>;
  'data_source.undeleted': NotionEntityEvent<'data_source.undeleted', 'data_source'>;
  /** @deprecated Sent with API versions before 2025-09-03; see `data_source.content_updated`. */
  'database.content_updated': NotionEntityEvent<'database.content_updated', 'database' | 'block', UpdatedBlocks>;
  'database.created': NotionEntityEvent<'database.created', 'database' | 'block'>;
  'database.deleted': NotionEntityEvent<'database.deleted', 'database' | 'block'>;
  'database.moved': NotionEntityEvent<'database.moved', 'database' | 'block'>;
  /** @deprecated Sent with API versions before 2025-09-03; see `data_source.schema_updated`. */
  'database.schema_updated': NotionEntityEvent<'database.schema_updated', 'database' | 'block', UpdatedSchema>;
  'database.undeleted': NotionEntityEvent<'database.undeleted', 'database' | 'block'>;
  'file_upload.completed': NotionUnsampledEvent<'file_upload.completed', 'file_upload'>;
  'file_upload.created': NotionUnsampledEvent<'file_upload.created', 'file_upload'>;
  'file_upload.expired': NotionUnsampledEvent<'file_upload.expired', 'file_upload'>;
  'file_upload.upload_failed': NotionUnsampledEvent<'file_upload.upload_failed', 'file_upload'>;
  'page.content_updated': NotionEntityEvent<'page.content_updated', 'page', UpdatedBlocks>;
  'page.created': NotionEntityEvent<'page.created', 'page'>;
  'page.deleted': NotionEntityEvent<'page.deleted', 'page'>;
  'page.locked': NotionEntityEvent<'page.locked', 'page'>;
  'page.moved': NotionEntityEvent<'page.moved', 'page'>;
  'page.properties_updated': NotionEntityEvent<
    'page.properties_updated',
    'page',
    { /** Ids of the properties that changed. */ updated_properties: string[] }
  >;
  'page.transcription_block.transcript_deleted': NotionUnsampledEvent<
    'page.transcription_block.transcript_deleted',
    'page' | 'block'
  >;
  'page.undeleted': NotionEntityEvent<'page.undeleted', 'page'>;
  'page.unlocked': NotionEntityEvent<'page.unlocked', 'page'>;
  'view.created': NotionUnsampledEvent<'view.created', 'view'>;
  'view.deleted': NotionUnsampledEvent<'view.deleted', 'view'>;
  'view.updated': NotionUnsampledEvent<'view.updated', 'view'>;
}
