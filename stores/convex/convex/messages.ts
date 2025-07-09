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
    paginationOpts: paginationOptsValidator,
  },
  handler: async (ctx, args) => {
    // Determine the sort order (defaulting to ascending)
    const sortOrder = args.sortDirection === 'desc' ? 'desc' : 'asc';

    // Query messages with the given threadId and apply sorting
    const query = ctx.db
      .query('messages')
      .withIndex('by_threadId', q => q.eq('threadId', args.threadId))
      .order(sortOrder);

    // Apply pagination using Convex's built-in pagination support
    // This will handle the cursor-based pagination efficiently
    const paginationResult = await query.paginate(args.paginationOpts);

    // Return the paginated result directly
    return paginationResult;
  },
});

/**
 * Save a message
 */
export const save = mutation({
  args: {
    message: v.any(),
    messages: v.optional(v.array(v.any())),
  },
  handler: async (ctx, args) => {
    // Handle single message
    if (args.message) {
      const message = args.message;

      const messageData = {
        messageId: message.id,
        threadId: message.threadId,
        messageType: message.type || 'assistant', // default to assistant if not specified
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
          messageType: message.type || 'assistant',
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
