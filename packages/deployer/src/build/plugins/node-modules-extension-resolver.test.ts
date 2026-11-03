import { mkdir, mkdtemp, realpath, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import type { Plugin } from 'rolldown';
import { rolldown } from 'rolldown';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { WorkspacePackageInfo } from '../../bundler/workspaceDependencies';
import { nodeModulesExternals } from './node-modules-extension-resolver';

const tempDirs: string[] = [];

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map(dir => rm(dir, { recursive: true, force: true })));
});

async function createFixture(files: Record<string, string>) {
  // Rolldown reports realpath'd importers (macOS tmpdir is a symlink to /private/var).
  const root = await realpath(await mkdtemp(join(tmpdir(), 'mastra-node-modules-externals-')));
  tempDirs.push(root);
  await Promise.all(
    Object.entries(files).map(async ([path, content]) => {
      const file = join(root, path);
      await mkdir(dirname(file), { recursive: true });
      await writeFile(file, content);
    }),
  );
  return root;
}

const pkg = (json: Record<string, unknown>) => JSON.stringify(json);

async function build(
  root: string,
  {
    workspaceMap = new Map<string, WorkspacePackageInfo>(),
    onWorkspaceImport,
    plugins = [],
  }: {
    workspaceMap?: Map<string, WorkspacePackageInfo>;
    onWorkspaceImport?: (id: string, importer: string) => void;
    plugins?: Plugin[];
  } = {},
) {
  const bundle = await rolldown({
    input: join(root, 'src/entry.mjs'),
    platform: 'node',
    logLevel: 'silent',
    plugins: [nodeModulesExternals({ platform: 'node', workspaceMap, onWorkspaceImport }), ...plugins],
  });

  try {
    const { output } = await bundle.generate({ format: 'esm' });
    return output[0];
  } finally {
    await bundle.close();
  }
}

describe('nodeModulesExternals', () => {
  it('adds the file extension to subpath imports of packages without exports', async () => {
    const root = await createFixture({
      'src/entry.mjs': `
        import get from 'nox/fp/get';
        import withExt from 'nox/fp/get.js';
        import dir from 'nox/dir';
        import sibling from 'nox/lib/sibling';
        export { get, withExt, dir, sibling };
      `,
      'node_modules/nox/package.json': pkg({ name: 'nox', main: 'index.js' }),
      'node_modules/nox/fp/get.js': `module.exports = 1;`,
      'node_modules/nox/dir/index.js': `module.exports = 1;`,
      'node_modules/nox/lib/sibling.ts': `export default 1;`,
      'node_modules/nox/lib/sibling.js': `module.exports = 1;`,
    });

    const chunk = await build(root);

    expect(chunk.imports.sort()).toEqual(['nox/dir/index.js', 'nox/fp/get.js', 'nox/lib/sibling.js']);
  });

  it('keeps subpath specifiers of packages with exports', async () => {
    const root = await createFixture({
      'src/entry.mjs': `import sub from 'exp/sub'; export { sub };`,
      'node_modules/exp/package.json': pkg({ name: 'exp', exports: { './sub': './dist/sub.js' } }),
      'node_modules/exp/dist/sub.js': `export default 1;`,
    });

    const chunk = await build(root);

    expect(chunk.imports).toEqual(['exp/sub']);
  });

  it('externalizes root imports, builtins and unresolvable specifiers without bundling them', async () => {
    const root = await createFixture({
      'src/entry.mjs': `
        import hono from 'hono';
        import fs from 'node:fs';
        import path from 'path';
        import missing from 'missing-pkg/sub';
        export { hono, fs, path, missing };
      `,
      'node_modules/hono/package.json': pkg({ name: 'hono', main: 'index.js' }),
      'node_modules/hono/index.js': `export default 'bundled-hono';`,
    });

    const chunk = await build(root);

    expect(chunk.imports.sort()).toEqual(['hono', 'missing-pkg/sub', 'node:fs', 'path']);
    expect(chunk.code).not.toContain('bundled-hono');
  });

  it('computes the path from the package root when a nested package.json is closer', async () => {
    const root = await createFixture({
      'src/entry.mjs': `import x from 'nox/esm/x'; export { x };`,
      'node_modules/nox/package.json': pkg({ name: 'nox' }),
      'node_modules/nox/esm/package.json': pkg({ type: 'module' }),
      'node_modules/nox/esm/x.js': `export default 1;`,
    });

    const chunk = await build(root);

    expect(chunk.imports).toEqual(['nox/esm/x.js']);
  });

  it('handles scoped packages', async () => {
    const root = await createFixture({
      'src/entry.mjs': `
        import utils from '@my/nox/utils';
        import sub from '@my/exp/sub';
        export { utils, sub };
      `,
      'node_modules/@my/nox/package.json': pkg({ name: '@my/nox' }),
      'node_modules/@my/nox/utils.js': `module.exports = 1;`,
      'node_modules/@my/exp/package.json': pkg({ name: '@my/exp', exports: { './sub': './sub.js' } }),
      'node_modules/@my/exp/sub.js': `export default 1;`,
    });

    const chunk = await build(root);

    expect(chunk.imports.sort()).toEqual(['@my/exp/sub', '@my/nox/utils.js']);
  });

  it('externalizes workspace imports and reports them', async () => {
    const root = await createFixture({
      'src/entry.mjs': `
        import ws from '@ws/pkg';
        import sub from '@ws/pkg/sub';
        export { ws, sub };
      `,
      'packages/pkg/package.json': pkg({ name: '@ws/pkg', main: 'index.js' }),
    });
    const workspaceMap = new Map<string, WorkspacePackageInfo>([
      ['@ws/pkg', { location: join(root, 'packages/pkg'), dependencies: {}, version: '1.0.0' }],
    ]);
    const onWorkspaceImport = vi.fn();

    const chunk = await build(root, { workspaceMap, onWorkspaceImport });

    expect(chunk.imports.sort()).toEqual(['@ws/pkg', '@ws/pkg/sub']);
    const entry = join(root, 'src/entry.mjs');
    expect(onWorkspaceImport.mock.calls.sort()).toEqual([
      ['@ws/pkg', entry],
      ['@ws/pkg/sub', entry],
    ]);
  });

  it('runs after plugins that resolve bare imports themselves', async () => {
    const root = await createFixture({
      'src/entry.mjs': `import local from 'nox/aliased'; export { local };`,
      'src/aliased.mjs': `export default 'aliased-value';`,
    });
    const alias: Plugin = {
      name: 'test-alias',
      resolveId(id) {
        return id === 'nox/aliased' ? join(root, 'src/aliased.mjs') : null;
      },
    };

    const chunk = await build(root, { plugins: [alias] });

    expect(chunk.imports).toEqual([]);
    expect(chunk.code).toContain('aliased-value');
  });
});
