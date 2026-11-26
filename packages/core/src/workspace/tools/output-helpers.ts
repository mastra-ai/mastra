import { estimateTokenCount } from 'tokenx';

import { isValidationError } from '../../tools/validation';
import { sliceByTokensSafe, sliceSafe } from '../../utils/slice-by-tokens';

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
 * tokenx is synchronous and allocates per word, so running it over a multi-MB
 * output blocks the event loop for seconds. Outputs up to this many chars per
 * token of budget are counted and cut exactly as before; longer ones never reach
 * tokenx whole (see `countTokensOver` and `sliceEdge`).
 */
const WINDOW_CHARS_PER_TOKEN = 32;

/**
 * tokenx never gives a non-whitespace segment fewer than one token per this many
 * UTF-16 chars: 6 by default, and up to 4 code points (8 chars when astral) for
 * its language rules. So text with more non-whitespace chars than
 * `limit * MAX_CHARS_PER_TOKEN` is over `limit`.
 */
const MAX_CHARS_PER_TOKEN = 8;

const WHITESPACE_RUN_RE = /\s+/g;
const STRUCTURED_WHITESPACE_RE = /\n\s/;

// Char classes for approximateTokenCount, mirroring tokenx's segment split.
const WS = 0;
const PUNCT = 1;
const DIGIT = 2;
const WORD = 3;
const CHAR_CLASS = new Uint8Array(128).fill(WORD);
for (const c of ' \t\n\r\v\f') CHAR_CLASS[c.charCodeAt(0)] = WS;
for (const c of '.,!?;(){}[]<>:/\\|@#$%^&*+=`~_"-') CHAR_CLASS[c.charCodeAt(0)] = PUNCT;
for (let c = 48; c <= 57; c++) CHAR_CLASS[c] = DIGIT;

/** Same set as the regex `\s`, which is what tokenx splits words on. */
function isWhitespace(code: number): boolean {
  return (
    code === 0xa0 ||
    code === 0x1680 ||
    (code >= 0x2000 && code <= 0x200a) ||
    code === 0x2028 ||
    code === 0x2029 ||
    code === 0x202f ||
    code === 0x205f ||
    code === 0x3000 ||
    code === 0xfeff
  );
}

function runTokens(kind: number, length: number, onlyDigits: boolean): number {
  if (kind === WS) return 0;
  if (length <= 3) return 1;
  if (kind === PUNCT) return Math.ceil(length / 2);
  return onlyDigits ? Math.ceil(length / 3) : Math.ceil(length / 6);
}

/**
 * One pass over char codes with no allocations: an approximate token count
 * (tokenx's rules for ASCII text, used only for the "of ~N tokens" total) and
 * the number of non-whitespace chars.
 */
function scanTokens(text: string): { approx: number; nonWhitespace: number } {
  let approx = 0;
  let nonWhitespace = 0;
  let kind = -1;
  let length = 0;
  let onlyDigits = true;
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i);
    const cls = code < 128 ? CHAR_CLASS[code]! : isWhitespace(code) ? WS : WORD;
    const runKind = cls === DIGIT ? WORD : cls;
    if (runKind !== kind) {
      if (length) approx += runTokens(kind, length, onlyDigits);
      kind = runKind;
      length = 0;
      onlyDigits = true;
    }
    length++;
    if (cls !== WS) nonWhitespace++;
    if (cls !== DIGIT) onlyDigits = false;
  }
  if (length) approx += runTokens(kind, length, onlyDigits);
  return { approx, nonWhitespace };
}

/**
 * Exact token count of `output` when it may fit `limit`, else an approximation.
 * Returns `undefined` when the output fits, so callers return it as is.
 */
function countTokensOver(output: string, limit: number): number | undefined {
  if (output.length <= Math.max(limit, 1) * WINDOW_CHARS_PER_TOKEN) {
    const exact = estimateTokenCount(output);
    return exact <= limit ? undefined : exact;
  }
  const { approx, nonWhitespace } = scanTokens(output);
  if (nonWhitespace > limit * MAX_CHARS_PER_TOKEN) return approx;
  // Little non-whitespace text in a long output: tokenx counts each whitespace run
  // as 0 tokens, or 1 when it holds a newline followed by more whitespace, so
  // collapsing every run to ' ' or '\n ' keeps the count and shrinks the input.
  const collapsed = output.replace(WHITESPACE_RUN_RE, run => (STRUCTURED_WHITESPACE_RE.test(run) ? '\n ' : ' '));
  const exact = estimateTokenCount(collapsed);
  return exact <= limit ? undefined : exact;
}

/**
 * `budget` tokens from one end of `output`. Outputs within the overall `limit`'s
 * size cap are cut exactly as before, by `sliceByTokensSafe(output, 0, budget)`
 * (`'head'`) or `sliceByTokensSafe(output, -budget)` (`'tail'`). Longer ones hand
 * tokenx only a window at that end, measured as tokenx sees it: whitespace runs
 * are collapsed (see `countTokensOver`), so padding can't crowd real text out of
 * the window. The cut is mapped back to the original text, whitespace and all.
 *
 * For those longer outputs the cut is approximate: it fits `budget` by tokenx's
 * count of the kept text, but can land elsewhere than tokenizing the whole output
 * would. tokenx counts a segment by its whole length, so a window that ends inside
 * a long segment counts it differently (at a 2,000-token budget, 65,000 'a' then
 * 'é' keeps 12,000 chars here and 6,000 when the whole output is tokenized).
 */
