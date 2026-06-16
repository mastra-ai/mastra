import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { dirname, join, relative } from 'node:path';

let linuxDepsInstallPromise: Promise<void> | undefined;

function isTruthy(value: string | undefined): boolean {
  return value === '1' || value === 'true';
}

function isSubpath(parent: string, child: string): boolean {
  const relativePath = relative(parent, child);
  return relativePath !== '' && !relativePath.startsWith('..') && !relativePath.startsWith('/');
}

function resolvePlaywrightCli(): string | undefined {
  const require = createRequire(import.meta.url);
  const candidates = ['playwright-chromium', 'playwright'];

  for (const pkg of candidates) {
    try {
      const packageEntry = require.resolve(pkg);
      const packageDir = dirname(packageEntry);
      const cliPath = join(packageDir, 'cli.js');

      if (!isSubpath(packageDir, cliPath)) {
        continue;
      }

      return cliPath;
    } catch {
      // Try the next Playwright package name.
    }
  }

  return undefined;
}

async function runPlaywrightInstallDeps(playwrightCli: string, timeoutMs: number): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const child = spawn(process.execPath, [playwrightCli, 'install-deps', 'chromium'], {
      stdio: 'inherit',
      shell: false,
    });

    const timeout = setTimeout(() => {
      child.kill('SIGTERM');
      reject(new Error(`Timed out installing Playwright Chromium system dependencies after ${timeoutMs}ms`));
    }, timeoutMs);

    child.once('error', error => {
      clearTimeout(timeout);
      reject(error);
    });

    child.once('exit', code => {
      clearTimeout(timeout);
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`Playwright Chromium system dependency install failed with exit code ${code}`));
      }
    });
  });
}

export async function installPlaywrightLinuxDeps({
  cdpUrl,
  enabled = true,
  timeoutMs = 120_000,
}: {
  cdpUrl?: unknown;
  enabled?: boolean;
  timeoutMs?: number;
} = {}): Promise<void> {
  if (!enabled || cdpUrl || isTruthy(process.env.BROWSER_SKIP_INSTALL_DEPS)) {
    return;
  }

  if (process.platform !== 'linux' || process.getuid?.() !== 0) {
    return;
  }

  linuxDepsInstallPromise ??= (async () => {
    const playwrightCli = resolvePlaywrightCli();
    if (!playwrightCli) {
      return;
    }

    await runPlaywrightInstallDeps(playwrightCli, timeoutMs);
  })().catch(error => {
    linuxDepsInstallPromise = undefined;
    throw error;
  });

  await linuxDepsInstallPromise;
}

export function resetPlaywrightLinuxDepsForTest(): void {
  linuxDepsInstallPromise = undefined;
}
