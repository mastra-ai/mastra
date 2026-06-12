import fs from 'node:fs';
import fsPromises from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { Deps } from './deps';

// Test access to private methods. TypeScript's `private` is compile-time
// only; the surface is still reachable on the instance at runtime.
type DepsTestable = Deps & {
  getPackageManagerCommand(pm: 'npm' | 'yarn' | 'pnpm' | 'bun', type: 'install' | 'add'): string;
  ensurePnpmWorkspaceYaml(dir: string): Promise<void>;
};

describe('Deps (pnpm 11 compatibility, #16613)', () => {
  let tempDir: string;
  let deps: DepsTestable;

  beforeEach(async () => {
    tempDir = await fsPromises.mkdtemp(path.join(os.tmpdir(), 'mastra-deps-test-'));
    deps = new Deps(tempDir) as DepsTestable;
  });

  afterEach(async () => {
    await fsPromises.rm(tempDir, { recursive: true, force: true });
  });

  describe('getPackageManagerCommand', () => {
    it('does NOT pass --ignore-workspace to `pnpm install` (#16613)', () => {
      const cmd = deps.getPackageManagerCommand('pnpm', 'install');

      expect(cmd).not.toContain('--ignore-workspace');
      expect(cmd).toBe('install --loglevel=error');
    });

    it('still passes --loglevel=error for `pnpm add`', () => {
      const cmd = deps.getPackageManagerCommand('pnpm', 'add');

      expect(cmd).toBe('add --loglevel=error');
    });
  });

  describe('ensurePnpmWorkspaceYaml', () => {
    it('writes an empty packages list when no workspace yaml is present', async () => {
      await deps.ensurePnpmWorkspaceYaml(tempDir);

      const written = await fsPromises.readFile(path.join(tempDir, 'pnpm-workspace.yaml'), 'utf8');
      expect(written).toBe('packages: []\n');
    });

    it('does not overwrite an existing pnpm-workspace.yaml', async () => {
      const existing = 'packages:\n  - ./pkg\n';
      await fsPromises.writeFile(path.join(tempDir, 'pnpm-workspace.yaml'), existing, 'utf8');

      await deps.ensurePnpmWorkspaceYaml(tempDir);

      const written = await fsPromises.readFile(path.join(tempDir, 'pnpm-workspace.yaml'), 'utf8');
      expect(written).toBe(existing);
    });

    it('is idempotent across repeated calls', async () => {
      await deps.ensurePnpmWorkspaceYaml(tempDir);
      const firstWrite = fs.statSync(path.join(tempDir, 'pnpm-workspace.yaml')).mtimeMs;

      await new Promise(resolve => setTimeout(resolve, 10));

      await deps.ensurePnpmWorkspaceYaml(tempDir);
      const secondWrite = fs.statSync(path.join(tempDir, 'pnpm-workspace.yaml')).mtimeMs;

      // Second call should be a no-op (mtime preserved because the file
      // already exists).
      expect(secondWrite).toBe(firstWrite);
    });
  });
});
