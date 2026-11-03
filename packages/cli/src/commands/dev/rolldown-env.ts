/**
 * Works around https://github.com/rolldown/rolldown/issues/10985: in watch mode, Rolldown's allocator (mimalloc)
 * holds on to memory freed across its worker threads, so a `mastra dev` session keeps growing (~0.7 GB to ~1.9 GB
 * over 30 rebuilds on a real app). Fewer threads and returning freed arena memory right away lower it (about a
 * quarter less on average), for ~10 ms more per rebuild. Only the dev server commands get these: `mastra build`
 * runs once and would just be slower.
 *
 * Remove this once the issue is fixed in the Rolldown version we depend on.
 */
const DEV_ROLLDOWN_ENV_DEFAULTS = {
  ROLLDOWN_WORKER_THREADS: '4',
  RAYON_NUM_THREADS: '4',
  MIMALLOC_ARENA_PURGE_MULT: '0',
};

const appliedDefaults: string[] = [];

/** `mastra dev` and `mastra factory dev`; the CLI has no global options that take a value. */
export function isDevServerCommand(args: string[]): boolean {
  const [command, subcommand] = args.filter(arg => !arg.startsWith('-'));
  return command === 'dev' || (command === 'factory' && subcommand === 'dev');
}

/**
 * Sets the defaults the user hasn't set. Must run before Rolldown is imported: mimalloc reads its options when the
 * native binding loads.
 */
export function applyDevRolldownEnvDefaults(args: string[], env: NodeJS.ProcessEnv = process.env): void {
  if (!isDevServerCommand(args)) {
    return;
  }

  for (const [key, value] of Object.entries(DEV_ROLLDOWN_ENV_DEFAULTS)) {
    if (env[key] === undefined) {
      env[key] = value;
      appliedDefaults.push(key);
    }
  }
}

/**
 * Removes the defaults from the environment of a process that runs user code, which should see the variables the
 * user set (including in their dotenv files) and not the CLI's tuning.
 */
export function withoutDevRolldownEnvDefaults(
  childEnv: NodeJS.ProcessEnv,
  loadedEnv: Map<string, string>,
): NodeJS.ProcessEnv {
  const result = { ...childEnv };
  for (const key of appliedDefaults) {
    const loaded = loadedEnv.get(key);
    if (loaded === undefined) {
      delete result[key];
    } else {
      result[key] = loaded;
    }
  }
  return result;
}
