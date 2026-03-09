/**
 * Example: Using Mastra Processors with AI SDK's streamText
 *
 * This example demonstrates how to use Mastra's processor middleware
 * with streaming responses.
 */

import { openai } from '@ai-sdk/openai';
import { streamText } from 'ai';
import { withMastra } from '@mastra/ai-sdk';
import type { OutputProcessor, ProcessOutputStreamArgs } from '@mastra/core/processors';

/**
 * A processor that counts and logs streaming chunks
 */
const chunkCounterProcessor: OutputProcessor = {
  id: 'chunk-counter',

  async processOutputStream(args: ProcessOutputStreamArgs) {
    const { part, state } = args;

    // Initialize counter in state
    if (state.chunkCount === undefined) {
      state.chunkCount = 0;
    }

    // Count text chunks
    if (part.type === 'text-delta') {
      state.chunkCount++;
      // Log every 5 chunks
      if (state.chunkCount % 5 === 0) {
        process.stdout.write(`\n[${state.chunkCount} chunks received]\n`);
      }
    }

    // Pass through the chunk unchanged
    return part;
  },
};

/**
 * A processor that filters out certain patterns from the stream
 */
const filterProcessor: OutputProcessor = {
  id: 'filter',

  async processOutputStream(args: ProcessOutputStreamArgs) {
    const { part } = args;

    if (part.type === 'text-delta') {
      // Example: Replace any occurrence of "AI" with "Assistant"
      const filteredText = part.payload.text.replace(/\bAI\b/gi, 'Assistant');

      if (filteredText !== part.payload.text) {
        return {
          ...part,
          payload: {
            ...part.payload,
            text: filteredText,
          },
        };
      }
    }

    return part;
  },
};

async function main() {
  console.log('🚀 Streaming with Processors Example\n');
  console.log('='.repeat(50));

  // Create a wrapped model with streaming processors
  const modelWithProcessors = withMastra(openai('gpt-4o-mini'), {
    outputProcessors: [chunkCounterProcessor, filterProcessor],
  });

  console.log('\n📝 Streaming a response with processors...\n');
  console.log('-'.repeat(50));

  const { textStream } = await streamText({
    model: modelWithProcessors,
    prompt: 'Write a short paragraph about the future of AI assistants.',
  });

  // Consume the stream
  for await (const chunk of textStream) {
    process.stdout.write(chunk);
  }

  console.log('\n' + '-'.repeat(50));
  console.log('\n✅ Stream complete!');
}

main().catch(console.error);
