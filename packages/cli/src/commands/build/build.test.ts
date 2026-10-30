import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { MastraError } from '@mastra/core/error';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const logged = vi.hoisted(() => ({ error: [] as Array<[string, unknown]> }));
const platformDeployer = vi.hoisted(() => ({ current: undefined as unknown }));

vi.mock('../../utils/logger', () => ({
  createLogger: () => ({
    info: () => {},
    warn: () => {},
    debug: () => {},
    error: (message: string, details: unknown) => logged.error.push([message, details]),
  }),
}));

vi.mock('@mastra/deployer', async importOriginal => ({
  ...(await importOriginal<typeof import('@mastra/deployer')>()),
  getDeployer: async () => platformDeployer.current,
}));

// Stand-in for the MastraError copy that @mastra/deployer bundles: same shape, different class.
class BundledMastraError extends Error {
  readonly id = 'DEPLOYER_BUNDLER_ANALYZE_FAILED';
  readonly domain = 'DEPLOYER';
  readonly category = 'SYSTEM';
  readonly details = { file: 'src/mastra/index.ts' };

  toJSONDetails() {
    return { message: this.message, domain: this.domain, category: this.category, details: this.details };
  }
}

describe('build', () => {
  let rootDir: string;

  beforeEach(async () => {
    logged.error = [];
    rootDir = await mkdtemp(join(tmpdir(), 'mastra-cli-build-'));
    await mkdir(join(rootDir, 'src', 'mastra'), { recursive: true });
    await writeFile(join(rootDir, 'package.json'), JSON.stringify({ name: 'app', type: 'module' }));
    await writeFile(join(rootDir, 'src', 'mastra', 'index.ts'), 'export const mastra = {};\n');
    vi.spyOn(process, 'exit').mockImplementation((() => undefined) as never);
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    await rm(rootDir, { recursive: true, force: true });
  });

  it('logs structured details for a MastraError from a different copy of the error class', async () => {
    const error = new BundledMastraError('Failed to analyze Mastra application: boom');
    expect(error).not.toBeInstanceOf(MastraError);
    platformDeployer.current = {
      __setLogger: () => {},
      getAllToolPaths: () => [],
      prepare: async () => {
        throw error;
      },
    };

    const { build } = await import('./build');
    await build({ root: rootDir, debug: false });

    expect(logged.error).toEqual([
      [
        'Failed to analyze Mastra application: boom',
        { domain: 'DEPLOYER', category: 'SYSTEM', details: { file: 'src/mastra/index.ts' } },
      ],
    ]);
    expect(process.exit).toHaveBeenCalledWith(1);
  });

  it('falls back to the generic message for plain errors', async () => {
    platformDeployer.current = {
      __setLogger: () => {},
      getAllToolPaths: () => [],
      prepare: async () => {
        throw new Error('disk full');
      },
    };

    const { build } = await import('./build');
    await build({ root: rootDir, debug: false });

    expect(logged.error).toHaveLength(1);
    expect(logged.error[0]![0]).toBe('Mastra Build failed: disk full');
    expect(process.exit).toHaveBeenCalledWith(1);
  });
});
