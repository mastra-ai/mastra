import { mkdir, mkdtemp, rm, symlink, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { noopLogger } from '@mastra/core/logger';
import { afterEach, describe, expect, it } from 'vitest';
import { analyzeBundle } from './analyze';
import { slash } from './utils';

const tempDirs: string[] = [];
const packageRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const tempRoot = join(packageRoot, '.tmp');

afterEach(async () => {
  await Promise.all(
    tempDirs.splice(0).map(dir =>
      rm(dir, {
        recursive: true,
        force: true,
      }),
    ),
  );
});

describe('workspace path normalization (issue #13022)', () => {
  it('should normalize backslashes so startsWith matches rollup imports', () => {
    const rollupImport = 'apps/@agents/devstudio/.mastra/.build/chunk-ILQXPZCD.mjs';
    const windowsPath = 'apps\\@agents\\devstudio';

    expect(rollupImport.startsWith(windowsPath)).toBe(false);
    expect(rollupImport.startsWith(slash(windowsPath))).toBe(true);
  });
});

describe('external dependency versions', () => {
  it('resolves an external dependency version from the bundled workspace importer', async () => {
    await mkdir(tempRoot, { recursive: true });
    const tempDir = await mkdtemp(join(tempRoot, 'mastra-importer-version-'));
    tempDirs.push(tempDir);

    const appDir = join(tempDir, 'apps', 'app');
    const workspacePackageDir = join(tempDir, 'packages', 'workspace-package');
    const externalPackageDir = join(workspacePackageDir, 'node_modules', 'external-only-from-workspace');
    const entryFile = join(appDir, 'index.ts');
    const outputDir = join(appDir, '.mastra', '.build');

    await mkdir(outputDir, { recursive: true });
    await mkdir(join(appDir, 'node_modules', '@internal'), { recursive: true });
    await mkdir(externalPackageDir, { recursive: true });
    await mkdir(join(workspacePackageDir, 'src'), { recursive: true });
    await writeFile(join(tempDir, 'package.json'), JSON.stringify({ name: 'test-workspace', version: '1.0.0' }));
    await writeFile(join(tempDir, 'pnpm-workspace.yaml'), `packages:\n  - apps/*\n  - packages/*\n`);
    await writeFile(join(appDir, 'package.json'), JSON.stringify({ name: 'app', version: '1.0.0', type: 'module' }));
    await writeFile(
      join(workspacePackageDir, 'package.json'),
      JSON.stringify({
        name: '@internal/workspace-package',
        version: '1.0.0',
        type: 'module',
        main: './src/index.js',
        dependencies: {
          'external-only-from-workspace': '4.5.6',
        },
      }),
    );
    await writeFile(
      join(externalPackageDir, 'package.json'),
      JSON.stringify({ name: 'external-only-from-workspace', version: '4.5.6', type: 'module', main: './index.js' }),
    );
    await writeFile(join(externalPackageDir, 'index.js'), `export const externalValue = 'external';`);
    await writeFile(
      join(workspacePackageDir, 'src', 'index.js'),
      `import { externalValue } from 'external-only-from-workspace';\nexport const workspaceValue = externalValue;`,
    );
    await symlink(workspacePackageDir, join(appDir, 'node_modules', '@internal', 'workspace-package'));
    await writeFile(
      entryFile,
      `import { workspaceValue } from '@internal/workspace-package';\nexport const value = workspaceValue;`,
    );

    const originalCwd = process.cwd();
    process.chdir(tempDir);
    try {
      const result = await analyzeBundle(
        [entryFile],
        entryFile,
        {
          outputDir,
          projectRoot: appDir,
          platform: 'node',
          isDev: true,
          bundlerOptions: {
            externals: ['external-only-from-workspace'],
            enableSourcemap: false,
          },
        },
        noopLogger,
      );

      expect(result.externalDependencies.get('external-only-from-workspace')).toEqual({
        version: '4.5.6',
        packageSpec: undefined,
      });
    } finally {
      process.chdir(originalCwd);
    }
  }, 15000);

  it('resolves an external dependency version from a dynamic import in a bundled workspace package', async () => {
    await mkdir(tempRoot, { recursive: true });
    const tempDir = await mkdtemp(join(tempRoot, 'mastra-dynamic-importer-version-'));
    tempDirs.push(tempDir);

    const appDir = join(tempDir, 'apps', 'app');
    const workspacePackageDir = join(tempDir, 'packages', 'workspace-package');
    const externalPackageDir = join(workspacePackageDir, 'node_modules', 'typescript');
    const entryFile = join(appDir, 'index.ts');
    const outputDir = join(appDir, '.mastra', '.build');

    await mkdir(outputDir, { recursive: true });
    await mkdir(join(appDir, 'node_modules', '@internal'), { recursive: true });
    await mkdir(externalPackageDir, { recursive: true });
    await mkdir(join(workspacePackageDir, 'src'), { recursive: true });
    await writeFile(join(tempDir, 'package.json'), JSON.stringify({ name: 'test-workspace', version: '1.0.0' }));
    await writeFile(join(tempDir, 'pnpm-workspace.yaml'), `packages:\n  - apps/*\n  - packages/*\n`);
    await writeFile(join(appDir, 'package.json'), JSON.stringify({ name: 'app', version: '1.0.0', type: 'module' }));
    await writeFile(
      join(workspacePackageDir, 'package.json'),
      JSON.stringify({
        name: '@internal/workspace-package',
        version: '1.0.0',
        type: 'module',
        main: './src/index.js',
        dependencies: {
          typescript: '5.9.3',
        },
      }),
    );
    await writeFile(
      join(externalPackageDir, 'package.json'),
      JSON.stringify({ name: 'typescript', version: '5.9.3', type: 'module', main: './index.js' }),
    );
    await writeFile(join(externalPackageDir, 'index.js'), `export const version = '5.9.3';`);
    await writeFile(
      join(workspacePackageDir, 'src', 'index.js'),
      `export async function loadTypescript() { return import('typescript'); }`,
    );
    await symlink(workspacePackageDir, join(appDir, 'node_modules', '@internal', 'workspace-package'));
    await writeFile(
      entryFile,
      `import { loadTypescript } from '@internal/workspace-package';\nexport const value = loadTypescript;`,
    );

    const originalCwd = process.cwd();
    process.chdir(tempDir);
    try {
      const result = await analyzeBundle(
        [entryFile],
        entryFile,
        {
          outputDir,
          projectRoot: appDir,
          platform: 'node',
          isDev: true,
          bundlerOptions: {
            externals: ['typescript'],
            enableSourcemap: false,
          },
        },
        noopLogger,
      );

      expect(result.externalDependencies.get('typescript')).toEqual({
        version: '5.9.3',
        packageSpec: undefined,
      });
    } finally {
      process.chdir(originalCwd);
    }
  }, 15000);

  it('does not externalize transitive workspace dependencies in production builds', async () => {
    await mkdir(tempRoot, { recursive: true });
    const tempDir = await mkdtemp(join(tempRoot, 'mastra-transitive-workspace-'));
    tempDirs.push(tempDir);

    const appDir = join(tempDir, 'apps', 'app');
    const pkgADir = join(tempDir, 'packages', 'a');
    const pkgBDir = join(tempDir, 'packages', 'b');
    const pkgCDir = join(tempDir, 'packages', 'c');
    const entryFile = join(appDir, 'index.ts');
    const outputDir = join(appDir, '.mastra', '.build');

    await mkdir(outputDir, { recursive: true });
    await mkdir(join(appDir, 'node_modules', '@internal'), { recursive: true });
    await mkdir(join(pkgADir, 'node_modules', '@internal'), { recursive: true });
    await mkdir(join(pkgBDir, 'node_modules', '@internal'), { recursive: true });
    await mkdir(join(appDir, 'src'), { recursive: true });
    await mkdir(join(pkgADir, 'src'), { recursive: true });
    await mkdir(join(pkgBDir, 'src'), { recursive: true });
    await mkdir(join(pkgCDir, 'src'), { recursive: true });

    await writeFile(join(tempDir, 'package.json'), JSON.stringify({ name: 'test-workspace', version: '1.0.0' }));
    await writeFile(join(tempDir, 'pnpm-workspace.yaml'), `packages:\n  - apps/*\n  - packages/*\n`);
    await writeFile(join(appDir, 'package.json'), JSON.stringify({ name: 'app', version: '1.0.0', type: 'module' }));
    await writeFile(
      join(pkgADir, 'package.json'),
      JSON.stringify({
        name: '@internal/a',
        version: '1.0.0',
        type: 'module',
        main: './src/index.js',
        dependencies: { '@internal/b': 'workspace:*' },
      }),
    );
    await writeFile(
      join(pkgBDir, 'package.json'),
      JSON.stringify({
        name: '@internal/b',
        version: '1.0.0',
        type: 'module',
        main: './src/index.js',
        dependencies: { '@internal/c': 'workspace:*' },
      }),
    );
    await writeFile(
      join(pkgCDir, 'package.json'),
      JSON.stringify({ name: '@internal/c', version: '1.0.0', type: 'module', main: './src/index.js' }),
    );

    await writeFile(
      join(pkgADir, 'src', 'index.js'),
      `import { valueB } from '@internal/b';\nexport const valueA = valueB;`,
    );
    await writeFile(
      join(pkgBDir, 'src', 'index.js'),
      `import { valueC } from '@internal/c';\nexport const valueB = valueC;`,
    );
    await writeFile(join(pkgCDir, 'src', 'index.js'), `export const valueC = 'c';`);
    await writeFile(entryFile, `import { valueA } from '@internal/a';\nexport const value = valueA;`);

    await symlink(pkgADir, join(appDir, 'node_modules', '@internal', 'a'));
    await symlink(pkgBDir, join(pkgADir, 'node_modules', '@internal', 'b'));
    await symlink(pkgCDir, join(pkgBDir, 'node_modules', '@internal', 'c'));

    const originalCwd = process.cwd();
    process.chdir(tempDir);
    try {
      const result = await analyzeBundle(
        [entryFile],
        entryFile,
        {
          outputDir,
          projectRoot: appDir,
          platform: 'node',
          bundlerOptions: {
            externals: [],
            enableSourcemap: false,
          },
        },
        noopLogger,
      );

      expect(result.externalDependencies.has('@internal/a')).toBe(false);
      expect(result.externalDependencies.has('@internal/b')).toBe(false);
      expect(result.externalDependencies.has('@internal/c')).toBe(false);
    } finally {
      process.chdir(originalCwd);
    }
  }, 15000);
});

describe('protocol imports', () => {
  it('should exclude protocol imports from externalDependencies', async () => {
    await mkdir(tempRoot, { recursive: true });
    const tempDir = await mkdtemp(join(tempRoot, 'mastra-protocol-imports-'));
    tempDirs.push(tempDir);

    const entryFile = join(tempDir, 'index.ts');
    const outputDir = join(tempDir, '.mastra', '.build');
    await mkdir(outputDir, { recursive: true });
    await writeFile(join(tempDir, 'package.json'), JSON.stringify({ name: 'protocol-import-test', type: 'module' }));
    await writeFile(
      entryFile,
      `
        import { env } from 'cloudflare:workers';
        import { Mastra } from '@mastra/core/mastra';

        export const binding = env.TEST_BINDING;
        export const mastra = new Mastra({});
      `,
    );

    const result = await analyzeBundle(
      [entryFile],
      entryFile,
      {
        outputDir,
        projectRoot: tempDir,
        platform: 'browser',
        bundlerOptions: {
          externals: [],
          enableSourcemap: false,
        },
      },
      noopLogger,
    );

    expect(result.externalDependencies.has('cloudflare:workers')).toBe(false);
  }, 15000);
});

describe('npm alias dependencies', () => {
  it('preserves alias install specs in external dependency metadata', async () => {
    await mkdir(tempRoot, { recursive: true });
    const tempDir = await mkdtemp(join(tempRoot, 'mastra-npm-alias-'));
    tempDirs.push(tempDir);

    const entryFile = join(tempDir, 'index.ts');
    const outputDir = join(tempDir, '.mastra', '.build');
    const aliasPackageDir = join(tempDir, 'node_modules', '@ai-sdk', 'provider-utils-v7');
    await mkdir(outputDir, { recursive: true });
    await mkdir(aliasPackageDir, { recursive: true });
    await writeFile(
      join(tempDir, 'package.json'),
      JSON.stringify({
        name: 'alias-test-project',
        version: '1.0.0',
        type: 'module',
        dependencies: {
          '@ai-sdk/provider-utils-v7': 'npm:@ai-sdk/provider-utils@5.0.0',
        },
      }),
    );
    await writeFile(
      join(aliasPackageDir, 'package.json'),
      JSON.stringify({ name: '@ai-sdk/provider-utils', version: '5.0.0', type: 'module', main: './index.js' }),
    );
    await writeFile(join(aliasPackageDir, 'index.js'), `export const aliasValue = 'alias';`);
    await writeFile(
      entryFile,
      `
        import { aliasValue } from '@ai-sdk/provider-utils-v7';

        export const value = aliasValue;
      `,
    );

    const result = await analyzeBundle(
      [entryFile],
      entryFile,
      {
        outputDir,
        projectRoot: tempDir,
        platform: 'node',
        bundlerOptions: {
          externals: ['@ai-sdk/provider-utils-v7'],
          enableSourcemap: false,
        },
      },
      noopLogger,
    );

    expect(result.externalDependencies.get('@ai-sdk/provider-utils-v7')).toEqual({
      version: '5.0.0',
      packageSpec: 'npm:@ai-sdk/provider-utils@5.0.0',
    });
  }, 15000);

  it('resolves alias install specs for dynamic external dependency fallbacks', async () => {
    await mkdir(tempRoot, { recursive: true });
    const tempDir = await mkdtemp(join(tempRoot, 'mastra-npm-alias-dynamic-'));
    tempDirs.push(tempDir);

    const entryFile = join(tempDir, 'index.ts');
    const outputDir = join(tempDir, '.mastra', '.build');
    const aliasPackageDir = join(tempDir, 'node_modules', '@ai-sdk', 'provider-utils-v5');
    await mkdir(outputDir, { recursive: true });
    await mkdir(aliasPackageDir, { recursive: true });
    await writeFile(
      join(tempDir, 'package.json'),
      JSON.stringify({
        name: 'alias-dynamic-test-project',
        version: '1.0.0',
        type: 'module',
        dependencies: {
          '@ai-sdk/provider-utils-v5': 'npm:@ai-sdk/provider-utils@3.0.25',
        },
      }),
    );
    await writeFile(
      join(aliasPackageDir, 'package.json'),
      JSON.stringify({ name: '@ai-sdk/provider-utils', version: '3.0.25', type: 'module', main: './index.js' }),
    );
    await writeFile(join(aliasPackageDir, 'index.js'), `export const aliasValue = 'alias';`);
    await writeFile(entryFile, `export const value = 'entry';`);

    const result = await analyzeBundle(
      [entryFile],
      entryFile,
      {
        outputDir,
        projectRoot: tempDir,
        platform: 'node',
        bundlerOptions: {
          externals: [],
          dynamicPackages: ['@ai-sdk/provider-utils-v5'],
          enableSourcemap: false,
        },
      },
      noopLogger,
    );

    expect(result.externalDependencies.get('@ai-sdk/provider-utils-v5')).toEqual({
      version: '3.0.25',
      packageSpec: 'npm:@ai-sdk/provider-utils@3.0.25',
    });
  }, 15000);
});

describe('Software Factory project type detection', () => {
  it('classifies a MastraFactory entry as factory', async () => {
    await mkdir(tempRoot, { recursive: true });
    const tempDir = await mkdtemp(join(tempRoot, 'factory-analyze-'));
    tempDirs.push(tempDir);

    const mastraDir = join(tempDir, 'src', 'mastra');
    const entryFile = join(mastraDir, 'index.ts');
    const outputDir = join(tempDir, '.mastra', '.build');
    await mkdir(outputDir, { recursive: true });
    await mkdir(mastraDir, { recursive: true });
    await writeFile(join(tempDir, 'package.json'), JSON.stringify({ name: 'test', version: '1.0.0', type: 'module' }));
    await writeFile(join(mastraDir, 'factory.ts'), `export class MastraFactory { prepare() { return {}; } }\n`);
    await writeFile(
      entryFile,
      `import { MastraFactory } from './factory';\n` +
        `const factory = new MastraFactory();\n` +
        `export const mastra = factory.prepare();\n`,
    );

    const result = await analyzeBundle(
      [entryFile],
      entryFile,
      {
        outputDir,
        projectRoot: tempDir,
        platform: 'node',
        bundlerOptions: { externals: [], enableSourcemap: false },
      },
      noopLogger,
    );

    expect(result.projectType).toBe('factory');
  });

  it('classifies an ordinary Mastra entry as undefined projectType', async () => {
    await mkdir(tempRoot, { recursive: true });
    const tempDir = await mkdtemp(join(tempRoot, 'factory-analyze-'));
    tempDirs.push(tempDir);

    const mastraDir = join(tempDir, 'src', 'mastra');
    const entryFile = join(mastraDir, 'index.ts');
    const outputDir = join(tempDir, '.mastra', '.build');
    await mkdir(outputDir, { recursive: true });
    await mkdir(mastraDir, { recursive: true });
    await writeFile(join(tempDir, 'package.json'), JSON.stringify({ name: 'test', version: '1.0.0', type: 'module' }));
    await writeFile(entryFile, `export const mastra = new Mastra({});\n`);

    const result = await analyzeBundle(
      [entryFile],
      entryFile,
      {
        outputDir,
        projectRoot: tempDir,
        platform: 'node',
        bundlerOptions: { externals: [], enableSourcemap: false },
      },
      noopLogger,
    );

    expect(result.projectType).toBeUndefined();
  });
});
