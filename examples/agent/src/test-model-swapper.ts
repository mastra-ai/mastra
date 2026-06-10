/**
 * Test script for Model Swapper Test Agent
 *
 * Run with: npx tsx src/test-model-swapper.ts
 *
 * This script demonstrates:
 * 1. Simple weather requests use the default openai/gpt-5-mini model
 * 2. Research and planning requests route to openai/gpt-5.5
 *
 * The agent logs the selected model from its ModelSwapperProcessor before each LLM call.
 */

import { modelSwapperTestAgent } from './mastra/agents/model-swapper-test-agent.js';

const toolNames = (response: any) =>
  response.toolCalls?.map((toolCall: any) => toolCall.name ?? toolCall.toolName) ?? 'none';

async function main() {
  console.log('='.repeat(60));
  console.log('Model Swapper Test Agent');
  console.log('='.repeat(60));

  console.log('\n--- Simple request: should use openai/gpt-5-mini ---\n');
  const simpleResponse = await modelSwapperTestAgent.generate('What is the weather in Austin right now?');
  console.log('Agent response:', simpleResponse.text);
  console.log('Tools used:', toolNames(simpleResponse));

  console.log('\n--- Research/planning request: should use openai/gpt-5.5 ---\n');
  const complexResponse = await modelSwapperTestAgent.generate(
    'Research whether Austin or Denver is better for a remote engineering team offsite, compare tradeoffs, create a plan, and recommend one.',
  );
  console.log('Agent response:', complexResponse.text);
  console.log('Tools used:', toolNames(complexResponse));
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
