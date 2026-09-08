import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import type { SourceDependencyConstraints } from './index';
import { Bundler, applySourceDependencyRange, getSourceDependencyConstraints, isRegistryVersionSpec } from './index';

const tempDirs: string[] = [];

class TestBundler extends Bundler {
  async bundle(): Promise<void> {}

  getEnvFiles(): Promise<string[]> {
    return Promise.resolve([]);
  }
}

const constraints = ({
  dependencies = {},
  pinned = [],
}: { dependencies?: Record<string, string>; pinned?: string[] } = {}): SourceDependencyConstraints => ({
  dependencies,
  pinnedByResolutionField: new Set(pinned),
});

/**
 * Lay out a source app the way `mastra build` sees one: an app manifest, an entry file two
 * directories below it, and optionally a workspace root manifest above and a stub manifest beside
 * the entry file.
 */
const createSourceApp = async ({
  appManifest,
  rootManifest,
  entryManifest,
  pnpmWorkspaceYaml,
}: {
  appManifest: Record<string, unknown>;
  rootManifest?: Record<string, unknown>;
  entryManifest?: Record<string, unknown>;
  pnpmWorkspaceYaml?: string;
}) => {
  const tempDir = await mkdtemp(join(tmpdir(), 'mastra-bundler-source-app-'));
  tempDirs.push(tempDir);

  const isMonorepo = !!rootManifest || !!pnpmWorkspaceYaml;
  const appDir = isMonorepo ? join(tempDir, 'apps', 'api') : tempDir;
  const entryDir = join(appDir, 'src', 'mastra');
  await mkdir(entryDir, { recursive: true });

  const mastraEntryFile = join(entryDir, 'index.ts');
  await writeFile(mastraEntryFile, 'export {}', 'utf-8');
  await writeFile(join(appDir, 'package.json'), JSON.stringify(appManifest), 'utf-8');

  if (rootManifest) {
    await writeFile(join(tempDir, 'package.json'), JSON.stringify(rootManifest), 'utf-8');
  }

  if (entryManifest) {
    await writeFile(join(entryDir, 'package.json'), JSON.stringify(entryManifest), 'utf-8');
  }

  if (pnpmWorkspaceYaml) {
    await writeFile(join(tempDir, 'pnpm-workspace.yaml'), pnpmWorkspaceYaml, 'utf-8');
  }

  return { projectRoot: appDir, mastraEntryFile, workspaceRoot: tempDir };
};

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map(dir => rm(dir, { recursive: true, force: true })));
});

describe('Bundler.writePackageJson', () => {
  it('writes npm alias and workspace tarball dependency specs using the package name as the key', async () => {
    const tempDir = await mkdtemp(join(tmpdir(), 'mastra-bundler-package-json-'));
    tempDirs.push(tempDir);

    const bundler = new TestBundler('Test');
    const workspaceResolutions = {
      '@inner/transitive-c': 'file:./workspace-module/inner-transitive-c-1.0.0.tgz',
    };

    await bundler.writePackageJson(
      tempDir,
      new Map([
        ['@ai-sdk/provider-utils-v7', { version: '5.0.0', packageSpec: 'npm:@ai-sdk/provider-utils@5.0.0' }],
        ['@inner/transitive-c', { version: '1.0.0', packageSpec: workspaceResolutions['@inner/transitive-c'] }],
        ['regular-package/subpath', { version: '1.2.3' }],
      ]),
      workspaceResolutions,
    );

    const pkg = JSON.parse(await readFile(join(tempDir, 'package.json'), 'utf-8'));
    expect(pkg.dependencies).toEqual({
      '@ai-sdk/provider-utils-v7': 'npm:@ai-sdk/provider-utils@5.0.0',
      '@inner/transitive-c': 'file:./workspace-module/inner-transitive-c-1.0.0.tgz',
      'regular-package': '1.2.3',
    });
    expect(pkg.resolutions).toEqual(workspaceResolutions);
    expect(pkg.pnpm).toBeUndefined();
  });

  it('writes an adopted source range under the package name for a subpath import', async () => {
    const tempDir = await mkdtemp(join(tmpdir(), 'mastra-bundler-package-json-'));
    tempDirs.push(tempDir);

    const bundler = new TestBundler('Test');
    await bundler.writePackageJson(
      tempDir,
      new Map([
        ['zod/v4', { version: '^4.3.6' }],
        ['@ai-sdk/openai-v5', { version: '5.0.93', packageSpec: 'npm:@ai-sdk/openai@^5.0.0' }],
      ]),
    );

    const pkg = JSON.parse(await readFile(join(tempDir, 'package.json'), 'utf-8'));
    expect(pkg.dependencies).toEqual({
      zod: '^4.3.6',
      '@ai-sdk/openai-v5': 'npm:@ai-sdk/openai@^5.0.0',
    });
    expect(pkg).not.toHaveProperty('overrides');
    expect(pkg).not.toHaveProperty('pnpm');
  });

  it('carries a declared range from the source manifest through to the written package.json', async () => {
    const { projectRoot, mastraEntryFile } = await createSourceApp({
      appManifest: { name: 'source-app', dependencies: { zod: '^4.3.6' } },
    });
    const outputDir = join(projectRoot, 'output');

    const sourceConstraints = await getSourceDependencyConstraints({ projectRoot, mastraEntryFile });
    const resolved = applySourceDependencyRange('zod/v4', { version: '3.25.76' }, sourceConstraints);

    const bundler = new TestBundler('Test');
    await bundler.writePackageJson(outputDir, new Map([['zod/v4', resolved]]));

    const pkg = JSON.parse(await readFile(join(outputDir, 'package.json'), 'utf-8'));
    expect(pkg.dependencies.zod).toBe('^4.3.6');
    expect(pkg.dependencies.zod).not.toBe('3.25.76');
  });
});

