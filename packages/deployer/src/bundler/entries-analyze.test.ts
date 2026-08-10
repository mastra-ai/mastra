import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { Config } from '@mastra/core/mastra';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Capture what `_bundle` hands to analyzeBundle, then stop the build there. Everything
// after analysis (rollup, workspace packing, npm install) is irrelevant to this contract
// and far too slow for a unit test.
const { analyzeCalls } = vi.hoisted(() => ({ analyzeCalls: [] as string[][] }));

vi.mock('../build/analyze', () => ({
  analyzeBundle: vi.fn((entries: string[]) => {
    analyzeCalls.push(entries);
    throw new Error('STOP_AFTER_ANALYZE');
  }),
}));

const { Bundler } = await import('./index');

class EntriesBundler extends Bundler {
  constructor(private readonly userEntries: Record<string, string>) {
    super('Test');
  }

  async bundle(): Promise<void> {}

  getEnvFiles(): Promise<string[]> {
    return Promise.resolve([]);
  }

  // Bypass the babel/rollup extraction of the real entry file — this test is about the
  // wiring from resolved options into analyzeBundle, not about reading the config.
  protected async getUserBundlerOptions(): Promise<NonNullable<Config['bundler']>> {
    return { externals: [], sourcemap: false, transpilePackages: [], entries: this.userEntries };
  }

  publicBundle(serverFile: string, mastraEntryFile: string, outputDirectory: string, projectRoot: string) {
    return this._bundle(serverFile, mastraEntryFile, { outputDirectory, projectRoot });
  }
}

let tempDir: string;
let mastraEntryFile: string;
const tempDirs: string[] = [];

beforeEach(async () => {
  analyzeCalls.length = 0;
  tempDir = await mkdtemp(join(tmpdir(), 'mastra-entries-analyze-'));
  tempDirs.push(tempDir);
  mastraEntryFile = join(tempDir, 'index.ts');
  await writeFile(mastraEntryFile, 'export const mastra = {}');
  await writeFile(join(tempDir, 'voice-worker.ts'), 'export default {}');
});

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map(dir => rm(dir, { recursive: true, force: true })));
});

describe('_bundle extra-entry dependency analysis', () => {
  /**
   * The core contract of `bundler.entries`. Dependencies imported only by an extra entry
   * reach the generated package.json solely because that entry is analyzed — drop it from
   * this array and the emitted bundle cannot resolve them at runtime, with no build error.
   * `e2e-tests/monorepo` asserts the resulting package.json on a real build; this guards
   * the wiring itself.
   */
  it('passes extra entries to analyzeBundle alongside the server entry', async () => {
    const bundler = new EntriesBundler({ 'voice-worker': './voice-worker.ts' });

    await expect(
      bundler.publicBundle('const virtual = 1\n', mastraEntryFile, join(tempDir, '.mastra'), tempDir),
    ).rejects.toThrow(/STOP_AFTER_ANALYZE/);

    expect(analyzeCalls).toHaveLength(1);
    expect(analyzeCalls[0]).toContain(join(tempDir, 'voice-worker.ts').replaceAll('\\', '/'));
    // The server entry must still be analyzed first.
    expect(analyzeCalls[0]?.[0]).toBe('const virtual = 1\n');
  });

  it('analyzes only the server entry when none are configured', async () => {
    const bundler = new EntriesBundler({});

    await expect(
      bundler.publicBundle('const virtual = 1\n', mastraEntryFile, join(tempDir, '.mastra'), tempDir),
    ).rejects.toThrow(/STOP_AFTER_ANALYZE/);

    expect(analyzeCalls[0]).toEqual(['const virtual = 1\n']);
  });
});
