/**
 * Ralph Wiggum Loop Prototype for Mastra
 *
 * This prototype demonstrates how the autonomous loop pattern could be
 * implemented using Mastra's existing primitives.
 */

import { z } from 'zod';
import { Agent } from '@mastra/core/agent';
import { createWorkflow, createStep } from '@mastra/core/workflows';
import type { Mastra } from '@mastra/core/mastra';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

// ============================================================================
// Types
// ============================================================================

export interface CompletionChecker {
  check: () => Promise<{ success: boolean; message?: string; data?: any }>;
}

export interface AutonomousLoopConfig {
  /** The task prompt to send to the agent */
  prompt: string;

  /** How to determine if the task is complete */
  completion: CompletionChecker;

  /** Maximum number of iterations before giving up */
  maxIterations: number;

  /** Optional: Maximum tokens to spend */
  maxTokens?: number;

  /** Optional: Delay between iterations in ms */
  iterationDelay?: number;

  /** Optional: How many previous iteration results to include in context */
  contextWindow?: number;

  /** Optional: Called after each iteration */
  onIteration?: (result: IterationResult) => void | Promise<void>;

  /** Optional: Called when starting an iteration */
  onIterationStart?: (iteration: number) => void | Promise<void>;
}

export interface IterationResult {
  iteration: number;
  success: boolean;
  agentOutput: string;
  completionCheck: {
    success: boolean;
    message?: string;
  };
  tokensUsed?: number;
  duration: number;
  error?: Error;
}

export interface AutonomousLoopResult {
  success: boolean;
  iterations: IterationResult[];
  totalTokens: number;
  totalDuration: number;
  finalOutput: string;
  completionMessage?: string;
}

// ============================================================================
// Completion Checkers (Helpers)
// ============================================================================

/**
 * Check if tests pass
 */
export function testsPassing(testCommand = 'npm test'): CompletionChecker {
  return {
    async check() {
      try {
        const { stdout, stderr } = await execAsync(testCommand, { timeout: 300000 });
        return {
          success: true,
          message: 'All tests passed',
          data: { stdout, stderr },
        };
      } catch (error: any) {
        return {
          success: false,
          message: error.message,
          data: { stdout: error.stdout, stderr: error.stderr },
        };
      }
    },
  };
}

/**
 * Check if build succeeds
 */
export function buildSucceeds(buildCommand = 'npm run build'): CompletionChecker {
  return {
    async check() {
      try {
        const { stdout, stderr } = await execAsync(buildCommand, { timeout: 600000 });
        return {
          success: true,
          message: 'Build succeeded',
          data: { stdout, stderr },
        };
      } catch (error: any) {
        return {
          success: false,
          message: error.message,
          data: { stdout: error.stdout, stderr: error.stderr },
        };
      }
    },
  };
}

/**
 * Check if lint passes
 */
export function lintClean(lintCommand = 'npm run lint'): CompletionChecker {
  return {
    async check() {
      try {
        const { stdout, stderr } = await execAsync(lintCommand, { timeout: 120000 });
        return {
          success: true,
          message: 'No lint errors',
          data: { stdout, stderr },
        };
      } catch (error: any) {
        return {
          success: false,
          message: error.message,
          data: { stdout: error.stdout, stderr: error.stderr },
        };
      }
    },
  };
}

/**
 * Check if output contains a specific string/pattern
 */
export function outputContains(pattern: string | RegExp): CompletionChecker {
  let lastOutput = '';
  return {
    async check() {
      const matches = typeof pattern === 'string' ? lastOutput.includes(pattern) : pattern.test(lastOutput);

      return {
        success: matches,
        message: matches ? `Output contains pattern` : `Output does not contain pattern`,
      };
    },
    // Helper to set output for checking
    setOutput: (output: string) => {
      lastOutput = output;
    },
  } as CompletionChecker & { setOutput: (output: string) => void };
}

/**
 * Combine multiple checkers (all must pass)
 */
