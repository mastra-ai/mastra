/**
 * Network Validation Module
 *
 * Adds programmatic validation to the Agent Network loop.
 * This allows the network to verify task completion through external checks
 * rather than relying solely on LLM self-assessment.
 *
 * The core primitive is the ValidationCheck interface - users can implement
 * any validation logic they need. Helper functions are provided for common
 * patterns but are not required.
 */

import { z } from 'zod';
import { exec } from 'child_process';
import { promisify } from 'util';
import { createTool } from '../../tools';
import type { Message } from '../../agent';

const execAsync = promisify(exec);

// ============================================================================
// Core Types
// ============================================================================

/**
 * Runtime context passed to validation checks.
 * Contains the current state of the network loop.
 */
export interface ValidationContext {
  /** Current iteration number (1-based) */
  iteration: number;
  /** Maximum iterations allowed */
  maxIterations?: number;
  /** All messages in the conversation */
  messages: Message[];
  /** The original task/prompt */
  originalTask: string;
  /** Current thread ID (if using memory) */
  threadId?: string;
  /** Resource ID (if using memory) */
  resourceId?: string;
  /** Name of the network */
  networkName: string;
  /** ID of the current run */
  runId: string;
  /** Result from the last primitive execution (if any) */
  lastResult?: unknown;
  /** Whether the LLM assessed the task as complete */
  llmSaysComplete: boolean;
}

/**
 * Result of a single validation check.
 * This is what your check function should return.
 */
export interface ValidationResult {
  /** Whether the check passed */
  success: boolean;
  /** Human-readable message describing the result */
  message: string;
  /** Optional structured details (will be shown to LLM on failure) */
  details?: Record<string, unknown>;
  /** How long the check took in ms (automatically added if not provided) */
  duration?: number;
}

/**
 * A validation check that verifies some aspect of task completion.
 *
 * Users can implement this interface directly or use helper functions
 * like `createCheck()`.
 *
 * @example Direct implementation
 * ```typescript
 * const myCheck: ValidationCheck = {
 *   id: 'api-health',
 *   name: 'API Health Check',
 *   check: async (ctx) => {
 *     // Can use context to make decisions
 *     console.log(`Checking after iteration ${ctx.iteration}`);
 *     const res = await fetch('http://localhost:3000/health');
 *     return {
 *       success: res.ok,
 *       message: res.ok ? 'API is healthy' : `API returned ${res.status}`,
 *     };
 *   },
 * };
 * ```
 */
export interface ValidationCheck {
  /** Unique identifier for this check */
  id: string;
  /** Human-readable name (shown in logs/UI) */
  name: string;
  /** Async function that performs the validation, receives runtime context */
  check: (context: ValidationContext) => Promise<ValidationResult>;
}

/**
 * Configuration for network validation
 */
export interface NetworkValidationConfig {
  /**
   * Array of validation checks to run.
   * Each check should implement the ValidationCheck interface.
   */
  checks: ValidationCheck[];

  /**
   * How to combine check results:
   * - 'all': All checks must pass (default)
   * - 'any': At least one check must pass
   */
  strategy?: 'all' | 'any';

  /**
   * How validation interacts with LLM completion assessment:
   * - 'verify': LLM says complete AND validation passes (default)
   * - 'override': Only validation matters, ignore LLM assessment
   * - 'assist': Use validation to help LLM (feed results back as context)
   */
  mode?: 'verify' | 'override' | 'assist';

  /**
   * Maximum time for all validation checks (ms)
   * Default: 600000 (10 minutes)
   */
  timeout?: number;

  /**
   * Run validation checks in parallel (default: true)
   */
  parallel?: boolean;

  /**
   * Called after each validation run with results
   */
  onValidation?: (results: ValidationRunResult) => void | Promise<void>;
}

/**
 * Result of running all validation checks
 */
export interface ValidationRunResult {
  /** Whether overall validation passed (based on strategy) */
  passed: boolean;
  /** Individual check results */
  results: Array<ValidationResult & { checkId: string; checkName: string }>;
  /** Total duration of all checks */
  totalDuration: number;
  /** Whether validation timed out */
  timedOut: boolean;
}

// ============================================================================
// Validation Runner
// ============================================================================

/**
 * Runs all validation checks according to the configuration
 */
