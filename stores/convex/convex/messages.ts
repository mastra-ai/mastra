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
