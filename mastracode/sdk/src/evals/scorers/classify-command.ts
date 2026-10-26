/**
 * Shared command classification utilities for scoring.
 *
 * Used by scorers to consistently identify build, test, and other command types.
 */

/**
 * Check if a command string is a build/typecheck command.
 * Handles compound commands (e.g. `pnpm build && pnpm test`) by checking each segment.
 */
export function isBuildCommand(command: string): boolean {
  const segments = command.split(/\s*(?:&&|\|\||;)\s*/);
  return segments.some(seg => {
    const trimmed = seg.trim();
    if (!/\b(tsc|typecheck|type-check|build)\b/.test(trimmed)) return false;
    // Don't reject if "test" only appears as a substring (e.g. "build-test-output").
    // Only reject if a test runner is the primary verb of this segment.
    const primaryVerb = trimmed.replace(/^(?:pnpm|npm|yarn|npx|bunx?|turbo)\s+(?:run\s+)?/, '').split(/\s/)[0] ?? '';
    return !/^(test|vitest|jest|mocha|pytest)$/.test(primaryVerb);
  });
}

/**
 * Check if a command string is a test command.
 */
export function isTestCommand(command: string): boolean {
  return /\b(test|vitest|jest|mocha|pytest|spec)\b/.test(command);
}

/**
 * Extract exit code from an `execute_command` result.
 * Only trusts explicit exitCode/code fields — no heuristic fallbacks.
 */
export function getExitCode(result: unknown): number | null {
  if (result == null) return null;

  if (typeof result === 'string') {
    const exitMatch = result.match(/exit(?:ed)?\s+(?:with\s+)?(?:code\s*:?\s*)?(-?\d+)/i);
    if (exitMatch) return parseInt(exitMatch[1]!, 10);
    return null;
  }

  if (typeof result === 'object') {
    const obj = result as Record<string, unknown>;
    if ('exitCode' in obj && typeof obj.exitCode === 'number') return obj.exitCode;
    if ('code' in obj && typeof obj.code === 'number') return obj.code;
  }

  return null;
}

/**
 * Determine if a tool call result indicates success (exit code 0, no explicit error).
 * Works with both structured result objects and string results.
 */
export function isSuccessResult(result: unknown, error?: unknown): boolean {
  if (error || !result) return false;

  const exitCode = getExitCode(result);
  if (exitCode !== null) return exitCode === 0;

  // execute_command only appends an exit code when the command fails.
  return typeof result === 'string';
}

/**
 * Match a file path from tool output against an expected path.
 * Supports exact match and suffix match (e.g. "src/foo.ts" matches "/abs/path/src/foo.ts").
 */
export function matchFilePath(actual: string, expected: string): boolean {
  if (actual === expected) return true;
  return actual.endsWith(`/${expected}`) || expected.endsWith(`/${actual}`);
}
