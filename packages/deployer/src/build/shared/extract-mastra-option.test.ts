import { existsSync } from 'node:fs';
import { mkdir, mkdtemp, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
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