describe('isRegistryVersionSpec', () => {
  it.each([
    '4.3.6',
    '^4.3.6',
    '~4.3',
    '~1.2.3',
    '>=4.0.0 <5.0.0',
    '1.2.3 || 2.0.0',
    '1.2.3 - 2.3.4',
    '>=1.0.0-alpha.1 <2',
    '*',
    'x',
    '1.x',
    'latest',
    'next',
    'beta',
    'v1.2.3',
    '1.2.3-beta.1',
    '1.2.3+build.5',
  ])('accepts the registry specifier %j', spec => {
    expect(isRegistryVersionSpec(spec)).toBe(true);
  });

  it.each([
    'catalog:',
    'catalog:default',
    'workspace:*',
    'workspace:^',
    'file:../vendor/zod.tgz',
    'link:../zod',
    'git:git@github.com:colinhacks/zod.git',
    'git+ssh://git@github.com/colinhacks/zod.git',
    'git+https://github.com/colinhacks/zod.git',
    'github:colinhacks/zod#v4',
    'gitlab:org/repo',
    'bitbucket:org/repo',
    'http://example.com/zod.tgz',
    'https://example.com/zod.tgz',
    'portal:../zod',
    'patch:zod@3.25.76#./p.patch',
    'jsr:@scope/pkg',
  ])('rejects the protocol specifier %j', spec => {
    expect(isRegistryVersionSpec(spec)).toBe(false);
  });

  it.each(['org/repo', 'org/repo#v4', 'org/repo#semver:^1.0.0'])('rejects the git shorthand %j', spec => {
    expect(isRegistryVersionSpec(spec)).toBe(false);
  });

  it.each([
    '.',
    '..',
    './vendor/zod',
    '.vendor',
    '.1.2',
    '~/zod',
    '/opt/zod',
    '\\opt\\zod',
    'zod-4.3.6.tgz',
    'vendor.tar.gz',
    'vendor.tar',
    'npm:zod-4.3.6.tgz',
    '',
  ])('rejects the path or archive specifier %j', spec => {
    expect(isRegistryVersionSpec(spec)).toBe(false);
  });

  it.each(['npm:zod@^4.3.6', 'npm:@ai-sdk/openai@5.0.93', 'npm:zod'])('accepts the npm alias %j', spec => {
    expect(isRegistryVersionSpec(spec)).toBe(true);
  });

  it.each([
    'npm:zod@catalog:',
    'npm:@ai-sdk/openai@catalog:',
    'npm:zod@workspace:*',
    'npm:zod@file:../zod.tgz',
    'npm:file:../vendor/zod@1.0.0',
    'npm:catalog:zod@1.0.0',
    'npm:../vendor/zod@1.0.0',
  ])('rejects the npm alias %j whose target is not a registry package and range', spec => {
    expect(isRegistryVersionSpec(spec)).toBe(false);
  });
});

