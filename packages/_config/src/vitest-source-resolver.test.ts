import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  createWorkspacePackageIndex,
  resolveWorkspaceSource,
  workspaceSourceResolver,
} from './vitest-source-resolver.js';

function makeWorkspace() {
  const root = mkdtempSync(join(tmpdir(), 'vitest-source-resolver-'));
  writeFileSync(
    join(root, 'pnpm-workspace.yaml'),
    `packages:\n  - packages/*\n  - tools/*\n  - e2e-tests/workspace-compat\n`,
  );
  return root;
}

function writePackage(root: string, dir: string, manifest: Record<string, any>, files: string[] = []) {
  const packageDir = join(root, dir);
  mkdirSync(packageDir, { recursive: true });
  writeFileSync(join(packageDir, 'package.json'), JSON.stringify(manifest, null, 2));

  for (const file of files) {
    const path = join(packageDir, file);
    mkdirSync(join(path, '..'), { recursive: true });
    writeFileSync(path, 'export {};\n');
  }

  return packageDir;
}

function resolveId(plugin: ReturnType<typeof workspaceSourceResolver>, id: string, importer?: string) {
  const hook = plugin.resolveId;
  if (!hook) return Promise.resolve(null);
  const handler = typeof hook === 'function' ? hook : hook.handler;
  return handler.call(
    {
      resolve: (resolvedId: string) => Promise.resolve({ id: resolvedId }),
    } as any,
    id,
    importer,
    {} as any,
  );
}

