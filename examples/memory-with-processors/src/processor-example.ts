import 'dotenv/config';
import { openai } from '@ai-sdk/openai';
import { Mastra } from '@mastra/core';
import { createLogger } from '@mastra/core/logger';
import { createTool } from '@mastra/core/tools';
import { Agent } from '@mastra/core/agent';
import { Memory, TokenLimiter } from '@mastra/memory';
import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';
import chalk from 'chalk';

// Create a tool that reads the massive pnpm-lock.yaml file
const testTool = createTool({
  id: 'read-file',
  description: 'Read a large file to test token limits',
  execute: async () => {
    try {
      // Try multiple possible locations for the pnpm-lock.yaml file
      const possiblePaths = [
        // Root of the project
        resolve(import.meta.dirname, '../../../', 'pnpm-lock.yaml'),
      ];

      let filePath: string | null = null;
      let fileContent = '';

      // Find the first file that exists
      for (const path of possiblePaths) {
        if (existsSync(path)) {
          filePath = path;
          fileContent = readFileSync(path, 'utf-8');
          break;
        }
      }

      // If no file was found, generate a large mock file
      if (!filePath) {
        console.log(chalk.yellow('No suitable large file found. Generating mock content...'));

        // Create a large mock yaml-like content (about 20K characters)
        fileContent = Array(100)
          .fill(0)
          .map(
            (_, i) =>
              `package-${i}:
  version: "1.0.${i}"
  resolved: "https://registry.npmjs.org/package-${i}/-/package-${i}-1.0.${i}.tgz"
  integrity: "sha512-${Math.random().toString(36).substring(2, 40)}"
  dependencies:
    dep-a: "^2.0.0"
    dep-b: "^3.1.2"
    dep-c: "^0.8.9"
  devDependencies:
    test-lib: "^4.5.2"
`,
          )
          .join('\n');
      }

      // Return the first 20K characters (still very token-heavy)
      return `File content (truncated to 20K chars):\n${fileContent.slice(0, 20000)}`;
    } catch (error) {
      console.error('Error reading file:', error);

      // Return a mock large response as fallback
      return `Error reading file: ${error.message}\n\nGenerating mock content instead: \n${Array(50)
        .fill('This is a large mock file content to test token limiting. ')
        .join('\n')}`;
    }
  },
});

// Create memory with a low token limit to clearly demonstrate limiting
const memory = new Memory({
  processors: [
    // Set a very low token limit (1000) to clearly demonstrate token limiting
    new TokenLimiter(1000),
  ],
  options: {
    lastMessages: 50,
  },
});

// Create an agent with the test tool
const tokenTestAgent = new Agent({
  name: 'Token Test Agent',
  instructions: 'You help test token limiting by calling tools that return large amounts of data.',
  model: openai('gpt-4o-mini'),
  memory,
  tools: { testTool },
});

// Create Mastra instance
const mastra = new Mastra({
  agents: { tokenTestAgent },
  logger: createLogger({ level: 'info' }),
});

// Track token usage
const tokenHistory: number[] = [];

async function sendMessage(message: string) {
  console.log(`\n${chalk.green('You:')} ${message}`);

  // Get the agent response
  const response = await mastra.getAgent('tokenTestAgent').generate(message, {
    threadId: 'token-test-thread',
    resourceId: 'demo-user',
  });

  // Display the response
  console.log(`\n${chalk.blue('Agent:')} ${response.text}`);

  // Track and display token usage
  const tokensUsed = response.usage.totalTokens;
  tokenHistory.push(tokensUsed);

  // Display token usage information
  console.log(`\n${chalk.yellow('📊 Token Usage:')}`);
  console.log(`${chalk.yellow('├')} Current: ${tokensUsed} tokens`);
  console.log(`${chalk.yellow('├')} Total: ${tokenHistory.reduce((sum, t) => sum + t, 0)} tokens`);
  console.log(`${chalk.yellow('└')} Memory Token Limit: 1000 tokens`);

  return response;
}

async function main() {
  console.log(
    chalk.cyan(`
╔══════════════════════════════════════════════════════════╗
║                                                          ║
║  TOKEN LIMITER PROCESSOR DEMO                            ║
║                                                          ║
║  This example demonstrates how TokenLimiter works with   ║
║  extremely large tool responses.                         ║
║                                                          ║
║  The tool reads a massive pnpm-lock.yaml file and        ║
║  returns a large chunk of text. If the file can't be     ║
║  found, it generates mock content.                       ║
║                                                          ║
║  Memory token limit: 1000 tokens                         ║
║                                                          ║
╚══════════════════════════════════════════════════════════╝
`),
  );

  // First message - introduction
  await sendMessage("Hello! I'd like to test the token limiting functionality.");

  // Second message - ask to call the tool
  await sendMessage(
    "Please use the read-file tool to read the large file. After you do, I'll ask you to summarize what you found.",
  );

  // Third message - ask about content that might be forgotten due to token limiting
  await sendMessage(
    'Now, can you tell me what was in the file you just read? And do you remember what I asked in my first message?',
  );

  // Fourth message - ask about content that should definitely be forgotten
  await sendMessage(
    "Let's see how the token limiter is working. Do you remember the exact contents at the beginning of the file?",
  );

  console.log(
    chalk.cyan(`
═════════════════════════════════════════════════════════════
  DEMO COMPLETE
  
  The TokenLimiter processor has prevented the conversation from
  exceeding the 1000 token limit by pruning older messages,
  particularly the large tool response.
  
  This ensures that the context window is never exceeded while
  still preserving the most recent and relevant messages.
═════════════════════════════════════════════════════════════
`),
  );
}

main().catch(console.error);

