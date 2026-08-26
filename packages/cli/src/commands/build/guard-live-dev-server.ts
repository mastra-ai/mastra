import pc from 'picocolors';
import { readLiveDevLock } from '../dev/dev-lock';

/**
 * `Bundler.prepare()` (in @mastra/deployer) empties `outputDirectory`
 * unconditionally. A live `mastra dev` server holding `dev.lock` in that same
 * directory would have its lock file and already-served assets deleted out
 * from under it, with no warning. Refuse (or, with `force`, warn loudly and
 * proceed) before that happens.
 *
 * Returns whether it's safe to proceed (no live dev server, or one is live
 * but `force` was passed). When it isn't, this prints the error and calls
 * `process.exit(1)` itself -- but also returns `false`, so a caller doesn't
 * depend on `process.exit()` actually terminating the process to avoid
 * running the destructive operation it's guarding.
 */
export async function guardAgainstLiveDevServer(outputDirectory: string, force: boolean | undefined): Promise<boolean> {
  const liveLock = await readLiveDevLock(outputDirectory);
  if (!liveLock) return true;

  const where = liveLock.host && liveLock.port ? ` (${liveLock.host}:${liveLock.port})` : '';

  if (!force) {
    console.error('');
    console.error(pc.red('  ✗ ') + pc.bold(pc.red('A `mastra dev` server is running in this directory')));
    console.error('');
    console.error(`  ${pc.red('│')} PID ${pc.bold(String(liveLock.pid))} is still active${where}.`);
    console.error(`  ${pc.red('│')} Building now would empty its output directory out from under it.`);
    console.error('');
    console.error(`  ${pc.dim('To fix this:')}`);
    console.error(`  ${pc.dim('•')} Stop the dev server (PID ${liveLock.pid}), or`);
    console.error(`  ${pc.dim('•')} Re-run with ${pc.cyan('--force')} to build anyway.`);
    console.error('');
    process.exit(1);
    return false;
  }

  console.warn(
    pc.yellow(
      `  ⚠ A \`mastra dev\` server (PID ${liveLock.pid}${where}) is running in this directory. ` +
        '--force was passed, so building anyway -- its output directory is about to be emptied out from under it.',
    ),
  );
  return true;
}

/**
 * Runs `prepare` (the caller's `deployer.prepare(outputDirectory)`) guarded
 * by an immediate, right-before-the-call re-check of `dev.lock`.
 *
 * `guardAgainstLiveDevServer()` alone, called once up front in `build()`,
 * still leaves a window open: real async work (peer-dep checks, entry-file
 * analysis, resolving a platform deployer) runs between that check and the
 * `prepare()` call that actually empties the directory, and a `mastra dev`
 * server can start and acquire the lock during that window. Re-checking
 * immediately before the call that does the deleting shrinks that window
 * from "the whole pre-build analysis phase" down to a single promise tick.
 *
 * This does not make the check-then-act atomic against a concurrent `mastra
 * dev` acquiring the lock in that same tick -- true atomicity would need a
 * lock shared by both commands' startup paths, not just build's. That's a
 * larger, separate change; this narrows the practical window to effectively
 * nothing without it.
 */
export async function prepareWithLiveDevGuard(
  outputDirectory: string,
  force: boolean | undefined,
  prepare: () => Promise<void>,
): Promise<void> {
  const canProceed = await guardAgainstLiveDevServer(outputDirectory, force);
  if (!canProceed) return;
  await prepare();
}
