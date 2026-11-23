import { existsSync } from 'node:fs';
import { mkdir, mkdtemp, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { extractMastraOption, extractMastraOptionBundler } from './extract-mastra-option';

describe('Extract Mastra option', () => {
  const _dirname = dirname(fileURLToPath(import.meta.url));

  const testOutputDir = join(__dirname, '.test-output');

  beforeAll(async () => {
    await mkdir(testOutputDir, { recursive: true });
  });

  afterAll(async () => {
    try {
      await rm(testOutputDir, { recursive: true, force: true });
    } catch {}
  });

  it('extracts workers without initializing unrelated Mastra configuration', async () => {
    const entryFile = join(_dirname, '../plugins/__fixtures__/basic-with-workers.ts');
    const result = await extractMastraOption('workers', entryFile, testOutputDir);

    expect(result).not.toBeNull();
    expect(result?.bundleOutput.output[0].code).toContain('RuntimeNamedWorker');
    expect(result?.bundleOutput.output[0].code).not.toContain('initializeStorage');

    process.env.DEPLOYMENT_WORKER_NAME = 'cleanup-jobs';
    try {
      await expect(result?.getConfig()).resolves.toMatchObject([{ name: 'cleanup-jobs' }]);
    } finally {
      delete process.env.DEPLOYMENT_WORKER_NAME;
    }
  });

  describe.each([['bundler'], ['deployer'], ['server']] as const)('%s', name => {
    it.for([
      ['../plugins/__fixtures__/basic.js'],
      ['../plugins/__fixtures__/basic-with-const.js'],
      ['../plugins/__fixtures__/basic-with-import.js'],
      ['../plugins/__fixtures__/basic-with-spread.js'],
      ['../plugins/__fixtures__/basic-with-function.js'],
    ])('should extract the %s option from %s', async ([fileName]) => {
      const _file = join(_dirname, fileName);

      await mkdir(testOutputDir, { recursive: true });

      const entryFile = join(__dirname, '../plugins/__fixtures__/basic-with-bundler.js');
      const result = await extractMastraOption(name, entryFile, testOutputDir);

      // Check that the bundler-config.mjs file was created
      const configPath = join(testOutputDir, `${name}-config.mjs`);
      expect(existsSync(configPath)).toBe(true);

      // The key test: getConfig() should not throw a module resolution error
      // This is the operation that fails with Bun due to invalid file URL
      expect(result).not.toBeNull();
      expect(result?.bundleOutput.output[0].code).toMatchSnapshot();
    });
  });

  // Installed packages stay external during option extraction and must not be loaded (#28645).
  describe('installed dependencies', () => {
    let root: string;
    let entryFile: string;

    const files: Record<string, string> = {
      'app/package.json': JSON.stringify({ name: 'app', type: 'module' }),
      'app/src/mastra/index.ts': `import { Mastra } from '@mastra/core/mastra';
import { serverConfig } from './server';

export const mastra = new Mastra({ server: serverConfig });
`,
      'app/src/mastra/server.ts': `import { shout } from 'installed-dep';
import { greet } from 'raw-ts';

export const serverConfig = { port: 4111, greeting: shout(greet('app')) };
`,
      'app/node_modules/installed-dep/package.json': JSON.stringify({
        name: 'installed-dep',
        type: 'module',
        exports: './index.js',
      }),
      'app/node_modules/installed-dep/index.js': `export const shout = value => value.toUpperCase() + '!';\n`,
      'packages/raw-ts/package.json': JSON.stringify({ name: 'raw-ts', type: 'module', exports: './src/index.ts' }),
      'packages/raw-ts/src/index.ts': `import { prefix } from 'raw-only-dep';
export const greet = (name: string): string => \`\${prefix} \${name}\`;
`,
      'packages/raw-ts/node_modules/raw-only-dep/package.json': JSON.stringify({
        name: 'raw-only-dep',
        type: 'module',
        exports: './index.js',
      }),
      'packages/raw-ts/node_modules/raw-only-dep/index.js': `export const prefix = 'hello';\n`,
    };

    beforeAll(async () => {
      root = await mkdtemp(join(tmpdir(), 'mastra-extract-option-'));
      entryFile = join(root, 'app', 'src', 'mastra', 'index.ts');

      for (const [file, contents] of Object.entries(files)) {
        await mkdir(dirname(join(root, file)), { recursive: true });
        await writeFile(join(root, file), contents);
      }
      // A workspace package linked into the app, the way pnpm links `workspace:*` dependencies.
      await symlink(join('..', '..', 'packages', 'raw-ts'), join(root, 'app', 'node_modules', 'raw-ts'), 'dir');
    });

    afterAll(async () => {
      await rm(root, { recursive: true, force: true });
    });

    // A relative entry never matches the module id Rollup gives it, so nothing is stripped from it and all of its
    // imports are resolved, as in the issue's `getDeployer` probe (`node probe.mjs src/mastra/index.ts`).
    it.for([
      ['server', 'an absolute entry', () => entryFile],
      ['deployer', 'a relative entry', () => relative(process.cwd(), entryFile)],
    ] as const)('does not load installed packages when extracting %s from %s', async ([name, , getEntry]) => {
      const bundle = await extractMastraOptionBundler(name, getEntry(), { hasCustomConfig: false });
      try {
        expect(bundle.watchFiles.filter(file => file.includes('node_modules'))).toEqual([]);
        // The raw-TS workspace source is still loaded so esbuild can transpile it.
        expect(bundle.watchFiles.some(file => file.endsWith(join('raw-ts', 'src', 'index.ts')))).toBe(true);
      } finally {
        await bundle.close();
      }
    });
  });
});
