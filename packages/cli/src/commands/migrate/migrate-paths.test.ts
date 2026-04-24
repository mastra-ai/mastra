import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  findMastraEntryCandidates,
  resolveMigrateEntryFile,
  resolveMigratePaths,
  toDetectedProjectRoot,
} from './migrate-paths';

describe('migrate path resolution', () => {
  const tempDirs: string[] = [];

  afterEach(() => {
    for (const dir of tempDirs) {
      rmSync(dir, { recursive: true, force: true });
    }
    tempDirs.length = 0;
  });

  it('resolves relative --dir against --root', () => {
    const tempDir = mkdtempSync(join(tmpdir(), 'mastra-migrate-paths-'));
    tempDirs.push(tempDir);

    const paths = resolveMigratePaths({
      cwd: tempDir,
      root: 'apps/project',
      dir: 'src/mastra',
    });

    expect(paths.rootDir).toBe(join(tempDir, 'apps', 'project'));
    expect(paths.mastraDir).toBe(join(tempDir, 'apps', 'project', 'src', 'mastra'));
  });

  it('finds entry file from mastra directory', () => {
    const tempDir = mkdtempSync(join(tmpdir(), 'mastra-migrate-test-'));
    tempDirs.push(tempDir);

    const mastraDir = join(tempDir, 'src', 'mastra');
    mkdirSync(mastraDir, { recursive: true });
    writeFileSync(join(mastraDir, 'index.ts'), 'export const mastra = {};', 'utf8');

    const resolution = resolveMigrateEntryFile(mastraDir);
    expect(resolution.entryFile).toBe(join(mastraDir, 'index.ts'));
    expect(resolution.checkedPaths).toEqual([join(mastraDir, 'index.ts'), join(mastraDir, 'index.js')]);
  });

  it('detects entrypoint candidates and ignores node_modules', () => {
    const tempDir = mkdtempSync(join(tmpdir(), 'mastra-migrate-candidates-'));
    tempDirs.push(tempDir);

    const appMastraDir = join(tempDir, 'apps', 'app-one', 'src', 'mastra');
    mkdirSync(appMastraDir, { recursive: true });
    writeFileSync(join(appMastraDir, 'index.ts'), 'export const mastra = {};', 'utf8');

    const ignoredMastraDir = join(tempDir, 'node_modules', 'pkg', 'src', 'mastra');
    mkdirSync(ignoredMastraDir, { recursive: true });
    writeFileSync(join(ignoredMastraDir, 'index.ts'), 'export const ignored = true;', 'utf8');

    const candidates = findMastraEntryCandidates(tempDir);
    expect(candidates).toEqual([join(appMastraDir, 'index.ts')]);
  });

  it('derives project root from entry file path', () => {
    const tempDir = mkdtempSync(join(tmpdir(), 'mastra-migrate-root-'));
    tempDirs.push(tempDir);

    const entryFile = join(tempDir, 'apps', 'my-app', 'src', 'mastra', 'index.ts');
    expect(toDetectedProjectRoot(entryFile)).toBe(join(tempDir, 'apps', 'my-app'));
  });
});
