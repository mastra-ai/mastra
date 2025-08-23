import { createStep, createWorkflow } from '@mastra/core/workflows';
import { z } from 'zod';
import { createGitHubIssueReproAgent } from './agent.js';
import readline from 'readline';
import ora from 'ora';
import chalk from 'chalk';
import path from 'path';
import os from 'os';
import { Agent } from '@mastra/core';
import { AgentBuilderDefaults } from '@mastra/agent-builder';

// Helper function to create issue slug
function createIssueSlug(issueUrlOrNumber: string): string {
  const match = issueUrlOrNumber.match(/github\.com\/([^\/]+)\/([^\/]+)\/issues\/(\d+)/);
  if (match) {
    const [, owner, repo, number] = match;
    return `gh-repro-${owner}-${repo}-${number}`;
  }
  if (/^\d+$/.test(issueUrlOrNumber)) {
    return `gh-repro-issue-${issueUrlOrNumber}`;
  }
  return `gh-repro-${Date.now()}`;
}

function getMemoryConfig(issueUrl: string) {
  return {
    resource: 'repro-agent',
    thread: createIssueSlug(issueUrl),
  };
}

// Step 1: Check if conversation already exists
export const checkShouldInit = createStep({
  id: 'should-init',
  inputSchema: z.object({
    issueUrl: z.string(),
  }),
  outputSchema: z.object({
    hasConversation: z.boolean(),
    threadId: z.string(),
    resourceId: z.string(),
    agent: z.any(),
    projectPath: z.string(),
  }),
  execute: async ({ inputData }) => {
    const { issueUrl } = inputData;

    const issueSlug = createIssueSlug(issueUrl);
    const memoryConfig = getMemoryConfig(issueUrl);
    const threadId = memoryConfig.thread;
    const resourceId = memoryConfig.resource;
    const projectPath = path.join(os.tmpdir(), 'mastra-repros', issueSlug);

    const agent = createGitHubIssueReproAgent({
      issueSlug,
      projectPath,
    });

    const memory = getMemoryConfig(issueUrl);

    const memoryInstance = await agent.getMemory();
    // Get messages from memory
    const hasConversation = !!(
      (await (async () => {
        try {
          return (
            await memoryInstance?.query({
              resourceId: memory.resource,
              threadId: memory.thread,
              selectBy: {
                last: 1,
              },
            })
          )?.messages?.length;
        } catch (e) {
          return 0;
        }
      })()) || 0 > 1
    );

    return {
      hasConversation,
      threadId,
      resourceId,
      agent,
      projectPath,
    };
  },
});

// Step 2: Initialize project with manageProject tool
export const initializeProjectStep = createStep({
  id: 'initialize-project',
  inputSchema: z.object({
    hasConversation: z.boolean(),
    messages: z.array(z.any()),
    threadId: z.string(),
    resourceId: z.string(),
    agent: z.any(),
    projectPath: z.string(),
  }),
  outputSchema: z.object({
    initialized: z.boolean(),
    result: z.string(),
    threadId: z.string(),
    resourceId: z.string(),
    agent: z.any(),
    projectPath: z.string(),
  }),
  execute: async ({ inputData, getInitData }) => {
    const { threadId, resourceId, agent, projectPath } = inputData;

    // Skip if conversation already exists
    if (inputData.hasConversation) {
      return {
        initialized: false,
        result: 'Conversation already exists',
        threadId,
        resourceId,
        agent,
        projectPath,
      };
    }

    // Ensure temp directory exists
    // fs.mkdirSync(projectPath, { recursive: true });
    console.log(chalk.blue(`📁 Created project directory: ${projectPath}`));

    // Call the manageProject tool to set up the project
    const spinner = ora('\nInitializing project structure...').start();

    try {
      const result = await AgentBuilderDefaults.createMastraProject({
        projectName: projectPath,
        features: ['agents', 'workflows'],
      });
      if (result.error) throw new Error(result.error);

      spinner.succeed('Project initialized');
      return {
        initialized: true,
        // result: result.message,
        result: 'success',
        threadId,
        resourceId,
        agent,
        projectPath,
      };
    } catch (error) {
      spinner.fail('Failed to initialize project');
      throw error;
    }
  },
});

