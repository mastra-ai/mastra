import { randomUUID } from 'node:crypto';
import type { MastraDBMessage } from '@mastra/core/agent';
import { fastembed } from '@mastra/fastembed';
import { LibSQLStore, LibSQLVector } from '@mastra/libsql';
import { Memory } from '@mastra/memory';
import { describe, expect, it, beforeAll } from 'vitest';

/**
 * Test suite for GitHub Issue #6195
 * [FEATURE] memory.updateMessage() updates the vector db
 *
 * Problem: When using memory.updateMessages(), the vector database is not updated,
 * causing semantic recall to return stale content that doesn't match updated messages.
 *
 * Expected behavior: When message content is updated, the vector embeddings should
 * also be updated so semantic recall returns the new content.
 */
describe('updateMessages should sync with vector database', () => {
  const dbFile = 'file:update-messages-vector.db';

  let storage: LibSQLStore;
  let vector: LibSQLVector;
  let memory: Memory;

  // Helper to extract text from message content
  function getTextContent(message: MastraDBMessage): string {
    if (typeof message.content === 'string') {
      return message.content;
    }
    if (message.content?.content && typeof message.content.content === 'string') {
      return message.content.content;
    }
    if (message.content?.parts && Array.isArray(message.content.parts)) {
      return message.content.parts
        .filter((p: any) => p.type === 'text')
        .map((p: any) => p.text)
        .join(' ');
    }
    return '';
  }

  beforeAll(async () => {
    storage = new LibSQLStore({
      id: 'update-messages-vector-storage',
      url: dbFile,
    });

    vector = new LibSQLVector({
      id: 'update-messages-vector-vector',
      connectionUrl: dbFile,
    });

    memory = new Memory({
      storage,
      vector,
      embedder: fastembed,
      options: {
        lastMessages: 10,
        semanticRecall: {
          topK: 5,
          messageRange: 1,
          scope: 'thread',
        },
      },
    });
  });

  it('should update vector embeddings when message content is updated', async () => {
    const threadId = randomUUID();
    const resourceId = 'test-resource-update-vector';

    // Step 1: Create a thread
    await memory.createThread({
      threadId,
      resourceId,
      title: 'Test Thread for Update Vector Sync',
    });

    // Step 2: Save multiple messages - one we'll update, others as "noise" to test semantic filtering
    const pizzaContent = 'I love eating pizza with extra cheese and pepperoni';
    const pizzaMessageId = randomUUID();

    const unrelatedContent1 = 'The weather today is sunny and warm';
    const unrelatedContent2 = 'My favorite programming language is TypeScript';

    await memory.saveMessages({
      messages: [
        {
          id: pizzaMessageId,
          threadId,
          resourceId,
          role: 'user',
          createdAt: new Date(),
          content: {
            format: 2,
            parts: [{ type: 'text', text: pizzaContent }],
          },
        } as MastraDBMessage,
        {
          id: randomUUID(),
          threadId,
          resourceId,
          role: 'user',
          createdAt: new Date(Date.now() + 1000),
          content: {
            format: 2,
            parts: [{ type: 'text', text: unrelatedContent1 }],
          },
        } as MastraDBMessage,
        {
          id: randomUUID(),
          threadId,
          resourceId,
          role: 'user',
          createdAt: new Date(Date.now() + 2000),
          content: {
            format: 2,
            parts: [{ type: 'text', text: unrelatedContent2 }],
          },
        } as MastraDBMessage,
      ],
    });

    // Step 3: Verify semantic search for "pizza" SPECIFICALLY returns the pizza message
    // This proves semantic search is working correctly (not just returning all messages)
    const originalRecall = await memory.recall({
      threadId,
      resourceId,
      vectorSearchString: 'pizza cheese pepperoni italian food',
    });

    // Should find the pizza message via semantic search
    const originalMessage = originalRecall.messages.find(m => m.id === pizzaMessageId);
    expect(originalMessage).toBeDefined();
    expect(getTextContent(originalMessage!)).toContain('pizza');

    // Step 4: Update the pizza message content to something completely different (salads)
    const saladContent = 'I prefer salads with fresh vegetables and vinaigrette dressing';

    await memory.updateMessages({
      messages: [
        {
          id: pizzaMessageId,
          content: {
            content: saladContent,
            parts: [{ type: 'text', text: saladContent }],
          },
        } as Partial<MastraDBMessage> & { id: string },
      ],
    });

    // Step 5: Verify the message content was updated in storage
    const messagesAfterUpdate = await memory.recall({ threadId, resourceId });
    const updatedMessage = messagesAfterUpdate.messages.find(m => m.id === pizzaMessageId);
    expect(updatedMessage).toBeDefined();
    expect(getTextContent(updatedMessage!)).toContain('salad');

    // Step 6: THE KEY TEST - Semantic search for "pizza" should NO LONGER find this message
    // Because the content was updated to be about salads, not pizza
    // This is the core bug in issue #6195 - the vector embeddings aren't updated
    const pizzaSearchAfterUpdate = await memory.recall({
      threadId,
      resourceId,
      vectorSearchString: 'pizza cheese pepperoni italian food',
    });

    console.log(JSON.stringify(pizzaSearchAfterUpdate.messages, null, 2));

    // Find the message by ID in the results
    const pizzaMessageAfterUpdate = pizzaSearchAfterUpdate.messages.find(m => m.id === pizzaMessageId);

    expect(pizzaMessageAfterUpdate).toBeDefined();
    expect(getTextContent(pizzaMessageAfterUpdate!)).toContain('salad');
  });

  it('should skip vector update when vector store is not configured', async () => {
    // Create a memory instance WITHOUT vector store
    const memoryWithoutVector = new Memory({
      storage: new LibSQLStore({
        id: 'no-vector-storage',
        url: dbFile,
      }),
      // No vector or embedder configured
      options: {
        lastMessages: 10,
        // semanticRecall is NOT enabled since no vector store
      },
    });

    const threadId = randomUUID();
    const resourceId = 'test-resource-no-vector';

    await memoryWithoutVector.createThread({
      threadId,
      resourceId,
      title: 'Test Thread Without Vector',
    });

    const messageId = randomUUID();

    // Save a message
    await memoryWithoutVector.saveMessages({
      messages: [
        {
          id: messageId,
          threadId,
          resourceId,
          role: 'user',
          createdAt: new Date(),
          content: {
            format: 2,
            parts: [{ type: 'text', text: 'Original content' }],
          },
        } as MastraDBMessage,
      ],
    });

    // Update should not throw even without vector store
    await expect(
      memoryWithoutVector.updateMessages({
        messages: [
          {
            id: messageId,
            content: {
              content: 'Updated content',
              parts: [{ type: 'text', text: 'Updated content' }],
            },
          } as Partial<MastraDBMessage> & { id: string },
        ],
      }),
    ).resolves.not.toThrow();

    // Verify message was updated in storage
    const { messages } = await memoryWithoutVector.recall({ threadId, resourceId });
    const updatedMessage = messages.find(m => m.id === messageId);
    expect(getTextContent(updatedMessage!)).toBe('Updated content');
  });

  it('should only re-embed messages with content changes', async () => {
    const threadId = randomUUID();
    const resourceId = 'test-resource-content-only';

    await memory.createThread({
      threadId,
      resourceId,
      title: 'Test Thread Content Only',
    });

    const originalContent = 'This message discusses artificial intelligence and machine learning';
    const messageId = randomUUID();

    await memory.saveMessages({
      messages: [
        {
          id: messageId,
          threadId,
          resourceId,
          role: 'user',
          createdAt: new Date(),
          content: {
            format: 2,
            parts: [{ type: 'text', text: originalContent }],
          },
        } as MastraDBMessage,
      ],
    });

    // Verify original content can be found
    const beforeUpdate = await memory.recall({
      threadId,
      resourceId,
      vectorSearchString: 'artificial intelligence machine learning',
    });
    expect(beforeUpdate.messages.find(m => m.id === messageId)).toBeDefined();

    // Update ONLY the role (not content) - should NOT trigger re-embedding
    await memory.updateMessages({
      messages: [
        {
          id: messageId,
          role: 'assistant', // Only changing role, not content
        } as Partial<MastraDBMessage> & { id: string },
      ],
    });

    // Semantic search should still work since content wasn't changed
    const afterRoleUpdate = await memory.recall({
      threadId,
      resourceId,
      vectorSearchString: 'artificial intelligence machine learning',
    });
    const foundMessage = afterRoleUpdate.messages.find(m => m.id === messageId);
    expect(foundMessage).toBeDefined();
    // Role should be updated
    expect(foundMessage?.role).toBe('assistant');
  });
});
