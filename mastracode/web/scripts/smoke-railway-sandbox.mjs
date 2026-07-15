#!/usr/bin/env node
/**
 * Smoke test the Railway sandbox factory end-to-end without going through
 * the web server. Provisions a fresh sandbox using the same wrapper and
 * template shape production uses (`RailwaySandbox` from `@mastra/railway`
 * with `template: builder => builder.withPackages('git')`), then runs the
 * runtime `gh` install that `ensureGhInstalled` does inside the sandbox,
 * and finally verifies `gh --version`. Prints stdout/stderr from every
 * step so template-build failures and apt failures are visible.
 *
 * The Railway SDK does not surface template-build logs itself; this script
 * surfaces them by running the same steps as regular sandbox execs where
 * their output is readable — the same design decision that led to moving
 * `gh` install out of the template and into `ensureGhInstalled`.
 *
 * Usage:
 *   RAILWAY_API_TOKEN=... \
 *   RAILWAY_PROJECT_ID=... \
 *   RAILWAY_ENVIRONMENT_ID=... \
 *     node scripts/smoke-railway-sandbox.mjs
 *
 * Optional env:
 *   MASTRACODE_SANDBOX_IDLE_MINUTES=5   # tear-down window (default 5)
 *   KEEP_SANDBOX=1                       # skip destroy, leave sandbox running
 *
 * Requires `@mastra/railway` to be built. From the repo root:
 *   pnpm build:mastracode
 */

import { RailwaySandbox } from '@mastra/railway';

const REQUIRED = ['RAILWAY_API_TOKEN', 'RAILWAY_PROJECT_ID', 'RAILWAY_ENVIRONMENT_ID'];
const missing = REQUIRED.filter(k => !process.env[k]);
if (missing.length > 0) {
  console.error(`Missing required env: ${missing.join(', ')}`);
  process.exit(1);
}

const IDLE_MINUTES = Number(process.env.MASTRACODE_SANDBOX_IDLE_MINUTES ?? 5);
const KEEP = process.env.KEEP_SANDBOX === '1';

// Same shell command the runtime `ensureGhInstalled` helper runs inside the
// sandbox when `gh --version` is missing. Kept in sync with the copy in
// `mastracode/web/src/web/github/sandbox.ts` (`ensureGhInstalled`).
const GH_INSTALL_SCRIPT = [
  'set -eux',
  'apt-get update',
  'DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends ca-certificates curl',
  'mkdir -p /etc/apt/keyrings',
  'curl -fsSL https://cli.github.com/packages/githubcli-archive-keyring.gpg -o /etc/apt/keyrings/githubcli-archive-keyring.gpg',
  'chmod go+r /etc/apt/keyrings/githubcli-archive-keyring.gpg',
  'ARCH=$(dpkg --print-architecture)',
  'echo "deb [arch=$ARCH signed-by=/etc/apt/keyrings/githubcli-archive-keyring.gpg] https://cli.github.com/packages stable main" > /etc/apt/sources.list.d/github-cli.list',
  'apt-get update',
  'DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends gh',
].join('; ');

function stepBanner(n, label) {
  console.log(`\n============================================================`);
  console.log(`STEP ${n}: ${label}`);
  console.log(`============================================================`);
}

function printExec(result) {
  console.log(`  exitCode: ${result.exitCode}`);
  if (result.stdout) console.log(`  --- stdout ---\n${result.stdout.trimEnd()}`);
  if (result.stderr) console.log(`  --- stderr ---\n${result.stderr.trimEnd()}`);
}

const sandbox = new RailwaySandbox({
  idleTimeoutMinutes: IDLE_MINUTES,
  template: builder => builder.withPackages('git'),
});

try {
  stepBanner(1, 'Build template + provision sandbox');
  console.log(`  idleTimeoutMinutes: ${IDLE_MINUTES}`);
  await sandbox.start();
  console.log(`  provider sandbox id: ${sandbox.railway.id}`);

  stepBanner(2, 'git --version (baked into template)');
  const gitVersion = await sandbox.executeCommand('git --version');
  printExec(gitVersion);
  if (gitVersion.exitCode !== 0) throw new Error('git --version failed');

  stepBanner(3, 'gh --version (expected to fail; not in template)');
  const ghBefore = await sandbox.executeCommand('gh --version');
  printExec(ghBefore);

  stepBanner(4, 'Install gh at runtime (mirrors ensureGhInstalled)');
  const install = await sandbox.executeCommand(GH_INSTALL_SCRIPT);
  printExec(install);
  if (install.exitCode !== 0) throw new Error('gh install failed');

  stepBanner(5, 'gh --version (should succeed now)');
  const ghAfter = await sandbox.executeCommand('gh --version');
  printExec(ghAfter);
  if (ghAfter.exitCode !== 0) throw new Error('gh --version failed after install');

  console.log(`\n✅ smoke test passed`);
} catch (err) {
  console.error(`\n❌ smoke test failed: ${err instanceof Error ? err.message : String(err)}`);
  if (err instanceof Error && err.stack) console.error(err.stack);
  process.exitCode = 1;
} finally {
  if (!KEEP) {
    try {
      await sandbox.destroy();
      console.log(`\n  sandbox destroyed`);
    } catch (err) {
      console.error(`  failed to destroy sandbox: ${err instanceof Error ? err.message : String(err)}`);
    }
  } else {
    try {
      console.log(`\n  KEEP_SANDBOX=1 — provider sandbox ${sandbox.railway.id} left running`);
    } catch {
      console.log(`\n  KEEP_SANDBOX=1 — sandbox left running (id unavailable, never provisioned)`);
    }
  }
}
