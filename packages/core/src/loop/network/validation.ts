/**
 * Network Completion Checks
 *
 * Provides a unified "check" concept for determining when a network task is complete.
 * Checks can be code-based (run tests, call APIs) or LLM-based (ask an LLM to evaluate).
 *
 * The default behavior uses a built-in LLM check that asks "is this task complete?"
 * Users can add their own checks, mix code and LLM checks, or replace the default entirely.
 */

import { z } from 'zod';
import { exec } from 'child_process';
import { promisify } from 'util';
import { createTool } from '../../tools';
import type { MastraDBMessage } from '../../agent';

const execAsync = promisify(exec);

// ============================================================================
// Core Types
// ============================================================================

/**
 * Runtime context passed to completion checks.
 * Contains the full state of the network loop at check time.
 */
export interface CheckContext {
  // ---- Iteration State ----
  /** Current iteration number (1-based) */
  iteration: number;
  /** Maximum iterations allowed */
  maxIterations?: number;

  // ---- Messages & Conversation ----
  /** All messages in the conversation thread */
  messages: MastraDBMessage[];
  /** The original task/prompt that started this network run */
  originalTask: string;

  // ---- Routing Agent State ----
  /** Which primitive was selected this iteration */
  selectedPrimitive: {
    id: string;
    type: 'agent' | 'workflow' | 'tool';
  };
  /** The prompt/input sent to the selected primitive */
  primitivePrompt: string;
  /** Result from the primitive execution */
  primitiveResult: string;

  // ---- Identifiers ----
  /** Name of the network/routing agent */
  networkName: string;
  /** ID of the current run */
  runId: string;
  /** Current thread ID (if using memory) */
  threadId?: string;
  /** Resource ID (if using memory) */
  resourceId?: string;

  // ---- Request Context ----
  /**
   * Custom context from the request.
   */
  customContext?: Record<string, unknown>;
}

/**
 * Result of a completion check.
 */
export interface CheckResult {
  /** Whether the check passed (task is complete per this check) */
  passed: boolean;
  /** Human-readable message describing the result */
  message: string;
  /** Optional final result to return (used when check passes) */
  result?: string;
  /** Optional structured details (shown to LLM on failure for next iteration) */
  details?: Record<string, unknown>;
  /** How long the check took in ms (automatically added) */
  duration?: number;
}

/**
 * A completion check that determines if the task is done.
 * Checks can be code-based or LLM-based - both use this interface.
 */
export interface Check {
  /** Unique identifier for this check */
  id: string;
  /** Human-readable name (shown in logs/UI) */
  name: string;
  /** Whether this is an LLM-based check (for internal use) */
  isLLMCheck?: boolean;
  /** Async function that runs the check */
  run: (context: CheckContext) => Promise<CheckResult>;
}

// Legacy aliases for backwards compatibility
/** @deprecated Use CheckContext instead */
export type ValidationContext = CheckContext;
/** @deprecated Use CheckResult instead */
export type ValidationResult = CheckResult;
/** @deprecated Use Check instead */
export type ValidationCheck = Check;

/**
 * Configuration for network completion checks.
 */
export interface CompletionConfig {
  /**
   * Checks to run to determine if the task is complete.
   * Can be code-based (createCheck) or LLM-based (createLLMCheck).
   *
   * If not specified, uses the default LLM completion check (taskCompletionCheck).
   */
  checks?: Check[];

  /**
   * How to combine check results:
   * - 'all': All checks must pass (default)
   * - 'any': At least one check must pass
   */
  strategy?: 'all' | 'any';

  /**
   * Maximum time for all checks (ms)
   * Default: 600000 (10 minutes)
   */
  timeout?: number;

  /**
   * Run checks in parallel (default: true)
   */
  parallel?: boolean;

  /**
   * Called after checks run with results
   */
  onCheck?: (results: CheckRunResult) => void | Promise<void>;
}

/**
 * Result of running all completion checks
 */
export interface CheckRunResult {
  /** Whether the task is complete (based on strategy) */
  complete: boolean;
  /** Final result to return (from passing check) */
  result?: string;
  /** Individual check results */
  checks: Array<CheckResult & { checkId: string; checkName: string }>;
  /** Total duration of all checks */
  totalDuration: number;
  /** Whether checks timed out */
  timedOut: boolean;
}

// Legacy aliases
/** @deprecated Use CompletionConfig instead */
export type NetworkValidationConfig = CompletionConfig;
/** @deprecated Use CheckRunResult instead */
export type ValidationRunResult = CheckRunResult;