export async function runValidation(
  config: NetworkValidationConfig,
  context: ValidationContext,
): Promise<ValidationRunResult> {
  const strategy = config.strategy ?? 'all';
  const parallel = config.parallel ?? true;
  const timeout = config.timeout ?? 600000;

  const startTime = Date.now();
  const results: ValidationRunResult['results'] = [];
  let timedOut = false;

  // Create a timeout promise
  const timeoutPromise = new Promise<'timeout'>(resolve => {
    setTimeout(() => resolve('timeout'), timeout);
  });

  if (parallel) {
    // Run all checks in parallel
    const checkPromises = config.checks.map(async check => {
      try {
        const result = await check.check(context);
        return { ...result, checkId: check.id, checkName: check.name };
      } catch (error: any) {
        return {
          success: false,
          message: `Check ${check.name} threw an error: ${error.message}`,
          checkId: check.id,
          checkName: check.name,
          duration: 0,
        };
      }
    });

    const raceResult = await Promise.race([Promise.all(checkPromises), timeoutPromise]);

    if (raceResult === 'timeout') {
      timedOut = true;
      // Still wait for any completed checks
      const settledResults = await Promise.allSettled(checkPromises);
      for (const settled of settledResults) {
        if (settled.status === 'fulfilled') {
          results.push(settled.value);
        }
      }
    } else {
      results.push(...raceResult);
    }
  } else {
    // Run checks sequentially with short-circuit logic
    for (const check of config.checks) {
      if (Date.now() - startTime > timeout) {
        timedOut = true;
        break;
      }

      try {
        const result = await check.check(context);
        results.push({ ...result, checkId: check.id, checkName: check.name });

        // Short-circuit for 'all' strategy if a check fails
        if (strategy === 'all' && !result.success) {
          break;
        }
        // Short-circuit for 'any' strategy if a check passes
        if (strategy === 'any' && result.success) {
          break;
        }
      } catch (error: any) {
        results.push({
          success: false,
          message: `Check ${check.name} threw an error: ${error.message}`,
          checkId: check.id,
          checkName: check.name,
          duration: 0,
        });
        if (strategy === 'all') {
          break;
        }
      }
    }
  }

  const passed =
    strategy === 'all'
      ? results.length === config.checks.length && results.every(r => r.success)
      : results.some(r => r.success);

  const runResult: ValidationRunResult = {
    passed,
    results,
    totalDuration: Date.now() - startTime,
    timedOut,
  };

  // Call the onValidation callback if provided
  await config.onValidation?.(runResult);

  return runResult;
}

/**
 * Formats validation results into a message for the LLM
 */
export function formatValidationFeedback(result: ValidationRunResult): string {
  const lines: string[] = [];

  lines.push('## Validation Results');
  lines.push('');
  lines.push(`Overall: ${result.passed ? '✅ PASSED' : '❌ FAILED'}`);
  lines.push(`Duration: ${result.totalDuration}ms`);
  if (result.timedOut) {
    lines.push('⚠️ Validation timed out before all checks completed');
  }
  lines.push('');

  for (const check of result.results) {
    lines.push(`### ${check.checkName} (${check.checkId})`);
    lines.push(`Status: ${check.success ? '✅ Passed' : '❌ Failed'}`);
    lines.push(`Message: ${check.message}`);
    if (check.details) {
      lines.push('Details:');
      lines.push('```');
      // Truncate long details
      const detailsStr = JSON.stringify(check.details, null, 2);
      lines.push(detailsStr.length > 2000 ? detailsStr.slice(0, 2000) + '...' : detailsStr);
      lines.push('```');
    }
    lines.push('');
  }

  return lines.join('\n');
}

// ============================================================================
// Check Creator
// ============================================================================

/**
 * The result shape returned by a check's run function
 */
type CheckRunResult = { success: boolean; message: string; details?: Record<string, unknown> };

