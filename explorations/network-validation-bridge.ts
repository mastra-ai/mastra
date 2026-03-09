/**
 * Network Validation Bridge
 *
 * This module shows how to add Ralph Wiggum-style programmatic validation
 * to Mastra's existing Agent Network loop.
 *
 * The key insight: Agent Network's LLM-based completion assessment and
 * Ralph Wiggum's programmatic validation are complementary. This bridge
 * combines both for more reliable autonomous execution.
 */

import { z } from 'zod';
import { Agent } from '@mastra/core/agent';
import { createTool } from '@mastra/core/tools';
import type { MessageListInput } from '@mastra/core/agent';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

// ============================================================================
// Types
// ============================================================================

export interface ValidationCheck {
  id: string;
  name: string;
  check: () => Promise<ValidationResult>;
}

export interface ValidationResult {
  success: boolean;
  message: string;
  details?: Record<string, unknown>;
  duration?: number;
}

export interface NetworkValidationConfig {
  /**
   * Array of validation checks to run
   */
  checks: ValidationCheck[];

  /**
   * How to combine check results:
   * - 'all': All checks must pass
   * - 'any': At least one check must pass
   * - 'weighted': Use weights (future)
   */
  strategy: 'all' | 'any';

  /**
   * How validation interacts with LLM completion assessment:
   * - 'verify': LLM says complete AND validation passes
   * - 'override': Only validation matters, ignore LLM
   * - 'llm-fallback': Try validation first, use LLM if no checks configured
   */
  mode: 'verify' | 'override' | 'llm-fallback';

  /**
   * Maximum time for all validation checks (ms)
   */
  timeout?: number;

  /**
   * Run validation in parallel or sequentially
   */
  parallel?: boolean;
}

export interface ValidatedNetworkOptions {
  /**
   * Maximum iterations before stopping
   */
  maxIterations: number;

  /**
   * Validation configuration
   */
  validation?: NetworkValidationConfig;

  /**
   * Called after each iteration with validation results
   */
  onIteration?: (result: IterationStatus) => void | Promise<void>;

  /**
   * Thread ID for memory
   */
  threadId?: string;

  /**
   * Resource ID for memory
   */
  resourceId?: string;
}

export interface IterationStatus {
  iteration: number;
  llmSaysComplete: boolean;
  validationPassed: boolean | null;
  validationResults: ValidationResult[];
  isComplete: boolean;
  primitive: {
    type: 'agent' | 'workflow' | 'tool' | 'none';
    id: string;
  };
  duration: number;
}

// ============================================================================
// Validation Check Factories
// ============================================================================

/**
 * Check if tests pass
 */
export function testsPass(command = 'npm test', options?: { timeout?: number; cwd?: string }): ValidationCheck {
  return {
    id: 'tests-pass',
    name: 'Tests Pass',
    async check() {
      const start = Date.now();
      try {
        const { stdout, stderr } = await execAsync(command, {
          timeout: options?.timeout ?? 300000,
          cwd: options?.cwd,
        });
        return {
          success: true,
          message: 'All tests passed',
          details: { stdout: stdout.slice(-1000), stderr: stderr.slice(-500) },
          duration: Date.now() - start,
        };
      } catch (error: any) {
        return {
          success: false,
          message: `Tests failed: ${error.message}`,
          details: {
            stdout: error.stdout?.slice(-1000),
            stderr: error.stderr?.slice(-1000),
            exitCode: error.code,
          },
          duration: Date.now() - start,
        };
      }
    },
  };
}

/**
 * Check if build succeeds
 */
export function buildSucceeds(
  command = 'npm run build',
  options?: { timeout?: number; cwd?: string },
): ValidationCheck {
  return {
    id: 'build-succeeds',
    name: 'Build Succeeds',
    async check() {
      const start = Date.now();
      try {
        const { stdout, stderr } = await execAsync(command, {
          timeout: options?.timeout ?? 600000,
          cwd: options?.cwd,
        });
        return {
          success: true,
          message: 'Build completed successfully',
          details: { stdout: stdout.slice(-500), stderr: stderr.slice(-500) },
          duration: Date.now() - start,
        };
      } catch (error: any) {
        return {
          success: false,
          message: `Build failed: ${error.message}`,
          details: {
            stdout: error.stdout?.slice(-1000),
            stderr: error.stderr?.slice(-1000),
          },
          duration: Date.now() - start,
        };
      }
    },
  };
}

