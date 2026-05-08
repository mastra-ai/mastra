import { estimateTokenCount, sliceByTokens } from 'tokenx';

/** Default number of lines to return (tail). */
export const DEFAULT_TAIL_LINES = 200;

/** Default estimated token limit for tool output. Safety net on top of line-based tail. */
export const DEFAULT_MAX_OUTPUT_TOKENS = 2_000;

// ---------------------------------------------------------------------------
// ANSI stripping
// ---------------------------------------------------------------------------

/**
 * Strip ANSI escape codes from text.
 * Covers CSI sequences (colors, cursor), OSC sequences (hyperlinks), and C1 controls.
 * Based on the pattern from chalk/ansi-regex.
 */

// biome-ignore lint/suspicious/noControlCharactersInRegex: ANSI control chars are intentional
const ANSI_RE =
  /(?:\u001B\][\s\S]*?(?:\u0007|\u001B\u005C|\u009C))|(?:[\u001B\u009B][\[\]()#;?]*(?:\d{1,4}(?:[;:]\d{0,4})*)?[\dA-PR-TZcf-nq-uy=><~])/g;

export function stripAnsi(text: string): string {
  return text.replace(ANSI_RE, '');
}

/**
 * `toModelOutput` handler for sandbox tools.
 * Strips ANSI escape codes so the model sees clean text, while the raw
 * output (with colors) is preserved in the stream/TUI.
 *
 * Returns `{ type: 'text', value: '...' }` to match the AI SDK's
 * expected tool-result output format.
 */
export function sandboxToModelOutput(output: unknown): unknown {
  if (typeof output === 'string') {
    return { type: 'text', value: stripAnsi(output) };
  }
  return output;
}

// ---------------------------------------------------------------------------
// Tail (line-based truncation)
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Token-based truncation (uses tokenx for fast, lightweight estimation)
// ---------------------------------------------------------------------------

/**
 * Token-based output limit. Truncates output to fit within a token budget.
 * Uses tokenx for fast token estimation and truncates at the token level
 * (not line boundaries) to maximise use of the budget.
 *
 * @param output - The text to truncate
 * @param limit - Maximum tokens (default: DEFAULT_MAX_OUTPUT_TOKENS)
 * @param from - Which end to truncate from:
 *   - `'start'` (default): Remove tokens from the start, keep the end
 *   - `'end'`: Remove tokens from the end, keep the start
 */
export async function applyTokenLimit(
  output: string,
  limit: number = DEFAULT_MAX_OUTPUT_TOKENS,
  from: 'start' | 'end' = 'start',
): Promise<string> {
  if (!output) return output;

  const totalTokens = estimateTokenCount(output);
  if (totalTokens <= limit) return output;

  const kept = from === 'start' ? sliceByTokens(output, -limit) : sliceByTokens(output, 0, limit);

  const position = from === 'start' ? 'last' : 'first';
  return from === 'start'
    ? `[output truncated: showing ${position} ~${limit} of ~${totalTokens} tokens]\n${kept}`
    : `${kept}\n[output truncated: showing ${position} ~${limit} of ~${totalTokens} tokens]`;
}

/**
 * Head+tail sandwich truncation. Keeps lines from both the start and end
 * of the output, with a truncation notice in the middle.
 * Uses tokenx for fast token estimation.
 *
 * @param output - The text to truncate
 * @param limit - Maximum tokens (default: DEFAULT_MAX_OUTPUT_TOKENS)
 * @param headRatio - Fraction of the token budget to allocate to the head (default: 0.1 = 10%)
 */
export async function applyTokenLimitSandwich(
  output: string,
  limit: number = DEFAULT_MAX_OUTPUT_TOKENS,
  headRatio: number = 0.1,
): Promise<string> {
  if (!output) return output;

  const totalTokens = estimateTokenCount(output);
  if (totalTokens <= limit) return output;
  const headBudget = Math.floor(limit * headRatio);
  const tailBudget = limit - headBudget;

  const head = headBudget > 0 ? sliceByTokens(output, 0, headBudget) : '';
  const tail = tailBudget > 0 ? sliceByTokens(output, -tailBudget) : '';

  const notice = `[...output truncated — showing first ~${headBudget} + last ~${tailBudget} of ~${totalTokens} tokens...]`;
  return [head, notice, tail].filter(Boolean).join('\n');
}

/**
 * Apply both tail (line-based) and token limit (safety net) to output.
 */
export async function truncateOutput(
  output: string,
  tail?: number | null,
  tokenLimit?: number,
  tokenFrom?: 'start' | 'end' | 'sandwich',
): Promise<string> {
  const tailed = applyTail(output, tail);
  if (tokenFrom === 'sandwich') {
    return applyTokenLimitSandwich(tailed, tokenLimit);
  }
  return applyTokenLimit(tailed, tokenLimit, tokenFrom);
}
