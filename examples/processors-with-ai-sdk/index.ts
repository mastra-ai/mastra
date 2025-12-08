/**
 * Example: Using Mastra Processors with AI SDK's generateText
 *
 * This example demonstrates how to use Mastra's withMastra helper
 * with the AI SDK's generateText function.
 */

import { openai } from '@ai-sdk/openai';
import { generateText } from 'ai';
import { withMastra } from '@mastra/ai-sdk';
import type { Processor, ProcessInputArgs, ProcessOutputResultArgs } from '@mastra/core/processors';

/**
 * A simple logging processor that logs input and output messages
 */
const loggingProcessor: Processor<'logger'> = {
  id: 'logger',
  name: 'Logging Processor',

  async processInput(args: ProcessInputArgs) {
    console.log('\n📥 [Input Processor] Processing input messages:');
    for (const msg of args.messages) {
      const text =
        typeof msg.content === 'string'
          ? msg.content
          : msg.content?.parts
              ?.filter((p: any) => p.type === 'text')
              .map((p: any) => p.text)
              .join('') || '';
      console.log(`  - [${msg.role}]: ${text.slice(0, 100)}${text.length > 100 ? '...' : ''}`);
    }
    return args.messages;
  },

  async processOutputResult(args: ProcessOutputResultArgs) {
    console.log('\n📤 [Output Processor] Processing output messages:');
    for (const msg of args.messages) {
      const text =
        msg.content?.parts
          ?.filter((p: any) => p.type === 'text')
          .map((p: any) => p.text)
          .join('') || '';
      console.log(`  - [${msg.role}]: ${text.slice(0, 100)}${text.length > 100 ? '...' : ''}`);
    }
    return args.messages;
  },
};

/**
 * A processor that adds a prefix to all assistant responses
 */
const prefixProcessor: Processor<'prefix'> = {
  id: 'prefix',
  name: 'Prefix Processor',

  async processOutputResult(args: ProcessOutputResultArgs) {
    const prefix = '🤖 AI Response: ';

    return args.messages.map(msg => {
      if (msg.role !== 'assistant' || !msg.content?.parts) {
        return msg;
      }

      const newParts = msg.content.parts.map((part: any) => {
        if (part.type === 'text') {
          return { ...part, text: prefix + part.text };
        }
        return part;
      });

      return {
        ...msg,
        content: {
          ...msg.content,
          parts: newParts,
        },
      };
    });
  },
};

async function main() {
  console.log('🚀 Mastra Processors with AI SDK Example\n');
  console.log('='.repeat(50));

  // Create a wrapped model with processor middleware using withMastra helper
  const modelWithProcessors = withMastra(openai('gpt-4o-mini'), {
    inputProcessors: [loggingProcessor],
    outputProcessors: [loggingProcessor, prefixProcessor],
  });

  // Use generateText with the wrapped model
  console.log('\n📝 Sending prompt: "What is 2 + 2? Reply in one word."\n');

  const result = await generateText({
    model: modelWithProcessors,
    prompt: 'What is 2 + 2? Reply in one word.',
  });

  console.log('\n' + '='.repeat(50));
  console.log('\n✅ Final Result:');
  console.log(`   ${result.text}`);
  console.log(`\n   Tokens used: ${result.usage.totalTokens}`);
}

main().catch(console.error);
