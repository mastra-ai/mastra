import { mkdir, mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
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
  writeFactoryMarkerForTest(outputDirectory: string): Promise<void> {
    return this.writeFactoryMarker(outputDirectory);
  }
}

describe('Bundler.writeFactoryMarker', () => {
  it('writes mastra-project.json without an assets.ui path', async () => {
    // The Factory SPA is resolved at runtime from node_modules/mastra/dist/
    // factory/, so the marker no longer needs to advertise a bundled path.
    const tempDir = await mkdtemp(join(tmpdir(), 'factory-marker-'));
    tempDirs.push(tempDir);

    const outputDir = join(tempDir, 'output');
    await mkdir(outputDir, { recursive: true });

    const bundler = new TestBundler('Test');
    await bundler.writeFactoryMarkerForTest(tempDir);

    const marker = JSON.parse(await readFile(join(outputDir, 'mastra-project.json'), 'utf-8'));
    expect(marker).toEqual({
      schemaVersion: 1,
      projectType: 'factory',
    });
  });
});
