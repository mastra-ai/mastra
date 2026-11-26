/**
 * Supabase Database Webhook payload types, from Supabase's webhook guide
 * (https://supabase.com/docs/guides/database/webhooks). A row's shape is
 * the table's, which Connect can't know, so records are untyped.
 */

/** A table row, by column. */
export type SupabaseTableRecord = Record<string, unknown>;

/** Supabase webhook payloads by Connect event type: the body's `type`. */
export interface SupabaseWebhookPayloads {
  INSERT: { type: 'INSERT'; table: string; schema: string; record: SupabaseTableRecord; old_record: null };
  UPDATE: {
    type: 'UPDATE';
    table: string;
    schema: string;
    record: SupabaseTableRecord;
    old_record: SupabaseTableRecord;
  };
  DELETE: { type: 'DELETE'; table: string; schema: string; record: null; old_record: SupabaseTableRecord };
}