// Step 3: Initial discovery step for GitHub issue
export const initialDiscoveryStep = createStep({
  id: 'initial-discovery',
  inputSchema: z.object({
    initialized: z.boolean(),
    result: z.string(),
    threadId: z.string(),
    resourceId: z.string(),
    agent: z.any(),
    projectPath: z.string(),
  }),
  outputSchema: z.object({
    analysis: z.string(),
    threadId: z.string(),
    resourceId: z.string(),
    agent: z.any(),
    projectPath: z.string(),
  }),
  execute: async ({ inputData, getInitData, getStepResult }) => {
    const { threadId, agent, projectPath } = inputData;
    const { issueUrl } = getInitData();
    const checkResult = getStepResult(checkShouldInit);

    // Skip if conversation already exists
    if (checkResult.hasConversation) {
      return {
        analysis: 'Using existing conversation',
        threadId,
        resourceId: inputData.resourceId,
        agent,
        projectPath,
      };
    }

    const spinner = ora('Analyzing GitHub issue...').start();
    spinner.stopAndPersist();

    try {
      const result = await (agent as Agent).stream(
        `Please analyze this GitHub issue and prepare to reproduce it: ${issueUrl}
        
        1. Use gh CLI to fetch the issue details
        2. Understand what needs to be reproduced
        3. Identify the minimal setup required
        4. Create a plan for reproduction
        5. Write an ISSUE_SUMMARY.md file to the repro root explaining what you've discovered, which issue this is for, how to run the repo, and any other important relevant info. Keep it direct and to the point without any overly verbose language.
        6. If you add a runnable .ts file that should be run outside of "mastra dev", add an npm script like "repro": "tsx ./src/repro.ts" that can be run immediately by the user when they're running the reproduction.
        7. If you're reproducing a problem that uses a storage/vector adapter that can run in docker, please add a docker-compose.yml file that can be run and connected to. First check docker for any running containers that it might conflict with.
        8. If you add a repro script and/or a docker compose file, make sure you run the docker file and the npm script to ensure it's reproing as you expect it to. Don't just try "docker-compose" also try "docker compose" since some systems only have the latter.
        Note that a very basic project has already been scaffolded in cwd (${projectPath}). Feel free to explore the files on disk that exist`,
        {
          threadId: getMemoryConfig(issueUrl).thread,
          resourceId: getMemoryConfig(issueUrl).resource,
          onError: event => {
            event;
          },
          onStepFinish: step => {
            step;
          },
          onFinish: result => {
            result;
          },
        },
      );

      for await (const part of result.fullStream) {
        if (part.type === `text-delta`) process.stdout.write(part.textDelta);
        else {
          console.log(part.type);
          if (part.type === `tool-call` || part.type === `tool-result`) console.log(part.toolName, part.toolCallId);
          if (part.type === `tool-call`) console.log(part.args);
        }
      }

      spinner.succeed('Issue analyzed');
      console.log(chalk.green('\n✓ Initial analysis complete'));

      return {
        analysis: await result.text,
        threadId,
        resourceId: inputData.resourceId,
        agent,
        projectPath,
      };
    } catch (error) {
      spinner.fail('Failed to analyze issue');
      throw error;
    }
  },
});

