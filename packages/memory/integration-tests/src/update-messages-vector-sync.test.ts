import { randomUUID } from 'node:crypto';
import { fastembed } from '@mastra/fastembed';
import { LibSQLStore, LibSQLVector } from '@mastra/libsql';
import { Memory } from '@mastra/memory';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

/**
 * Test to verify that memory.updateMessages() updates the vector database
 * to keep semantic recall in sync with the updated message content.
 *
 * Issue: https://github.com/mastra-ai/mastra/issues/6195
 *
 * Problem: When using memory.updateMessage(), the semantic recall (vector database)
 * doesn't get updated, causing a mismatch between the updated messages and
 * semantic recall results.
 */
describe('updateMessages should sync vector database (Issue #6195)', () => {
  let memory: Memory;
  let storage: LibSQLStore;
  let vector: LibSQLVector;
  let threadId: string;
  const resourceId = `test-resource-${randomUUID()}`;

  beforeEach(async () => {
    // Use a unique file-based database for each test to avoid state pollution
    const uniqueId = randomUUID();
    const dbFile = `file:/tmp/test-${uniqueId}.db`;

    storage = new LibSQLStore({
      id: `update-msg-storage-${uniqueId}`,
      url: dbFile,
    });
    vector = new LibSQLVector({
      url: dbFile,
      id: `update-msg-vector-${uniqueId}`,
    });

    // Initialize storage to create tables
    await storage.init();

    memory = new Memory({
      storage,
      vector,
      embedder: fastembed,
      options: {
        semanticRecall: {
          topK: 5,
          messageRange: 0,
          scope: 'thread',
        },
        lastMessages: false,
      },
    });

    // Create a thread for testing
    const thread = await memory.saveThread({
      thread: {
        id: randomUUID(),
        title: 'Update Message Vector Test',
        resourceId,
        metadata: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });
    threadId = thread.id;
  });

  afterEach(async () => {
    try {
      // @ts-ignore - accessing internal client for cleanup
      await storage.client?.close();
      // @ts-ignore - accessing internal client for cleanup
      await vector.turso?.close();
    } catch {
      // Ignore cleanup errors
    }
  });

  it('should update vector embeddings when message content is updated', async () => {
    // Step 1: Save a message with original content about "quantum physics"
    const originalContent = 'Quantum physics explores subatomic particles and wave functions in the universe.';
    const originalMessage = {
      id: randomUUID(),
      threadId,
      content: {
        format: 2 as const,
        parts: [{ type: 'text' as const, text: originalContent }],
      },
      role: 'user' as const,
      createdAt: new Date(),
      resourceId,
    };

    await memory.saveMessages({ messages: [originalMessage] });

    // Step 2: Get the vector ID before update
    const vectorsBefore = await vector.query({
      indexName: 'memory_messages_384',
      queryVector: new Array(384).fill(0.01),
      topK: 100,
    });
    const vectorIdBefore = vectorsBefore[0]?.id;
    expect(vectorIdBefore).toBeDefined();

    // Verify original content has HIGH score for physics query
    // @ts-ignore - accessing protected method
    const { embeddings: physicsEmbeddings } = await memory.embedMessageContent(
      'quantum physics subatomic particles wave functions',
    );
    const physicsResultsBefore = await vector.query({
      indexName: 'memory_messages_384',
      queryVector: physicsEmbeddings[0],
      topK: 5,
    });
    const physicsScoreBefore = physicsResultsBefore[0]?.score ?? 0;
    expect(physicsScoreBefore).toBeGreaterThan(0.7); // High similarity to original content

    // Step 3: Update the message to be about "cooking recipes" (completely different topic)
    const updatedContent = 'Italian pasta recipes include carbonara, bolognese, and pesto with fresh basil.';

    await memory.updateMessages({
      messages: [
        {
          id: originalMessage.id,
          content: {
            format: 2 as const,
            parts: [{ type: 'text' as const, text: updatedContent }],
          },
        },
      ],
    });

    // Step 4: Verify the vector was replaced (different ID)
    const vectorsAfter = await vector.query({
      indexName: 'memory_messages_384',
      queryVector: new Array(384).fill(0.01),
      topK: 100,
    });
    const vectorIdAfter = vectorsAfter[0]?.id;
    expect(vectorIdAfter).toBeDefined();
    expect(vectorIdAfter).not.toBe(vectorIdBefore); // Vector was deleted and recreated

    // Step 5: Verify "quantum physics" query now has LOW score (doesn't match pasta content)
    const physicsResultsAfter = await vector.query({
      indexName: 'memory_messages_384',
      queryVector: physicsEmbeddings[0],
      topK: 5,
    });
    const physicsScoreAfter = physicsResultsAfter[0]?.score ?? 0;
    expect(physicsScoreAfter).toBeLessThan(0.6); // Low similarity - fix is working!

    // Step 6: Verify "cooking" query has HIGH score (matches pasta content)
    // @ts-ignore - accessing protected method
    const { embeddings: cookingEmbeddings } = await memory.embedMessageContent(
      'Italian pasta recipes carbonara bolognese cooking',
    );
    const cookingResults = await vector.query({
      indexName: 'memory_messages_384',
      queryVector: cookingEmbeddings[0],
      topK: 5,
    });
    const cookingScore = cookingResults[0]?.score ?? 0;
    expect(cookingScore).toBeGreaterThan(0.7); // High similarity to updated content

    // The cooking score should be significantly higher than physics score
    expect(cookingScore).toBeGreaterThan(physicsScoreAfter + 0.2);
  });

  it('should delete vectors when message content is cleared', async () => {
    // Save a message with content
    const message = {
      id: randomUUID(),
      threadId,
      content: {
        format: 2 as const,
        parts: [{ type: 'text' as const, text: 'Unique elephants roaming in African savanna wildlife.' }],
      },
      role: 'user' as const,
      createdAt: new Date(),
      resourceId,
    };

    await memory.saveMessages({ messages: [message] });

    // Verify vector exists
    const vectorsBefore = await vector.query({
      indexName: 'memory_messages_384',
      queryVector: new Array(384).fill(0.01),
      topK: 100,
    });
    expect(vectorsBefore.length).toBe(1);
    expect(vectorsBefore[0]?.metadata?.message_id).toBe(message.id);

    // Update message to empty content
    await memory.updateMessages({
      messages: [
        {
          id: message.id,
          content: {
            format: 2 as const,
            parts: [{ type: 'text' as const, text: '' }],
          },
        },
      ],
    });

    // Vector should be deleted (no new content to embed)
    const vectorsAfter = await vector.query({
      indexName: 'memory_messages_384',
      queryVector: new Array(384).fill(0.01),
      topK: 100,
    });
    expect(vectorsAfter.length).toBe(0);
  });

  it('should handle updating multiple messages at once', async () => {
    // Create two messages about very different topics
    const message1 = {
      id: randomUUID(),
      threadId,
      content: {
        format: 2 as const,
        parts: [
          { type: 'text' as const, text: 'Marine biology studies ocean ecosystems and underwater life forms.' },
        ],
      },
      role: 'user' as const,
      createdAt: new Date(),
      resourceId,
    };

    const message2 = {
      id: randomUUID(),
      threadId,
      content: {
        format: 2 as const,
        parts: [{ type: 'text' as const, text: 'Classical music composers include Mozart, Beethoven, and Bach.' }],
      },
      role: 'user' as const,
      createdAt: new Date(Date.now() + 1000),
      resourceId,
    };

    await memory.saveMessages({ messages: [message1, message2] });

    // Verify both vectors exist
    const vectorsBefore = await vector.query({
      indexName: 'memory_messages_384',
      queryVector: new Array(384).fill(0.01),
      topK: 100,
    });
    expect(vectorsBefore.length).toBe(2);

    // Update both messages to completely different topics
    await memory.updateMessages({
      messages: [
        {
          id: message1.id,
          content: {
            format: 2 as const,
            parts: [{ type: 'text' as const, text: 'Space exploration and rocket propulsion technology advances.' }],
          },
        },
        {
          id: message2.id,
          content: {
            format: 2 as const,
            parts: [{ type: 'text' as const, text: 'Gardening tips for growing tomatoes and vegetables organically.' }],
          },
        },
      ],
    });

    // Verify both vectors were updated (same count, message IDs preserved)
    const vectorsAfter = await vector.query({
      indexName: 'memory_messages_384',
      queryVector: new Array(384).fill(0.01),
      topK: 100,
    });
    expect(vectorsAfter.length).toBe(2);

    const messageIds = vectorsAfter.map(v => v.metadata?.message_id);
    expect(messageIds).toContain(message1.id);
    expect(messageIds).toContain(message2.id);

    // Verify message1 now matches "space" query better than "marine" query
    // @ts-ignore - accessing protected method
    const { embeddings: spaceEmbeddings } = await memory.embedMessageContent('space exploration rockets');
    // @ts-ignore - accessing protected method
    const { embeddings: marineEmbeddings } = await memory.embedMessageContent('marine biology ocean underwater');

    const spaceResults = await vector.query({
      indexName: 'memory_messages_384',
      queryVector: spaceEmbeddings[0],
      topK: 5,
      filter: { message_id: message1.id },
    });
    const marineResults = await vector.query({
      indexName: 'memory_messages_384',
      queryVector: marineEmbeddings[0],
      topK: 5,
      filter: { message_id: message1.id },
    });

    const spaceScore = spaceResults[0]?.score ?? 0;
    const marineScore = marineResults[0]?.score ?? 0;

    // Space query should have higher score than marine query for message1 (now about space)
    expect(spaceScore).toBeGreaterThan(marineScore);
  });
});