describe('applySourceDependencyRange', () => {
  it('prefers the declared range over the version resolved from node_modules', () => {
    expect(
      applySourceDependencyRange('zod/v4', { version: '3.25.76' }, constraints({ dependencies: { zod: '^4.3.6' } })),
    ).toEqual({ version: '^4.3.6' });
  });

  it.each([
    'catalog:',
    'catalog:default',
    'workspace:*',
    'file:../vendor/zod.tgz',
    'link:../zod',
    'github:colinhacks/zod#v4',
    'git+ssh://git@github.com/colinhacks/zod.git',
    'https://example.com/zod.tgz',
    'portal:../zod',
    'patch:zod@3.25.76#./p.patch',
  ])('keeps the resolved version when the declared specifier is %j', declared => {
    expect(
      applySourceDependencyRange('zod', { version: '3.25.76' }, constraints({ dependencies: { zod: declared } })),
    ).toEqual({ version: '3.25.76' });
  });

  it('adopts the declared npm alias spec for an aliased dependency', () => {
    const result = applySourceDependencyRange(
      '@ai-sdk/openai-v5',
      { version: '5.0.93', packageSpec: 'npm:@ai-sdk/openai@5.0.93' },
      constraints({ dependencies: { '@ai-sdk/openai-v5': 'npm:@ai-sdk/openai@^5.0.0' } }),
    );

    expect(result.packageSpec).toBe('npm:@ai-sdk/openai@^5.0.0');
  });

  it('never composes a non-registry specifier into an npm alias spec', () => {
    const result = applySourceDependencyRange(
      '@ai-sdk/openai-v5',
      { version: '5.0.93', packageSpec: 'npm:@ai-sdk/openai@5.0.93' },
      constraints({ dependencies: { '@ai-sdk/openai-v5': 'catalog:' } }),
    );

    expect(result.packageSpec).toBe('npm:@ai-sdk/openai@5.0.93');
    expect(result.packageSpec).not.toContain('catalog:');
  });

  it('leaves the analyzer result untouched when the manifest declares nothing for the dependency', () => {
    const dependencyInfo = { version: '3.25.76' };
    const result = applySourceDependencyRange('zod', dependencyInfo, constraints());

    expect(result).toEqual({ version: '3.25.76' });
    expect(dependencyInfo).toEqual({ version: '3.25.76' });
  });

  it('keeps the resolved version when a resolution field pins the package', () => {
    expect(
      applySourceDependencyRange(
        'zod',
        { version: '4.3.6' },
        constraints({ dependencies: { zod: '^3.0.0' }, pinned: ['zod'] }),
      ),
    ).toEqual({ version: '4.3.6' });
  });

  it('keeps the resolved version when a resolution field pins the package a subpath import resolves to', () => {
    expect(
      applySourceDependencyRange(
        'zod/v4',
        { version: '4.3.6' },
        constraints({ dependencies: { zod: '^3.0.0' }, pinned: ['zod'] }),
      ),
    ).toEqual({ version: '4.3.6' });
  });

  it.each(['stagehand>zod', 'stagehand@2>zod', 'zod/v4'])(
    'does not read the resolution key %j as a pin on the top-level dependency',
    key => {
      expect(
        applySourceDependencyRange(
          'zod',
          { version: '3.25.76' },
          constraints({ dependencies: { zod: '^4.3.6' }, pinned: [key] }),
        ),
      ).toEqual({ version: '^4.3.6' });
    },
  );

  it.each([
    '*',
    'x',
    'X',
    'latest',
    'next',
    '',
    '   ',
    '>=0',
    '>= 0.0.0',
    '* || 4',
    'npm:zod',
    'npm:@aws-sdk/client-s3',
  ])('keeps the resolved version when the declared specifier %j names no bounded version', declared => {
    expect(
      applySourceDependencyRange('zod', { version: '3.25.76' }, constraints({ dependencies: { zod: declared } })),
    ).toEqual({ version: '3.25.76' });
  });

  it('trims surrounding whitespace off an adopted range', () => {
    expect(
      applySourceDependencyRange('zod', { version: '3.25.76' }, constraints({ dependencies: { zod: '  ^4.3.6 ' } })),
    ).toEqual({ version: '^4.3.6' });
  });

  it('keeps the resolved alias when the declared value is a bare range for a differently named package', () => {
    const result = applySourceDependencyRange(
      'ai-v5',
      { version: '5.0.93', packageSpec: 'npm:ai@5.0.93' },
      constraints({ dependencies: { 'ai-v5': '^5.0.0' } }),
    );

    expect(result).toEqual({ version: '5.0.93', packageSpec: 'npm:ai@5.0.93' });
  });
});

