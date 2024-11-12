// model Property {
//     entity    Entity? @relation(fields: [entityId], references: [id])
//     entityId  String?
//   }

import { pgEnum, text, boolean, pgTable, jsonb, integer } from "drizzle-orm/pg-core";
import { relations } from 'drizzle-orm'
import { createId } from '@paralleldrive/cuid2';

export const propertyTypeEnum = pgEnum('property_type', [
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

export type PropertyType = typeof propertyTypeEnum.enumValues[number];

export const properties = pgTable("properties", {
    id: text().primaryKey().$defaultFn(() => createId()),
    name: text().notNull(),
    description: text(),
    displayName: text().notNull(),
    type: propertyTypeEnum('type').notNull(),
    visible: boolean().$default(() => true),
    modifiable: boolean().$default(() => true),
    order: integer().notNull(),
    config: jsonb('config'),
});

export const propertiesRelations = relations(properties, ({ one, many }) => {
    return {
        parent: one(properties),
        compositeProperty: many(properties),
    }
})