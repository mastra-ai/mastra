import {
    pgTable,
    text,
    timestamp,
    varchar,
    boolean,
    json,
    integer,
    pgEnum,
    index,
    unique
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { createId } from '@paralleldrive/cuid2';

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

export const recordStatusEnum = pgEnum('RecordStatus', [
    'ACTIVE',
    'ARCHIVED',
]);

// Connections Table
export const connections = pgTable('connections', {
    id: text('id').primaryKey().$defaultFn(() => createId()),
    name: varchar('name').notNull(),
    issues: text('issues').array().default([]).notNull(),
    syncConfig: json('sync_config'),
    connectionId: varchar().notNull(),
    createdAt: timestamp().defaultNow().notNull(),
    updatedAt: timestamp(),
    lastSyncAt: timestamp(),
    subscriptionId: text(),
});

export const connectionsUnique = unique('connectionNameUnique').on(connections.connectionId, connections.name);

export const subscriptionIdIdx = index('subscriptionIdIdx').on(connections.subscriptionId);

// Entities Table
export const entities = pgTable('entity', {
    id: text('id').primaryKey().$defaultFn(() => createId()),
    type: varchar('type').notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow(),
    createdBy: varchar('created_by').notNull(),
    kId: text('k_id').references(() => connections.id),
    lastSyncId: text('last_sync_id'),
});

export const entitiesUnique = unique('entities_k_id_unique').on(entities.kId, entities.type);

export const properties = pgTable('properties', {
    id: text('id').primaryKey().$defaultFn(() => createId()),
    name: varchar('name').notNull(),
    displayName: varchar('display_name').notNull(),
    visible: boolean('visible').default(true).notNull(),
    config: json('config'),
    description: text('description'),
    type: propertyTypeEnum('type').notNull(),
    order: integer('order').notNull(),
    modifiable: boolean('modifiable').default(true).notNull(),
    parentId: text('parent_id').references(() => properties.id),
    entityId: text('entity_id').references(() => entities.id),
});

// Credentials Table
export const credentials = pgTable('credentials', {
    id: text('id').primaryKey().$defaultFn(() => createId()),
    type: varchar('type').notNull(),
    value: json('value').notNull(),
    scope: text('scope').array().notNull(),
    kId: text('k_id').references(() => connections.id, { onDelete: 'cascade' }).unique(),
});

// Records Table
export const records = pgTable('records', {
    id: text('id').primaryKey().$defaultFn(() => createId()),
    externalId: text(),
    data: json('data').$type<Record<string, any>>().default({}).notNull(),
    source: varchar().default('MANUAL').notNull(),
    entityType: varchar().notNull(),
    entityId: text().references(() => entities.id),
    status: recordStatusEnum('status').default('ACTIVE').notNull(),
    deletedAt: timestamp('deleted_at', { mode: 'date' }),
    createdAt: timestamp('created_at', { mode: 'date' }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { mode: 'date' }).defaultNow(),
});

export const recordsExternalIdIdx = index('records_external_id_idx').on(records.externalId);

// Relations
export const propertiesRelations = relations(properties, ({ one, many }) => ({
    parent: one(properties, {
        fields: [properties.parentId],
        references: [properties.id],
        relationName: 'PropertyToProperty',
    }),
    compositeProperty: many(properties, {
        relationName: 'PropertyToProperty',
    }),
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