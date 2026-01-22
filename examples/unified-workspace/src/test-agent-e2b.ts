/**
 * Test E2B Sandbox with an Agent
 *
 * Prerequisites:
 * 1. Set E2B_API_KEY environment variable
 * 2. Set OPENAI_API_KEY environment variable
 * 3. Run: pnpm install --ignore-workspace
 * 4. Run: pnpm test:agent-e2b
 */

import { Agent } from '@mastra/core/agent';
import { Workspace, LocalFilesystem, createWorkspaceTools } from '@mastra/core/workspace';
import { E2BSandbox } from '@mastra/e2b';
import { openai } from '@ai-sdk/openai';
import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs/promises';

async function main() {
  console.log('🤖 Agent + E2B Sandbox Test\n');

  // Check for required env vars
  if (!process.env.E2B_API_KEY) {
    console.error('❌ E2B_API_KEY not set');
    process.exit(1);
  }
  if (!process.env.OPENAI_API_KEY) {
    console.error('❌ OPENAI_API_KEY not set');
    process.exit(1);
  }

  // Create temp directory for local filesystem
  const tempDir = path.join(os.tmpdir(), `mastra-agent-test-${Date.now()}`);
  await fs.mkdir(tempDir, { recursive: true });
  console.log('📁 Created temp directory:', tempDir);

  // Create workspace with E2B sandbox
  const workspace = new Workspace({
    filesystem: new LocalFilesystem({ basePath: tempDir }),
    sandbox: new E2BSandbox({ timeout: 120000 }), // 2 min timeout
  });

  await workspace.init();
  console.log('✅ Workspace initialized');
  console.log('   Access mode:', workspace.accessMode);

  // Create workspace tools for the agent
  const workspaceTools = createWorkspaceTools({ workspace });

  // Create an agent with workspace tools
  const agent = new Agent({
    name: 'CodeRunner',
    instructions: `You are a helpful coding assistant with access to a cloud sandbox environment.
You can:
- Write files to the workspace filesystem
- Read files from the workspace
- Execute Python or Node.js code in a secure cloud sandbox
- Run shell commands in the sandbox

When asked to run code, use the workspace_execute_code tool.
When asked to run a command, use the workspace_execute_command tool.
When working with files, use workspace_write_file and workspace_read_file.

Always show the output of code execution to the user.`,
    model: openai('gpt-4o-mini'),
    tools: workspaceTools,
  });

  console.log('\n🚀 Agent ready! Starting conversation...\n');

  try {
    // Test 1: Simple code execution
    console.log('--- Test 1: Execute Python code ---');
    const response1 = await agent.generate(
      'Run this Python code and show me the output: print("Hello from E2B sandbox!")',
    );
    console.log('Agent response:', response1.text);

    // Test 2: Write and read a file
    console.log('\n--- Test 2: File operations ---');
    const response2 = await agent.generate(
      'Write a file called "data.json" with content {"name": "test", "value": 42}, then read it back and confirm the contents.',
    );
    console.log('Agent response:', response2.text);

    // Test 3: More complex code
    console.log('\n--- Test 3: Complex Python code ---');
    const response3 = await agent.generate(`
Run this Python code that calculates fibonacci numbers:

def fibonacci(n):
    if n <= 1:
        return n
    return fibonacci(n-1) + fibonacci(n-2)

for i in range(10):
    print(f"fib({i}) = {fibonacci(i)}")
`);
    console.log('Agent response:', response3.text);

    // Test 4: Shell command
    console.log('\n--- Test 4: Shell command ---');
    const response4 = await agent.generate('Run the command "uname -a" to show the system information of the sandbox');
    console.log('Agent response:', response4.text);

    console.log('\n\n🎉 All agent tests complete!');
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    // Cleanup
    console.log('\n🧹 Cleaning up...');
    await workspace.destroy();
    await fs.rm(tempDir, { recursive: true, force: true });
    console.log('✅ Done!');
  }
}

main().catch(console.error);
