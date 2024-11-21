import { createId } from '@paralleldrive/cuid2';
import { relations, sql } from 'drizzle-orm';

import { pgTable, text, timestamp, varchar, boolean, jsonb, integer, pgEnum, index, unique } from 'drizzle-orm/pg-core';

// Enums
export const propertyTypeEnum = pgEnum('PropertyType', [
  'LONG_TEXT',
  'SINGLE_LINE_TEXT',
  'SINGLE_SELECT',
  'MULTI_SELECT',
  'CHECKBOX',
  'DATE',
  'USER',
  'BADGE_LIST',
  'CURRENCY',
  'URL',
  'PHONE',
  'CONTACT',
  'COMPANY',
  'PERSON',
  'ENRICHMENT',
  'COMPOSITE',
  'BOOLEAN',
  'NUMBER',
  'FLOAT',
  'JSON_OBJECT',
  'JSON_ARRAY',
]);

export const recordStatusEnum = pgEnum('RecordStatus', ['ACTIVE', 'ARCHIVED']);

// Connections Table
export const connections = pgTable(
  'connections',
  {
    id: text()
      .primaryKey()
      .$defaultFn(() => createId()),
    name: varchar().notNull(),
    issues: text()
      .array()
      .default(sql`'{}'::text[]`)
      .notNull(),
    syncConfig: jsonb().$type<Record<string, any>>().default({}),
    connectionId: varchar().notNull(),
    createdAt: timestamp().defaultNow().notNull(),
    updatedAt: timestamp(),
    lastSyncAt: timestamp(),
    subscriptionId: text(),
  },
  t => ({
    subscriptionIdIdx: index('subscriptionIdIdx').on(t.subscriptionId),
    connectionsUnique: unique('connectionNameUnique').on(t.connectionId, t.name),
  }),
);

// Entities Table
export const entities = pgTable(
  'entity',
  {
    id: text()
      .primaryKey()
      .$defaultFn(() => createId()),
    type: varchar().notNull(),
    createdAt: timestamp().defaultNow().notNull(),
    updatedAt: timestamp().defaultNow(),
    createdBy: varchar().notNull(),
    kId: text().references(() => connections.id),
    lastSyncId: text(),
  },
  t => ({
    entitiesUnique: unique('entities_k_id_unique').on(t.kId, t.type),
  }),
);

export const properties = pgTable('properties', {
  id: text()
    .primaryKey()
    .$defaultFn(() => createId()),
  name: varchar().notNull(),
  displayName: varchar().notNull(),
  visible: boolean().default(true).notNull(),
  config: jsonb().$type<Record<string, any>>().default({}),
  description: text(),
  type: propertyTypeEnum().notNull(),
  order: integer().notNull(),
  modifiable: boolean().default(true).notNull(),
  entityId: text().references(() => entities.id),
});

// Credentials Table
export const credentials = pgTable('credentials', {
  id: text()
    .primaryKey()
    .$defaultFn(() => createId()),
  type: varchar().notNull(),
  value: jsonb().$type<Record<string, any>>().default({}).notNull(),
  scope: text()
    .array()
    .default(sql`'{}'::text[]`)
    .notNull(),
  kId: text()
    .references(() => connections.id, { onDelete: 'cascade' })
    .unique(),
});

// Records Table
export const records = pgTable(
  'records',
  {
    id: text()
      .primaryKey()
      .$defaultFn(() => createId()),
    externalId: text(),
    data: jsonb().$type<Record<string, any>>().default({}).notNull(),
    source: varchar().default('MANUAL').notNull(),
    entityType: varchar().notNull(),
    entityId: text().references(() => entities.id),
    status: recordStatusEnum().default('ACTIVE').notNull(),
    deletedAt: timestamp({ mode: 'date' }),
    createdAt: timestamp({ mode: 'date' }).defaultNow().notNull(),
    updatedAt: timestamp({ mode: 'date' }).defaultNow(),
  },
  t => ({
    recordsExternalIdIdx: index('records_external_id_idx').on(t.externalId),
  }),
);

// Relations
export const propertiesRelations = relations(properties, ({ one }) => ({
  entity: one(entities, {
    fields: [properties.entityId],
    references: [entities.id],
  }),
}));

export const recordsRelations = relations(records, ({ one }) => ({
  entity: one(entities, {
    fields: [records.entityId],
    references: [entities.id],
  }),
}));

export const credentialsRelations = relations(credentials, ({ one }) => ({
  connection: one(connections, {
    fields: [credentials.kId],
    references: [connections.id],
  }),
}));

export const connectionsRelations = relations(connections, ({ one, many }) => ({
  credential: one(credentials),
  entities: many(entities),
}));

export const entitiesRelations = relations(entities, ({ many, one }) => ({
  properties: many(properties),
  records: many(records),
  connection: one(connections, {
    fields: [entities.kId],
    references: [connections.id],
  }),
}));

// Types for better type safety
export type Property = typeof properties.$inferSelect;
export type NewProperty = typeof properties.$inferInsert;

export type MastraRecord = typeof records.$inferSelect;
export type NewRecord = typeof records.$inferInsert;

export type Credential = typeof credentials.$inferSelect;
export type NewCredential = typeof credentials.$inferInsert;

export type Connection = typeof connections.$inferSelect;
export type NewConnection = typeof connections.$inferInsert;

export type Entity = typeof entities.$inferSelect;
export type NewEntity = typeof entities.$inferInsert;
