/**
 * Quick Start Example for @mastra/convex
 *
 * This example shows the basic setup and usage of the Convex adapter.
 * Run with: npx tsx examples/quick-start.ts
 */

import { Mastra } from '@mastra/core';
import { ConvexStore, ConvexVector, COMMON_EMBEDDING_DIMENSIONS } from '@mastra/convex';

// ============================================================================
// Setup
// ============================================================================

// Create storage adapter with runtime auth (recommended)
const storage = new ConvexStore({
  id: 'convex',
  deploymentUrl: process.env.CONVEX_URL!,
  authToken: process.env.CONVEX_AUTH_TOKEN!, // Use JWT token for runtime
});

// Create vector adapter for embeddings
const vector = new ConvexVector({
  id: 'convex-vectors',
  deploymentUrl: process.env.CONVEX_URL!,
  authToken: process.env.CONVEX_AUTH_TOKEN!,
});

// Initialize Mastra
const mastra = new Mastra({
  storage,
  vectors: { default: vector },
});

// ============================================================================
// Usage Examples
// ============================================================================

async function main() {
  console.log('🚀 Convex Adapter Quick Start\n');

  // --- Memory: Save and retrieve threads ---
  console.log('📝 Creating a thread...');
  const memoryStore = await storage.getStore('memory');

  const thread = await memoryStore?.saveThread({
    thread: {
      id: `thread-${Date.now()}`,
      resourceId: 'user-123',
      title: 'My First Conversation',
      metadata: { source: 'quick-start' },
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  });
  console.log(`   Created thread: ${thread?.id}\n`);

  // --- Memory: Save messages ---
  console.log('💬 Saving messages...');
  await memoryStore?.saveMessages({
    messages: [
      {
        id: `msg-${Date.now()}-1`,
        threadId: thread!.id,
        role: 'user',
        content: { text: 'Hello, how are you?' },
        type: 'text',
        createdAt: new Date(),
        resourceId: 'user-123',
      },
      {
        id: `msg-${Date.now()}-2`,
        threadId: thread!.id,
        role: 'assistant',
        content: { text: "I'm doing great! How can I help you today?" },
        type: 'text',
        createdAt: new Date(),
        resourceId: 'user-123',
      },
    ],
  });
  console.log('   Saved 2 messages\n');

  // --- Memory: List messages ---
  console.log('📖 Listing messages...');
  const { messages } = await memoryStore!.listMessages({
    threadId: thread!.id,
    perPage: 10,
  });
  console.log(`   Found ${messages.length} messages:`);
  messages.forEach(msg => {
    console.log(`   - [${msg.role}]: ${JSON.stringify(msg.content)}`);
  });
  console.log();

  // --- Vectors: Create index and upsert ---
  console.log('🔢 Setting up vector index...');
  try {
    await vector.createIndex({
      indexName: 'quick-start-docs',
      dimension: COMMON_EMBEDDING_DIMENSIONS.OPENAI_ADA_002,
    });
    console.log('   Created vector index\n');
  } catch (e) {
    console.log('   Vector index already exists\n');
  }

  // --- Vectors: Upsert embeddings ---
  console.log('📊 Upserting vectors...');
  // Generate fake embeddings for demo (normally you'd use OpenAI, etc.)
  const fakeEmbedding = () => Array.from({ length: 1536 }, () => Math.random() * 2 - 1);

  await vector.upsert({
    indexName: 'quick-start-docs',
    vectors: [fakeEmbedding(), fakeEmbedding(), fakeEmbedding()],
    ids: ['doc-1', 'doc-2', 'doc-3'],
    metadata: [
      { title: 'Introduction to AI', category: 'tech' },
      { title: 'Machine Learning Basics', category: 'tech' },
      { title: 'History of Computing', category: 'history' },
    ],
  });
  console.log('   Upserted 3 vectors\n');

  // --- Vectors: Query ---
  console.log('🔍 Querying vectors...');
  const queryResults = await vector.query({
    indexName: 'quick-start-docs',
    queryVector: fakeEmbedding(),
    topK: 3,
  });
  console.log(`   Found ${queryResults.length} similar documents:`);
  queryResults.forEach(result => {
    console.log(`   - ${result.id}: score=${result.score.toFixed(4)}`);
  });
  console.log();

  // --- Cleanup ---
  console.log('🧹 Cleaning up...');
  await memoryStore?.deleteThread({ threadId: thread!.id });
  await vector.truncateIndex({ indexName: 'quick-start-docs' });
  console.log('   Done!\n');

  console.log('✅ Quick start complete!');
}

// Run the example
main().catch(console.error);
