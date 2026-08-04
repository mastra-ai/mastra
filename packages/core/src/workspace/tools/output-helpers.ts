import { estimateTokenCount, sliceByTokens } from 'tokenx';

/** Default number of lines to return (tail). */
export const DEFAULT_TAIL_LINES = 200;

/**
 * Default number of leading lines kept alongside the tail when the caller did not ask for a
 * specific tail.
 *
 * A tail is the right shape for a log, where the interesting part is the end. It is the wrong
 * shape for structured output — a JSON document opens with what it is and closes with brackets, so
 * tailing it returns the brackets. Keeping both ends costs a bounded number of lines and leaves
 * the model something it can act on either way.
 */
export const DEFAULT_HEAD_LINES = 200;

/** Default estimated token limit for tool output. Safety net on top of line-based tail. */
export const DEFAULT_MAX_OUTPUT_TOKENS = 2_000;

/**
 * Share of the token budget given to the head in sandwich truncation.
 *
 * Weighted towards the tail, because errors and results arrive at the end of a command's output,
 * but large enough that the head is still worth reading — a head of a few hundred tokens is
 * usually the difference between seeing a payload's shape and seeing its first brace.
 */
export const DEFAULT_HEAD_RATIO = 0.3;

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

/**
 * Keep the first `head` and last `tail` lines, with a notice for what was dropped in between.
 *
 * Line-level, so it is cheap on very large output and bounds how much text the token pass below
 * has to estimate over.
 */
export function applyLineSandwich(
  output: string,
  head: number = DEFAULT_HEAD_LINES,
  tail: number = DEFAULT_TAIL_LINES,
): string {
  if (!output) return output;
  const trailingNewline = output.endsWith('\n');
  const lines = (trailingNewline ? output.slice(0, -1) : output).split('\n');
  if (lines.length <= head + tail) return output;

  const omitted = lines.length - head - tail;
  const body = [...lines.slice(0, head), `[... ${omitted} lines omitted ...]`, ...lines.slice(-tail)].join('\n');
  const withNewline = trailingNewline ? body + '\n' : body;
  return `[showing first ${head} and last ${tail} of ${lines.length} lines]\n${withNewline}`;
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
 * @param headRatio - Fraction of the token budget to allocate to the head (default: DEFAULT_HEAD_RATIO)
 */
export async function applyTokenLimitSandwich(
  output: string,
  limit: number = DEFAULT_MAX_OUTPUT_TOKENS,
  headRatio: number = DEFAULT_HEAD_RATIO,
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
 * Apply both line-based and token limits (safety net) to output.
 *
 * A caller asking to keep both ends gets both ends: the line pass keeps a head as well as a tail
 * unless a specific tail was requested. Tailing first would decide the question before the token
 * pass ever saw the head — there is nothing for a sandwich to keep once the front of the output
 * has already been thrown away.
 */
export async function truncateOutput(
  output: string,
  tail?: number | null,
  tokenLimit?: number,
  tokenFrom?: 'start' | 'end' | 'sandwich',
): Promise<string> {
  if (tokenFrom === 'sandwich') {
    const bounded = tail == null ? applyLineSandwich(output) : applyTail(output, tail);
    return applyTokenLimitSandwich(bounded, tokenLimit);
  }
  return applyTokenLimit(applyTail(output, tail), tokenLimit, tokenFrom);
}
