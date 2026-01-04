/**
 * Network Completion Scorers
 *
 * Completion checks are just MastraScorers that return 0 (failed) or 1 (passed).
 * This unifies completion checking with the evaluation system.
 *
 * @example
 * ```typescript
 * import { createScorer } from '@mastra/core/evals';
 *
 * // Simple completion scorer
 * const testsScorer = createScorer({
 *   id: 'tests',
 *   description: 'Run unit tests',
 * }).generateScore(async ({ run }) => {
 *   const result = await exec('npm test');
 *   return result.exitCode === 0 ? 1 : 0;
 * });
 *
 * // Use in network
 * await agent.network(messages, {
 *   completion: {
 *     scorers: [testsScorer],
 *   },
 * });
 * ```
 */

import { z } from 'zod';
import { exec } from 'child_process';
import { promisify } from 'util';
import { createTool } from '../../tools';
import type { MastraDBMessage, Agent } from '../../agent';
import { createScorer, MastraScorer } from '../../evals/base';

const execAsync = promisify(exec);

// ============================================================================
// Core Types
// ============================================================================

/**
 * Runtime context passed to completion scoring.
 * Available via run.input when using a completion scorer.
 */
export interface CompletionContext {
  /** Current iteration number (1-based) */
  iteration: number;
  /** Maximum iterations allowed */
  maxIterations?: number;
  /** All messages in the conversation thread */
  messages: MastraDBMessage[];
  /** The original task/prompt that started this network run */
  originalTask: string;
  /** Which primitive was selected this iteration */
  selectedPrimitive: {
    id: string;
    type: 'agent' | 'workflow' | 'tool';
  };
  /** The prompt/input sent to the selected primitive */
  primitivePrompt: string;
  /** Result from the primitive execution */
  primitiveResult: string;
  /** Name of the network/routing agent */
  networkName: string;
  /** ID of the current run */
  runId: string;
  /** Current thread ID (if using memory) */
  threadId?: string;
  /** Resource ID (if using memory) */
  resourceId?: string;
  /** Custom context from the request */
  customContext?: Record<string, unknown>;
}

/**
 * Result of running a single scorer
 */
export interface ScorerResult {
  /** The score (0 = failed, 1 = passed) */
  score: number;
  /** Whether this scorer passed (score === 1) */
  passed: boolean;
  /** Reason from the scorer */
  reason?: string;
  /** Scorer ID */
  scorerId: string;
  /** Scorer name */
  scorerName: string;
  /** Duration in ms */
  duration: number;
}

/**
 * Configuration for network completion.
 */
export interface CompletionConfig {
  /**
   * Scorers to run to determine if the task is complete.
   * Each scorer should return 0 (not complete) or 1 (complete).
   *
   * @example
   * ```typescript
   * completion: {
   *   scorers: [testsScorer, buildScorer],
   * }
   * ```
   */
  scorers?: MastraScorer<any, any, any, any>[];

  /**
   * How to combine scorer results:
   * - 'all': All scorers must pass (score = 1) (default)
   * - 'any': At least one scorer must pass
   */
  strategy?: 'all' | 'any';

  /**
   * Maximum time for all scorers (ms)
   * Default: 600000 (10 minutes)
   */
  timeout?: number;

  /**
   * Run scorers in parallel (default: true)
   */
  parallel?: boolean;

  /**
   * Called after scorers run with results
   */
  onComplete?: (results: CompletionRunResult) => void | Promise<void>;
}

/**
 * Result of running all completion scorers
 */
export interface CompletionRunResult {
  /** Whether the task is complete (based on strategy) */
  complete: boolean;
  /** Individual scorer results */
  scorers: ScorerResult[];
  /** Total duration of all scorers */
  totalDuration: number;
  /** Whether scoring timed out */
  timedOut: boolean;
}

// Legacy type aliases for backwards compatibility
/** @deprecated Use CompletionContext instead */
export type CheckContext = CompletionContext;
/** @deprecated Use CompletionConfig instead */
export type NetworkValidationConfig = CompletionConfig;
/** @deprecated Use CompletionRunResult instead */
export type CheckRunResult = CompletionRunResult;
/** @deprecated Use CompletionRunResult instead */
export type ValidationRunResult = CompletionRunResult;

// ============================================================================
// Scorer Runner
// ============================================================================

/**
 * Run a single scorer and return the result.
 * 
 * Scorers receive:
 * - `run.input` - CompletionContext with all network state
 * - `run.output` - The primitive's result (what we're evaluating)
 * - `run.runId` - The network run ID
 * - `run.requestContext` - Custom context from the request
 */
async function runSingleScorer(
  scorer: MastraScorer<any, any, any, any>,
  context: CompletionContext,
): Promise<ScorerResult> {
  const start = Date.now();

  try {
    const result = await scorer.run({
      runId: context.runId,
      input: context,
      output: context.primitiveResult,
      requestContext: context.customContext,
    });

    const score = typeof result.score === 'number' ? result.score : 0;
    const reason = typeof result.reason === 'string' ? result.reason : undefined;

    return {
      score,
      passed: score === 1,
      reason,
      scorerId: scorer.id,
      scorerName: scorer.name ?? scorer.id,
      duration: Date.now() - start,
    };
  } catch (error: any) {
    return {
      score: 0,
      passed: false,
      reason: `Scorer threw an error: ${error.message}`,
      scorerId: scorer.id,
      scorerName: scorer.name ?? scorer.id,
      duration: Date.now() - start,
    };
  }
}

/**
 * Runs all completion scorers according to the configuration
 */