/**
 * Creates a validation check from an async function.
 *
 * The `run` function receives:
 * - `args`: Your custom static configuration (if provided)
 * - `context`: Runtime state from the network loop (messages, iteration, etc.)
 *
 * @param options.id - Unique identifier for this check
 * @param options.name - Human-readable name (shown in logs/feedback)
 * @param options.args - Static arguments passed to the run function (your custom config)
 * @param options.run - Async function that performs the validation
 *
 * @example
 * ```typescript
 * // Run a command - use context to vary behavior
 * const testsCheck = createCheck({
 *   id: 'tests',
 *   name: 'Unit Tests',
 *   args: { command: 'npm test' },
 *   run: async (args, ctx) => {
 *     // Could run more thorough tests on later iterations
 *     const cmd = ctx.iteration > 3 ? `${args.command} -- --coverage` : args.command;
 *     const result = await exec(cmd);
 *     return {
 *       success: result.exitCode === 0,
 *       message: result.exitCode === 0 ? 'Tests passed' : 'Tests failed',
 *       details: { stdout: result.stdout, iteration: ctx.iteration },
 *     };
 *   },
 * });
 *
 * // Check based on conversation content
 * const outputCheck = createCheck({
 *   id: 'output-check',
 *   name: 'Output Validation',
 *   run: async (ctx) => {
 *     // Inspect what the agent actually did
 *     const lastMessage = ctx.messages.at(-1);
 *     const hasCode = lastMessage?.content?.includes('```');
 *     return {
 *       success: hasCode,
 *       message: hasCode ? 'Agent produced code' : 'No code in output',
 *     };
 *   },
 * });
 *
 * // Dynamic check based on iteration
 * const progressCheck = createCheck({
 *   id: 'progress',
 *   name: 'Progress Check',
 *   run: async (ctx) => {
 *     // Fail if we're past iteration 5 and still not done
 *     if (ctx.iteration > 5 && !ctx.llmSaysComplete) {
 *       return { success: false, message: 'Taking too long, need human review' };
 *     }
 *     return { success: true, message: 'Progress acceptable' };
 *   },
 * });
 *
 * // With static args for configuration
 * const apiCheck = createCheck({
 *   id: 'api',
 *   name: 'API Health',
 *   args: { url: 'http://localhost:3000/health', expectedStatus: 200 },
 *   run: async (args, ctx) => {
 *     console.log(`Checking API on iteration ${ctx.iteration}`);
 *     const res = await fetch(args.url);
 *     return {
 *       success: res.status === args.expectedStatus,
 *       message: res.ok ? 'API healthy' : `Got ${res.status}`,
 *     };
 *   },
 * });
 * ```
 */
export function createCheck<TArgs = undefined>(
  options: TArgs extends undefined
    ? {
        id: string;
        name: string;
        run: (context: ValidationContext) => Promise<CheckRunResult>;
      }
    : {
        id: string;
        name: string;
        args: TArgs;
        run: (args: TArgs, context: ValidationContext) => Promise<CheckRunResult>;
      },
): ValidationCheck {
  return {
    id: options.id,
    name: options.name,
    async check(context: ValidationContext) {
      const start = Date.now();
      try {
        const result = await ('args' in options
          ? options.run(options.args, context)
          : (options.run as (ctx: ValidationContext) => Promise<CheckRunResult>)(context));
        return { ...result, duration: Date.now() - start };
      } catch (error: any) {
        return {
          success: false,
          message: `Check threw an error: ${error.message}`,
          details: { error: error.stack },
          duration: Date.now() - start,
        };
      }
    },
  };
}

// ============================================================================
// Validation Tool (for Agent Network primitives)
// ============================================================================

/**
 * Creates a tool that lets agents run shell commands for validation.
 * Add this to your agent's tools if you want the agent to decide when to validate.
 *
 * @example
 * ```typescript
 * const agent = new Agent({
 *   instructions: 'After making changes, run commands to verify your work.',
 *   tools: {
 *     runCommand: createRunCommandTool(),
 *   },
 * });
 * ```
 */
export function createRunCommandTool() {
  return createTool({
    id: 'run-command',
    description:
      'Execute a shell command and return the result. Use this to verify your work by running tests, builds, linting, or any other validation commands.',
    inputSchema: z.object({
      command: z.string().describe('The shell command to execute'),
      timeout: z.number().default(60000).describe('Timeout in milliseconds'),
      cwd: z.string().optional().describe('Working directory'),
    }),
    execute: async ({ command, timeout, cwd }) => {
      try {
        const { stdout, stderr } = await execAsync(command, { timeout, cwd });
        return {
          success: true,
          exitCode: 0,
          stdout: stdout.slice(-3000),
          stderr: stderr.slice(-1000),
        };
      } catch (error: any) {
        return {
          success: false,
          exitCode: error.code,
          stdout: error.stdout?.slice(-2000),
          stderr: error.stderr?.slice(-2000),
          message: error.message,
        };
      }
    },
  });
}
