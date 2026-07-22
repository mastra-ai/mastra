import { existsSync } from 'node:fs';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { MastraError } from '@mastra/core/error';
import { afterEach, describe, expect, it } from 'vitest';
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

    const error = await (bundler as any).writeFactoryMarker(tempDir).catch((error: unknown) => error);
    expect(error).toBeInstanceOf(MastraError);
    expect(error).toMatchObject({ id: 'DEPLOYER_BUNDLER_FACTORY_UI_MISSING' });
    expect((error as Error).message).toMatch(/factory\/index\.html.*not found/);

    // Marker should not have been written
    expect(existsSync(join(outputDir, 'mastra-project.json'))).toBe(false);
  });
});
