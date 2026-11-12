// Ported from find-workspaces@0.3.1 tests/findRoot.test.ts and tests/findWorkspaces.test.ts,
// against the upstream fixtures in ./__fixtures__. Results are sorted by location
// because package order is not part of the contract and differs between glob engines.
import { posix, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import type { Workspace } from './index';
import { createWorkspacesCache, findWorkspaces, findWorkspacesRoot } from './index';

const fixturesDir = fileURLToPath(new URL('./__fixtures__', import.meta.url));
const fixture = (path: string) => resolve(fixturesDir, path);
const posixFixture = (path: string) => fixture(path).split(sep).join(posix.sep);
const stopDir = resolve(fixturesDir, '..');

const workspace = (path: string, name: string): Workspace => ({
  location: posixFixture(path),
  package: { name, private: true },
});

async function find(path: string, options: Parameters<typeof findWorkspaces>[1] = { stopDir }) {
  const found = await findWorkspaces(fixture(path), options);
  return found && [...found].sort((a, b) => a.location.localeCompare(b.location));
}

describe('findWorkspacesRoot (upstream)', () => {
  it.each([
    ['yarn-npm/foo/bar', 'yarn-npm', ['packages/*']],
    ['yarn-npm-with-packages', 'yarn-npm-with-packages', ['packages/*']],
    ['lerna', 'lerna', ['packages/*']],
    ['lerna-with-packages', 'lerna-with-packages', ['packages/*']],
    ['bolt', 'bolt', ['packages/**/*']],
  ])('returns the root for %s', (from, root, globs) => {
    expect(findWorkspacesRoot(fixture(from), { stopDir })).toEqual({ location: posixFixture(root), globs });
  });

  it.each(['lerna-with-invalid-packages', 'lerna-with-invalid-workspaces'])('returns null for %s', name => {
    expect(findWorkspacesRoot(fixture(name), { stopDir })).toBeNull();
  });

  it('stops searching at stop dir', () => {
    expect(findWorkspacesRoot(fixture('yarn-npm/foo/bar'), { stopDir: fixture('yarn-npm') })).toBeNull();
  });

  it('fills and clears the cache', () => {
    const cache = createWorkspacesCache();
    const options = { cache, stopDir };
    const bolt = { location: posixFixture('bolt'), globs: ['packages/**/*'] };

    expect(findWorkspacesRoot(fixture('bolt'), options)).toEqual(bolt);
    expect(findWorkspacesRoot(fixture('bolt'), options)).toEqual(bolt);
    expect(findWorkspacesRoot(fixture('lerna-with-invalid-packages'), options)).toBeNull();
    expect(findWorkspacesRoot(fixture('lerna-with-invalid-packages'), options)).toBeNull();

    expect(cache.root).toEqual(
      new Map([
        [fixture('bolt'), bolt],
        [fixturesDir, null],
      ]),
    );
    expect(cache.workspaces).toEqual(new Map());

    cache.clear();
    expect(cache.root).toEqual(new Map());
    expect(cache.workspaces).toEqual(new Map());
  });

  it('returns the root from the cache', () => {
    const cache = createWorkspacesCache();
    const root = { location: posixFixture('bolt'), globs: ['packages/**/*'] };
    cache.root.set(fixture('bolt'), root);

    expect(findWorkspacesRoot(fixture('bolt/foo'), { cache, stopDir })).toBe(root);
    expect(findWorkspacesRoot(fixture('bolt'), { cache, stopDir })).toBe(root);
  });
});

describe('findWorkspaces (upstream)', () => {
  it('returns workspaces for yarn/npm', async () => {
    expect(await find('yarn-npm/foo/bar')).toEqual([
      workspace('yarn-npm/packages/a', '@yarn-npm/a'),
      workspace('yarn-npm/packages/b', '@yarn-npm/b'),
    ]);
  });

  it('returns workspaces for yarn/npm with packages, skipping a package without a name', async () => {
    expect(await find('yarn-npm-with-packages')).toEqual([
      workspace('yarn-npm-with-packages/packages/a', '@yarn-npm-with-packages/a'),
      workspace('yarn-npm-with-packages/packages/b', '@yarn-npm-with-packages/b'),
    ]);
  });

  it('returns workspaces for pnpm, honoring negated globs', async () => {
    expect(await find('pnpm')).toEqual([
      workspace('pnpm/components/a', '@pnpm/component-a'),
      workspace('pnpm/components/b', '@pnpm/component-b'),
      workspace('pnpm/components/nested/component', '@pnpm/nested-component'),
      workspace('pnpm/packages/a', '@pnpm/a'),
      workspace('pnpm/packages/b', '@pnpm/b'),
    ]);
  });

  it('returns workspaces for pnpm with defaults', async () => {
    expect(await find('pnpm-with-defaults')).toEqual([
      workspace('pnpm-with-defaults/components/a', '@pnpm/component-a'),
      workspace('pnpm-with-defaults/components/b', '@pnpm/component-b'),
      workspace('pnpm-with-defaults/packages/a', '@pnpm/a'),
      workspace('pnpm-with-defaults/packages/b', '@pnpm/b'),
    ]);
  });

  it('returns workspaces for lerna', async () => {
    expect(await find('lerna')).toEqual([
      workspace('lerna/packages/a', '@lerna/a'),
      workspace('lerna/packages/b', '@lerna/b'),
    ]);
  });

  it('returns workspaces for lerna with packages', async () => {
    expect(await find('lerna-with-packages')).toEqual([
      workspace('lerna-with-packages/packages/a', '@lerna-with-packages/a'),
      workspace('lerna-with-packages/packages/b', '@lerna-with-packages/b'),
    ]);
  });

  it('returns workspaces for bolt without packages inside node_modules', async () => {
    expect(await find('bolt')).toEqual([
      workspace('bolt/packages/a', '@bolt/a'),
      workspace('bolt/packages/b', '@bolt/b'),
    ]);
  });

  it.each([
    'yarn-npm-with-invalid-package-json',
    'yarn-npm-with-invalid-workspaces',
    'lerna-with-invalid-packages',
    'lerna-with-invalid-workspaces',
    'lerna-with-invalid-lerna-json',
  ])('returns null for %s', async name => {
    expect(await find(name)).toBeNull();
  });

  it('fills and clears the cache', async () => {
    const cache = createWorkspacesCache();
    const options = { cache, stopDir };
    const lerna = [workspace('lerna/packages/a', '@lerna/a'), workspace('lerna/packages/b', '@lerna/b')];
    const lernaWithPackages = [
      workspace('lerna-with-packages/packages/a', '@lerna-with-packages/a'),
      workspace('lerna-with-packages/packages/b', '@lerna-with-packages/b'),
    ];

    expect(await find('lerna', options)).toEqual(lerna);
    expect(await find('lerna-with-packages/foo', options)).toEqual(lernaWithPackages);
    expect(await find('lerna-with-packages/bar', options)).toEqual(lernaWithPackages);

    expect(cache.root).toEqual(
      new Map([
        [fixture('lerna'), { location: posixFixture('lerna'), globs: ['packages/*'] }],
        [fixture('lerna-with-packages'), { location: posixFixture('lerna-with-packages'), globs: ['packages/*'] }],
      ]),
    );
    expect([...cache.workspaces.keys()].sort()).toEqual([posixFixture('lerna'), posixFixture('lerna-with-packages')]);

    cache.clear();
    expect(cache.root).toEqual(new Map());
    expect(cache.workspaces).toEqual(new Map());
  });
});