export async function runCompletionScorers(
  scorers: MastraScorer<any, any, any, any>[],
  context: CompletionContext,
  options?: {
    strategy?: 'all' | 'any';
    parallel?: boolean;
    timeout?: number;
  },
): Promise<CompletionRunResult> {
  const strategy = options?.strategy ?? 'all';
  const parallel = options?.parallel ?? true;
  const timeout = options?.timeout ?? 600000;

  const startTime = Date.now();
  const results: ScorerResult[] = [];
  let timedOut = false;

  const timeoutPromise = new Promise<'timeout'>(resolve => {
    setTimeout(() => resolve('timeout'), timeout);
  });

  if (parallel) {
    const scorerPromises = scorers.map(scorer => runSingleScorer(scorer, context));
    const raceResult = await Promise.race([Promise.all(scorerPromises), timeoutPromise]);

    if (raceResult === 'timeout') {
      timedOut = true;
      const settledResults = await Promise.allSettled(scorerPromises);
      for (const settled of settledResults) {
        if (settled.status === 'fulfilled') {
          results.push(settled.value);
        }
      }
    } else {
      results.push(...raceResult);
    }
  } else {
    for (const scorer of scorers) {
      if (Date.now() - startTime > timeout) {
        timedOut = true;
        break;
      }

      const result = await runSingleScorer(scorer, context);
      results.push(result);

      // Short-circuit
      if (strategy === 'all' && !result.passed) break;
      if (strategy === 'any' && result.passed) break;
    }
  }

  const complete =
    strategy === 'all'
      ? results.length === scorers.length && results.every(r => r.passed)
      : results.some(r => r.passed);

  return {
    complete,
    scorers: results,
    totalDuration: Date.now() - startTime,
    timedOut,
  };
}

// Legacy function aliases
/** @deprecated Use runCompletionScorers instead */
export async function runChecks(
  scorers: MastraScorer<any, any, any, any>[],
  context: CompletionContext,
  options?: { strategy?: 'all' | 'any'; parallel?: boolean; timeout?: number },
): Promise<CompletionRunResult> {
  return runCompletionScorers(scorers, context, options);
}

/** @deprecated Use runCompletionScorers instead */
export async function runValidation(
  config: CompletionConfig,
  context: CompletionContext,
): Promise<CompletionRunResult> {
  const result = await runCompletionScorers(config.scorers || [], context, {
    strategy: config.strategy,
    parallel: config.parallel,
    timeout: config.timeout,
  });
  await config.onComplete?.(result);
  return result;
}

/**
 * Formats scorer results into a message for the LLM
 */
export function formatCompletionFeedback(result: CompletionRunResult): string {
  const lines: string[] = [];

  lines.push('## Completion Check Results');
  lines.push('');
  lines.push(`Overall: ${result.complete ? '✅ COMPLETE' : '❌ NOT COMPLETE'}`);
  lines.push(`Duration: ${result.totalDuration}ms`);
  if (result.timedOut) {
    lines.push('⚠️ Scoring timed out');
  }
  lines.push('');

  for (const scorer of result.scorers) {
    lines.push(`### ${scorer.scorerName} (${scorer.scorerId})`);
    lines.push(`Score: ${scorer.score} ${scorer.passed ? '✅' : '❌'}`);
    if (scorer.reason) {
      lines.push(`Reason: ${scorer.reason}`);
    }
    lines.push('');
  }

  return lines.join('\n');
}

// Legacy alias
/** @deprecated Use formatCompletionFeedback instead */
export const formatCheckFeedback = formatCompletionFeedback;
/** @deprecated Use formatCompletionFeedback instead */
export const formatValidationFeedback = formatCompletionFeedback;

// ============================================================================
// Default LLM Completion Scorer
// ============================================================================

/**
 * Creates the default LLM completion scorer.
 * This is what runs when no scorers are configured.
 * 
 * @internal Used by the network loop
 */
export function createDefaultCompletionScorer(agent: Agent): MastraScorer<any, any, any, any> {
  return createScorer({
    id: 'default-completion',
    description: 'Default LLM completion check',
  }).generateScore(async ({ run }) => {
    const ctx = run.input as CompletionContext;
    
    const completionPrompt = `
      The ${ctx.selectedPrimitive.type} ${ctx.selectedPrimitive.id} has contributed to the task.
      This is the result: ${ctx.primitiveResult}

      You need to evaluate if the task is complete. Pay very close attention to the SYSTEM INSTRUCTIONS for when the task is considered complete.
      Original task: ${ctx.originalTask}

      Return 1 if the task is complete, 0 if not complete.
    `;

    try {
      const result = await agent.generate(completionPrompt, {
        maxSteps: 1,
      });
      
      // Parse the response - look for indicators of completion
      const text = result.text.toLowerCase();
      const isComplete = text.includes('1') || 
                         text.includes('complete') || 
                         text.includes('done') ||
                         text.includes('finished');
      
      return isComplete ? 1 : 0;
    } catch {
      return 0; // On error, assume not complete
    }
  });
}

// Re-export for users who want to create custom scorers
export { createScorer } from '../../evals/base';

// ============================================================================
// Tools
// ============================================================================

/**
 * Creates a tool that lets agents run shell commands.
 *
 * @example
 * ```typescript
 * const agent = new Agent({
 *   tools: { runCommand: createRunCommandTool() },
 * });
 * ```
 */
export function createRunCommandTool() {
  return createTool({
    id: 'run-command',
    description: 'Execute a shell command and return the result.',
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
