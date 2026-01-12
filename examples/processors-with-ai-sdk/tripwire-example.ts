/**
 * Example: Tripwire/Abort Functionality with Mastra Processors
 *
 * This example demonstrates how processors can abort processing
 * using the tripwire mechanism.
 */

import { openai } from '@ai-sdk/openai';
import { generateText } from 'ai';
import { withMastra } from '@mastra/ai-sdk';
import type { InputProcessor, ProcessInputArgs } from '@mastra/core/processors';

/**
 * A guard processor that blocks certain content
 */
const guardProcessor: InputProcessor = {
  id: 'guard',

  async processInput(args: ProcessInputArgs) {
    console.log('\n🛡️  [Guard] Checking input messages...');

    for (const msg of args.messages) {
      const text =
        typeof msg.content === 'string'
          ? msg.content
          : msg.content?.parts
              ?.filter((p: any) => p.type === 'text')
              .map((p: any) => p.text)
              .join('') || '';

      // Block messages containing "secret"
      if (text.toLowerCase().includes('secret')) {
        console.log('🚫 [Guard] Blocked: Message contains forbidden content');
        args.abort('Content blocked: forbidden word detected');
      }
    }

    console.log('✅ [Guard] Input approved');
    return args.messages;
  },
};

async function main() {
  console.log('🚀 Tripwire/Abort Example\n');
  console.log('='.repeat(50));

  // Create a wrapped model with the guard processor
  const modelWithGuard = withMastra(openai('gpt-4o-mini'), {
    inputProcessors: [guardProcessor],
  });

  // Test 1: Normal message (should pass)
  console.log('\n📝 Test 1: Sending normal message...');
  try {
    const result1 = await generateText({
      model: modelWithGuard,
      prompt: 'What is 2 + 2?',
    });
    console.log(`\n✅ Response: ${result1.text}`);
  } catch (error) {
    console.log(`\n❌ Error: ${error}`);
  }

  console.log('\n' + '='.repeat(50));

  // Test 2: Message with forbidden content (should be blocked)
  console.log('\n📝 Test 2: Sending message with forbidden content...');
  try {
    const result2 = await generateText({
      model: modelWithGuard,
      prompt: 'Tell me a secret about the universe.',
    });

    console.log(JSON.stringify(result2, null, 2));
    console.log(`\n⚠️  Response (blocked): ${result2.text}`);
    console.log('   Note: The model was NOT called. This is the tripwire response.');
  } catch (error) {
    console.log(`\n❌ Error: ${error}`);
  }

  console.log('\n' + '='.repeat(50));
  console.log('\n✅ Example complete!');
}

main().catch(console.error);
