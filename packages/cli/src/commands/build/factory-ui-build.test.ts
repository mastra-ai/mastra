import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { PinoLogger } from '@mastra/loggers';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { buildFactoryUI } from './factory-ui-build';

const logger = new PinoLogger({ name: 'test', level: 'silent' });

describe('buildFactoryUI', () => {
  let tmpDir: string;
  let mastraDir: string;
  let factoryUISource: string;

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'factory-ui-build-test-'));
    mastraDir = join(tmpDir, 'project', 'src', 'mastra');
    factoryUISource = join(tmpDir, 'prebuilt-factory');
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  it('copies the prebuilt Factory UI into the Mastra public directory', async () => {
    await mkdir(join(factoryUISource, 'assets'), { recursive: true });
    await writeFile(join(factoryUISource, 'index.html'), '<html>factory</html>');
    await writeFile(join(factoryUISource, 'assets', 'app.js'), 'console.log("factory")');

    await buildFactoryUI(mastraDir, logger, factoryUISource);

    await expect(readFile(join(mastraDir, 'public', 'factory', 'index.html'), 'utf8')).resolves.toBe(
      '<html>factory</html>',
    );
    await expect(readFile(join(mastraDir, 'public', 'factory', 'assets', 'app.js'), 'utf8')).resolves.toBe(
      'console.log("factory")',
    );
  });

  it('overwrites stale Factory UI assets', async () => {
    await mkdir(factoryUISource, { recursive: true });
    await writeFile(join(factoryUISource, 'index.html'), '<html>current</html>');

    const outputDir = join(mastraDir, 'public', 'factory');
    await mkdir(outputDir, { recursive: true });
    await writeFile(join(outputDir, 'index.html'), '<html>stale</html>');

    await buildFactoryUI(mastraDir, logger, factoryUISource);

    await expect(readFile(join(outputDir, 'index.html'), 'utf8')).resolves.toBe('<html>current</html>');
  });

  it('throws when the prebuilt Factory UI is missing', async () => {
    await expect(buildFactoryUI(mastraDir, logger, factoryUISource)).rejects.toThrow(/Prebuilt Factory UI not found/);
  });
});
