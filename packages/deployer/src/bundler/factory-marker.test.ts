import { existsSync } from 'node:fs';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { noopLogger } from '@mastra/core/logger';
import { afterEach, describe, expect, it } from 'vitest';
import { analyzeBundle } from '../build/analyze';
import { Bundler } from './index';

const tempDirs: string[] = [];

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map(dir => rm(dir, { recursive: true, force: true })));
});

// A minimal concrete Bundler subclass for testing protected methods
class TestBundler extends Bundler {
  async bundle(): Promise<void> {}
  getEnvFiles(): Promise<string[]> {
    return Promise.resolve([]);
  }
}

describe('Software Factory project type detection in analyzeBundle', () => {
  it('classifies a MastraFactory entry as factory', async () => {
    const tempDir = await mkdtemp(join(tmpdir(), 'factory-analyze-'));
    tempDirs.push(tempDir);

    const mastraDir = join(tempDir, 'src', 'mastra');
    const entryFile = join(mastraDir, 'index.ts');
    const outputDir = join(tempDir, '.mastra', '.build');
    await mkdir(outputDir, { recursive: true });
    await mkdir(mastraDir, { recursive: true });
    await writeFile(join(tempDir, 'package.json'), JSON.stringify({ name: 'test', version: '1.0.0', type: 'module' }));

    // A Factory-style entry that imports MastraFactory and constructs it,
    // then exports a Mastra instance (so hasValidConfig is also true).
    // Create the imported module so Rollup can resolve it.
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
    const tempDir = await mkdtemp(join(tmpdir(), 'factory-analyze-'));
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

describe('Bundler.writeFactoryMarker', () => {
  it('writes mastra-project.json with the agreed schema when factory/index.html exists', async () => {
    const tempDir = await mkdtemp(join(tmpdir(), 'factory-marker-'));
    tempDirs.push(tempDir);

    // Simulate the output directory structure after copyPublic
    const outputDir = join(tempDir, 'output');
    await mkdir(join(outputDir, 'factory'), { recursive: true });
    await writeFile(join(outputDir, 'factory', 'index.html'), '<html></html>');

    const bundler = new TestBundler('Test');
    await (bundler as any).writeFactoryMarker(tempDir);

    const markerPath = join(outputDir, 'mastra-project.json');
    expect(existsSync(markerPath)).toBe(true);

    const marker = JSON.parse(await readFile(markerPath, 'utf-8'));
    expect(marker).toEqual({
      schemaVersion: 1,
      projectType: 'factory',
      assets: { ui: 'factory' },
    });
  });

  it('throws when factory/index.html is missing', async () => {
    const tempDir = await mkdtemp(join(tmpdir(), 'factory-marker-'));
    tempDirs.push(tempDir);

    // No factory/index.html created
    const outputDir = join(tempDir, 'output');
    await mkdir(outputDir, { recursive: true });

    const bundler = new TestBundler('Test');

    await expect((bundler as any).writeFactoryMarker(tempDir)).rejects.toThrow(/factory\/index\.html.*not found/);

    // Marker should not have been written
    expect(existsSync(join(outputDir, 'mastra-project.json'))).toBe(false);
  });
});
