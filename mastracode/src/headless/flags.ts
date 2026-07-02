/**
 * Declarative flag specification for the headless CLI.
 *
 * A single table is the source of truth for three things that previously drifted
 * apart in `cli.ts`:
 *   1. the `node:util` `parseArgs` option config,
 *   2. per-flag value coercion + validation, and
 *   3. the `--help` usage text.
 *
 * Adding a flag means adding one row here; parsing, validation, and the usage
 * listing all follow automatically.
 */
import type { OutputMode } from './cli.js';
import type { PermissionMode, RunMode, ThinkingLevel } from './types.js';
import { VALID_MODES, VALID_PERMISSION_MODES, VALID_THINKING_LEVELS } from './types.js';

export const VALID_OUTPUTS = ['human', 'json', 'jsonl'] as const;

/** Reusable validators. Each throws a descriptive Error or returns the typed value. */
const validate = {
  /** Restrict to a fixed set of string literals. */
  enum<T extends string>(flag: string, allowed: readonly T[]) {
    return (raw: string): T => {
      if (!(allowed as readonly string[]).includes(raw)) {
        throw new Error(`${flag} must be one of: ${allowed.join(', ')}`);
      }
      return raw as T;
    };
  },
  /** Require a positive (>0) integer. */
  positiveInt(flag: string) {
    return (raw: string): number => {
      const parsed = Number(raw);
      if (!Number.isInteger(parsed) || parsed <= 0) {
        throw new Error(`${flag} must be a positive integer`);
      }
      return parsed;
    };
  },
  /** Pass a string through unchanged. */
  string(raw: string): string {
    return raw;
  },
};

/**
 * One CLI flag. `key` is the long name (e.g. `output`); `field` is the
 * {@link import('./cli.js').HeadlessArgs} property it populates. `coerce`
 * converts the raw string and validates it. Boolean flags omit `coerce` and set
 * `field` to `true` when present.
 */
export interface FlagSpec {
  /** Long flag name without the leading `--`. */
  key: string;
  /** Single-character alias (without the leading `-`), if any. */
  short?: string;
  /** Whether the flag takes a value (`string`) or is a switch (`boolean`). */
  type: 'string' | 'boolean';
  /** Target field on `HeadlessArgs`. Omit for flags handled out-of-band (e.g. help). */
  field?: string;
  /** Coerce/validate a string value. Required for `type: 'string'` flags that map to a field. */
  coerce?: (raw: string) => unknown;
  /** `<...>` value placeholder shown in usage, e.g. `<text>`. */
  placeholder?: string;
  /** One-line (or multi-line) help description shown in usage. */
  help: string | string[];
}

export const FLAGS: FlagSpec[] = [
  {
    key: 'prompt',
    short: 'p',
    type: 'string',
    field: 'prompt',
    coerce: validate.string,
    placeholder: '<text>',
    help: 'The task to execute (required, or pipe via stdin)',
  },
  {
    key: 'continue',
    short: 'c',
    type: 'boolean',
    field: 'continue_',
    help: 'Resume the most recent thread instead of creating a new one',
  },
  {
    key: 'thread',
    short: 't',
    type: 'string',
    field: 'thread',
    coerce: validate.string,
    placeholder: '<id>',
    help: 'Resume a specific thread by ID',
  },
  {
    key: 'title',
    type: 'string',
    field: 'title',
    coerce: validate.string,
    placeholder: '<title>',
    help: 'Set or rename the thread title',
  },
  {
    key: 'clone-thread',
    type: 'boolean',
    field: 'cloneThread',
    help: 'Clone the current thread before running (work on a copy)',
  },
  {
    key: 'resource-id',
    type: 'string',
    field: 'resourceId',
    coerce: validate.string,
    placeholder: '<id>',
    help: 'Set the resource ID for thread scoping',
  },
  {
    key: 'timeout',
    type: 'string',
    field: 'timeout',
    coerce: validate.positiveInt('--timeout'),
    placeholder: '<seconds>',
    help: 'Exit with code 2 if not complete within timeout',
  },
  {
    key: 'max-turns',
    type: 'string',
    field: 'maxTurns',
    coerce: validate.positiveInt('--max-turns'),
    placeholder: '<n>',
    help: 'Abort after N agentic turns (exit code 1)',
  },
  {
    key: 'permission-mode',
    type: 'string',
    field: 'permissionMode',
    coerce: validate.enum<PermissionMode>('--permission-mode', VALID_PERMISSION_MODES),
    placeholder: '<mode>',
    help: [
      'How tool approvals/suspensions resolve:',
      '  auto   approve everything (default)',
      '  deny   refuse approvals, abort on suspension',
    ],
  },
  {
    key: 'output',
    short: 'o',
    type: 'string',
    field: 'output',
    coerce: validate.enum<OutputMode>('--output', VALID_OUTPUTS),
    placeholder: '<mode>',
    help: [
      'Output mode: "human" (default), "json", or "jsonl"',
      '  human  streaming text to stdout, activity to stderr',
      '  json   single final JSON object (text, usage, tools)',
      '  jsonl  newline-delimited JSON event stream',
    ],
  },
  {
    key: 'model',
    short: 'm',
    type: 'string',
    field: 'model',
    coerce: validate.string,
    placeholder: '<id>',
    help: 'Model override (e.g., a provider/model id)',
  },
  {
    key: 'mode',
    type: 'string',
    field: 'mode',
    coerce: validate.enum<RunMode>('--mode', VALID_MODES),
    placeholder: '{build|plan|fast}',
    help: 'Execution mode — defaults to "build" if omitted',
  },
  {
    key: 'thinking-level',
    type: 'string',
    field: 'thinkingLevel',
    coerce: validate.enum<ThinkingLevel>('--thinking-level', VALID_THINKING_LEVELS),
    placeholder: '<level>',
    help: 'Thinking level: off, low, medium, high, xhigh',
  },
  {
    key: 'settings',
    type: 'string',
    field: 'settings',
    coerce: validate.string,
    placeholder: '<path>',
    help: 'Path to settings.json file (default: global settings)',
  },
  {
    key: 'help',
    short: 'h',
    type: 'boolean',
    help: 'Show this help and exit',
  },
];

/** `parseArgs` option config derived from {@link FLAGS}. */
export function buildParseArgsOptions() {
  const options: Record<string, { type: 'string' | 'boolean'; short?: string; default?: boolean }> = {};
  for (const flag of FLAGS) {
    options[flag.key] = flag.type === 'boolean' ? { type: 'boolean', default: false } : { type: 'string' };
    if (flag.short) options[flag.key]!.short = flag.short;
  }
  return options;
}

/** Render the aligned `--flag  description` block of the usage text from {@link FLAGS}. */
export function renderFlagUsage(): string {
  const left = (flag: FlagSpec): string => {
    const long = `--${flag.key}`;
    const short = flag.short ? `, -${flag.short}` : '';
    const value = flag.placeholder ? ` ${flag.placeholder}` : '';
    return `  ${long}${short}${value}`;
  };

  const rows = FLAGS.map(flag => ({ flag, label: left(flag) }));
  const width = Math.max(...rows.map(r => r.label.length)) + 2;

  return rows
    .map(({ flag, label }) => {
      const lines = Array.isArray(flag.help) ? flag.help : [flag.help];
      const first = `${label.padEnd(width)}${lines[0]}`;
      const rest = lines.slice(1).map(line => `${' '.repeat(width)}${line}`);
      return [first, ...rest].join('\n');
    })
    .join('\n');
}