// Step 4: Interactive chat loop (recursive)
export const chatLoopStep = createStep({
  id: 'chat-loop',
  inputSchema: z.object({
    threadId: z.string(),
    resourceId: z.string(),
    agent: z.any(),
    projectPath: z.string(),
  }),
  outputSchema: z.object({
    shouldContinue: z.boolean(),
    lastMessage: z.string(),
    threadId: z.string(),
    resourceId: z.string(),
    agent: z.any(),
    projectPath: z.string(),
  }),
  execute: async ({ inputData }) => {
    const { agent, threadId, projectPath } = inputData;
    const abortController = new AbortController();

    // Set up Ctrl+C handler for aborting streams
    const handleSigInt = () => {
      if (!abortController.signal.aborted) {
        abortController.abort();
      } else {
        process.exit();
      }
    };
    process.on('SIGINT', handleSigInt);

    // Create readline interface for user input
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    // Get user input
    const userInput = await new Promise<string>(resolve => {
      rl.question(chalk.cyan('\n> '), answer => {
        rl.close();
        resolve(answer);
      });
    });

    // Check for exit command
    if (userInput.toLowerCase() === 'exit' || userInput.toLowerCase() === 'quit') {
      console.log(chalk.yellow('\n👋 Goodbye!'));
      process.removeListener('SIGINT', handleSigInt);
      return {
        shouldContinue: false,
        lastMessage: userInput,
        threadId,
        resourceId: inputData.resourceId,
        agent,
        projectPath,
      };
    }

    // Generate response
    const spinner = ora('responding...').start();
    let streamStarted = false;

    try {
      const stream = await (agent as Agent).stream(userInput, {
        threadId: inputData.threadId,
        resourceId: inputData.resourceId,
        abortSignal: abortController.signal,
      });

      spinner.stop();

      for await (const part of stream.fullStream) {
        if (!streamStarted) {
          console.log(chalk.gray('\n--- Agent Response ---'));
          streamStarted = true;
        }
        if (part.type === `text-delta`) process.stdout.write(part.textDelta);
        else {
          console.log(part.type);
          if (part.type === `tool-call` || part.type === `tool-result`) console.log(part.toolName, part.toolCallId);
          if (part.type === `tool-call`) console.log(part.args);
          if (part.type === `tool-result`) console.log(part.result);
        }
      }

      if (streamStarted) {
        console.log(chalk.gray('\n--- End Response ---'));
      }

      process.removeListener('SIGINT', handleSigInt);
      return {
        shouldContinue: true,
        lastMessage: userInput,
        threadId,
        resourceId: inputData.resourceId,
        agent,
        projectPath,
      };
    } catch (error: any) {
      spinner.stop();

      if (error.name === 'AbortError') {
        console.log(chalk.yellow('\n\n⚠️ Response interrupted'));
        process.removeListener('SIGINT', handleSigInt);
        return {
          shouldContinue: true,
          lastMessage: userInput,
          threadId,
          resourceId: inputData.resourceId,
          agent,
          projectPath,
        };
      }

      console.error(chalk.red('\n❌ Error:'), error.message);
      process.removeListener('SIGINT', handleSigInt);
      return {
        shouldContinue: true,
        lastMessage: userInput,
        threadId,
        resourceId: inputData.resourceId,
        agent,
        projectPath,
      };
    }
  },
});

// Main workflow composition
export const githubIssueReproWorkflow = createWorkflow({
  id: 'github-issue-repro',
  inputSchema: z.object({
    issueUrl: z.string(),
  }),
  outputSchema: z.object({
    completed: z.boolean(),
    message: z.string().optional(),
  }),
})
  .then(checkShouldInit)
  .then(initializeProjectStep)
  .then(initialDiscoveryStep)
  // Map the output to match chatLoopStep's input
  .map(async ({ getStepResult }) => {
    const result = getStepResult(initialDiscoveryStep);

    return {
      threadId: result.threadId,
      resourceId: result.resourceId,
      agent: result.agent,
      projectPath: result.projectPath,
    };
  })
  .dountil(chatLoopStep, async ({ inputData }) => {
    // Continue until user exits
    return !inputData.shouldContinue;
  })
  .map(async () => ({
    completed: true,
    message: 'Workflow completed successfully',
  }))
  .commit();

// Export function to run the workflow
export async function runGitHubIssueReproWorkflow(inputData: { issueUrl: string }) {
  try {
    const run = await githubIssueReproWorkflow.createRunAsync();
    const result = await run.start({ inputData });

    return result;
  } catch (error) {
    console.error(chalk.red('Workflow error:'), error);
    throw error;
  }
}

process.on('SIGINT', () => {
  process.exit();
});
