import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { mkdir, rm } from 'node:fs/promises';
import { extractMastraOption } from './extract-mastra-option';
import { existsSync } from 'node:fs';

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

  describe.each([['bundler'], ['deployer'], ['server']] as const)('%s', name => {
    it.for([
      ['../plugins/__fixtures__/basic.js'],
      ['../plugins/__fixtures__/basic-with-const.js'],
      ['../plugins/__fixtures__/basic-with-import.js'],
      ['../plugins/__fixtures__/basic-with-spread.js'],
      ['../plugins/__fixtures__/basic-with-function.js'],
    ])('should extract the %s option from %s', async ([fileName]) => {
      const file = join(_dirname, fileName);

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