/**
 * Check if lint passes
 */
export function lintPasses(command = 'npm run lint', options?: { timeout?: number; cwd?: string }): ValidationCheck {
  return {
    id: 'lint-passes',
    name: 'Lint Passes',
    async check() {
      const start = Date.now();
      try {
        const { stdout, stderr } = await execAsync(command, {
          timeout: options?.timeout ?? 120000,
          cwd: options?.cwd,
        });
        return {
          success: true,
          message: 'No lint errors',
          details: { stdout: stdout.slice(-500) },
          duration: Date.now() - start,
        };
      } catch (error: any) {
        return {
          success: false,
          message: `Lint errors found: ${error.message}`,
          details: {
            stdout: error.stdout?.slice(-1000),
            stderr: error.stderr?.slice(-1000),
          },
          duration: Date.now() - start,
        };
      }
    },
  };
}

/**
 * Check if TypeScript compiles without errors
 */
export function typeChecks(
  command = 'npx tsc --noEmit',
  options?: { timeout?: number; cwd?: string },
): ValidationCheck {
  return {
    id: 'type-checks',
    name: 'TypeScript Compiles',
    async check() {
      const start = Date.now();
      try {
        const { stdout, stderr } = await execAsync(command, {
          timeout: options?.timeout ?? 300000,
          cwd: options?.cwd,
        });
        return {
          success: true,
          message: 'No type errors',
          details: { stdout: stdout.slice(-500) },
          duration: Date.now() - start,
        };
      } catch (error: any) {
        return {
          success: false,
          message: `Type errors found`,
          details: {
            stdout: error.stdout?.slice(-2000),
            stderr: error.stderr?.slice(-1000),
          },
          duration: Date.now() - start,
        };
      }
    },
  };
}

/**
 * Custom validation check from a function
 */
export function customCheck(
  id: string,
  name: string,
  fn: () => Promise<{ success: boolean; message: string; details?: Record<string, unknown> }>,
): ValidationCheck {
  return {
    id,
    name,
    async check() {
      const start = Date.now();
      const result = await fn();
      return { ...result, duration: Date.now() - start };
    },
  };
}

/**
 * File exists check
 */
export function fileExists(path: string): ValidationCheck {
  return {
    id: `file-exists-${path}`,
    name: `File Exists: ${path}`,
    async check() {
      const start = Date.now();
      try {
        const fs = await import('fs/promises');
        await fs.access(path);
        return {
          success: true,
          message: `File ${path} exists`,
          duration: Date.now() - start,
        };
      } catch {
        return {
          success: false,
          message: `File ${path} does not exist`,
          duration: Date.now() - start,
        };
      }
    },
  };
}

/**
 * File contains pattern check
 */
export function fileContains(path: string, pattern: string | RegExp): ValidationCheck {
  return {
    id: `file-contains-${path}`,
    name: `File Contains Pattern: ${path}`,
    async check() {
      const start = Date.now();
      try {
        const fs = await import('fs/promises');
        const content = await fs.readFile(path, 'utf-8');
        const matches = typeof pattern === 'string' ? content.includes(pattern) : pattern.test(content);

        return {
          success: matches,
          message: matches
            ? `File ${path} contains expected pattern`
            : `File ${path} does not contain expected pattern`,
          duration: Date.now() - start,
        };
      } catch (error: any) {
        return {
          success: false,
          message: `Could not read file ${path}: ${error.message}`,
          duration: Date.now() - start,
        };
      }
    },
  };
}

// ============================================================================
// Validation Runner
// ============================================================================

async function runValidation(
  config: NetworkValidationConfig,
): Promise<{ passed: boolean; results: ValidationResult[] }> {
  const results: ValidationResult[] = [];

  if (config.parallel) {
    // Run all checks in parallel
    const checkResults = await Promise.all(config.checks.map(check => check.check()));
    results.push(...checkResults);
  } else {
    // Run checks sequentially (can short-circuit on failure for 'all' strategy)
    for (const check of config.checks) {
      const result = await check.check();
      results.push(result);

      // Short-circuit for 'all' strategy if a check fails
      if (config.strategy === 'all' && !result.success) {
        break;
      }
      // Short-circuit for 'any' strategy if a check passes
      if (config.strategy === 'any' && result.success) {
        break;
      }
    }
  }

  const passed = config.strategy === 'all' ? results.every(r => r.success) : results.some(r => r.success);

  return { passed, results };
}

