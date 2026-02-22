import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { findProjectRoot, getServersForFile, walkUp } from './servers';

describe('walkUp', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'lsp-walkup-'));
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it('finds closest marker', () => {
    // tempDir/a/b/c with package.json at tempDir/a
    const a = join(tempDir, 'a');
    const b = join(a, 'b');
    const c = join(b, 'c');
    mkdirSync(c, { recursive: true });
    writeFileSync(join(a, 'package.json'), '{}');

    expect(walkUp(c, ['package.json'])).toBe(a);
  });

  it('finds marker in the starting directory itself', () => {
    writeFileSync(join(tempDir, 'tsconfig.json'), '{}');

    expect(walkUp(tempDir, ['tsconfig.json'])).toBe(tempDir);
  });

  it('prefers closest match over parent', () => {
    // Both parent and child have package.json — should find child
    const parent = join(tempDir, 'parent');
    const child = join(parent, 'child');
    const deep = join(child, 'src');
    mkdirSync(deep, { recursive: true });
    writeFileSync(join(parent, 'package.json'), '{}');
    writeFileSync(join(child, 'package.json'), '{}');

    expect(walkUp(deep, ['package.json'])).toBe(child);
  });

  it('returns null when no marker found', () => {
    const deep = join(tempDir, 'a', 'b', 'c');
    mkdirSync(deep, { recursive: true });

    expect(walkUp(deep, ['nonexistent-marker.json'])).toBeNull();
  });

  it('checks multiple markers', () => {
    const dir = join(tempDir, 'project');
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, 'go.mod'), 'module example');

    expect(walkUp(dir, ['package.json', 'go.mod'])).toBe(dir);
  });

  it('stops at filesystem root without infinite loop', () => {
    // walkUp from a shallow path should not hang
    const result = walkUp('/tmp', ['definitely-not-a-real-marker-file-xyz']);
    expect(result).toBeNull();
  });
});

describe('findProjectRoot', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'lsp-root-'));
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it('finds tsconfig.json', () => {
    const project = join(tempDir, 'project');
    const src = join(project, 'src');
    mkdirSync(src, { recursive: true });
    writeFileSync(join(project, 'tsconfig.json'), '{}');

    expect(findProjectRoot(src)).toBe(project);
  });

  it('finds package.json', () => {
    const project = join(tempDir, 'project');
    const src = join(project, 'src');
    mkdirSync(src, { recursive: true });
    writeFileSync(join(project, 'package.json'), '{}');

    expect(findProjectRoot(src)).toBe(project);
  });

  it('finds go.mod', () => {
    const project = join(tempDir, 'go-project');
    const pkg = join(project, 'pkg');
    mkdirSync(pkg, { recursive: true });
    writeFileSync(join(project, 'go.mod'), 'module example');

    expect(findProjectRoot(pkg)).toBe(project);
  });

  it('finds Cargo.toml', () => {
    const project = join(tempDir, 'rust-project');
    const src = join(project, 'src');
    mkdirSync(src, { recursive: true });
    writeFileSync(join(project, 'Cargo.toml'), '[package]');

    expect(findProjectRoot(src)).toBe(project);
  });

  it('finds .git directory', () => {
    const project = join(tempDir, 'git-project');
    const src = join(project, 'src');
    const gitDir = join(project, '.git');
    mkdirSync(src, { recursive: true });
    mkdirSync(gitDir, { recursive: true });

    expect(findProjectRoot(src)).toBe(project);
  });

  it('returns null when nothing found', () => {
    const deep = join(tempDir, 'a', 'b', 'c');
    mkdirSync(deep, { recursive: true });

    expect(findProjectRoot(deep)).toBeNull();
  });
});

describe('getServersForFile', () => {
  it('returns TypeScript server for .ts files', () => {
    const servers = getServersForFile('/project/src/app.ts');
    expect(servers.length).toBeGreaterThan(0);
    expect(servers.some(s => s.id === 'typescript')).toBe(true);
  });

  it('returns TypeScript server for .tsx files', () => {
    const servers = getServersForFile('/project/src/App.tsx');
    expect(servers.some(s => s.id === 'typescript')).toBe(true);
  });

  it('returns TypeScript server for .js files', () => {
    const servers = getServersForFile('/project/src/app.js');
    expect(servers.some(s => s.id === 'typescript')).toBe(true);
  });

  it('returns Python server for .py files', () => {
    const servers = getServersForFile('/project/main.py');
    expect(servers.some(s => s.id === 'python')).toBe(true);
  });

  it('returns Go server for .go files', () => {
    const servers = getServersForFile('/project/main.go');
    expect(servers.some(s => s.id === 'go')).toBe(true);
  });

  it('returns Rust server for .rs files', () => {
    const servers = getServersForFile('/project/src/main.rs');
    expect(servers.some(s => s.id === 'rust')).toBe(true);
  });

  it('returns empty array for unsupported files', () => {
    expect(getServersForFile('/project/README.md')).toEqual([]);
    expect(getServersForFile('/project/data.json')).toEqual([]);
    expect(getServersForFile('/project/image.png')).toEqual([]);
  });

  it('filters disabled servers', () => {
    const servers = getServersForFile('/project/src/app.ts', ['eslint']);
    expect(servers.some(s => s.id === 'eslint')).toBe(false);
    expect(servers.some(s => s.id === 'typescript')).toBe(true);
  });

  it('can disable all matching servers', () => {
    const servers = getServersForFile('/project/main.go', ['go']);
    expect(servers).toEqual([]);
  });

  it('server definitions include markers', () => {
    const tsServers = getServersForFile('/project/app.ts');
    const tsServer = tsServers.find(s => s.id === 'typescript');
    expect(tsServer?.markers).toEqual(['tsconfig.json', 'package.json']);

    const pyServers = getServersForFile('/project/app.py');
    const pyServer = pyServers.find(s => s.id === 'python');
    expect(pyServer?.markers).toEqual(['pyproject.toml', 'setup.py', 'requirements.txt', 'setup.cfg']);

    const goServers = getServersForFile('/project/main.go');
    const goServer = goServers.find(s => s.id === 'go');
    expect(goServer?.markers).toEqual(['go.mod']);

    const rsServers = getServersForFile('/project/main.rs');
    const rsServer = rsServers.find(s => s.id === 'rust');
    expect(rsServer?.markers).toEqual(['Cargo.toml']);
  });
});
