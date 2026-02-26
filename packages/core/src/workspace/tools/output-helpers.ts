import { getTiktoken } from '../../utils/tiktoken';

/** Default number of lines to return (tail). */
export const DEFAULT_TAIL_LINES = 200;

/** Default estimated token limit for tool output. Safety net on top of line-based tail. */
export const DEFAULT_MAX_OUTPUT_TOKENS = 3_000;

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
// Token-based truncation (uses tiktoken)
// ---------------------------------------------------------------------------

/**
 * Token-based output limit. Truncates output to fit within a token budget.
 * Uses tiktoken for accurate token counting.
 *
 * @param output - The text to truncate
 * @param limit - Maximum tokens (default: DEFAULT_MAX_OUTPUT_TOKENS)
 * @param from - Which end to truncate from:
 *   - `'start'` (default): Remove lines from the start, keep the end
 *   - `'end'`: Remove lines from the end, keep the start
 */
export async function applyTokenLimit(
  output: string,
  limit: number = DEFAULT_MAX_OUTPUT_TOKENS,
  from: 'start' | 'end' = 'start',
): Promise<string> {
  if (!output) return output;

  const tiktoken = await getTiktoken();
  const tokens = tiktoken.encode(output).length;
  if (tokens <= limit) return output;

  const trailingNewline = output.endsWith('\n');
  const lines = (trailingNewline ? output.slice(0, -1) : output).split('\n');

  const kept: string[] = [];
  let keptTokens = 0;

  if (from === 'start') {
    // Keep the end — iterate backwards
    for (let i = lines.length - 1; i >= 0; i--) {
      const lineTokens = tiktoken.encode(lines[i]!).length;
      if (keptTokens + lineTokens > limit && kept.length > 0) break;
      kept.unshift(lines[i]!);
      keptTokens += lineTokens;
    }
  } else {
    // Keep the start — iterate forwards
    for (let i = 0; i < lines.length; i++) {
      const lineTokens = tiktoken.encode(lines[i]!).length;
      if (keptTokens + lineTokens > limit && kept.length > 0) break;
      kept.push(lines[i]!);
      keptTokens += lineTokens;
    }
  }

  if (kept.length >= lines.length) return output; // nothing to truncate
  const body = kept.join('\n') + (trailingNewline && from === 'start' ? '\n' : '');
  const position = from === 'start' ? 'last' : 'first';
  return from === 'start'
    ? `[output truncated: showing ${position} ~${keptTokens} of ~${tokens} tokens]\n${body}`
    : `${body}\n[output truncated: showing ${position} ~${keptTokens} of ~${tokens} tokens]`;
}

/**
 * Head+tail sandwich truncation. Keeps lines from both the start and end
 * of the output, with a truncation notice in the middle.
 * Uses tiktoken for accurate token counting.
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

  const tiktoken = await getTiktoken();
  const tokens = tiktoken.encode(output).length;
  if (tokens <= limit) return output;

  const trailingNewline = output.endsWith('\n');
  const lines = (trailingNewline ? output.slice(0, -1) : output).split('\n');

  const headBudget = Math.floor(limit * headRatio);
  const tailBudget = limit - headBudget;

  // Collect head lines (from the start)
  const headLines: string[] = [];
  let headTokens = 0;
  for (let i = 0; i < lines.length; i++) {
    const lineTokens = tiktoken.encode(lines[i]!).length;
    if (headTokens + lineTokens > headBudget && headLines.length > 0) break;
    headLines.push(lines[i]!);
    headTokens += lineTokens;
  }

  // Collect tail lines (from the end, not overlapping with head)
  const tailLines: string[] = [];
  let tailTokens = 0;
  for (let i = lines.length - 1; i >= headLines.length; i--) {
    const lineTokens = tiktoken.encode(lines[i]!).length;
    if (tailTokens + lineTokens > tailBudget && tailLines.length > 0) break;
    tailLines.unshift(lines[i]!);
    tailTokens += lineTokens;
  }

  if (headLines.length + tailLines.length >= lines.length) return output;

  const omitted = lines.length - headLines.length - tailLines.length;
  const head = headLines.join('\n');
  const tail = tailLines.join('\n') + (trailingNewline ? '\n' : '');
  return `${head}\n[...${omitted} lines truncated — showing first ~${headTokens} + last ~${tailTokens} of ~${tokens} tokens...]\n${tail}`;
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