// ============================================================================
// Validation Tools (for Agent Network)
// ============================================================================

/**
 * Create validation tools that can be added to an Agent Network
 * This allows the routing agent to call validation as a primitive
 */
export function createValidationTools() {
  return {
    runTests: createTool({
      id: 'run-tests',
      description:
        'Run the project test suite to verify changes work correctly. Call this after making code changes to ensure tests pass.',
      inputSchema: z.object({
        command: z.string().default('npm test').describe('The test command to run'),
        timeout: z.number().default(300000).describe('Timeout in milliseconds'),
      }),
      execute: async ({ command, timeout }) => {
        const check = testsPass(command, { timeout });
        return check.check();
      },
    }),

    runBuild: createTool({
      id: 'run-build',
      description: 'Build the project to verify there are no compilation errors. Call this after making code changes.',
      inputSchema: z.object({
        command: z.string().default('npm run build').describe('The build command to run'),
        timeout: z.number().default(600000).describe('Timeout in milliseconds'),
      }),
      execute: async ({ command, timeout }) => {
        const check = buildSucceeds(command, { timeout });
        return check.check();
      },
    }),

    runLint: createTool({
      id: 'run-lint',
      description: 'Run linting to check for code style issues. Call this after making code changes.',
      inputSchema: z.object({
        command: z.string().default('npm run lint').describe('The lint command to run'),
        timeout: z.number().default(120000).describe('Timeout in milliseconds'),
      }),
      execute: async ({ command, timeout }) => {
        const check = lintPasses(command, { timeout });
        return check.check();
      },
    }),

    checkTypes: createTool({
      id: 'check-types',
      description: 'Run TypeScript type checking. Call this after making code changes to ensure type safety.',
      inputSchema: z.object({
        command: z.string().default('npx tsc --noEmit').describe('The type check command'),
        timeout: z.number().default(300000).describe('Timeout in milliseconds'),
      }),
      execute: async ({ command, timeout }) => {
        const check = typeChecks(command, { timeout });
        return check.check();
      },
    }),

    runCommand: createTool({
      id: 'run-command',
      description: 'Execute an arbitrary shell command and return the result. Useful for custom validation.',
      inputSchema: z.object({
        command: z.string().describe('The command to execute'),
        timeout: z.number().default(60000).describe('Timeout in milliseconds'),
        cwd: z.string().optional().describe('Working directory'),
      }),
      execute: async ({ command, timeout, cwd }) => {
        try {
          const { stdout, stderr } = await execAsync(command, { timeout, cwd });
          return {
            success: true,
            exitCode: 0,
            stdout: stdout.slice(-2000),
            stderr: stderr.slice(-1000),
          };
        } catch (error: any) {
          return {
            success: false,
            exitCode: error.code,
            stdout: error.stdout?.slice(-2000),
            stderr: error.stderr?.slice(-1000),
            message: error.message,
          };
        }
      },
    }),
  };
}

// ============================================================================
// Enhanced Network Loop with Validation
// ============================================================================

/**
 * Wraps an agent's network method with validation support.
 *
 * This is a bridge implementation that adds Ralph Wiggum-style validation
 * to the existing Agent Network loop.
 */
