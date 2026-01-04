/**
 * Network Validation Module
 *
 * Adds Ralph Wiggum-style programmatic validation to the Agent Network loop.
 * This allows the network to verify task completion through external checks
 * (tests pass, build succeeds, etc.) rather than relying solely on LLM
 * self-assessment.
 */

import { z } from 'zod';
import { exec } from 'child_process';
import { promisify } from 'util';
import { createTool } from '../../tools';

const execAsync = promisify(exec);

// ============================================================================
// Types
// ============================================================================

/**
 * Result of a single validation check
 */
export interface ValidationResult {
  /** Whether the check passed */
  success: boolean;
  /** Human-readable message describing the result */
  message: string;
  /** Optional structured details about the result */
  details?: Record<string, unknown>;
  /** How long the check took in ms */
  duration?: number;
}

/**
 * A validation check that can be run to verify task completion
 */
export interface ValidationCheck {
  /** Unique identifier for this check */
  id: string;
  /** Human-readable name */
  name: string;
  /** Function that performs the validation */
  check: () => Promise<ValidationResult>;
}

/**
 * Configuration for network validation
 */
export interface NetworkValidationConfig {
  /**
   * Array of validation checks to run
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
// Validation Check Factories
// ============================================================================

/**
 * Creates a check that verifies tests pass
 */
export function testsPass(
  command = 'npm test',
  options?: { timeout?: number; cwd?: string; name?: string },
): ValidationCheck {
  return {
    id: 'tests-pass',
    name: options?.name ?? 'Tests Pass',
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
          details: {
            stdout: stdout.slice(-2000),
            stderr: stderr.slice(-500),
          },
          duration: Date.now() - start,
        };
      } catch (error: any) {
        return {
          success: false,
          message: `Tests failed: ${error.message?.slice(0, 200)}`,
          details: {
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
 * Creates a check that verifies the build succeeds
 */
export function buildSucceeds(
  command = 'npm run build',
  options?: { timeout?: number; cwd?: string; name?: string },
): ValidationCheck {
  return {
    id: 'build-succeeds',
    name: options?.name ?? 'Build Succeeds',
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
          details: {
            stdout: stdout.slice(-1000),
            stderr: stderr.slice(-500),
          },
          duration: Date.now() - start,
        };
      } catch (error: any) {
        return {
          success: false,
          message: `Build failed: ${error.message?.slice(0, 200)}`,
          details: {
            stdout: error.stdout?.slice(-2000),
            stderr: error.stderr?.slice(-2000),
          },
          duration: Date.now() - start,
        };
      }
    },
  };
}

/**
 * Creates a check that verifies lint passes
 */
export function lintPasses(
  command = 'npm run lint',
  options?: { timeout?: number; cwd?: string; name?: string },
): ValidationCheck {
  return {
    id: 'lint-passes',
    name: options?.name ?? 'Lint Passes',
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
          details: { stdout: stdout.slice(-1000) },
          duration: Date.now() - start,
        };
      } catch (error: any) {
        return {
          success: false,
          message: `Lint errors found`,
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
 * Creates a check that verifies TypeScript compiles
 */
export function typeChecks(
  command = 'npx tsc --noEmit',
  options?: { timeout?: number; cwd?: string; name?: string },
): ValidationCheck {
  return {
    id: 'type-checks',
    name: options?.name ?? 'TypeScript Compiles',
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
          details: { stdout: stdout.slice(-1000) },
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
