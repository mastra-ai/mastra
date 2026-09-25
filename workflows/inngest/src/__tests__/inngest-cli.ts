/**
 * Resolves the `inngest` dev-server CLI binary for tests. Never downloads it.
 *
 * pnpm deliberately blocks the `inngest-cli` postinstall script (`allowBuilds`
 * in pnpm-workspace.yaml), so the platform Go binary is never downloaded at
 * install time — and test code must not run that blocked script either.
 * Instead, this helper resolves a binary the developer already installed:
 *
 *   1. `INNGEST_CLI_PATH` env var (custom installs / escape hatch)
 *   2. `node_modules/inngest-cli/bin/inngest` — populated by the explicit
 *      opt-in `pnpm --filter @mastra/inngest setup:inngest-cli`
 *   3. `inngest` on PATH (brew / official installer)
 *
 * If none exists, it throws with install instructions. The vitest globalSetup
 * calls this up front so a missing install fails once, before any test runs.
 *
 * Always spawn the absolute path returned here — never `npx inngest-cli` or
 * the `node_modules/.bin` shim: the generated shim invokes a binary that may
 * not exist (and even when it does, pnpm's shim may wrongly run the Go binary
 * with node).
 */
import fs from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';

const require = createRequire(import.meta.url);

const BINARY_NAME = process.platform === 'win32' ? 'inngest.exe' : 'inngest';

let cachedBinaryPath: string | null = null;

function findOnPath(): string | null {
  for (const dir of (process.env.PATH ?? '').split(path.delimiter)) {
    // pnpm prepends node_modules/.bin dirs to PATH for scripts; the `inngest`
    // entry there is the broken JS shim this helper exists to avoid.
    if (!dir || dir.includes('node_modules')) continue;
    const candidate = path.join(dir, BINARY_NAME);
    try {
      const stat = fs.statSync(candidate);
      if (!stat.isFile()) continue;
      fs.accessSync(candidate, fs.constants.X_OK);
      return candidate;
    } catch {
      continue;
    }
  }
  return null;
}

export function ensureInngestCliBinary(): string {
  if (cachedBinaryPath) return cachedBinaryPath;

  const override = process.env.INNGEST_CLI_PATH;
  if (override && fs.existsSync(override)) {
    cachedBinaryPath = override;
    return cachedBinaryPath;
  }

  const pkgDir = path.dirname(require.resolve('inngest-cli/package.json'));
  const packageBinary = path.join(pkgDir, 'bin', BINARY_NAME);
  if (fs.existsSync(packageBinary)) {
    cachedBinaryPath = packageBinary;
    return cachedBinaryPath;
  }

  const pathBinary = findOnPath();
  if (pathBinary) {
    cachedBinaryPath = pathBinary;
    return cachedBinaryPath;
  }

  throw new Error(
    [
      'Inngest CLI not found. The inngest-cli postinstall is intentionally blocked',
      'by pnpm (allowBuilds in pnpm-workspace.yaml), so the dev-server binary is not',
      'downloaded automatically. Install it one of these ways, then re-run:',
      '  - brew install inngest/tap/inngest',
      "  - pnpm --filter @mastra/inngest setup:inngest-cli   (runs the package's own installer, ~100MB)",
      '  - set INNGEST_CLI_PATH=/path/to/inngest',
    ].join('\n'),
  );
}
