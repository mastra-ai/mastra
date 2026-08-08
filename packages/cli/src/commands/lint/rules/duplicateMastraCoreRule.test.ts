import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, test } from 'vitest';
import { duplicateMastraCoreRule } from './duplicateMastraCoreRule.js';
import type { LintContext } from './types.js';

const tempDirs: string[] = [];

function createRoot(): string {
  const rootDir = mkdtempSync(join(tmpdir(), 'mastra-duplicate-core-rule-'));
  tempDirs.push(rootDir);
  return rootDir;
}

function createContext(rootDir: string): LintContext {
  return {
    rootDir,
    mastraDir: join(rootDir, 'src', 'mastra'),
    outputDirectory: join(rootDir, '.mastra'),
    discoveredTools: [],
    packageJson: {},
    mastraPackages: [],
  };
}

/** Writes a real @mastra/core package at `<nodeModulesDir>/@mastra/core`. */
function writeCore(nodeModulesDir: string, version: string): string {
  const coreDir = join(nodeModulesDir, '@mastra', 'core');
  mkdirSync(coreDir, { recursive: true });
  writeFileSync(join(coreDir, 'package.json'), JSON.stringify({ name: '@mastra/core', version }));
  return coreDir;
}

describe('duplicateMastraCoreRule', () => {
  afterEach(() => {
    for (const dir of tempDirs) {
      rmSync(dir, { recursive: true, force: true });
    }
    tempDirs.length = 0;
  });

  test('reports nothing when no @mastra/core is installed', async () => {
    const rootDir = createRoot();
    mkdirSync(join(rootDir, 'node_modules'), { recursive: true });

    expect(await duplicateMastraCoreRule.run(createContext(rootDir))).toEqual([]);
  });

  test('reports nothing when node_modules does not exist', async () => {
    expect(await duplicateMastraCoreRule.run(createContext(createRoot()))).toEqual([]);
  });

  test('reports nothing for a single copy', async () => {
    const rootDir = createRoot();
    writeCore(join(rootDir, 'node_modules'), '1.51.0');

    expect(await duplicateMastraCoreRule.run(createContext(rootDir))).toEqual([]);
  });

  test('reports an error for two physically distinct copies', async () => {
    const rootDir = createRoot();
    writeCore(join(rootDir, 'node_modules'), '1.51.0');
    writeCore(join(rootDir, 'node_modules', '@mastra', 'memory', 'node_modules'), '1.50.0');

    const issues = await duplicateMastraCoreRule.run(createContext(rootDir));

    expect(issues).toHaveLength(1);
    expect(issues[0]!.code).toBe('DUPLICATE_MASTRA_CORE');
    expect(issues[0]!.severity).toBe('error');
    expect(issues[0]!.message).toContain('2 separate copies');
    expect(issues[0]!.message).toContain('1.51.0');
    expect(issues[0]!.message).toContain('1.50.0');
  });

  test('detects duplicates even when both copies are the same version', async () => {
    const rootDir = createRoot();
    writeCore(join(rootDir, 'node_modules'), '1.51.0');
    writeCore(join(rootDir, 'node_modules', '@mastra', 'pg', 'node_modules'), '1.51.0');

    const issues = await duplicateMastraCoreRule.run(createContext(rootDir));

    expect(issues).toHaveLength(1);
    expect(issues[0]!.code).toBe('DUPLICATE_MASTRA_CORE');
  });

  test('does not flag symlinks that resolve to the same copy', async () => {
    const rootDir = createRoot();
    const coreDir = writeCore(join(rootDir, 'node_modules'), '1.51.0');

    // pnpm-style: a nested dependency links back to the one real copy.
    const nestedScope = join(rootDir, 'node_modules', '@mastra', 'memory', 'node_modules', '@mastra');
    mkdirSync(nestedScope, { recursive: true });
    symlinkSync(coreDir, join(nestedScope, 'core'), 'dir');

    expect(await duplicateMastraCoreRule.run(createContext(rootDir))).toEqual([]);
  });

  test('ignores a directory without a readable package.json', async () => {
    const rootDir = createRoot();
    writeCore(join(rootDir, 'node_modules'), '1.51.0');
    mkdirSync(join(rootDir, 'node_modules', '@mastra', 'memory', 'node_modules', '@mastra', 'core'), {
      recursive: true,
    });

    expect(await duplicateMastraCoreRule.run(createContext(rootDir))).toEqual([]);
  });
});
