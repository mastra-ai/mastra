/**
 * V8 flags Mastra Code starts Node with. They have to be set when the heap is created, so the CLI
 * entry re-execs Node once with them before loading anything else.
 *
 * `--max-semi-space-size=8` caps the young generation at 8 MB per semi-space. Node 24's default is
 * larger, and Mastra Code's bursty allocation (streaming, rendering) keeps it full: on Node 24 that's
 * about 100 MB less RSS at idle and 60 MB less after 40 tool turns, for ~3% more CPU. Node 22's default
 * is already close to this, so the flag changes little there.
 */
export const HEAP_FLAGS = ['--max-semi-space-size=8'] as const;

/** Opt out with MASTRACODE_NO_HEAP_FLAGS=1 (e.g. to compare memory, or when a flag misbehaves). */
const OPT_OUT_ENV = 'MASTRACODE_NO_HEAP_FLAGS';

/**
 * The argv to re-exec Node with, or undefined when no restart is needed: every flag is already set
 * (by us, the user's command line or NODE_OPTIONS), the user opted out, or this isn't Node.
 */
export function heapFlagRelaunchArgv(proc: {
  execPath: string;
  execArgv: readonly string[];
  argv: readonly string[];
  env: NodeJS.ProcessEnv;
  versions: NodeJS.ProcessVersions;
}): string[] | undefined {
  if (proc.env[OPT_OUT_ENV] === '1') return undefined;
  // Bun and Deno expose process.execve too, but don't take V8 flags this way.
  if (proc.versions.bun || proc.versions.deno) return undefined;
  // Option names only, with V8's underscore spelling (`--max_semi_space_size`) read as dashes.
  const setNames = [...proc.execArgv, ...splitNodeOptions(proc.env.NODE_OPTIONS ?? '')].map(option =>
    option.split('=')[0]!.replaceAll('_', '-'),
  );
  // The flag itself counts, not its name inside another option's value (`--title=--max-semi-space-size`).
  const missing = HEAP_FLAGS.filter(flag => !setNames.includes(flag.split('=')[0]!));
  if (missing.length === 0) return undefined;
  return [proc.execPath, ...missing, ...proc.execArgv, ...proc.argv.slice(1)];
}

/**
 * Split NODE_OPTIONS the way Node does: on spaces, with double quotes grouping a value and a
 * backslash escaping the next character inside quotes.
 */
function splitNodeOptions(value: string): string[] {
  const options: string[] = [];
  let current = '';
  let started = false;
  let quoted = false;
  for (let i = 0; i < value.length; i++) {
    const char = value[i]!;
    if (quoted && char === '\\' && i + 1 < value.length) {
      current += value[++i];
    } else if (char === '"') {
      quoted = !quoted;
      started = true;
    } else if (char === ' ' && !quoted) {
      if (started) options.push(current);
      current = '';
      started = false;
    } else {
      current += char;
      started = true;
    }
  }
  if (started) options.push(current);
  return options;
}