describe('workspace source resolver', () => {
  it('resolves exact root and subpath exports to source files', () => {
    const root = makeWorkspace();
    const packageDir = writePackage(
      root,
      'packages/core',
      {
        name: '@mastra/core',
        exports: {
          '.': { import: { types: './dist/index.d.ts', default: './dist/index.js' } },
          './agent': { import: { types: './dist/agent/index.d.ts', default: './dist/agent/index.js' } },
        },
      },
      ['src/index.ts', 'src/agent/index.ts'],
    );

    const packages = createWorkspacePackageIndex(root);

    expect(resolveWorkspaceSource('@mastra/core', packages, undefined)).toEqual({
      path: join(packageDir, 'src/index.ts'),
      query: '',
    });
    expect(resolveWorkspaceSource('@mastra/core/agent?raw', packages, undefined)).toEqual({
      path: join(packageDir, 'src/agent/index.ts'),
      query: '?raw',
    });
  });

  it('resolves TSX, JS, and directory index source variants', () => {
    const root = makeWorkspace();
    const packageDir = writePackage(
      root,
      'packages/variants',
      {
        name: '@mastra/variants',
        exports: {
          './component': './dist/component.js',
          './plain': './dist/plain.js',
          './folder': './dist/folder.js',
          './nested': './dist/nested/index.js',
        },
      },
      ['src/component.tsx', 'src/plain.js', 'src/folder/index.js', 'src/nested/index.tsx'],
    );

    const packages = createWorkspacePackageIndex(root);

    expect(resolveWorkspaceSource('@mastra/variants/component', packages, undefined)?.path).toBe(
      join(packageDir, 'src/component.tsx'),
    );
    expect(resolveWorkspaceSource('@mastra/variants/plain', packages, undefined)?.path).toBe(
      join(packageDir, 'src/plain.js'),
    );
    expect(resolveWorkspaceSource('@mastra/variants/folder', packages, undefined)?.path).toBe(
      join(packageDir, 'src/folder/index.js'),
    );
    expect(resolveWorkspaceSource('@mastra/variants/nested', packages, undefined)?.path).toBe(
      join(packageDir, 'src/nested/index.tsx'),
    );
  });

  it('uses exports as an allowlist and ignores non-workspace imports', () => {
    const root = makeWorkspace();
    writePackage(
      root,
      'packages/core',
      {
        name: '@mastra/core',
        exports: {
          '.': { import: { default: './dist/index.js' } },
        },
      },
      ['src/index.ts', 'src/secret.ts'],
    );

    const packages = createWorkspacePackageIndex(root);

    expect(resolveWorkspaceSource('@mastra/core/secret', packages, undefined)).toBeNull();
    expect(resolveWorkspaceSource('@other/pkg', packages, undefined)).toBeNull();
    expect(resolveWorkspaceSource('./local', packages, undefined)).toBeNull();
  });

  it('ignores relative, absolute, URL, virtual, node builtin, node_modules, and external ids in the plugin', async () => {
    const root = makeWorkspace();
    writePackage(root, 'packages/core', { name: '@mastra/core', exports: { '.': './dist/index.js' } }, [
      'src/index.ts',
    ]);

    const plugin = workspaceSourceResolver({ root, disabled: false });
    const ids = [
      './local',
      '/absolute/path.js',
      'file:///absolute/path.js',
      'https://example.com/mod.js',
      'node:fs',
      '\0virtual:module',
      '/workspace/node_modules/@mastra/core/dist/index.js',
      'react',
    ];

    for (const id of ids) {
      await expect(resolveId(plugin, id)).resolves.toBeNull();
    }
  });

  it('resolves wildcard exports for scoped and unscoped packages', () => {
    const root = makeWorkspace();
    const sdkDir = writePackage(
      root,
      'tools/sdk',
      {
        name: 'mastracode',
        exports: {
          './*': { import: { types: './dist/*.d.ts', default: './dist/*.js' } },
        },
      },
      ['src/client.ts'],
    );
    const uiDir = writePackage(
      root,
      'packages/playground-ui',
      {
        name: '@mastra/playground-ui',
        exports: {
          './utils/*': { import: { types: './dist/utils/*.d.ts', default: './dist/utils/*.es.js' } },
        },
      },
      ['src/utils/cn.ts'],
    );

    const packages = createWorkspacePackageIndex(root);

    expect(resolveWorkspaceSource('mastracode/client', packages, undefined)?.path).toBe(join(sdkDir, 'src/client.ts'));
    expect(resolveWorkspaceSource('@mastra/playground-ui/utils/cn', packages, undefined)?.path).toBe(
      join(uiDir, 'src/utils/cn.ts'),
    );
  });

  it('falls back for CSS/build-only exports even when a colliding source file exists', () => {
    const root = makeWorkspace();
    writePackage(
      root,
      'packages/ui',
      {
        name: '@mastra/ui',
        exports: {
          './style.css': './dist/style.css',
          './asset.css': './dist/asset.css',
        },
      },
      ['src/style.ts', 'src/asset.css.ts'],
    );

    const packages = createWorkspacePackageIndex(root);

    expect(resolveWorkspaceSource('@mastra/ui/style.css', packages, undefined)).toBeNull();
    expect(resolveWorkspaceSource('@mastra/ui/asset.css', packages, undefined)).toBeNull();
  });

  it('falls back for missing source equivalents', () => {
    const root = makeWorkspace();
    writePackage(
      root,
      'packages/ui',
      {
        name: '@mastra/ui',
        exports: {
          './missing': { import: { default: './dist/missing.js' } },
        },
      },
      ['src/index.ts'],
    );

    const packages = createWorkspacePackageIndex(root);

    expect(resolveWorkspaceSource('@mastra/ui/missing', packages, undefined)).toBeNull();
  });

  it('uses import/default conditions and ignores require-only exports', () => {
    const root = makeWorkspace();
    const packageDir = writePackage(
      root,
      'packages/conditional',
      {
        name: '@mastra/conditional',
        exports: {
          './imported': {
            import: { types: './dist/imported.d.ts', default: './dist/imported.js' },
            require: { default: './dist/imported.cjs' },
          },
          './defaulted': {
            default: './dist/defaulted.js',
          },
          './require-only': {
            require: './dist/require-only.cjs',
          },
        },
      },
      ['src/imported.ts', 'src/defaulted.ts', 'src/require-only.ts'],
    );

    const packages = createWorkspacePackageIndex(root);

    expect(resolveWorkspaceSource('@mastra/conditional/imported', packages, undefined)?.path).toBe(
      join(packageDir, 'src/imported.ts'),
    );
    expect(resolveWorkspaceSource('@mastra/conditional/defaulted', packages, undefined)?.path).toBe(
      join(packageDir, 'src/defaulted.ts'),
    );
    expect(resolveWorkspaceSource('@mastra/conditional/require-only', packages, undefined)).toBeNull();
  });

  it('preserves query and hash suffixes', async () => {
    const root = makeWorkspace();
    const packageDir = writePackage(
      root,
      'packages/core',
      {
        name: '@mastra/core',
        exports: {
          './agent': './dist/agent/index.js',
        },
      },
      ['src/agent/index.ts'],
    );

    const packages = createWorkspacePackageIndex(root);
    const expectedId = `${join(packageDir, 'src/agent/index.ts')}?raw#named`;

    expect(resolveWorkspaceSource('@mastra/core/agent?raw#named', packages, undefined)).toEqual({
      path: join(packageDir, 'src/agent/index.ts'),
      query: '?raw#named',
    });
    await expect(
      resolveId(workspaceSourceResolver({ root, disabled: false }), '@mastra/core/agent?raw#named'),
    ).resolves.toEqual({
      id: expectedId,
    });
  });

  it('avoids recursive self-resolution', async () => {
    const root = makeWorkspace();
    const packageDir = writePackage(
      root,
      'packages/core',
      {
        name: '@mastra/core',
        exports: {
          '.': './dist/index.js',
        },
      },
      ['src/index.ts'],
    );

    const packages = createWorkspacePackageIndex(root);
    const sourcePath = join(packageDir, 'src/index.ts');

    expect(resolveWorkspaceSource('@mastra/core', packages, sourcePath)).toBeNull();
    await expect(
      resolveId(workspaceSourceResolver({ root, disabled: false }), '@mastra/core', sourcePath),
    ).resolves.toBeNull();
  });

  it('excludes e2e-tests workspaces', () => {
    const root = makeWorkspace();
    writePackage(
      root,
      'e2e-tests/workspace-compat',
      {
        name: '@mastra/e2e-fixture',
        exports: { '.': './dist/index.js' },
      },
      ['src/index.ts'],
    );

    const packages = createWorkspacePackageIndex(root);

    expect(packages.has('@mastra/e2e-fixture')).toBe(false);
  });

  it('creates a disabled plugin in CI mode by default', async () => {
    const root = makeWorkspace();
    writePackage(root, 'packages/core', { name: '@mastra/core', exports: { '.': './dist/index.js' } }, [
      'src/index.ts',
    ]);

    const previousCi = process.env.CI;
    process.env.CI = 'true';
    try {
      await expect(resolveId(workspaceSourceResolver({ root }), '@mastra/core')).resolves.toBeNull();
    } finally {
      if (previousCi === undefined) {
        delete process.env.CI;
      } else {
        process.env.CI = previousCi;
      }
    }
  });

  it('can be disabled explicitly outside CI', async () => {
    const root = makeWorkspace();
    writePackage(root, 'packages/core', { name: '@mastra/core', exports: { '.': './dist/index.js' } }, [
      'src/index.ts',
    ]);

    await expect(resolveId(workspaceSourceResolver({ root, disabled: true }), '@mastra/core')).resolves.toBeNull();
  });
});
