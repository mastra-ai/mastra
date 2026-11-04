import { mkdtemp, mkdir, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { createWorkspacesCache, findWorkspaces, findWorkspacesRoot } from './index';

let root: string;

async function writePackage(dir: string, name: string, extra: Record<string, unknown> = {}) {
  await mkdir(dir, { recursive: true });
  await writeFile(join(dir, 'package.json'), JSON.stringify({ name, version: '1.0.0', ...extra }));
}

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), 'mastra-find-workspaces-'));
});

afterEach(async () => {
  await rm(root, { recursive: true, force: true });
});

describe('findWorkspacesRoot', () => {
  it('finds a pnpm workspace root from a nested directory', async () => {
    await writeFile(join(root, 'pnpm-workspace.yaml'), 'packages:\n  - "packages/*"\n');
    await writePackage(join(root, 'packages', 'a'), 'a');

    const found = findWorkspacesRoot(join(root, 'packages', 'a'), { stopDir: tmpdir() });
    expect(found).toEqual({ location: root.split('\\').join('/'), globs: ['packages/*'] });
  });

  it('falls back to globbing everything for a pnpm-workspace.yaml without packages', async () => {
    await writeFile(join(root, 'pnpm-workspace.yaml'), '');
    expect(findWorkspacesRoot(root, { stopDir: tmpdir() })?.globs).toEqual(['**']);
  });

  it('reads package.json workspaces as an array or an object', async () => {
    await writePackage(root, 'array-root', { workspaces: ['apps/*'] });
    expect(findWorkspacesRoot(root, { stopDir: tmpdir() })?.globs).toEqual(['apps/*']);

    await writePackage(root, 'object-root', { workspaces: { packages: ['libs/*'] } });
    expect(findWorkspacesRoot(root, { stopDir: tmpdir() })?.globs).toEqual(['libs/*']);
  });

  it('prefers lerna.json over pnpm-workspace.yaml over package.json', async () => {
    await writePackage(root, 'r', { workspaces: ['pkg/*'] });
    await writeFile(join(root, 'pnpm-workspace.yaml'), 'packages:\n  - "pnpm/*"\n');
    await writeFile(join(root, 'lerna.json'), JSON.stringify({ packages: ['lerna/*'] }));
    expect(findWorkspacesRoot(root, { stopDir: tmpdir() })?.globs).toEqual(['lerna/*']);
  });

  it('returns null when no workspace manifest exists before stopDir', async () => {
    await writePackage(join(root, 'plain'), 'plain');
    expect(findWorkspacesRoot(join(root, 'plain'), { stopDir: root })).toBeNull();
  });

  it('memoizes results in the cache for nested lookups', async () => {
    await writeFile(join(root, 'pnpm-workspace.yaml'), 'packages:\n  - "packages/*"\n');
    const cache = createWorkspacesCache();
    const first = findWorkspacesRoot(root, { cache, stopDir: tmpdir() });
    await rm(join(root, 'pnpm-workspace.yaml'));
    const second = findWorkspacesRoot(join(root, 'packages', 'deep'), { cache, stopDir: tmpdir() });
    expect(second).toBe(first);
  });
});