// ============================================================================
// Check Runner
// ============================================================================

/**
 * Runs all completion checks according to the configuration
 */
export async function runChecks(checks: Check[], context: CheckContext, options?: {
  strategy?: 'all' | 'any';
  parallel?: boolean;
  timeout?: number;
}): Promise<CheckRunResult> {
  const strategy = options?.strategy ?? 'all';
  const parallel = options?.parallel ?? true;
  const timeout = options?.timeout ?? 600000;

  const startTime = Date.now();
  const results: CheckRunResult['checks'] = [];
  let timedOut = false;
  let finalResult: string | undefined;

  // Create a timeout promise
  const timeoutPromise = new Promise<'timeout'>(resolve => {
    setTimeout(() => resolve('timeout'), timeout);
  });

  if (parallel) {
    // Run all checks in parallel
    const checkPromises = checks.map(async check => {
      try {
        const result = await check.run(context);
        return { ...result, checkId: check.id, checkName: check.name };
      } catch (error: any) {
        return {
          passed: false,
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
    for (const check of checks) {
      if (Date.now() - startTime > timeout) {
        timedOut = true;
        break;
      }

      try {
        const result = await check.run(context);
        results.push({ ...result, checkId: check.id, checkName: check.name });

        // Capture result from passing check
        if (result.passed && result.result) {
          finalResult = result.result;
        }

        // Short-circuit for 'all' strategy if a check fails
        if (strategy === 'all' && !result.passed) {
          break;
        }
        // Short-circuit for 'any' strategy if a check passes
        if (strategy === 'any' && result.passed) {
          break;
        }
      } catch (error: any) {
        results.push({
          passed: false,
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

  // Get result from first passing check (if any)
  if (!finalResult) {
    const passingCheck = results.find(r => r.passed && r.result);
    if (passingCheck) {
      finalResult = passingCheck.result;
    }
  }

  const complete =
    strategy === 'all'
      ? results.length === checks.length && results.every(r => r.passed)
      : results.some(r => r.passed);

  return {
    complete,
    result: finalResult,
    checks: results,
    totalDuration: Date.now() - startTime,
    timedOut,
  };
}

// Legacy wrapper
/** @deprecated Use runChecks instead */
export async function runValidation(
  config: CompletionConfig,
  context: CheckContext,
): Promise<CheckRunResult> {
  const result = await runChecks(config.checks || [], context, {
    strategy: config.strategy,
    parallel: config.parallel,
    timeout: config.timeout,
  });
  await config.onCheck?.(result);
  return result;
}

/**
 * Formats check results into a message for the LLM
 */
export function formatCheckFeedback(result: CheckRunResult): string {
  const lines: string[] = [];

  lines.push('## Completion Check Results');
  lines.push('');
  lines.push(`Overall: ${result.complete ? '✅ COMPLETE' : '❌ NOT COMPLETE'}`);
  lines.push(`Duration: ${result.totalDuration}ms`);
  if (result.timedOut) {
    lines.push('⚠️ Checks timed out');
  }
  lines.push('');

  for (const check of result.checks) {
    lines.push(`### ${check.checkName} (${check.checkId})`);
    lines.push(`Status: ${check.passed ? '✅ Passed' : '❌ Failed'}`);
    lines.push(`Message: ${check.message}`);
    if (check.details) {
      lines.push('Details:');
      lines.push('```');
      const detailsStr = JSON.stringify(check.details, null, 2);
      lines.push(detailsStr.length > 2000 ? detailsStr.slice(0, 2000) + '...' : detailsStr);
      lines.push('```');
    }
    lines.push('');
  }

  return lines.join('\n');
}

// Legacy alias
/** @deprecated Use formatCheckFeedback instead */
export const formatValidationFeedback = formatCheckFeedback;

// ============================================================================
// Check Creators
// ============================================================================

/**
 * Parameters passed to the check's run function.
 * Combines user-provided args with runtime context from the network loop.
 */
export type CheckParams<TArgs = undefined> = TArgs extends undefined
  ? CheckContext
  : CheckContext & { args: TArgs };

/**
 * The return type for check run functions
 */
type CheckRunReturn = { passed: boolean; message: string; result?: string; details?: Record<string, unknown> };

/**
 * Creates a code-based completion check.
 *
 * @param options.id - Unique identifier for this check
 * @param options.name - Human-readable name
 * @param options.args - Static arguments available via `params.args`
 * @param options.run - Async function that runs the check
 *
 * @example
 * ```typescript
 * // Run tests
 * const testsCheck = createCheck({
 *   id: 'tests',
 *   name: 'Unit Tests',
 *   args: { command: 'npm test' },
 *   run: async (params) => {
 *     const result = await exec(params.args.command);
 *     return {
 *       passed: result.exitCode === 0,
 *       message: result.exitCode === 0 ? 'Tests passed' : 'Tests failed',
 *     };
 *   },
 * });
 *
 * // Check API
 * const apiCheck = createCheck({
 *   id: 'api',
 *   name: 'API Health',
 *   args: { url: 'http://localhost:3000/health' },
 *   run: async (params) => {
 *     const res = await fetch(params.args.url);
 *     return { passed: res.ok, message: res.ok ? 'Healthy' : 'Down' };
 *   },
 * });
 *
 * // Context-aware check
 * const progressCheck = createCheck({
 *   id: 'progress',
 *   name: 'Progress',
 *   run: async (params) => {
 *     if (params.iteration > 10) {
 *       return { passed: false, message: 'Taking too long' };
 *     }
 *     return { passed: true, message: 'OK' };
 *   },
 * });
 * ```
 */
export function createCheck<TArgs = undefined>(
  options: TArgs extends undefined
    ? {
        id: string;
        name: string;
        run: (params: CheckContext) => Promise<CheckRunReturn>;
      }
    : {
        id: string;
        name: string;
        args: TArgs;
        run: (params: CheckContext & { args: TArgs }) => Promise<CheckRunReturn>;
      },
): Check {
  return {
    id: options.id,
    name: options.name,
    async run(context: CheckContext) {
      const start = Date.now();
      try {
        const params = 'args' in options ? { ...context, args: options.args } : context;
        const result = await (options.run as (p: typeof params) => Promise<CheckRunReturn>)(params);
        return { ...result, duration: Date.now() - start };
      } catch (error: any) {
        return {
          passed: false,
          message: `Check threw an error: ${error.message}`,
          details: { error: error.stack },
          duration: Date.now() - start,
        };
      }
    },
  };
}

/**
 * Creates an LLM-based completion check.
 * The LLM will evaluate the task based on your instructions.
 *
 * @param options.id - Unique identifier for this check
 * @param options.name - Human-readable name
 * @param options.instructions - Instructions for the LLM to evaluate completion
 *
 * @example
 * ```typescript
 * const qualityCheck = createLLMCheck({
 *   id: 'quality',
 *   name: 'Code Quality Review',
 *   instructions: `
 *     Review the code changes and evaluate:
 *     - Are there any obvious bugs?
 *     - Is error handling adequate?
 *     - Are edge cases covered?
 *   `,
 * });
 * ```
 */
export function createLLMCheck(options: {
  id: string;
  name: string;
  instructions: string;
}): Check {
  return {
    id: options.id,
    name: options.name,
    isLLMCheck: true,
    // The actual LLM call is handled by the network loop
    // This just stores the config
    async run(_context: CheckContext) {
      // This is a placeholder - the network loop will intercept LLM checks
      // and run them through the routing agent
      return {
        passed: false,
        message: 'LLM check must be run by the network loop',
        _llmCheckConfig: {
          instructions: options.instructions,
        },
      } as CheckResult;
    },
  };
}

/**
 * The default LLM completion check used by agent.network().
 * Asks the LLM "Is this task complete?" based on system instructions.
 *
 * Include this in your checks array if you want the default behavior
 * alongside your own checks.
 *
 * @param options.instructions - Additional instructions for completion evaluation
 *
 * @example
 * ```typescript
 * // Default + custom checks
 * completion: {
 *   checks: [
 *     taskCompletionCheck(),
 *     testsCheck,
 *   ],
 * }
 *
 * // Customized default check
 * completion: {
 *   checks: [
 *     taskCompletionCheck({
 *       instructions: 'Only mark complete when all tests pass',
 *     }),
 *     testsCheck,
 *   ],
 * }
 * ```
 */
export function taskCompletionCheck(options?: { instructions?: string }): Check {
  return createLLMCheck({
    id: 'task-completion',
    name: 'Task Completion',
    instructions: options?.instructions || `
      Evaluate if the task is complete based on the system instructions.
      Pay close attention to what was originally requested.
      Only mark as complete if all requirements have been satisfied.
    `,
  });
}

// ============================================================================
// Tools
// ============================================================================

/**
 * Creates a tool that lets agents run shell commands.
 * Add this to your agent's tools if you want the agent to run commands.
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
