/**
 * Test script for Dynamic Tools Agent
 *
 * Run with: npx tsx src/test-dynamic-tools.ts
 *
 * This script demonstrates:
 * 1. Agent searching for tools
 * 2. Agent loading a tool
 * 3. Using loaded tools in subsequent turns
 */

import { dynamicToolsAgent, getLoadedTools } from './mastra/agents/dynamic-tools-agent.js';

async function main() {
  const threadId = `test-thread-${Date.now()}`;

  console.log('='.repeat(60));
  console.log('Dynamic Tools Agent Test');
  console.log('='.repeat(60));
  console.log(`Thread ID: ${threadId}\n`);

  // Step 1: Ask agent to do something that requires searching for tools
  console.log('--- Step 1: Initial request (agent needs to discover tools) ---\n');

  const response1 = await dynamicToolsAgent.generate('I need to add 5 and 3 together. Can you help?', {
    memory: {
      thread: threadId,
    },
  });

  console.log('Agent response:', response1.text);
  console.log('\nTools used:', response1.toolCalls?.map(tc => tc.name) || 'none');

  // Check what tools are now loaded
  const loadedAfterStep1 = await getLoadedTools({ threadId });
  console.log('\nLoaded tools after step 1:', Object.keys(loadedAfterStep1));

  // Step 2: Follow up - the tool should now be loaded
  console.log('\n--- Step 2: Follow-up request (tool should be loaded) ---\n');

  const response2 = await dynamicToolsAgent.generate('Now please add those numbers.', {
    memory: {
      thread: threadId,
    },
  });

  console.log('Agent response:', response2.text);
  console.log('\nTools used:', response2.toolCalls?.map(tc => tc.name) || 'none');

  // Step 3: Try another capability
  console.log('\n--- Step 3: New capability request ---\n');

  const response3 = await dynamicToolsAgent.generate("What's the stock price of AAPL?", {
    memory: {
      thread: threadId,
    },
  });

  console.log('Agent response:', response3.text);
  console.log('\nTools used:', response3.toolCalls?.map(tc => tc.name) || 'none');

  // Final loaded tools
  const finalLoaded = await getLoadedTools({ threadId });
  console.log('\n--- Final loaded tools ---');
  console.log(Object.keys(finalLoaded));

  console.log('\n' + '='.repeat(60));
  console.log('Test complete!');
  console.log('='.repeat(60));
}

main().catch(console.error);
