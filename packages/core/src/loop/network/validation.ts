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

const execAsync = promisify(exec);

// ============================================================================
// Core Types
// ============================================================================

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
 * like `createCheck()` or `createCommandCheck()`.
 *
 * @example Direct implementation
 * ```typescript
 * const myCheck: ValidationCheck = {
 *   id: 'api-health',
 *   name: 'API Health Check',
 *   check: async () => {
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
  /** Async function that performs the validation */
  check: () => Promise<ValidationResult>;
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
export async function runValidation(config: NetworkValidationConfig): Promise<ValidationRunResult> {
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
        const result = await check.check();
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
        const result = await check.check();
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
// Check Creators - Composable primitives for building validation checks
// ============================================================================

/**
 * Options for createCheck
 */
export interface CreateCheckOptions {
  /** Unique identifier for this check */
  id: string;
  /** Human-readable name (shown in logs/feedback) */
  name: string;
}

/**
 * Creates a validation check from an async function.
 * This is the primary way to create custom validation logic.
 *
 * @example
 * ```typescript
 * const apiHealthCheck = createCheck({
 *   id: 'api-health',
 *   name: 'API Health Check',
 * }, async () => {
 *   const res = await fetch('http://localhost:3000/health');
 *   return {
 *     success: res.ok,
 *     message: res.ok ? 'API is healthy' : `API returned ${res.status}`,
 *   };
 * });
 *
 * const dbConnectionCheck = createCheck({
 *   id: 'db-connection',
 *   name: 'Database Connection',
 * }, async () => {
 *   try {
 *     await db.query('SELECT 1');
 *     return { success: true, message: 'Database connected' };
 *   } catch (e) {
 *     return { success: false, message: `Database error: ${e.message}` };
 *   }
 * });
 * ```
 */
export function createCheck(
  options: CreateCheckOptions,
  fn: () => Promise<{ success: boolean; message: string; details?: Record<string, unknown> }>,
): ValidationCheck {
  return {
    id: options.id,
    name: options.name,
    async check() {
      const start = Date.now();
      try {
        const result = await fn();
        return { ...result, duration: Date.now() - start };
      } catch (error: any) {
        return {
          success: false,
          message: `Check threw an error: ${error.message}`,
          duration: Date.now() - start,
        };
      }
    },
  };
}

/**
 * Options for createCommandCheck
 */
export interface CreateCommandCheckOptions {
  /** Unique identifier for this check */
  id: string;
  /** Human-readable name (shown in logs/feedback) */
  name: string;
  /** The shell command to run */
  command: string;
  /** Working directory (optional) */
  cwd?: string;
  /** Timeout in milliseconds (default: 60000) */
  timeout?: number;
  /** Custom success message (default: "Command succeeded") */
  successMessage?: string;
  /** Custom failure message prefix (default: "Command failed") */
  failureMessage?: string;
}

/**
 * Creates a validation check that runs a shell command.
 * The check passes if the command exits with code 0.
 *
 * @example
 * ```typescript
 * // Run tests
 * const testsCheck = createCommandCheck({
 *   id: 'tests',
 *   name: 'Unit Tests',
 *   command: 'npm test',
 *   timeout: 300000,
 * });
 *
 * // Run build
 * const buildCheck = createCommandCheck({
 *   id: 'build',
 *   name: 'Build',
 *   command: 'npm run build',
 *   successMessage: 'Build completed successfully',
 * });
 *
 * // Run custom script
 * const migrationCheck = createCommandCheck({
 *   id: 'db-migrate',
 *   name: 'Database Migrations',
 *   command: 'npm run db:migrate:status',
 *   cwd: './packages/api',
 * });
 *
 * // Run with custom project commands
 * const e2eCheck = createCommandCheck({
 *   id: 'e2e',
 *   name: 'E2E Tests',
 *   command: 'pnpm test:e2e',
 *   timeout: 600000,
 * });
 * ```
 */
export function createCommandCheck(options: CreateCommandCheckOptions): ValidationCheck {
  return {
    id: options.id,
    name: options.name,
    async check() {
      const start = Date.now();
      try {
        const { stdout, stderr } = await execAsync(options.command, {
          timeout: options.timeout ?? 60000,
          cwd: options.cwd,
        });
        return {
          success: true,
          message: options.successMessage ?? 'Command succeeded',
          details: {
            command: options.command,
            stdout: stdout.slice(-2000),
            stderr: stderr.slice(-500),
          },
          duration: Date.now() - start,
        };
      } catch (error: any) {
        return {
          success: false,
          message: `${options.failureMessage ?? 'Command failed'}: ${error.message?.slice(0, 200)}`,
          details: {
            command: options.command,
            stdout: error.stdout?.slice(-2000),
            stderr: error.stderr?.slice(-2000),
            exitCode: error.code,
          },
          duration: Date.now() - start,
        };
      }
    },
  };
}

/**
 * Creates a check that runs a custom shell command
 */
export function commandSucceeds(
  command: string,
  options?: { timeout?: number; cwd?: string; name?: string; id?: string },
): ValidationCheck {
  return {
    id: options?.id ?? `command-${command.slice(0, 20).replace(/\s/g, '-')}`,
    name: options?.name ?? `Command: ${command.slice(0, 50)}`,
    async check() {
      const start = Date.now();
      try {
        const { stdout, stderr } = await execAsync(command, {
          timeout: options?.timeout ?? 60000,
          cwd: options?.cwd,
        });
        return {
          success: true,
          message: `Command succeeded`,
          details: {
            stdout: stdout.slice(-1000),
            stderr: stderr.slice(-500),
          },
          duration: Date.now() - start,
        };
      } catch (error: any) {
        return {
          success: false,
          message: `Command failed: ${error.message?.slice(0, 200)}`,
          details: {
            stdout: error.stdout?.slice(-1500),
            stderr: error.stderr?.slice(-1500),
            exitCode: error.code,
          },
          duration: Date.now() - start,
        };
      }
    },
  };
}

/**
 * Creates a check from a custom async function
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
      try {
        const result = await fn();
        return { ...result, duration: Date.now() - start };
      } catch (error: any) {
        return {
          success: false,
          message: `Check threw an error: ${error.message}`,
          duration: Date.now() - start,
        };
      }
    },
  };
}

/**
 * Creates a check that verifies a file exists
 */
export function fileExists(path: string, options?: { name?: string }): ValidationCheck {
  return {
    id: `file-exists-${path.replace(/[^a-z0-9]/gi, '-')}`,
    name: options?.name ?? `File Exists: ${path}`,
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
 * Creates a check that verifies a file contains a pattern
 */
export function fileContains(
  path: string,
  pattern: string | RegExp,
  options?: { name?: string },
): ValidationCheck {
  return {
    id: `file-contains-${path.replace(/[^a-z0-9]/gi, '-')}`,
    name: options?.name ?? `File Contains Pattern: ${path}`,
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
// Validation Tools (for Agent Network primitives)
// ============================================================================

/**
 * Creates validation tools that can be added to an agent's toolset.
 * This allows the routing agent to explicitly call validation.
 */
export function createValidationTools() {
  return {
    runTests: createTool({
      id: 'run-tests',
      description:
        'Run the project test suite to verify changes work correctly. Call this after making code changes to ensure tests pass before marking task complete.',
      inputSchema: z.object({
        command: z.string().default('npm test').describe('The test command to run'),
        timeout: z.number().default(300000).describe('Timeout in milliseconds'),
        cwd: z.string().optional().describe('Working directory'),
      }),
      execute: async ({ command, timeout, cwd }) => {
        const check = testsPass(command, { timeout, cwd });
        return check.check();
      },
    }),

    runBuild: createTool({
      id: 'run-build',
      description:
        'Build the project to verify there are no compilation errors. Call this after making code changes before marking task complete.',
      inputSchema: z.object({
        command: z.string().default('npm run build').describe('The build command to run'),
        timeout: z.number().default(600000).describe('Timeout in milliseconds'),
        cwd: z.string().optional().describe('Working directory'),
      }),
      execute: async ({ command, timeout, cwd }) => {
        const check = buildSucceeds(command, { timeout, cwd });
        return check.check();
      },
    }),

    runLint: createTool({
      id: 'run-lint',
      description: 'Run linting to check for code style issues after making code changes.',
      inputSchema: z.object({
        command: z.string().default('npm run lint').describe('The lint command to run'),
        timeout: z.number().default(120000).describe('Timeout in milliseconds'),
        cwd: z.string().optional().describe('Working directory'),
      }),
      execute: async ({ command, timeout, cwd }) => {
        const check = lintPasses(command, { timeout, cwd });
        return check.check();
      },
    }),

    checkTypes: createTool({
      id: 'check-types',
      description: 'Run TypeScript type checking to ensure type safety after making code changes.',
      inputSchema: z.object({
        command: z.string().default('npx tsc --noEmit').describe('The type check command'),
        timeout: z.number().default(300000).describe('Timeout in milliseconds'),
        cwd: z.string().optional().describe('Working directory'),
      }),
      execute: async ({ command, timeout, cwd }) => {
        const check = typeChecks(command, { timeout, cwd });
        return check.check();
      },
    }),

    runCommand: createTool({
      id: 'run-shell-command',
      description: 'Execute a shell command and return the result. Useful for custom validation or verification.',
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
    }),
  };
}
