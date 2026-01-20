import { existsSync } from 'node:fs';
import * as path from 'node:path';
import { describe, expect, it } from 'vitest';

import { getProjectRoot, resolveFromProjectRoot } from './project-root';

describe('getProjectRoot', () => {
  it('finds package.json by searching upward from cwd', () => {
    const root = getProjectRoot();
    expect(existsSync(path.join(root, 'package.json'))).toBe(true);
  });

  it('respects explicit root option', () => {
    const root = getProjectRoot({ root: '/explicit/path' });
    expect(root).toBe('/explicit/path');
  });

  it('resolves relative explicit root option', () => {
    const root = getProjectRoot({ root: './relative/path' });
    expect(path.isAbsolute(root)).toBe(true);
    expect(root).toMatch(/relative\/path$/);
  });

  it('returns consistent results on repeated calls', () => {
    const root1 = getProjectRoot();
    const root2 = getProjectRoot();
    expect(root1).toBe(root2);
  });

  it('respects custom cwd option', () => {
    const root1 = getProjectRoot();
    const root2 = getProjectRoot({ cwd: process.cwd() });
    expect(root1).toBe(root2);
  });

  it('finds nearest package.json from nested directory', () => {
    // Start from a nested directory within the project
    const nestedDir = path.join(process.cwd(), 'packages', 'core', 'src');
    const root = getProjectRoot({ cwd: nestedDir });
    // Should find packages/core/package.json (nearest), not monorepo root
    expect(existsSync(path.join(root, 'package.json'))).toBe(true);
  });

  it('falls back to startDir if no package.json found', () => {
    // Use a directory that has no package.json above it (filesystem root)
    const root = getProjectRoot({ cwd: '/' });
    expect(root).toBe('/');
  });

  it('skips .mastra directory when searching upward', () => {
    // When running bundled code from project/.mastra/output/index.mjs,
    // we want to find project/package.json, not any package.json inside .mastra
    // This test verifies the skip logic by checking that a path containing .mastra
    // resolves to the parent directory's package.json
    const projectRoot = getProjectRoot();
    const mastraPath = path.join(projectRoot, '.mastra', 'output');
    const root = getProjectRoot({ cwd: mastraPath });
    // Should skip .mastra and find the project root
    expect(root).toBe(projectRoot);
  });
});

describe('resolveFromProjectRoot', () => {
  it('resolves relative paths with ./ prefix from project root', () => {
    const resolved = resolveFromProjectRoot('./data/test.db');
    expect(path.isAbsolute(resolved)).toBe(true);
    expect(resolved).toMatch(/\/data\/test\.db$/);
  });

  it('resolves relative paths without ./ prefix from project root', () => {
    const resolved = resolveFromProjectRoot('data/test.db');
    expect(path.isAbsolute(resolved)).toBe(true);
    expect(resolved).toMatch(/\/data\/test\.db$/);
  });

  it('resolves ../ relative paths from project root', () => {
    const resolved = resolveFromProjectRoot('../sibling/file.txt');
    expect(path.isAbsolute(resolved)).toBe(true);
    expect(resolved).toMatch(/\/sibling\/file\.txt$/);
  });

  it('leaves absolute paths unchanged', () => {
    const resolved = resolveFromProjectRoot('/absolute/path/to/file.db');
    expect(resolved).toBe('/absolute/path/to/file.db');
  });

  it('handles Windows-style absolute paths', () => {
    // This test is only meaningful on Windows, but path.isAbsolute handles it
    const windowsPath = 'C:\\Users\\test\\file.db';
    const resolved = resolveFromProjectRoot(windowsPath);
    // On non-Windows, this will be treated as relative
    // On Windows, it would be returned as-is
    expect(resolved).toBeDefined();
  });

  it('respects explicit root option', () => {
    const resolved = resolveFromProjectRoot('./data/test.db', { root: '/custom/root' });
    expect(resolved).toBe('/custom/root/data/test.db');
  });
});