describe('getSourceDependencyConstraints', () => {
  it('reads declared dependencies and pinned names from the project root manifest', async () => {
    const { projectRoot, mastraEntryFile } = await createSourceApp({
      appManifest: {
        name: 'source-app',
        dependencies: { zod: '^4.3.6', '@ai-sdk/openai-v5': 'npm:@ai-sdk/openai@^5.0.0' },
        overrides: { 'left-pad': '1.4.2' },
        resolutions: { chalk: '5.0.0' },
        pnpm: { overrides: { debug: '4.3.7' } },
      },
    });

    await expect(getSourceDependencyConstraints({ projectRoot, mastraEntryFile })).resolves.toEqual({
      dependencies: { zod: '^4.3.6', '@ai-sdk/openai-v5': 'npm:@ai-sdk/openai@^5.0.0' },
      pinnedByResolutionField: new Set(['left-pad', 'chalk', 'debug']),
    });
  });

  it('takes dependencies from the app package and pinned names from the workspace root too', async () => {
    const { projectRoot, mastraEntryFile, workspaceRoot } = await createSourceApp({
      rootManifest: { name: 'monorepo-root', pnpm: { overrides: { zod: '4.3.6' } } },
      appManifest: { name: 'source-app', dependencies: { zod: '^3.0.0' } },
    });

    await expect(getSourceDependencyConstraints({ projectRoot, mastraEntryFile, workspaceRoot })).resolves.toEqual({
      dependencies: { zod: '^3.0.0' },
      pinnedByResolutionField: new Set(['zod']),
    });
  });

  it('collects pinned names from the root pnpm-workspace.yaml, where current pnpm keeps them', async () => {
    const { projectRoot, mastraEntryFile, workspaceRoot } = await createSourceApp({
      appManifest: { name: 'source-app', dependencies: { zod: '^3.0.0' } },
      pnpmWorkspaceYaml: [
        'packages:',
        '  - apps/*',
        'overrides:',
        '  zod: 4.3.6',
        "  'left-pad': 1.4.2",
        '  "@scope/pkg": 2.0.0',
        'onlyBuiltDependencies:',
        '  - esbuild',
        '',
      ].join('\n'),
    });

    await expect(getSourceDependencyConstraints({ projectRoot, mastraEntryFile, workspaceRoot })).resolves.toEqual({
      dependencies: { zod: '^3.0.0' },
      pinnedByResolutionField: new Set(['zod', 'left-pad', '@scope/pkg']),
    });
  });

  it('does not cross a package boundary when the nearest manifest declares no dependencies', async () => {
    const { projectRoot, mastraEntryFile, workspaceRoot } = await createSourceApp({
      rootManifest: { name: 'monorepo-root', dependencies: { react: '17 || 19' } },
      appManifest: { name: 'source-app' },
    });

    await expect(getSourceDependencyConstraints({ projectRoot, mastraEntryFile, workspaceRoot })).resolves.toEqual({
      dependencies: {},
      pinnedByResolutionField: new Set(),
    });
  });

  it('ignores a manifest sitting beside the entry file', async () => {
    const { projectRoot, mastraEntryFile } = await createSourceApp({
      appManifest: { name: 'source-app', dependencies: { zod: '^4.3.6' } },
      entryManifest: { type: 'module', dependencies: { zod: '^3.0.0' } },
    });

    await expect(getSourceDependencyConstraints({ projectRoot, mastraEntryFile })).resolves.toEqual({
      dependencies: { zod: '^4.3.6' },
      pinnedByResolutionField: new Set(),
    });
  });

  it('drops non-string dependency values instead of passing them through', async () => {
    const { projectRoot, mastraEntryFile } = await createSourceApp({
      appManifest: { name: 'source-app', dependencies: { zod: '^4.3.6', bad: { nested: true } } },
    });

    await expect(getSourceDependencyConstraints({ projectRoot, mastraEntryFile })).resolves.toEqual({
      dependencies: { zod: '^4.3.6' },
      pinnedByResolutionField: new Set(),
    });
  });

  it('returns nothing when the nearest manifest declares no constraints', async () => {
    const { projectRoot, mastraEntryFile } = await createSourceApp({ appManifest: { name: 'source-app' } });

    await expect(getSourceDependencyConstraints({ projectRoot, mastraEntryFile })).resolves.toEqual({
      dependencies: {},
      pinnedByResolutionField: new Set(),
    });
  });
});
