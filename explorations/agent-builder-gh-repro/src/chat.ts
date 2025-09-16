import readline from 'readline';
import os from 'os';
import chalk from 'chalk';
import { LibSQLStore } from '@mastra/libsql';
import { MCPClient } from '@mastra/mcp';
import { Mastra } from '@mastra/core';
import path from 'path';
import { ENHANCED_INSTRUCTIONS, GITHUB_ISSUE_REPRO_INSTRUCTIONS } from './instructions';
import { AgentBuilder, AgentBuilderDefaults } from '@mastra/agent-builder';
import { openai } from '@ai-sdk/openai';
import fs from 'fs/promises';

// Helper function to create a slug from issue URL or number
function createIssueSlug(issueUrlOrNumber: string): string {
  // Extract issue number from GitHub URL
  const match = issueUrlOrNumber.match(/github\.com\/([^\/]+)\/([^\/]+)\/issues\/(\d+)/);
  if (match) {
    const [, owner, repo, number] = match;
    return `gh-repro-${owner}-${repo}-${number}`;
  }

  // If it's just a number, use it directly
  if (/^\d+$/.test(issueUrlOrNumber)) {
    return `gh-repro-issue-${issueUrlOrNumber}`;
  }

  // Fallback to timestamp
  return `gh-repro-${Date.now()}`;
}