function sliceEdge(output: string, budget: number, limit: number, side: 'head' | 'tail'): string {
  if (output.length <= Math.max(limit, 1) * WINDOW_CHARS_PER_TOKEN) {
    return side === 'head' ? sliceByTokensSafe(output, 0, budget) : sliceByTokensSafe(output, -budget);
  }

  // Grow the window from the kept end until its collapsed size reaches the cap:
  // tokenx counts at least 1 token per 10 collapsed chars, so it holds over 3x the budget.
  const target = Math.max(budget, 1) * WINDOW_CHARS_PER_TOKEN;
  let size = 0;
  let inWhitespace = false;
  let edge = side === 'head' ? 0 : output.length;
  while (side === 'head' ? edge < output.length : edge > 0) {
    const code = output.charCodeAt(side === 'head' ? edge : edge - 1);
    const whitespace = code < 128 ? CHAR_CLASS[code] === WS : isWhitespace(code);
    const cost = whitespace ? (inWhitespace ? 0 : 2) : 1;
    if (size + cost > target) break;
    size += cost;
    inWhitespace = whitespace;
    edge += side === 'head' ? 1 : -1;
  }
  const window = side === 'head' ? output.slice(0, edge) : output.slice(edge);

  // Collapse whitespace runs, remembering where each one sits in both strings.
  const runs: { collapsedStart: number; collapsedEnd: number; start: number; end: number }[] = [];
  let collapsed = '';
  let last = 0;
  for (const match of window.matchAll(WHITESPACE_RUN_RE)) {
    collapsed += window.slice(last, match.index);
    const replacement = STRUCTURED_WHITESPACE_RE.test(match[0]) ? '\n ' : ' ';
    runs.push({
      collapsedStart: collapsed.length,
      collapsedEnd: collapsed.length + replacement.length,
      start: match.index,
      end: match.index + match[0].length,
    });
    collapsed += replacement;
    last = match.index + match[0].length;
  }
  collapsed += window.slice(last);

  // tokenx keeps or drops a 0- or 1-token whitespace run whole, so a cut lands on a run's edge or between other chars.
  const toWindowIndex = (index: number): number => {
    let shift = 0;
    for (const run of runs) {
      if (index < run.collapsedStart) break;
      if (index <= run.collapsedEnd) return index === run.collapsedEnd ? run.end : run.start;
      shift = run.end - run.collapsedEnd;
    }
    return index + shift;
  };

  if (side === 'head') {
    const kept = fitBudget(sliceByTokensSafe(collapsed, 0, budget), budget, side);
    return sliceSafe(window, 0, toWindowIndex(kept.length));
  }
  const kept = fitBudget(sliceByTokensSafe(collapsed, -budget), budget, side);
  return sliceSafe(window, toWindowIndex(collapsed.length - kept.length));
}

/**
 * tokenx slices a segment by the chars-per-token of its language, picked from the
 * chars it contains, so a cut that drops the char that picked it (a lone 'ж' in a run
 * of CJK) can count several times over `budget` on its own. Recount the kept text,
 * which is no longer than the bounded input it was cut from, and cut it again until
 * it fits.
 */
function fitBudget(kept: string, budget: number, side: 'head' | 'tail'): string {
  // `kept.length > 0`: an empty string counts 0 tokens, which never fits a negative budget.
  for (let tokens = estimateTokenCount(kept); kept.length > 0 && tokens > budget; tokens = estimateTokenCount(kept)) {
    const next = side === 'head' ? sliceByTokensSafe(kept, 0, budget) : sliceByTokensSafe(kept, -budget);
    // tokenx can't trim it any further: drop chars in proportion to the overshoot instead.
    const length = next.length < kept.length ? next.length : Math.floor((kept.length * budget) / tokens);
    kept = side === 'head' ? sliceSafe(kept, 0, length) : sliceSafe(kept, kept.length - length);
  }
  return kept;
}

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

  const totalTokens = countTokensOver(output, limit);
  if (totalTokens === undefined) return output;

  const kept = from === 'start' ? sliceEdge(output, limit, limit, 'tail') : sliceEdge(output, limit, limit, 'head');

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

  const totalTokens = countTokensOver(output, limit);
  if (totalTokens === undefined) return output;
  const headBudget = Math.floor(limit * headRatio);
  const tailBudget = limit - headBudget;

  // `head` is a prefix and `tail` a suffix of `output` (the surrogate repair keeps lengths).
  let head = headBudget > 0 ? sliceEdge(output, headBudget, limit, 'head') : '';
  let tail = tailBudget > 0 ? sliceEdge(output, tailBudget, limit, 'tail') : '';
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
