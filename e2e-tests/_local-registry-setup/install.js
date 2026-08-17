import { spawnSync } from 'node:child_process';

// Transient failures we see when the local Verdaccio uplink is briefly unable to
// reach npmjs. These surface as a 404 for a package that genuinely exists, which
// is indistinguishable from a real missing dependency unless we retry.
const TRANSIENT_PATTERNS = [
  /ERR_PNPM_FETCH_404/,
  /ERR_PNPM_FETCH_5\d\d/,
  /ERR_PNPM_REGISTRIES_MISMATCH/,
  /is not in the npm registry/,
  /ECONNRESET|ETIMEDOUT|ECONNREFUSED|EAI_AGAIN/,
  /socket hang up/,
  /request to .* failed/,
];

function isTransient(output) {
  return TRANSIENT_PATTERNS.some(pattern => pattern.test(output));
}

/**
 * Run a package-manager install, failing loudly on a non-zero exit code.
 *
 * Previously these installs used a bare `spawnSync` whose status was never
 * checked, so a failed install let the suite continue against an empty
 * `node_modules`. The real error was then masked by a confusing downstream
 * failure (`Cannot find type definition file for 'node'`, `mastra: not found`).
 *
 * Transient registry errors are retried, since a flaky uplink should not fail a run.
 */
export function installWithRetry(command, args, { cwd, env, shell = true, retries = 3 } = {}) {
  let lastOutput = '';

  for (let attempt = 1; attempt <= retries; attempt++) {
    const result = spawnSync(command, args, {
      cwd,
      env,
      shell,
      encoding: 'utf8',
      // Capture output so we can classify failures, while still surfacing it.
      stdio: ['inherit', 'pipe', 'pipe'],
    });

    const stdout = result.stdout || '';
    const stderr = result.stderr || '';
    lastOutput = `${stdout}${stderr}`;

    process.stdout.write(stdout);
    process.stderr.write(stderr);

    if (result.error) {
      throw new Error(`Failed to spawn "${command} ${args.join(' ')}": ${result.error.message}`);
    }

    if (result.status === 0) {
      return;
    }

    if (attempt < retries && isTransient(lastOutput)) {
      const delaySeconds = attempt * 5;
      console.warn(
        `Install failed with a transient registry error (attempt ${attempt}/${retries}). Retrying in ${delaySeconds}s...`,
      );
      // spawnSync keeps this synchronous, matching the surrounding setup code.
      spawnSync(process.execPath, ['-e', `setTimeout(() => {}, ${delaySeconds * 1000})`]);
      continue;
    }

    throw new Error(`"${command} ${args.join(' ')}" failed in ${cwd} with exit code ${result.status}`);
  }
}

/**
 * Run a command, failing loudly on a non-zero exit code.
 */
export function runOrThrow(command, args, { cwd, env, shell = true } = {}) {
  const result = spawnSync(command, args, { cwd, env, shell, stdio: 'inherit' });

  if (result.error) {
    throw new Error(`Failed to spawn "${command} ${args.join(' ')}": ${result.error.message}`);
  }

  if (result.status !== 0) {
    throw new Error(`"${command} ${args.join(' ')}" failed in ${cwd} with exit code ${result.status}`);
  }
}
