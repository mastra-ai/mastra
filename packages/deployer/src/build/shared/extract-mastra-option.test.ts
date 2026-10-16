import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdir, mkdtemp, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { extractMastraOption } from './extract-mastra-option';

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

  it('inlines raw TypeScript workspace packages imported by the server config', async () => {
    const root = await mkdtemp(join(tmpdir(), 'mastra-extract-ws-'));
    try {
      const write = async (file: string, content: string) => {
        await mkdir(dirname(join(root, file)), { recursive: true });
        await writeFile(join(root, file), content);
      };
      await write(
        'package.json',
        JSON.stringify({ name: 'root', private: true, workspaces: ['apps/*', 'packages/*'] }),
      );
      await write(
        'packages/lib/package.json',
        JSON.stringify({ name: '@repo/lib', version: '0.0.0', type: 'module', exports: { '.': './src/index.ts' } }),
      );
      await write('packages/lib/src/index.ts', "export { greet } from './greet';\n");
      await write('packages/lib/src/greet.ts', 'export const greet = (name: string): string => `hello ${name}`;\n');
      await write(
        'apps/app/package.json',
        JSON.stringify({ name: 'app', version: '0.0.0', type: 'module', dependencies: { '@repo/lib': 'workspace:*' } }),
      );
      await mkdir(join(root, 'apps/app/node_modules/@repo'), { recursive: true });
      await symlink(join(root, 'packages/lib'), join(root, 'apps/app/node_modules/@repo/lib'), 'dir');
      await write(
        'apps/app/src/mastra/index.ts',
        `import { Mastra } from '@mastra/core/mastra';
import { greet } from '@repo/lib';
export const mastra = new Mastra({
  server: { apiRoutes: [{ path: '/hello', method: 'GET', handler: async (c: any) => c.text(greet('world')) }] },
});
`,
      );

      const outputDir = join(root, 'apps/app/.mastra');
      const result = await extractMastraOption('server', join(root, 'apps/app/src/mastra/index.ts'), outputDir);

      expect(result).not.toBeNull();
      const code = result!.bundleOutput.output[0].code;
      expect(code).not.toContain('@repo/lib');
      expect(code).toContain('hello ');
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it('resolves dependencies of inlined workspace packages from the package itself', async () => {
    const root = await mkdtemp(join(tmpdir(), 'mastra-extract-ws-deps-'));
    try {
      const write = async (file: string, content: string) => {
        await mkdir(dirname(join(root, file)), { recursive: true });
        await writeFile(join(root, file), content);
      };
      const link = async (target: string, at: string) => {
        await mkdir(dirname(join(root, at)), { recursive: true });
        await symlink(join(root, target), join(root, at), 'dir');
      };
      const esmPackage = (name: string, exports: string) =>
        JSON.stringify({ name, version: '1.0.0', type: 'module', exports });

      await write(
        'package.json',
        JSON.stringify({ name: 'root', private: true, workspaces: ['apps/*', 'packages/*'] }),
      );
      // pnpm-style isolated store: deps are only reachable through the node_modules of packages that declare them
      await write('store/lib-only/package.json', esmPackage('lib-only', './index.js'));
      await write('store/lib-only/index.js', "export const suffix = '!';\n");
      await write('store/shared/package.json', esmPackage('shared', './index.js'));
      await write('store/shared/index.js', 'export const token = {};\n');
      await write('packages/built/package.json', esmPackage('@repo/built', './dist/index.js'));
      await write('packages/built/dist/index.js', "export const prefix = 'hello';\n");
      await write('packages/lib/package.json', esmPackage('@repo/lib', './src/index.ts'));
      await write(
        'packages/lib/src/index.ts',
        `import { prefix } from '@repo/built';
import { suffix } from 'lib-only';
import { token } from 'shared';
export const libToken = token;
export const greet = (name: string): string => \`\${prefix} \${name}\${suffix}\`;
`,
      );
      await link('store/lib-only', 'packages/lib/node_modules/lib-only');
      await link('store/shared', 'packages/lib/node_modules/shared');
      await link('packages/built', 'packages/lib/node_modules/@repo/built');
      await write('apps/app/package.json', esmPackage('app', './src/index.js'));
      await link('packages/lib', 'apps/app/node_modules/@repo/lib');
      await link('store/shared', 'apps/app/node_modules/shared');
      await write(
        'apps/app/src/mastra/index.ts',
        `import { Mastra } from '@mastra/core/mastra';
import { greet, libToken } from '@repo/lib';
import { token } from 'shared';
export const mastra = new Mastra({
  server: {
    apiRoutes: [
      { path: '/hello', method: 'GET', handler: async () => ({ greeting: greet('world'), sameToken: libToken === token }) },
    ],
  },
});
`,
      );

      const outputDir = join(root, 'apps/app/.mastra/output');
      const result = await extractMastraOption('server', join(root, 'apps/app/src/mastra/index.ts'), outputDir);
      expect(result).not.toBeNull();
      // The app's own dependency stays a bare import
      expect(result!.bundleOutput.output[0].code).toMatch(/from 'shared'/);

      // Load the config with plain Node, as `mastra dev` does, instead of through Vitest's module resolution
      const configUrl = pathToFileURL(join(outputDir, 'server-config.mjs')).href;
      const run = spawnSync(
        process.execPath,
        [
          '--input-type=module',
          '-e',
          `const { server } = await import(${JSON.stringify(configUrl)});
console.log(JSON.stringify(await server.apiRoutes[0].handler()));`,
        ],
        { encoding: 'utf8' },
      );
      expect(run.stderr).toBe('');
      expect(JSON.parse(run.stdout)).toEqual({ greeting: 'hello world!', sameToken: true });
    } finally {
      await rm(root, { recursive: true, force: true });
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
});
