import { paginationOptsValidator } from 'convex/server';
import { v } from 'convex/values';
import type { Doc } from './_generated/dataModel';
import { query, mutation } from './_generated/server';

/**
 * Get a message by its ID
 */
export const get = query({
  args: { id: v.string() },
  handler: async (ctx, args) => {
    const message = await ctx.db
      .query('messages')
      .withIndex('by_messageId', q => q.eq('messageId', args.id))
      .first();

    return message || null;
  },
});

/**
 * Get messages for a thread with efficient pagination
 */
export const getByThreadId = query({
  args: {
    threadId: v.string(),
    sortDirection: v.optional(v.union(v.literal('asc'), v.literal('desc'))),
    paginationOpts: v.optional(paginationOptsValidator),
  },
  handler: async (ctx, args) => {
    // Determine the sort order (defaulting to ascending)
    const sortOrder = args.sortDirection === 'desc' ? 'desc' : 'asc';

    // Query messages with the given threadId and apply sorting
    const query = ctx.db
      .query('messages')
      .withIndex('by_threadId', q => q.eq('threadId', args.threadId))
      .order(sortOrder);

    // Apply pagination using Convex's built-in pagination support if pagination options are provided
    // Otherwise, just collect all results
    if (args.paginationOpts) {
      // This will handle the cursor-based pagination efficiently
      const paginationResult = await query.paginate(args.paginationOpts);
      return paginationResult;
    } else {
      // Return all results when no pagination is requested
      const messages = await query.collect();
      return { page: messages, isDone: true, continueCursor: null };
    }
  },
});

/**
 * Save a message
 */
export const save = mutation({
  args: {
    message: v.optional(v.any()),
    messages: v.optional(v.array(v.any())),
  },
  handler: async (ctx, args) => {
    // Handle single message
    if (args.message) {
      const message = args.message;

      const messageData = {
        messageId: message.id,
        threadId: message.threadId,
        messageType: message.role || 'assistant', // Use role property for message type
        content: {
          content: message.content,
          metadata: message.metadata || {},
        },
        createdAt: message.createdAt || Date.now(),
      };

      // Check if message already exists
      const existingMessage = await ctx.db
        .query('messages')
        .withIndex('by_messageId', q => q.eq('messageId', message.id))
        .first();

      if (existingMessage) {
        // Update existing message
        await ctx.db.patch(existingMessage._id, messageData);
      } else {
        // Insert new message
        await ctx.db.insert('messages', messageData);
      }

      return message;
    }

    // Handle multiple messages
    if (args.messages && args.messages.length > 0) {
      const savedMessages = [];

      for (const message of args.messages) {
        const messageData = {
          messageId: message.id,
          threadId: message.threadId,
          messageType: message.role || 'assistant', // Use role property for message type
          content: {
            content: message.content,
            metadata: message.metadata || {},
          },
          createdAt: message.createdAt || Date.now(),
        };

        // Check if message already exists
        const existingMessage = await ctx.db
          .query('messages')
          .withIndex('by_messageId', q => q.eq('messageId', message.id))
          .first();

        if (existingMessage) {
          // Update existing message
          await ctx.db.patch(existingMessage._id, messageData);
        } else {
          // Insert new message
          await ctx.db.insert('messages', messageData);
        }

        savedMessages.push(message);
      }

      return savedMessages;
    }

    return args.message || [];
  },
});

/**
 * Save multiple messages in a batch
 */
export const batchSave = mutation({
  args: {
    messages: v.array(
      v.object({
        id: v.string(),
        threadId: v.string(),
        role: v.optional(v.string()),
        content: v.any(),
        metadata: v.optional(v.any()),
        createdAt: v.optional(v.number()),
      }),
    ),
  },
  handler: async (ctx, args) => {
    const { messages } = args;
    const savedMessages = [];

    for (const message of messages) {
      const messageData = {
        messageId: message.id,
        threadId: message.threadId,
        messageType: message.role || 'assistant',
        content: {
          content: message.content,
          metadata: message.metadata || {},
        },
        createdAt: message.createdAt || Date.now(),
      };

      // Check if message already exists
      const existingMessage = await ctx.db
        .query('messages')
        .withIndex('by_messageId', q => q.eq('messageId', message.id))
        .first();

      let savedMessage;
      if (existingMessage) {
        // Update existing message
        await ctx.db.patch(existingMessage._id, messageData);
        savedMessage = { ...messageData, _id: existingMessage._id };
      } else {
        // Insert new message
        const id = await ctx.db.insert('messages', messageData);
        savedMessage = { ...messageData, _id: id };
      }

      savedMessages.push(savedMessage);
    }

    return { success: true, count: savedMessages.length };
  },
});

/**
 * Update messages
 */
