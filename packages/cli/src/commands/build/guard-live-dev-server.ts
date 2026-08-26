import pc from 'picocolors';
import { readLiveDevLock } from '../dev/dev-lock';

/**
 * `Bundler.prepare()` (in @mastra/deployer) empties `outputDirectory`
 * unconditionally. A live `mastra dev` server holding `dev.lock` in that same
 * directory would have its lock file and already-served assets deleted out
 * from under it, with no warning. Refuse (or, with `force`, warn loudly and
 * proceed) before that happens.
 */
export async function guardAgainstLiveDevServer(outputDirectory: string, force: boolean | undefined): Promise<void> {
  const liveLock = await readLiveDevLock(outputDirectory);
  if (!liveLock) return;

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
  }

  console.warn(
    pc.yellow(
      `  ⚠ A \`mastra dev\` server (PID ${liveLock.pid}${where}) is running in this directory. ` +
        '--force was passed, so building anyway -- its output directory is about to be emptied out from under it.',
    ),
  );
}
