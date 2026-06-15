import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';

let linuxDepsInstalled = false;

function isTruthy(value: string | undefined): boolean {
  return value === '1' || value === 'true';
}

function resolvePlaywrightCli(): string | undefined {
  const require = createRequire(import.meta.url);
  const candidates = ['playwright-chromium', 'playwright'];

  for (const pkg of candidates) {
    try {
      return join(dirname(require.resolve(pkg)), 'cli.js');
    } catch {
      // Try the next Playwright package name.
    }
  }

  return undefined;
}

export function installPlaywrightLinuxDeps({
  cdpUrl,
  enabled = true,
}: {
  cdpUrl?: unknown;
  enabled?: boolean;
} = {}): void {
  if (!enabled || linuxDepsInstalled || cdpUrl || isTruthy(process.env.BROWSER_SKIP_INSTALL_DEPS)) {
    return;
  }

  if (process.platform !== 'linux' || process.getuid?.() !== 0) {
    return;
  }

  const playwrightCli = resolvePlaywrightCli();
  if (!playwrightCli) {
    return;
  }

  linuxDepsInstalled = true;
  execFileSync(process.execPath, [playwrightCli, 'install-deps', 'chromium'], { stdio: 'inherit' });
}

export function resetPlaywrightLinuxDepsForTest(): void {
  linuxDepsInstalled = false;
}
