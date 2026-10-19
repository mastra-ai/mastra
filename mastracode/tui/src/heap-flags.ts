/**
 * V8 flags Mastra Code starts Node with. They have to be set when the heap is created, so the CLI
 * entry re-execs Node once with them before loading anything else.
 *
 * `--max-semi-space-size=8` caps the young generation at 8 MB per semi-space. Node's default sizes it
 * from system memory (16 MB or more), and Mastra Code's bursty allocation (streaming, rendering) keeps
 * it full: about 115 MB less RSS at idle and 60 MB less after 40 tool turns, for ~3% more CPU.
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
  const nodeOptions = proc.env.NODE_OPTIONS ?? '';
  const missing = HEAP_FLAGS.filter(flag => {
    const name = flag.split('=')[0]!;
    return !proc.execArgv.some(arg => arg.startsWith(name)) && !nodeOptions.includes(name);
  });
  if (missing.length === 0) return undefined;
  return [proc.execPath, ...missing, ...proc.execArgv, ...proc.argv.slice(1)];
}
