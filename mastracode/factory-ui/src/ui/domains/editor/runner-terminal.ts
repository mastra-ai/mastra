/**
 * Terminal-flavoured helpers for the embedded command runner: ANSI escape
 * parsing, command-history persistence, and simple command-line tokenization
 * for highlighting and autocomplete.
 *
 * We intentionally avoid a full xterm.js — the runner is a streaming output
 * viewer, not an interactive PTY. anser handles SGR colour codes; we drop
 * cursor-movement codes on the floor since our output pane is append-only.
 */

import Anser from 'anser';

export interface AnsiSpan {
  /** Raw text with any ANSI escape codes already stripped. */
  content: string;
  /** Hex or CSS colour name for the foreground; undefined = default. */
  fg?: string;
  /** Hex or CSS colour name for the background; undefined = default. */
  bg?: string;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  strikethrough?: boolean;
  dim?: boolean;
  inverse?: boolean;
}

/**
 * Parse one output line into styled spans. anser gives us CSS colour strings
 * for the 16 named ANSI colours, 256-colour and truecolour palettes, and
 * carries decorations through as a CSS-class list which we translate into
 * boolean flags the renderer can style with design-system tokens.
 */
export function parseAnsi(line: string): AnsiSpan[] {
  const entries = Anser.ansiToJson(line, { use_classes: false, remove_empty: false });
  return entries
    .filter(entry => entry.content !== '')
    .map(entry => {
      const decorations = new Set([
        ...(entry.decorations ?? []),
        ...(entry.decoration ? [entry.decoration] : []),
      ].map(d => d.toLowerCase()));
      return {
        content: entry.content,
        fg: colourToken(entry.fg),
        bg: colourToken(entry.bg),
        bold: decorations.has('bold'),
        italic: decorations.has('italic'),
        underline: decorations.has('underline'),
        strikethrough: decorations.has('strikethrough'),
        dim: decorations.has('dim'),
        inverse: decorations.has('reverse'),
      } satisfies AnsiSpan;
    });
}

/**
 * anser emits colours as raw `R, G, B` triples. We recognise the standard
 * 16-colour ANSI palette (both dim and bright variants) and route them into
 * design-system tokens so the runner reads the same greens/reds/blues the
 * rest of the UI uses; anything else keeps its raw RGB so truecolour output
 * still renders in its intended shade.
 */
function colourToken(input: string | null | undefined): string | undefined {
  if (!input) return undefined;
  const key = input.replace(/\s+/g, '');
  const named = ANSI_RGB_TO_TOKEN[key];
  if (named) return named;
  return `rgb(${input})`;
}

const ANSI_RGB_TO_TOKEN: Record<string, string> = {
  '0,0,0': 'var(--foreground)',
  '187,0,0': 'var(--notice-destructive)',
  '0,187,0': 'var(--notice-success)',
  '187,187,0': 'var(--notice-warning)',
  '0,0,187': 'var(--notice-info)',
  '187,0,187': 'var(--accent5)',
  '0,187,187': 'var(--accent1)',
  '255,255,255': 'var(--foreground)',
  '85,85,85': 'var(--muted-foreground)',
  '255,85,85': 'var(--notice-destructive)',
  '0,255,0': 'var(--notice-success)',
  '255,255,85': 'var(--notice-warning)',
  '85,85,255': 'var(--notice-info)',
  '255,85,255': 'var(--accent5)',
  '85,255,255': 'var(--accent1)',
};

/**
 * Split a command line into POSIX-ish tokens for highlighting. Handles single
 * and double quotes so `echo "hello world"` reads as three tokens rather than
 * four. Unterminated quotes fall through to the end of input.
 */
export function tokenizeCommand(input: string): string[] {
  const tokens: string[] = [];
  let current = '';
  let quote: '"' | "'" | null = null;
  for (let index = 0; index < input.length; index++) {
    const ch = input[index]!;
    if (quote) {
      if (ch === quote) {
        quote = null;
      } else {
        current += ch;
      }
      continue;
    }
    if (ch === '"' || ch === "'") {
      quote = ch;
      continue;
    }
    if (ch === ' ' || ch === '\t') {
      if (current) {
        tokens.push(current);
        current = '';
      }
      continue;
    }
    current += ch;
  }
  if (current) tokens.push(current);
  return tokens;
}

