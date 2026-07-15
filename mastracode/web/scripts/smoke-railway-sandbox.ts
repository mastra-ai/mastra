#!/usr/bin/env node
/**
 * Smoke test the Railway sandbox factory end-to-end using the real production
 * code paths from `mastracode/web/src/web/github/sandbox.ts`:
 *
 *   1. `provisionFreshSandbox()`  — same factory + template shape production
 *      uses via `ensureProjectSandbox`, but without DB coupling.
 *   2. `ensureGhInstalled()`      — the same runtime gh install that
 *      `createPullRequest` invokes on first use.
 *
 * Any change to the production Railway wiring (template, idle timeout, gh
 * install script) is picked up automatically by this smoke test — nothing is
 * duplicated here.
 *
 * Usage:
 *   RAILWAY_API_TOKEN=... \
 *   RAILWAY_PROJECT_ID=... \
 *   RAILWAY_ENVIRONMENT_ID=... \
 *     pnpm --filter ./mastracode/web smoke:railway
 *
 * Optional env:
 *   MASTRACODE_SANDBOX_IDLE_MINUTES=5   # tear-down window (default 30)
 *   MASTRACODE_SANDBOX_PROVIDER=railway # force provider (else auto)
 *   KEEP_SANDBOX=1                       # skip destroy, leave sandbox running
 *
 * Requires the workspace to be built. From the repo root:
 *   pnpm build:mastracode
 */

import { ensureGhInstalled, getSandboxProvider, provisionFreshSandbox } from '../src/web/github/sandbox';
import type { MaterializationSandbox, SandboxCommandResult } from '../src/web/github/sandbox';

const REQUIRED = ['RAILWAY_API_TOKEN', 'RAILWAY_PROJECT_ID', 'RAILWAY_ENVIRONMENT_ID'];
const missing = REQUIRED.filter(k => !process.env[k]);
if (missing.length > 0) {
  console.error(`Missing required env: ${missing.join(', ')}`);
  process.exit(1);
}

if (getSandboxProvider() !== 'railway') {
  console.error(
    `Sandbox provider resolved to '${getSandboxProvider()}', not 'railway'. Set MASTRACODE_SANDBOX_PROVIDER=railway or unset the override.`,
  );
  process.exit(1);
}

const KEEP = process.env.KEEP_SANDBOX === '1';

function stepBanner(n: number, label: string): void {
  console.log(`\n============================================================`);
  console.log(`STEP ${n}: ${label}`);
  console.log(`============================================================`);
}

function printExec(result: SandboxCommandResult): void {
  console.log(`  exitCode: ${result.exitCode}`);
  if (result.stdout) console.log(`  --- stdout ---\n${result.stdout.trimEnd()}`);
  if (result.stderr) console.log(`  --- stderr ---\n${result.stderr.trimEnd()}`);
}

let sandbox: MaterializationSandbox | undefined;
try {
  stepBanner(1, 'Provision fresh sandbox (production factory + template)');
  sandbox = await provisionFreshSandbox();
  console.log(`  sandbox started (provider: ${getSandboxProvider()})`);

  stepBanner(2, 'git --version (baked into template)');
  const gitVersion = await sandbox.executeCommand('git --version');
  printExec(gitVersion);
  if (gitVersion.exitCode !== 0) throw new Error('git --version failed');

  stepBanner(3, 'ensureGhInstalled() — runtime gh install');
  await ensureGhInstalled(sandbox);
  console.log('  ensureGhInstalled: OK');

  stepBanner(4, 'gh --version (should succeed after install)');
  const ghAfter = await sandbox.executeCommand('gh --version');
  printExec(ghAfter);
  if (ghAfter.exitCode !== 0) throw new Error('gh --version failed after ensureGhInstalled');

  stepBanner(5, 'ensureGhInstalled() again — should be a fast no-op');
  const before = Date.now();
  await ensureGhInstalled(sandbox);
  console.log(`  ensureGhInstalled: OK (${Date.now() - before}ms)`);

  console.log(`\n✅ smoke test passed`);
} catch (err) {
  console.error(`\n❌ smoke test failed: ${err instanceof Error ? err.message : String(err)}`);
  if (err instanceof Error && err.stack) console.error(err.stack);
  process.exitCode = 1;
} finally {
  if (sandbox && !KEEP) {
    try {
      if (sandbox.stop) await sandbox.stop();
      console.log(`\n  sandbox stopped`);
    } catch (err) {
      console.error(`  failed to stop sandbox: ${err instanceof Error ? err.message : String(err)}`);
    }
  } else if (sandbox && KEEP) {
    console.log(`\n  KEEP_SANDBOX=1 — sandbox left running`);
  }
}