export const update = mutation({
  args: {
    messages: v.array(v.any()),
  },
  handler: async (ctx, args) => {
    const { messages } = args;
    const updatedMessages = [];

    for (const message of messages) {
      // Find the message by ID
      const existingMessage = await ctx.db
        .query('messages')
        .withIndex('by_messageId', q => q.eq('messageId', message.id))
        .first();

      if (!existingMessage) {
        throw new Error(`Message with ID ${message.id} not found`);
      }

      // Update message fields
      const updateData: Partial<Doc<'messages'>> = {};

      if (message.content !== undefined) {
        updateData.content = {
          ...existingMessage.content,
          content: message.content,
        };
      }

      if (message.metadata !== undefined) {
        updateData.content = {
          ...existingMessage.content,
          metadata: message.metadata,
        };
      }

      if (message.type !== undefined) {
        updateData.messageType = message.type;
      }

      // Update the message
      await ctx.db.patch(existingMessage._id, updateData);

      // Prepare updated message for return
      const updatedMessage = {
        ...existingMessage,
        ...message,
      };

      updatedMessages.push(updatedMessage);
    }

    return updatedMessages;
  },
});

// Helper functions removed as we're now using a simpler in-memory pagination approach

/**
 * Get paginated messages for a thread
 *
 * Supports pagination with page number and items per page
 * Returns messages with metadata about pagination status
 */
export const getPaginated = query({
  args: {
    threadId: v.string(),
    selectBy: v.object({
      pagination: v.object({
        page: v.number(),
        perPage: v.number(),
      }),
    }),
    format: v.string(),
  },
  handler: async (
    ctx,
    args,
  ): Promise<{
    messages: Array<{
      id: string;
      threadId: string;
      role: string;
      content: any; // Using any here as the content structure varies
      metadata?: Record<string, any>;
      createdAt: number; // Using number (timestamp) instead of Date to be compatible with Convex
    }>;
    total: number;
    page: number;
    perPage: number;
    hasMore: boolean;
  }> => {
    const { threadId, selectBy } = args;
    const { page, perPage } = selectBy.pagination;

    // Get all messages for this thread
    const allMessages = await ctx.db
      .query('messages')
      .withIndex('by_threadId', q => q.eq('threadId', threadId))
      .order('desc')
      .collect();

    // Calculate total count
    const total = allMessages.length;

    // Manually calculate pagination
    const startIndex = (page - 1) * perPage;
    const endIndex = startIndex + perPage;
    const paginatedMessages = allMessages.slice(startIndex, endIndex);

    // Transform the Convex document format to match expected MastraMessageV2 format
    type ConvexMessage = Doc<'messages'> & {
      messageId: string;
      threadId: string;
      messageType: string;
      content: {
        content: any;
        metadata?: Record<string, any>;
      };
      createdAt: number;
    };

    const messages = paginatedMessages.map((doc: ConvexMessage) => {
      return {
        id: doc.messageId,
        threadId: doc.threadId,
        role: doc.messageType,
        content: doc.content.content,
        metadata: doc.content.metadata || {},
        createdAt: doc.createdAt, // Return as timestamp (number) instead of Date object
      };
    });

    // Calculate if there are more messages
    const hasMore = total > endIndex;

    return {
      messages,
      total,
      page,
      perPage,
      hasMore,
    };
  },
});

/**
 * Load messages based on different key combinations
 * @param keys Object containing one of:
 *   - messageId: string - Get a single message by its ID
 *   - threadId: string - Get messages for a thread
 *   - paginationOpts?: PaginationOptions - Optional pagination options
 *   - sortDirection?: 'asc' | 'desc' - Sort order (default: 'asc')
 */
export const load = query({
  args: {
    keys: v.record(v.string(), v.any()), // Using v.any() to support complex values like paginationOpts
  },
  handler: async (ctx, args) => {
    const { keys } = args;

    // Handle single message by ID
    if (keys.messageId && typeof keys.messageId === 'string') {
      const message = await ctx.db
        .query('messages')
        .withIndex('by_messageId', q => q.eq('messageId', keys.messageId))
        .first();
      return message || null;
    }

    // Handle messages by threadId
    if (keys.threadId && typeof keys.threadId === 'string') {
      const sortOrder = keys.sortDirection === 'desc' ? 'desc' : 'asc';
      let query = ctx.db
        .query('messages')
        .withIndex('by_threadId', q => q.eq('threadId', keys.threadId))
        .order(sortOrder);

      // Apply pagination if options are provided
      if (keys.paginationOpts) {
        return await query.paginate(keys.paginationOpts);
      }

      // Return all results if no pagination
      const messages = await query.collect();
      return messages.map(message => ({
        id: message.messageId,
        threadId: message.threadId,
        role: message.messageType,
        content: message.content,
        createdAt: message.createdAt,
      }));
    }

    throw new Error('Must provide either messageId or threadId in keys');
  },
});
