import { execFileSync } from 'node:child_process';
import { readdirSync, readFileSync, rmSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'vite';
import { afterEach, expect, test } from 'vitest';

const packageRoot = fileURLToPath(new URL('..', import.meta.url));
const fixtureRoot = path.join(packageRoot, 'test-fixtures', 'vite-browser');
const fixtureDistRoot = path.join(fixtureRoot, 'dist');

afterEach(() => {
  rmSync(fixtureDistRoot, { recursive: true, force: true });
});

test(
  'root entry builds in Vite without browser polyfills',
  async () => {
    execFileSync('pnpm', ['run', 'build:js'], {
      cwd: packageRoot,
      stdio: 'pipe',
    });

    await build({
      configFile: false,
      logLevel: 'silent',
      root: fixtureRoot,
      build: {
        emptyOutDir: true,
        outDir: 'dist',
      },
    });

    const assetDir = path.join(fixtureDistRoot, 'assets');
    const builtAssets = readdirSync(assetDir)
      .filter(file => file.endsWith('.js'))
      .map(file => readFileSync(path.join(assetDir, file), 'utf8'))
      .join('\n');

    expect(builtAssets).not.toContain('__vite-browser-external');
    expect(builtAssets).not.toContain('@mastra/core/loop');
  },
  30_000,
);