export async function startInteractiveChat(options: { model?: string; projectPath?: string; initialIssue?: string }) {
  // Create a slug from the initial issue if provided
  const issueSlug = options.initialIssue ? createIssueSlug(options.initialIssue) : undefined;

  // Use provided path, or create a temp directory based on issue slug
  const projectPath =
    options?.projectPath ||
    (issueSlug
      ? path.join(os.tmpdir(), 'mastra-repros', issueSlug)
      : path.join(os.tmpdir(), 'mastra-repros', `gh-repro-${Date.now()}`));
  const model = options?.model || 'gpt-4o';

  try {
    await fs.mkdir(projectPath, {
      recursive: true,
    });
    await fs.writeFile(path.join(projectPath, 'package.json'), '{}');
    await fs.writeFile(path.join(projectPath, 'pnpm-lock.yaml'), '');
  } catch {}

  const baseInstructions = GITHUB_ISSUE_REPRO_INSTRUCTIONS(projectPath);
  const enhancedInstructions = ENHANCED_INSTRUCTIONS(baseInstructions);

  const mcp = new MCPClient({
    id: 'repro-agent',
    servers: {
      mastra: {
        command: 'npx',
        args: ['-y', '@mastra/mcp-docs-server'],
      },
    },
  });

  // add storage since we can't override memory and add storage
  const mastra = new Mastra({
    agents: {
      agent: new AgentBuilder({
        instructions: `${AgentBuilderDefaults.DEFAULT_INSTRUCTIONS}\n` + enhancedInstructions,
        model: openai(model),
        projectPath: projectPath,
        mode: 'code-editor', // Use full tool set including web search
        tools: {
          ...(await mcp.getTools()),
          ...(await AgentBuilderDefaults.DEFAULT_TOOLS(projectPath, 'code-editor')),
        },
      }),
    },
    storage: new LibSQLStore({
      url: 'file:./repro-agent.db',
    }),
  });

  const agent = mastra.getAgent('agent');

  const memory = {
    resource: 'repro-agent',
    thread: options.initialIssue!,
  } as const;

  console.log(`memory options`, memory);

  let currentAbortController: AbortController | null = null;
  let isStreaming = false;
  let shouldExit = false;

  // Handle Ctrl+C
  const handleSigInt = () => {
    if (isStreaming && currentAbortController) {
      // Abort current stream
      console.log(chalk.yellow('\n⚠️  Aborting current stream...'));
      currentAbortController.abort();
      currentAbortController = null;
      isStreaming = false;
      // Don't exit, just abort the stream
    } else {
      // Exit the program only when not streaming
      console.log(chalk.gray('\n\nGoodbye! 👋\n'));
      shouldExit = true;
      process.exit(0);
    }
  };

  process.on('SIGINT', handleSigInt);

  console.log(chalk.blue.bold('\n🤖 GitHub Issue Reproduction Agent - Interactive Mode\n'));
  console.log(chalk.gray('Type your questions or commands. Press Ctrl+C to abort streaming or exit.'));
  console.log(chalk.gray(`📁 Working directory: ${projectPath}\n`));

  const hasMessages =
    (await (async () => {
      try {
        return (
          await (
            await agent.getMemory()
          )?.query({
            resourceId: memory.resource,
            threadId: memory.thread,
            selectBy: {
              last: 1,
            },
          })
        )?.messages?.length;
      } catch {
        return 0;
      }
    })()) || 0 > 1;

  // If initial issue provided, process it first
  if (options.initialIssue && !hasMessages) {
    console.log(chalk.cyan(`Processing initial issue: ${options.initialIssue}\n`));

    const prompt = options.initialIssue.includes('github.com')
      ? `Please reproduce the GitHub issue at: ${options.initialIssue}`
      : `Please reproduce GitHub issue #${options.initialIssue}`;

    currentAbortController = new AbortController();
    isStreaming = true;

    try {
      const response = await agent.stream(prompt, {
        abortSignal: currentAbortController.signal,
        memory,
      });

      for await (const chunk of response.fullStream) {
        if (chunk.type === `text-delta`) {
          process.stdout.write(chunk.textDelta);
        } else if (chunk.type === `tool-call`) {
          console.log(chalk.gray(`\n🔧 Calling tool: ${chunk.toolName}`));
        } else if (chunk.type === `tool-result`) {
          // Tool results can be verbose, just indicate completion
          console.log(chalk.gray(`✓ Tool ${chunk.toolName} completed`));
        }
        // Check if we should abort
        if (currentAbortController?.signal.aborted) {
          break;
        }
      }
      console.log('\n');
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        console.log(chalk.yellow('\n⚠️  Stream aborted\n'));
      } else {
        console.error(chalk.red('\n❌ Error:'), error);
      }
    } finally {
      isStreaming = false;
      currentAbortController = null;
    }
  }

  // Main chat loop
  while (!shouldExit) {
    try {
      // Add a small delay after abort to let terminal recover
      if (!isStreaming) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      // Create a new readline interface for each prompt
      const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
        terminal: true,
      });

      // Get user input
      const input = await new Promise<string>((resolve, reject) => {
        rl.question(chalk.cyan('\n> '), answer => {
          rl.close();
          resolve(answer);
        });

        // Handle readline errors
        rl.on('error', err => {
          console.error(chalk.red('Readline error:'), err);
          rl.close();
          reject(err);
        });
      });

      const trimmedInput = input.trim();

      if (!trimmedInput) {
        continue;
      }

      // Special commands
      if (trimmedInput.toLowerCase() === 'exit' || trimmedInput.toLowerCase() === 'quit') {
        console.log(chalk.gray('\nGoodbye! 👋\n'));
        break;
      }

      if (trimmedInput.toLowerCase() === 'help') {
        console.log(chalk.cyan('\nAvailable commands:'));
        console.log(chalk.gray('  help     - Show this help message'));
        console.log(chalk.gray('  exit     - Exit the chat'));
        console.log(chalk.gray('  quit     - Exit the chat'));
        console.log(chalk.gray('  Ctrl+C   - Abort current stream or exit\n'));
        console.log(chalk.gray('You can also:'));
        console.log(chalk.gray('  - Paste a GitHub issue URL to reproduce it'));
        console.log(chalk.gray('  - Ask questions about the current issue'));
        console.log(chalk.gray('  - Give additional instructions to the agent\n'));
        continue;
      }

      // Process user input with the agent
      currentAbortController = new AbortController();
      isStreaming = true;

      try {
        console.log(); // Add a newline before agent response
        const response = await agent.stream(trimmedInput, { abortSignal: currentAbortController.signal, memory });

        for await (const chunk of response.fullStream) {
          if (currentAbortController?.signal.aborted) {
            break;
          }

          if (chunk.type === `text-delta`) {
            process.stdout.write(chunk.textDelta);
          } else if (chunk.type === `tool-call`) {
            console.log(chalk.gray(`\n🔧 Calling tool: ${chunk.toolName}`));
          } else if (chunk.type === `tool-result`) {
            console.log(chalk.gray(`✓ Tool ${chunk.toolName} completed`));
          }
        }
        console.log('\n');
      } catch (error: any) {
        if (error?.name === 'AbortError' || error?.message?.includes('aborted')) {
          console.log(chalk.yellow('\n⚠️  Stream aborted\n'));
        } else {
          console.error(chalk.red('\n❌ Error:'), error);
        }
      } finally {
        isStreaming = false;
        currentAbortController = null;
      }
    } catch (e) {
      console.error(e);
      process.exit(1);
    }
  }

  process.exit(0);
}
