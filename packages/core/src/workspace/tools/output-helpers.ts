/** Default number of lines to return (tail). */
export const DEFAULT_TAIL_LINES = 200;

/** Hard character limit for tool output. Safety net on top of line-based tail. */
export const MAX_OUTPUT_CHARS = 30_000;

/**
 * Return the last N lines of output, similar to `tail -n`.
 * - `n > 0`: last N lines
 * - `n === 0`: no limit (return all)
 * - `undefined/null`: use DEFAULT_TAIL_LINES
 */
export function applyTail(output: string, tail: number | null | undefined): string {
  if (!output) return output;
  const n = Math.abs(tail ?? DEFAULT_TAIL_LINES);
  if (n === 0) return output; // 0 = no limit
  // Strip trailing newline before splitting so it doesn't count as a line
  const trailingNewline = output.endsWith('\n');
  const lines = (trailingNewline ? output.slice(0, -1) : output).split('\n');
  if (lines.length <= n) return output;
  const sliced = lines.slice(-n).join('\n');
  const body = trailingNewline ? sliced + '\n' : sliced;
  return `[showing last ${n} of ${lines.length} lines]\n${body}`;
}

/**
 * Hard character limit. Truncates from the start (keeps the end) and
 * prepends a notice so the agent knows data was lost.
 */
export function applyCharLimit(output: string, limit: number = MAX_OUTPUT_CHARS): string {
  if (!output || output.length <= limit) return output;
  const truncated = output.slice(-limit);
  return `[output truncated: showing last ${limit} of ${output.length} characters]\n${truncated}`;
}

/**
 * Apply both tail (line-based) and char limit (safety net) to output.
 */
export function truncateOutput(output: string, tail?: number | null, charLimit?: number): string {
  return applyCharLimit(applyTail(output, tail), charLimit);
}
