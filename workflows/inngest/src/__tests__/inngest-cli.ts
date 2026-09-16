/**
 * Resolves the `inngest` dev-server CLI binary for tests, downloading it on
 * demand when missing.
 *
 * pnpm deliberately blocks the `inngest-cli` postinstall script (`allowBuilds`
 * in pnpm-workspace.yaml), so the platform Go binary is never downloaded at
 * install time. Spawning `npx inngest-cli` therefore fails on a fresh clone:
 * the generated `.bin` shim invokes a binary that does not exist (and even
 * when it does exist, pnpm's shim may wrongly run the Go binary with node).
 *
 * Always spawn the absolute path returned here — never `npx inngest-cli` or
 * the `node_modules/.bin` shim.
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';

const require = createRequire(import.meta.url);

let cachedBinaryPath: string | null = null;

export function ensureInngestCliBinary(): string {
  if (cachedBinaryPath) return cachedBinaryPath;

  const pkgDir = path.dirname(require.resolve('inngest-cli/package.json'));
  const binaryPath = path.join(pkgDir, 'bin', process.platform === 'win32' ? 'inngest.exe' : 'inngest');

  if (!fs.existsSync(binaryPath)) {
    fs.mkdirSync(path.dirname(binaryPath), { recursive: true });
    // The postinstall script extracts into `./bin` relative to cwd, so it must
    // run from the package directory. Downloads the binary once per machine.
    execFileSync(process.execPath, [path.join(pkgDir, 'postinstall.js')], {
      cwd: pkgDir,
      stdio: 'inherit',
      timeout: 5 * 60_000,
    });
    if (!fs.existsSync(binaryPath)) {
      throw new Error(`inngest-cli postinstall ran but the binary is still missing at ${binaryPath}`);
    }
  }

  cachedBinaryPath = binaryPath;
  return binaryPath;
}
