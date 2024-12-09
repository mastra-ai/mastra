import { createId } from '@paralleldrive/cuid2';
import { relations } from 'drizzle-orm';

import { text, timestamp, varchar, jsonb, index, unique, pgSchema } from 'drizzle-orm/pg-core';

export const mastraSchema = pgSchema('mastra');

// Entities Table
export const entities = mastraSchema.table(
  'entity',
  {
    id: text()
      .primaryKey()
      .$defaultFn(() => createId()),
    name: varchar().notNull(),
    createdAt: timestamp().defaultNow().notNull(),
    updatedAt: timestamp().defaultNow(),
    connectionId: text().notNull(),
    lastSyncId: text(),
  },
  t => ({
    entitiesUnique: unique('entities_connection_id_unique').on(t.connectionId, t.name),
  }),
);

// Records Table
export const records = mastraSchema.table(
  'records',
  {
    id: text()
      .primaryKey()
      .$defaultFn(() => createId()),
    externalId: text().notNull(),
    data: jsonb().$type<Record<string, any>>().default({}).notNull(),
    entityType: varchar().notNull(),
    entityId: text()
      .references(() => entities.id)
      .notNull(),
    deletedAt: timestamp({ mode: 'date' }),
    createdAt: timestamp({ mode: 'date' }).defaultNow().notNull(),
    updatedAt: timestamp({ mode: 'date' }).defaultNow(),
  },
  t => ({
    recordsExternalIdIdx: index('records_external_id_idx').on(t.externalId),
  }),
);

export const recordsRelations = relations(records, ({ one }) => ({
  entity: one(entities, {
    fields: [records.entityId],
    references: [entities.id],
  }),
}));

export type MastraRecord = typeof records.$inferSelect;
export type NewRecord = typeof records.$inferInsert;

export type Entity = typeof entities.$inferSelect;
export type NewEntity = typeof entities.$inferInsert;
