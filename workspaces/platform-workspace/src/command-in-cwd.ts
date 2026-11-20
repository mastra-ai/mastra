import { posix as posixPath } from 'node:path';

export function shellQuote(arg: string): string {
  // Single-quote every value so it is one shell word, including quotes in the value.
  return `'${arg.replace(/'/g, `'\\''`)}'`;
}

/**
 * `command` run from `cwd` by a leading shell `cd`, with the transports left to
 * start in the working directory. The exec transports report a `cwd` that
 * doesn't exist as a broken connection (retried, then "transport failed"), so
 * changing directory in the shell turns it into an ordinary failed command.
 *
 * A relative `cwd` resolves under `workingDirectory`. An absolute one outside it
 * that doesn't exist falls back to the same path under `workingDirectory`: the
 * workspace file tools read absolute paths that way (`/repo` is
 * `<workingDirectory>/repo`), so agents pass command `cwd`s the same way.
 *
 * Directory paths are stored in shell variables from quoted literals and read
 * back as `$_mastra_d1` / `$_mastra_d2`. They are not concatenated into the
 * script, and they are unset before `command` so positional parameters and the
 * caller's environment are unchanged.
 */
export function commandInCwd(command: string, cwd: string | undefined, workingDirectory: string | undefined): string {
  if (!cwd) return command;
  const normalize = (dir: string) => posixPath.normalize(dir).replace(/(.)\/$/, '$1');
  const base = workingDirectory ? normalize(workingDirectory) : undefined;
  const target = normalize(base && !cwd.startsWith('/') ? posixPath.join(base, cwd) : cwd);
  if (target === base) return command;
  const candidates = [target];
  if (base && cwd.startsWith('/') && !target.startsWith(`${base}/`)) candidates.push(posixPath.join(base, target));
  const primaryDir = candidates[0];
  if (!primaryDir) return command;
  const fallbackDir = candidates[1];
  const alsoTried = fallbackDir ? ' (also tried $_mastra_d2)' : '';
  return (
    `_mastra_d1=${shellQuote(primaryDir)}\n` +
    `_mastra_d2=${fallbackDir ? shellQuote(fallbackDir) : `''`}\n` +
    `if [ -d "$_mastra_d1" ]; then cd -- "$_mastra_d1" || exit 1\n` +
    `elif [ -n "$_mastra_d2" ] && [ -d "$_mastra_d2" ]; then cd -- "$_mastra_d2" || exit 1\n` +
    `else echo "Working directory not found: $_mastra_d1${alsoTried}" >&2; exit 1\n` +
    `fi\n` +
    `unset _mastra_d1 _mastra_d2\n` +
    command
  );
}
