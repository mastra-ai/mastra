/**
 * Mastra + Convex Setup Example
 *
 * This shows how to configure Mastra with the Convex storage adapter.
 */

import { Mastra } from '@mastra/core';
import { createAgent } from '@mastra/core/agent';
import { ConvexStore, ConvexVector, COMMON_EMBEDDING_DIMENSIONS } from '@mastra/convex';
import { Memory } from '@mastra/memory';
import { openai } from '@ai-sdk/openai';

// ============================================================================
// 1. Create Storage Adapter
// ============================================================================

const storage = new ConvexStore({
  id: 'convex',
  deploymentUrl: process.env.CONVEX_URL!,
  // Use authToken for runtime (recommended)
  authToken: process.env.CONVEX_AUTH_TOKEN!,
  // Or use adminAuthToken for CI/CD deployment only
  // adminAuthToken: process.env.CONVEX_ADMIN_KEY!,
});

// ============================================================================
// 2. Create Vector Adapter (Optional - for RAG)
// ============================================================================

const vectors = new ConvexVector({
  id: 'convex-vectors',
  deploymentUrl: process.env.CONVEX_URL!,
  authToken: process.env.CONVEX_AUTH_TOKEN!,
});

// ============================================================================
// 3. Create Memory with Convex Storage
// ============================================================================

const memory = new Memory({
  storage,
  vectors,
  embedder: openai.embedding('text-embedding-3-small'),
  options: {
    lastMessages: 20,
    semanticRecall: {
      topK: 5,
      messageRange: { before: 2, after: 1 },
    },
  },
});

// ============================================================================
// 4. Create Agent with Memory
// ============================================================================

const agent = createAgent({
  name: 'assistant',
  instructions: 'You are a helpful assistant with memory.',
  model: openai('gpt-4o'),
  memory,
});

// ============================================================================
// 5. Initialize Mastra
// ============================================================================

export const mastra = new Mastra({
  storage,
  vectors: {
    default: vectors,
  },
  agents: {
    assistant: agent,
  },
});

// ============================================================================
// Usage
// ============================================================================

async function main() {
  // Chat with memory
  const response = await mastra.getAgent('assistant').stream('Hello! Remember my name is Alice.', {
    resourceId: 'user-123',
    threadId: 'thread-abc',
  });

  for await (const chunk of response.textStream) {
    process.stdout.write(chunk);
  }

  // Later conversation - agent remembers
  const response2 = await mastra.getAgent('assistant').stream("What's my name?", {
    resourceId: 'user-123',
    threadId: 'thread-abc',
  });

  for await (const chunk of response2.textStream) {
    process.stdout.write(chunk);
  }
}