export function allCheckersPassing(...checkers: CompletionChecker[]): CompletionChecker {
  return {
    async check() {
      const results = await Promise.all(checkers.map(c => c.check()));
      const allPassed = results.every(r => r.success);

      return {
        success: allPassed,
        message: results.map(r => r.message).join('; '),
        data: { results },
      };
    },
  };
}

// ============================================================================
// Core Implementation
// ============================================================================

/**
 * Creates an autonomous loop workflow for an agent.
 *
 * This implements the Ralph Wiggum pattern: the agent iterates on a task
 * until completion criteria are met or max iterations are reached.
 */
export function createAutonomousLoopWorkflow(agent: Agent, mastra?: Mastra) {
  const iterationSchema = z.object({
    prompt: z.string(),
    iteration: z.number(),
    previousResults: z.array(
      z.object({
        iteration: z.number(),
        success: z.boolean(),
        output: z.string(),
        error: z.string().optional(),
      }),
    ),
    isComplete: z.boolean(),
    completionMessage: z.string().optional(),
  });

  const agentStep = createStep({
    id: 'agent-iteration',
    inputSchema: iterationSchema,
    outputSchema: z.object({
      text: z.string(),
      iteration: z.number(),
    }),
    execute: async ({ inputData }) => {
      // Build context from previous iterations
      let contextualPrompt = inputData.prompt;

      if (inputData.previousResults.length > 0) {
        const historyContext = inputData.previousResults
          .slice(-5) // Last 5 iterations
          .map(
            r => `
## Iteration ${r.iteration}
Result: ${r.success ? 'PARTIAL SUCCESS' : 'NEEDS MORE WORK'}
Output: ${r.output.slice(0, 500)}${r.output.length > 500 ? '...' : ''}
${r.error ? `Error: ${r.error}` : ''}
`,
          )
          .join('\n');

        contextualPrompt = `
# Task
${inputData.prompt}

# Previous Iterations
You have attempted this task ${inputData.previousResults.length} time(s) before.
Here is the history of your previous attempts:
${historyContext}

# Instructions
Based on the previous attempts, continue working on the task.
Address any errors or incomplete aspects from previous iterations.
Focus on making incremental progress toward the completion criteria.
`;
      }

      // Call the agent
      const result = await agent.generate(contextualPrompt);

      return {
        text: result.text,
        iteration: inputData.iteration,
      };
    },
  });

  return createWorkflow({
    id: 'autonomous-loop',
    inputSchema: iterationSchema,
    outputSchema: iterationSchema,
    mastra,
  })
    .then(agentStep)
    .commit();
}

/**
 * Executes an autonomous loop with the given agent and configuration.
 */