export async function networkWithValidation(
  agent: Agent,
  messages: MessageListInput,
  options: ValidatedNetworkOptions,
) {
  const { maxIterations, validation, onIteration, ...networkOptions } = options;

  let iteration = 0;
  let isComplete = false;
  let lastResult: any = null;

  // Track validation feedback to pass to next iteration
  let validationFeedback: string | null = null;

  while (!isComplete && iteration < maxIterations) {
    iteration++;
    const iterationStart = Date.now();

    // Prepare messages with validation feedback from previous iteration
    let iterationMessages = messages;
    if (validationFeedback && iteration > 1) {
      // Append validation feedback to help the agent learn from failures
      const feedbackMessage = `
[VALIDATION FEEDBACK FROM PREVIOUS ITERATION]
The previous attempt was reviewed with automated validation.
${validationFeedback}

Please address these issues and continue working on the task.
`;

      if (typeof iterationMessages === 'string') {
        iterationMessages = iterationMessages + '\n\n' + feedbackMessage;
      } else if (Array.isArray(iterationMessages)) {
        iterationMessages = [...iterationMessages, { role: 'user' as const, content: feedbackMessage }];
      }
    }

    // Run the network iteration
    // Note: In a real implementation, we'd hook into the network loop internals
    // For now, we simulate by calling network and checking completion
    const networkResult = await agent.network(iterationMessages, {
      maxIterations: 1, // One network iteration at a time
      ...networkOptions,
    });

    // Consume the stream to get the result
    let networkOutput = '';
    for await (const chunk of networkResult.fullStream) {
      if (chunk.type === 'routing-agent-text-delta') {
        networkOutput += chunk.payload?.text || '';
      }
    }

    // Check if LLM thinks it's complete
    // (In real implementation, we'd get this from the network result)
    const llmSaysComplete = networkOutput.includes('complete') || iteration >= maxIterations;

    // Run validation if configured and LLM says complete (or in override mode)
    let validationPassed: boolean | null = null;
    let validationResults: ValidationResult[] = [];

    if (validation) {
      if (validation.mode === 'override' || (validation.mode === 'verify' && llmSaysComplete)) {
        const validationRun = await runValidation(validation);
        validationPassed = validationRun.passed;
        validationResults = validationRun.results;

        // Build feedback for next iteration if validation failed
        if (!validationPassed) {
          validationFeedback = validationResults
            .filter(r => !r.success)
            .map(r => `❌ ${r.message}${r.details ? `\nDetails: ${JSON.stringify(r.details)}` : ''}`)
            .join('\n\n');
        } else {
          validationFeedback = null;
        }
      }
    }

    // Determine if truly complete based on mode
    if (validation) {
      switch (validation.mode) {
        case 'verify':
          isComplete = llmSaysComplete && validationPassed === true;
          break;
        case 'override':
          isComplete = validationPassed === true;
          break;
        case 'llm-fallback':
          isComplete = validationPassed !== null ? validationPassed : llmSaysComplete;
          break;
      }
    } else {
      isComplete = llmSaysComplete;
    }

    // Report iteration status
    const status: IterationStatus = {
      iteration,
      llmSaysComplete,
      validationPassed,
      validationResults,
      isComplete,
      primitive: { type: 'agent', id: agent.id }, // Simplified
      duration: Date.now() - iterationStart,
    };

    await onIteration?.(status);
    lastResult = { networkOutput, status };
  }

  return {
    success: isComplete,
    iterations: iteration,
    result: lastResult,
  };
}

// ============================================================================
// Example Usage
// ============================================================================

/*
import { Agent } from '@mastra/core/agent';
import { openai } from '@ai-sdk/openai';
import { Memory } from '@mastra/memory';
import { 
  networkWithValidation, 
  testsPass, 
  buildSucceeds, 
  createValidationTools 
} from './network-validation-bridge';

// Approach 1: Validation as config option
const codeAgent = new Agent({
  id: 'code-migrator',
  instructions: 'You help migrate code between frameworks.',
  model: openai('gpt-4o'),
  memory: new Memory(),
  agents: {
    coder: codingAgent,
    tester: testingAgent,
  },
});

const result = await networkWithValidation(
  codeAgent,
  'Migrate all tests from Jest to Vitest in the src/__tests__ directory',
  {
    maxIterations: 30,
    validation: {
      checks: [testsPass(), buildSucceeds()],
      strategy: 'all',
      mode: 'verify', // LLM must say complete AND tests must pass
    },
    onIteration: (status) => {
      console.log(`Iteration ${status.iteration}: LLM=${status.llmSaysComplete}, Valid=${status.validationPassed}`);
      if (status.validationResults.length > 0) {
        status.validationResults.forEach(r => {
          console.log(`  ${r.success ? '✅' : '❌'} ${r.message}`);
        });
      }
    },
  }
);

// Approach 2: Validation as tools (agent decides when to validate)
const validationAgent = new Agent({
  id: 'validation-aware-migrator',
  instructions: `You help migrate code between frameworks.
    IMPORTANT: After making changes, ALWAYS run tests and build to verify your work.
    Do not consider the task complete until all validation passes.`,
  model: openai('gpt-4o'),
  memory: new Memory(),
  tools: createValidationTools(), // Add validation tools
  agents: {
    coder: codingAgent,
  },
});

// Now the agent can call runTests, runBuild, etc. as tools
const result2 = await validationAgent.network(
  'Migrate all tests from Jest to Vitest',
  { maxIterations: 30 }
);
*/