describe('findWorkspaces', () => {
  it('lists packages matching the workspace globs with slash-normalized locations', async () => {
    await writeFile(join(root, 'pnpm-workspace.yaml'), 'packages:\n  - "packages/*"\n  - "apps/**"\n');
    await writePackage(join(root, 'packages', 'a'), 'pkg-a', { dependencies: { 'pkg-b': 'workspace:*' } });
    await writePackage(join(root, 'packages', 'b'), 'pkg-b', { exports: { '.': './index.js' } });
    await writePackage(join(root, 'apps', 'web', 'site'), 'site');
    await mkdir(join(root, 'packages', 'no-manifest'), { recursive: true });
    await writePackage(join(root, 'packages', 'a', 'node_modules', 'dep'), 'dep');

    const found = await findWorkspaces(join(root, 'packages', 'a'), { stopDir: tmpdir() });
    const byName = Object.fromEntries((found ?? []).map(w => [w.package.name, w]));

    expect(Object.keys(byName).sort()).toEqual(['pkg-a', 'pkg-b', 'site']);
    expect(byName['pkg-a']!.location).toBe(join(root, 'packages', 'a').split('\\').join('/'));
    expect(byName['pkg-a']!.package.dependencies).toEqual({ 'pkg-b': 'workspace:*' });
    expect(byName['pkg-b']!.package.exports).toEqual({ '.': './index.js' });
    expect(byName['pkg-a']!.location).not.toMatch(/\/$/);
  });

  it('skips directories whose package.json has no name', async () => {
    await writeFile(join(root, 'pnpm-workspace.yaml'), 'packages:\n  - "packages/*"\n');
    await mkdir(join(root, 'packages', 'anon'), { recursive: true });
    await writeFile(join(root, 'packages', 'anon', 'package.json'), JSON.stringify({ version: '1.0.0' }));
    await writePackage(join(root, 'packages', 'named'), 'named');

    const found = await findWorkspaces(root, { stopDir: tmpdir() });
    expect(found?.map(w => w.package.name)).toEqual(['named']);
  });

  it('returns null outside a workspace', async () => {
    await writePackage(join(root, 'plain'), 'plain');
    expect(await findWorkspaces(join(root, 'plain'), { stopDir: root })).toBeNull();
  });

  it('reuses the cached package list for the same root', async () => {
    await writeFile(join(root, 'pnpm-workspace.yaml'), 'packages:\n  - "packages/*"\n');
    await writePackage(join(root, 'packages', 'a'), 'a');
    const cache = createWorkspacesCache();

    const first = await findWorkspaces(root, { cache, stopDir: tmpdir() });
    await writePackage(join(root, 'packages', 'b'), 'b');
    const second = await findWorkspaces(root, { cache, stopDir: tmpdir() });

    expect(second).toBe(first);
    expect(second?.map(w => w.package.name)).toEqual(['a']);
  });

  it('honors negated globs', async () => {
    await writePackage(root, 'r', { workspaces: ['packages/*', '!packages/skip'] });
    await writePackage(join(root, 'packages', 'keep'), 'keep');
    await writePackage(join(root, 'packages', 'skip'), 'skip');

    const found = await findWorkspaces(root, { stopDir: tmpdir() });
    expect(found?.map(w => w.package.name)).toEqual(['keep']);
  });

  it('finds nested packages with a ** glob without listing the root itself', async () => {
    await writeFile(join(root, 'pnpm-workspace.yaml'), '');
    await writePackage(root, 'root');
    await writePackage(join(root, 'packages', 'a'), 'a');
    await writePackage(join(root, 'packages', 'a', 'nested'), 'nested');
    await writePackage(join(root, 'packages', 'a', 'node_modules', 'dep'), 'dep');

    const found = await findWorkspaces(root, { stopDir: tmpdir() });
    expect(found?.map(w => w.package.name).sort()).toEqual(['a', 'nested']);
  });

  it('lists the root package when the workspace globs include it', async () => {
    await writeFile(join(root, 'pnpm-workspace.yaml'), 'packages:\n  - "."\n  - "packages/*"\n');
    await writePackage(root, 'root', { dependencies: { '@scope/shared': 'workspace:*' } });
    await writePackage(join(root, 'packages', 'shared'), '@scope/shared');

    const found = await findWorkspaces(root, { stopDir: tmpdir() });
    expect(found?.map(w => w.package.name).sort()).toEqual(['@scope/shared', 'root']);
  });

  it('lists the root package when a brace glob contains the root alternative', async () => {
    await writePackage(root, 'root', { workspaces: ['{.,packages/*}'] });
    await writePackage(join(root, 'packages', 'shared'), '@scope/shared');

    const found = await findWorkspaces(root, { stopDir: tmpdir() });
    expect(found?.map(w => w.package.name).sort()).toEqual(['@scope/shared', 'root']);
  });

  it('finds a workspace package that is a symlink to a directory', async () => {
    await writePackage(root, 'r', { workspaces: ['packages/*'] });
    await writePackage(join(root, 'packages', 'a'), 'a');
    await writePackage(join(root, 'linked'), 'linked');
    await symlink(join('..', 'linked'), join(root, 'packages', 'link'), 'dir');

    const found = await findWorkspaces(root, { stopDir: tmpdir() });
    const byName = Object.fromEntries((found ?? []).map(w => [w.package.name, w]));
    expect(Object.keys(byName).sort()).toEqual(['a', 'linked']);
    expect(byName['linked']!.location).toBe(join(root, 'packages', 'link').split('\\').join('/'));
  });

  it('accepts ./-prefixed, trailing-slash and brace globs', async () => {
    await writePackage(root, 'r', { workspaces: ['./apps/*/', '{libs,tools}/*'] });
    await writePackage(join(root, 'apps', 'web'), 'web');
    await writePackage(join(root, 'libs', 'ui'), 'ui');
    await writePackage(join(root, 'tools', 'cli'), 'cli');
    await writePackage(join(root, 'other', 'x'), 'x');

    const found = await findWorkspaces(root, { stopDir: tmpdir() });
    expect(found?.map(w => w.package.name).sort()).toEqual(['cli', 'ui', 'web']);
  });
});
