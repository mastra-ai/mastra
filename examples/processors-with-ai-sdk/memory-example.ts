/**
 * Example: Using Mastra Memory with AI SDK
 *
 * This example demonstrates how to use the withMastra helper
 * to persist and retrieve conversation history with the AI SDK.
 *
 * It uses @mastra/libsql for storage (in-memory for this example).
 */

import { openai } from '@ai-sdk/openai';
import { generateText } from 'ai';
import { withMastra } from '@mastra/ai-sdk';
import { LibSQLStore } from '@mastra/libsql';

// Create LibSQL storage (in-memory for this example)
const storage = new LibSQLStore({
  id: 'memory-example',
  url: 'file::memory:',
});

// Create a thread for our conversation
const threadId = 'example-thread-' + Date.now();
const resourceId = 'demo-user';

async function main() {
  console.log('🚀 Memory Processor (MessageHistory) with AI SDK Example\n');
  console.log('='.repeat(60));
  console.log(`Thread ID: ${threadId}\n`);

  // Initialize the storage tables
  await storage.init();

  // First, let's seed some history into our database
  console.log('📝 Seeding conversation history...\n');

  // Create a thread
  await storage.saveThread({
    thread: {
      id: threadId,
      resourceId,
      title: 'Demo Conversation',
      metadata: {},
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  });

  // Save some historical messages
  await storage.saveMessages({
    messages: [
      {
        id: 'msg-1',
        threadId,
        resourceId,
        role: 'user',
        content: {
          format: 2,
          parts: [{ type: 'text', text: 'Hi, my name is Alice!' }],
        },
        createdAt: new Date(Date.now() - 60000),
      },
      {
        id: 'msg-2',
        threadId,
        resourceId,
        role: 'assistant',
        content: {
          format: 2,
          parts: [{ type: 'text', text: 'Hello Alice! Nice to meet you. How can I help you today?' }],
        },
        createdAt: new Date(Date.now() - 55000),
      },
      {
        id: 'msg-3',
        threadId,
        resourceId,
        role: 'user',
        content: {
          format: 2,
          parts: [{ type: 'text', text: 'I love programming in TypeScript.' }],
        },
        createdAt: new Date(Date.now() - 50000),
      },
      {
        id: 'msg-4',
        threadId,
        resourceId,
        role: 'assistant',
        content: {
          format: 2,
          parts: [
            {
              type: 'text',
              text: "That's great! TypeScript is an excellent choice for building type-safe applications.",
            },
          ],
        },
        createdAt: new Date(Date.now() - 45000),
      },
    ],
  });

  console.log('✅ Seeded 4 historical messages\n');
  console.log('-'.repeat(60));

  // Create a wrapped model with memory using withMastra
  // This automatically creates a MessageHistory processor
  const modelWithMemory = withMastra(openai('gpt-4o-mini'), {
    memory: {
      storage,
      threadId,
      resourceId,
      lastMessages: 10,
    },
  });

  // Now ask a question that references the conversation history
  console.log('\n📝 Asking: "What is my name and what programming language do I like?"\n');

  const result = await generateText({
    model: modelWithMemory,
    prompt: 'What is my name and what programming language do I like?',
  });

  console.log('🤖 Response:');
  console.log(`   ${result.text}\n`);

  // Check that the new messages were saved
  console.log('-'.repeat(60));
  console.log('\n📊 Messages in storage after the call:\n');

  const storedMessages = await storage.listMessages({
    threadId,
    orderBy: { field: 'createdAt', direction: 'ASC' },
  });

  for (const msg of storedMessages.messages) {
    const text =
      msg.content?.parts
        ?.filter((p: any) => p.type === 'text')
        .map((p: any) => p.text)
        .join('') || '';
    console.log(`   [${msg.role}]: ${text.slice(0, 60)}${text.length > 60 ? '...' : ''}`);
  }

  console.log(`\n   Total messages: ${storedMessages.messages.length}`);
  console.log('\n' + '='.repeat(60));
  console.log('\n✅ Example complete!');
}

main().catch(console.error);
