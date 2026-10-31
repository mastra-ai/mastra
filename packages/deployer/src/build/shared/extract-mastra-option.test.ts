import { existsSync } from 'node:fs';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { rollup } from 'rollup';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { extractMastraOption, typescriptSourcesResolver } from './extract-mastra-option';

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

  it('keeps installed dependencies external when extracting an option (#28645)', async () => {
    const root = await mkdtemp(join(_dirname, 'option-extraction-'));
    const appDir = join(root, 'app');
    const dependencyDir = join(appDir, 'node_modules', 'large-dependency');
    const outputDir = join(appDir, '.mastra', 'output');
    const entryFile = join(appDir, 'index.ts');

    try {
      await mkdir(dependencyDir, { recursive: true });
      await mkdir(outputDir, { recursive: true });
      await writeFile(join(appDir, 'package.json'), JSON.stringify({ type: 'module' }));
      await writeFile(join(dependencyDir, 'package.json'), JSON.stringify({ type: 'module', exports: './index.js' }));
      await writeFile(
        join(dependencyDir, 'index.js'),
        "export const server = { port: 3000, marker: 'large-dependency-inlined' };\n",
      );
      await writeFile(
        entryFile,
        "import { server as externalServer } from 'large-dependency';\nexport const mastra = new Mastra({ server: externalServer });\n",
      );

      // The resolver must mark installed packages external before later plugins can load them.
      const bundler = await rollup({
        input: entryFile,
        plugins: [
          typescriptSourcesResolver(entryFile),
          {
            name: 'reject-installed-dependency-resolution',
            resolveId(id) {
              if (id === 'large-dependency') {
                throw new Error('Installed dependency entered the option-extraction graph');
              }
              return null;
            },
          },
        ],
      });
      await bundler.close();

      const result = await extractMastraOption('server', entryFile, outputDir);
      expect(result).not.toBeNull();
      expect(result?.bundleOutput.output[0].code).toContain("from 'large-dependency'");
      expect(result?.bundleOutput.output[0].code).not.toContain('large-dependency-inlined');
      await expect(result?.getConfig()).resolves.toMatchObject({ port: 3000 });
    } finally {
      await rm(root, { recursive: true, force: true });
    }
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
});
