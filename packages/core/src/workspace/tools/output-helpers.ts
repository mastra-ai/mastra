import { estimateTokenCount } from 'tokenx';

import { isValidationError } from '../../tools/validation';
import { sliceByTokensSafe } from '../../utils/slice-by-tokens';

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
 *
 * Mastra validation-error envelopes (e.g. from output-schema validation
 * failures) are tagged as `{ type: 'error-json', value }` so providers
 * receive a valid tool-result output instead of an untagged object.
 *
 * `{ error: string }` results (e.g. substituted by a blocking `beforeToolCall`
 * hook) are tagged as `{ type: 'error-text', value }` so the model sees the reason.
 */
export function sandboxToModelOutput(output: unknown): unknown {
  if (typeof output === 'string') {
    return { type: 'text', value: stripAnsi(output) };
  }
  if (isValidationError(output)) {
    return { type: 'error-json', value: output };
  }
  if (typeof output === 'object' && output !== null && typeof (output as { error?: unknown }).error === 'string') {
    return { type: 'error-text', value: (output as { error: string }).error };
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
  const { header, body } = splitTail(output, tail);
  return header ? `${header}\n${body}` : body;
}

interface TailSplit {
  /** `[showing last N of M lines]` when lines were dropped, else undefined. */
  header: string | undefined;
  /** The kept lines. */
  body: string;
  /** Line number, in the full output, of the first line of `body`. */
  firstLine: number;
}

function splitTail(output: string, tail: number | null | undefined): TailSplit {
  const unchanged: TailSplit = { header: undefined, body: output, firstLine: 1 };
  if (!output) return unchanged;
  const n = Math.floor(Math.abs(tail ?? DEFAULT_TAIL_LINES));
  if (n === 0) return unchanged; // 0 = no limit (also covers |tail| < 1)
  // Strip trailing newline before splitting so it doesn't count as a line
  const trailingNewline = output.endsWith('\n');
  const lines = (trailingNewline ? output.slice(0, -1) : output).split('\n');
  if (lines.length <= n) return unchanged;
  const sliced = lines.slice(-n).join('\n');
  return {
    header: `[showing last ${n} of ${lines.length} lines]`,
    body: trailingNewline ? sliced + '\n' : sliced,
    firstLine: lines.length - n + 1,
  };
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

  const kept = from === 'start' ? sliceByTokensSafe(output, -limit) : sliceByTokensSafe(output, 0, limit);

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
 * The notice names the dropped lines and the lines kept on each side, so the
 * model can read exactly the missing range instead of re-running the command, e.g.
 * `[...output truncated — dropped lines 24-199; showing first ~200 tokens (lines 1-23) + last ~1800 tokens (lines 200-400) of ~3600 tokens...]`.
 * A line the cut goes through is reported as "the end of line N" / "the start of line N".
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
  return sandwich(output, limit, headRatio, 1);
}

/**
 * Sandwich truncation where line 1 of `output` is line `firstLine` of the text the
 * model asked for (after a line-based tail, the kept lines start part-way in).
 */
function sandwich(output: string, limit: number, headRatio: number, firstLine: number): string {
  if (!output) return output;

  const totalTokens = estimateTokenCount(output);
  if (totalTokens <= limit) return output;
  const headBudget = Math.floor(limit * headRatio);
  const tailBudget = limit - headBudget;

  // `head` is a prefix and `tail` a suffix of `output` (the surrogate repair keeps lengths).
  let head = headBudget > 0 ? sliceByTokensSafe(output, 0, headBudget) : '';
  let tail = tailBudget > 0 ? sliceByTokensSafe(output, -tailBudget) : '';
  const headEnd = head.length;
  let tailStart = output.length - tail.length;
  // The notice gets its own line, so a line break (`\n` or `\r\n`) at either cut is redundant.
  head = head.replace(/\r?\n$/, '');
  if (head.endsWith('\r') && output[headEnd] === '\n') head = head.slice(0, -1);
  const tailBreak = tail.startsWith('\r\n') ? 2 : tail.startsWith('\n') ? 1 : 0;
  tail = tail.slice(tailBreak);
  tailStart += tailBreak;

  const lines = describeCutLines(output, headEnd, tailStart, firstLine - 1);
  const dropped = lines.dropped ? `dropped ${lines.dropped}; ` : '';
  const notice = `[...output truncated — ${dropped}showing first ~${headBudget} tokens${lines.head} + last ~${tailBudget} tokens${lines.tail} of ~${totalTokens} tokens...]`;
  return [head, notice, tail].filter(Boolean).join('\n');
}

/** 1-based line number of the character at `index`. */
function lineAt(text: string, index: number): number {
  let line = 1;
  for (let i = text.indexOf('\n'); i !== -1 && i < index; i = text.indexOf('\n', i + 1)) line++;
  return line;
}

function lineRange(from: number, to: number): string {
  return from === to ? `line ${from}` : `lines ${from}-${to}`;
}

function joinClauses(clauses: string[]): string {
  if (clauses.length <= 1) return clauses.join('');
  return `${clauses.slice(0, -1).join(', ')} and ${clauses.at(-1)}`;
}

/**
 * Describe which lines a sandwich cut kept and dropped. The head keeps
 * `output[0, headEnd)` and the tail keeps `output[tailStart, end)`.
 * `offset` is added to every line number.
 */
function describeCutLines(
  output: string,
  headEnd: number,
  tailStart: number,
  offset: number,
): { head: string; tail: string; dropped: string } {
  const trailingNewline = output.endsWith('\n');
  const lastLine = lineAt(output, output.length) - (trailingNewline ? 1 : 0);
  const hasHead = headEnd > 0;
  const hasTail = tailStart < output.length;

  // Last line the head reaches, and whether it reaches that line's end.
  const headTo = hasHead ? lineAt(output, headEnd - 1) : 0;
  const headWhole =
    hasHead &&
    (output[headEnd - 1] === '\n' ||
      headEnd >= output.length ||
      output.startsWith('\n', headEnd) ||
      output.startsWith('\r\n', headEnd));
  // First line the tail reaches, and whether it starts at that line's start.
  const tailFrom = hasTail ? lineAt(output, tailStart) : lastLine + 1;
  const tailWhole = tailStart === 0 || output[tailStart - 1] === '\n';

  const n = (line: number) => line + offset;
  const head = hasHead ? ` (${lineRange(n(1), n(headTo))})` : '';
  const tail = hasTail ? ` (${lineRange(n(tailFrom), n(lastLine))})` : '';

  // Token estimates are rounded, so the kept slices can meet or overlap; then nothing was dropped.
  if (hasHead && hasTail && tailStart <= headEnd) return { head, tail, dropped: '' };
  if (hasHead && hasTail && headTo === tailFrom) {
    return { head, tail, dropped: `the middle of line ${n(headTo)}` };
  }

  const clauses: string[] = [];
  if (hasHead && !headWhole) clauses.push(`the end of line ${n(headTo)}`);
  if (tailFrom - 1 >= headTo + 1) clauses.push(lineRange(n(headTo + 1), n(tailFrom - 1)));
  if (hasTail && !tailWhole) clauses.push(`the start of line ${n(tailFrom)}`);
  return { head, tail, dropped: joinClauses(clauses) };
}

/**
 * Tell the model when the sandbox dropped the start of a stream (retention limit),
 * so it doesn't read the newest output as all of it.
 */
export function noteDroppedOutput(
  output: string,
  droppedBytes: number | undefined,
  stream: 'stdout' | 'stderr',
): string {
  if (!droppedBytes) return output;
  const note = `[${stream}: the first ${droppedBytes} bytes were dropped; only the newest output was kept. Redirect output to a file to read all of it.]`;
  return output ? `${note}\n${output}` : note;
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
  if (tokenFrom === 'sandwich') {
    // Cut the kept lines, not the `[showing last N of M lines]` header, so the
    // notice can number lines as they appear in the full output.
    const { header, body, firstLine } = splitTail(output, tail);
    const cut = sandwich(body, tokenLimit ?? DEFAULT_MAX_OUTPUT_TOKENS, 0.1, firstLine);
    return header ? `${header}\n${cut}` : cut;
  }
  return applyTokenLimit(applyTail(output, tail), tokenLimit, tokenFrom);
}
