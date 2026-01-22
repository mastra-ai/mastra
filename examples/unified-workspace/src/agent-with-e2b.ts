/**
 * Agent with E2B Sandbox
 *
 * Run: E2B_API_KEY=xxx OPENAI_API_KEY=xxx npx tsx src/agent-with-e2b.ts
 */

import { Agent } from '@mastra/core/agent';
import { Workspace, LocalFilesystem } from '@mastra/core/workspace';
import { E2BSandbox } from '@mastra/e2b';
import { openai } from '@ai-sdk/openai';
import * as readline from 'readline';

async function main() {
  // Create workspace with E2B sandbox
  const workspace = new Workspace({
    filesystem: new LocalFilesystem({ basePath: '/tmp/agent-workspace' }),
    sandbox: new E2BSandbox({ timeout: 120000 }),
  });

  await workspace.init();
  console.log('Workspace ready (mode:', workspace.accessMode + ')');

  // Create agent with workspace
  const agent = new Agent({
    name: 'CodeRunner',
    instructions: `You are a helpful coding assistant with access to a cloud sandbox.
Use the workspace tools to execute code, run commands, and manage files.`,
    model: openai('gpt-4o-mini'),
    workspace,
  });

  // Simple REPL
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  console.log('\nChat with the agent (type "exit" to quit):\n');

  const ask = () => {
    rl.question('You: ', async input => {
      if (input.toLowerCase() === 'exit') {
        await workspace.destroy();
        rl.close();
        return;
      }

      try {
        const response = await agent.generate(input);
        console.log('\nAgent:', response.text, '\n');
      } catch (err) {
        console.error('Error:', err);
      }

      ask();
    });
  };

  ask();
}

main().catch(console.error);
