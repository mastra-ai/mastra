import z from 'zod';
import { getThreadByIdResponseSchema } from './memory';
import { conversationItemSchema } from './responses';

export const conversationIdPathParams = z.object({
  conversationId: z.string().describe('Unique identifier for the conversation thread'),
});

export const createConversationBodySchema = z.object({
  agent_id: z.string().describe('Mastra agent ID used to create the conversation thread'),
  conversation_id: z.string().optional().describe('Optional conversation ID to use as the raw threadId'),
  resource_id: z.string().optional().describe('Optional resource ID to associate with the conversation'),
  title: z.string().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export type CreateConversationBody = z.infer<typeof createConversationBodySchema>;

export const conversationObjectSchema = z.object({
  id: z.string(),
  object: z.literal('conversation'),
  thread: getThreadByIdResponseSchema,
});

export const conversationDeletedSchema = z.object({
  id: z.string(),
  object: z.literal('conversation.deleted'),
  deleted: z.literal(true),
});

export const conversationItemsListSchema = z.object({
  object: z.literal('list'),
  data: z.array(conversationItemSchema),
  first_id: z.string().nullable(),
  last_id: z.string().nullable(),
  has_more: z.boolean(),
});

export type ConversationObject = z.infer<typeof conversationObjectSchema>;
export type ConversationItemsList = z.infer<typeof conversationItemsListSchema>;
export type ConversationDeleted = z.infer<typeof conversationDeletedSchema>;