export async function executeAutonomousLoop(
  agent: Agent,
  config: AutonomousLoopConfig,
  mastra?: Mastra,
): Promise<AutonomousLoopResult> {
  const iterations: IterationResult[] = [];
  let totalTokens = 0;
  const startTime = Date.now();

  const contextWindow = config.contextWindow ?? 5;

  for (let i = 0; i < config.maxIterations; i++) {
    const iterationStartTime = Date.now();

    // Notify iteration start
    await config.onIterationStart?.(i + 1);

    // Build context from previous iterations
    const previousResults = iterations.slice(-contextWindow).map(r => ({
      iteration: r.iteration,
      success: r.success,
      output: r.agentOutput,
      error: r.error?.message,
    }));

    let contextualPrompt = config.prompt;
    if (previousResults.length > 0) {
      const historyContext = previousResults
        .map(
          r => `
## Iteration ${r.iteration}
Status: ${r.success ? 'PARTIAL PROGRESS' : 'NEEDS WORK'}
Output: ${r.output.slice(0, 1000)}${r.output.length > 1000 ? '...' : ''}
${r.error ? `Error: ${r.error}` : ''}
`,
        )
        .join('\n');

      contextualPrompt = `
# Original Task
${config.prompt}

# Previous Iterations (${previousResults.length} attempts)
${historyContext}

# Current Iteration (${i + 1})
Continue working on the task. Address any errors or incomplete aspects.
Make incremental progress toward completion.
`;
    }

    try {
      // Execute agent
      const result = await agent.generate(contextualPrompt);
      const agentOutput = result.text;
      const tokensUsed = result.usage?.totalTokens ?? 0;
      totalTokens += tokensUsed;

      // Check token limit
      if (config.maxTokens && totalTokens > config.maxTokens) {
        return {
          success: false,
          iterations,
          totalTokens,
          totalDuration: Date.now() - startTime,
          finalOutput: agentOutput,
          completionMessage: `Token limit exceeded: ${totalTokens} > ${config.maxTokens}`,
        };
      }

      // Check completion
      const completionResult = await config.completion.check();

      const iterationResult: IterationResult = {
        iteration: i + 1,
        success: completionResult.success,
        agentOutput,
        completionCheck: {
          success: completionResult.success,
          message: completionResult.message,
        },
        tokensUsed,
        duration: Date.now() - iterationStartTime,
      };

      iterations.push(iterationResult);

      // Notify iteration complete
      await config.onIteration?.(iterationResult);

      // Check if complete
      if (completionResult.success) {
        return {
          success: true,
          iterations,
          totalTokens,
          totalDuration: Date.now() - startTime,
          finalOutput: agentOutput,
          completionMessage: completionResult.message,
        };
      }

      // Delay before next iteration
      if (config.iterationDelay && i < config.maxIterations - 1) {
        await new Promise(resolve => setTimeout(resolve, config.iterationDelay));
      }
    } catch (error: any) {
      const iterationResult: IterationResult = {
        iteration: i + 1,
        success: false,
        agentOutput: '',
        completionCheck: { success: false, message: error.message },
        duration: Date.now() - iterationStartTime,
        error,
      };

      iterations.push(iterationResult);
      await config.onIteration?.(iterationResult);

      // Don't fail immediately on errors, let the loop continue
      // The error context will be passed to the next iteration
    }
  }

  // Max iterations reached
  return {
    success: false,
    iterations,
    totalTokens,
    totalDuration: Date.now() - startTime,
    finalOutput: iterations.at(-1)?.agentOutput ?? '',
    completionMessage: `Max iterations (${config.maxIterations}) reached without completion`,
  };
}

// ============================================================================
// Example Usage
// ============================================================================

/*
import { Agent } from '@mastra/core/agent';
import { openai } from '@ai-sdk/openai';
import { executeAutonomousLoop, testsPassing } from './ralph-wiggum-loop-prototype';

const migrationAgent = new Agent({
  id: 'test-migrator',
  name: 'Test Migration Agent',
  instructions: `You are an expert at migrating test suites.
You understand testing frameworks deeply and can convert tests accurately.
When given a migration task, you:
1. Analyze the current test structure
2. Identify what needs to be changed
3. Make the necessary modifications
4. Verify the changes work correctly`,
  model: openai('gpt-4o'),
});

async function main() {
  const result = await executeAutonomousLoop(migrationAgent, {
    prompt: 'Migrate all tests in src/__tests__ from Jest to Vitest',
    completion: testsPassing('npm run test'),
    maxIterations: 20,
    iterationDelay: 1000,
    onIterationStart: (i) => console.log(`\n🔄 Starting iteration ${i}...`),
    onIteration: (r) => {
      console.log(`   ${r.success ? '✅' : '❌'} Iteration ${r.iteration}`);
      console.log(`   Tokens: ${r.tokensUsed}, Duration: ${r.duration}ms`);
      if (r.completionCheck.message) {
        console.log(`   Message: ${r.completionCheck.message}`);
      }
    },
  });

  console.log('\n' + '='.repeat(50));
  console.log(`Result: ${result.success ? '✅ SUCCESS' : '❌ FAILED'}`);
  console.log(`Total iterations: ${result.iterations.length}`);
  console.log(`Total tokens: ${result.totalTokens}`);
  console.log(`Total duration: ${result.totalDuration}ms`);
  if (result.completionMessage) {
    console.log(`Message: ${result.completionMessage}`);
  }
}

main().catch(console.error);
*/
