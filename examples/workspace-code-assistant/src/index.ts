/**
 * Workspace Code Assistant Demo
 *
 * This demo shows an agent with workspace capabilities:
 * - Writing code to files
 * - Executing code
 * - Reading results
 *
 * Run with: pnpm demo
 */

import { codeAssistantAgent, workspace } from './mastra/agents';

async function main() {
  console.log('🚀 Workspace Code Assistant Demo\n');
  console.log('='.repeat(50));

  // Initialize the workspace (creates directory, starts sandbox)
  console.log('\n📁 Initializing workspace...');
  await workspace.init();
  console.log('✅ Workspace ready!\n');

  // Demo 1: Create and run a simple script
  console.log('='.repeat(50));
  console.log('Demo 1: Create and run a Hello World script');
  console.log('='.repeat(50));

  const response1 = await codeAssistantAgent.generate(
    'Create a Python script called hello.py that prints "Hello from the workspace!" and run it.',
  );
  console.log('\n🤖 Agent Response:');
  console.log(response1.text);

  // Demo 2: Create a more complex script
  console.log('\n' + '='.repeat(50));
  console.log('Demo 2: Create a utility function');
  console.log('='.repeat(50));

  const response2 = await codeAssistantAgent.generate(
    'Create a Node.js file called math.js with a function that calculates the factorial of a number. Test it with factorial(5).',
  );
  console.log('\n🤖 Agent Response:');
  console.log(response2.text);

  // Demo 3: List files and read one
  console.log('\n' + '='.repeat(50));
  console.log('Demo 3: List workspace files');
  console.log('='.repeat(50));

  const response3 = await codeAssistantAgent.generate(
    'List all files in the workspace and show me the contents of hello.py',
  );
  console.log('\n🤖 Agent Response:');
  console.log(response3.text);

  // Demo 4: Debug and fix code
  console.log('\n' + '='.repeat(50));
  console.log('Demo 4: Create and fix buggy code');
  console.log('='.repeat(50));

  const response4 = await codeAssistantAgent.generate(
    `Create a file called buggy.js with this code:
    
    function divide(a, b) {
      return a / b;
    }
    console.log(divide(10, 0));
    
    Then run it and explain what happens. Can you add error handling?`,
  );
  console.log('\n🤖 Agent Response:');
  console.log(response4.text);

  // Cleanup
  console.log('\n' + '='.repeat(50));
  console.log('🧹 Cleaning up...');
  await workspace.destroy();
  console.log('✅ Done!\n');
}

// Run the demo
main().catch(console.error);
