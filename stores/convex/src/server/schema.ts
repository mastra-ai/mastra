import { defineTable } from 'convex/server';
import { v } from 'convex/values';

export const mastraDocumentsTable = defineTable({
  table: v.string(),
  primaryKey: v.string(),
  record: v.any(),
})
  .index('by_table', ['table'])
  .index('by_table_primary', ['table', 'primaryKey']);