export type TokenKind = 'command' | 'flag' | 'path' | 'string' | 'value';

/** Classify a token for syntax colouring in the command preview. */
export function classifyToken(token: string, index: number): TokenKind {
  if (index === 0) return 'command';
  if (token.startsWith('-')) return 'flag';
  if (token.includes('/') || token.startsWith('.') || token.startsWith('~')) return 'path';
  if ((token.startsWith('"') && token.endsWith('"')) || (token.startsWith("'") && token.endsWith("'"))) return 'string';
  return 'value';
}

const HISTORY_KEY = 'mastra.runner.history';
const HISTORY_LIMIT = 100;

export interface CommandHistory {
  entries: string[];
  push(command: string): void;
  navigate(index: number): string | undefined;
}

/** Load persisted command history (best-effort — swallows storage errors). */
export function loadHistory(): string[] {
  try {
    const raw = window.localStorage.getItem(HISTORY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string') : [];
  } catch {
    return [];
  }
}

/** Persist command history; dedupes consecutive duplicates and caps the size. */
export function saveHistory(entries: string[]): void {
  try {
    const capped = entries.slice(-HISTORY_LIMIT);
    window.localStorage.setItem(HISTORY_KEY, JSON.stringify(capped));
  } catch {
    // Storage failures shouldn't disrupt the run.
  }
}

/**
 * Compute the tab-completion candidates for `input` given the available
 * scripts + history. Completion targets the last token; if there's only one
 * candidate, callers substitute it directly, otherwise show a popover.
 */
export function completionCandidates(input: string, scripts: string[], history: string[]): string[] {
  const trimmedEnd = input.replace(/[ \t]+$/, '');
  if (input.endsWith(' ') || input.endsWith('\t')) return []; // no active token
  const tokens = tokenizeCommand(trimmedEnd);
  if (tokens.length === 0) return [];
  const last = tokens[tokens.length - 1]!;
  const prefix = last.toLowerCase();

  // First-token completion draws from a curated pool: history commands (their
  // first word), npm-run shortcuts, and common tool names.
  if (tokens.length === 1) {
    const pool = new Set<string>();
    for (const script of scripts) pool.add(`npm run ${script}`);
    for (const entry of history) {
      const first = tokenizeCommand(entry)[0];
      if (first) pool.add(first);
    }
    for (const common of COMMON_COMMANDS) pool.add(common);
    return dedupe([...pool].filter(candidate => candidate.toLowerCase().startsWith(prefix))).slice(0, 12);
  }

  const runner = tokens[0];
  const sub = tokens[1];
  const isPackageManager = runner === 'npm' || runner === 'pnpm' || runner === 'yarn';

  // `npm run <script>` — complete script names once the runner + `run` are typed.
  if (tokens.length === 3 && isPackageManager && (sub === 'run' || sub === 'r')) {
    return scripts.filter(name => name.toLowerCase().startsWith(prefix)).slice(0, 12);
  }
  // Second-token: `npm r` should offer both `npm run` and `npm run <script>`
  // shortcuts so users can jump straight to a task with one Tab.
  if (tokens.length === 2 && isPackageManager && 'run'.startsWith(prefix)) {
    const suggestions = [`${runner} run`, ...scripts.map(name => `${runner} run ${name}`)];
    return dedupe(suggestions).slice(0, 12);
  }

  // Fall back to history matches on the full input for a "did you mean" list.
  return dedupe(history.filter(entry => entry.toLowerCase().startsWith(input.toLowerCase()))).slice(0, 12);
}

function dedupe(values: string[]): string[] {
  return [...new Set(values)];
}

const COMMON_COMMANDS = [
  'ls',
  'cat',
  'echo',
  'grep',
  'git status',
  'git log',
  'git diff',
  'npm run',
  'npm test',
  'pnpm run',
  'pnpm test',
  'yarn',
];

/**
 * Apply a completion to `input`, replacing the trailing token when the
 * candidate is a bare word (e.g. a script name) or replacing the whole
 * command when the candidate already contains a space (e.g. `npm run`).
 */
export function applyCompletion(input: string, candidate: string): string {
  if (candidate.includes(' ')) return candidate;
  const tokens = tokenizeCommand(input);
  if (tokens.length <= 1) return candidate;
  const rebuilt = tokens.slice(0, -1).join(' ');
  return `${rebuilt} ${candidate}`;
}
