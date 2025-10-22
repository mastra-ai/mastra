import { pgTable, text, serial, timestamp, jsonb, integer } from 'drizzle-orm/pg-core';

export const stories = pgTable('stories', {
  id: serial('id').primaryKey(),
  title: text('title').notNull(),
  prompt: text('prompt').notNull(),
  content: text('content'),
  status: text('status').notNull().default('draft'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const characters = pgTable('characters', {
  id: serial('id').primaryKey(),
  storyId: integer('story_id').references(() => stories.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  description: text('description'),
  createdAt: timestamp('created_at').defaultNow(),
});

export const storyOutlines = pgTable('story_outlines', {
  id: serial('id').primaryKey(),
  storyId: integer('story_id').references(() => stories.id, { onDelete: 'cascade' }),
  sections: jsonb('sections'),
  createdAt: timestamp('created_at').defaultNow(),
});

export type Story = typeof stories.$inferSelect;
export type Character = typeof characters.$inferSelect;
export type StoryOutline = typeof storyOutlines.$inferSelect;
