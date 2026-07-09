import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { noopLogger } from '@mastra/core/logger';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('../validator/validate', () => ({
  validate: vi.fn().mockResolvedValue(undefined),
  ValidationError: class ValidationError extends Error {
    public readonly type: string;
    constructor(args: { type: string; message: string; stack: string }) {
      super(args.message);
      this.type = args.type;
      this.stack = args.stack;
    }
  },
}));

import { validate, ValidationError } from '../validator/validate';
import { analyzeBundle } from './analyze';

const tempDirs: string[] = [];
const packageRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const tempRoot = join(packageRoot, '.tmp');

afterEach(async () => {
  await Promise.all(
    tempDirs.splice(0).map(dir =>
      rm(dir, {
        recursive: true,
        force: true,
      }),
    ),
  );
  vi.mocked(validate).mockClear();
});

describe('validateOutput stubbedExternals (issue #16626)', () => {
  async function setupProject(prefix: string) {
    await mkdir(tempRoot, { recursive: true });
    const tempDir = await mkdtemp(join(tempRoot, prefix));
    tempDirs.push(tempDir);

    const entryFile = join(tempDir, 'index.ts');
    const outputDir = join(tempDir, '.mastra', '.build');
    await mkdir(outputDir, { recursive: true });
    await writeFile(
      entryFile,
      `
        import { Mastra } from '@mastra/core/mastra';
        export const mastra = new Mastra({});
      `,
    );

    return { entryFile, outputDir, projectRoot: tempDir };
  }

  function build({ entryFile, outputDir, projectRoot }: { entryFile: string; outputDir: string; projectRoot: string }) {
    return analyzeBundle(
      [entryFile],
      entryFile,
      {
        outputDir,
        projectRoot,
        platform: 'browser',
        bundlerOptions: {
          externals: ['drizzle-orm', 'pg'],
          enableSourcemap: false,
        },
      },
      noopLogger,
    );
  }

  // Bundling a real @mastra/core entry through rollup is slow under parallel suite load
  // (observed up to ~30s locally), so these give it generous headroom.

  it('does not stub user-configured externals while validation is succeeding', async () => {
    const project = await setupProject('mastra-user-externals-healthy-');

    await build(project);

    // Externals are ordinary runtime libraries that bundled code may use while it evaluates,
    // so they run for real unless they actually break the validation pass.
    expect(validate).toHaveBeenCalled();
    for (const [, opts] of vi.mocked(validate).mock.calls) {
      expect(opts.stubbedExternals).not.toContain('drizzle-orm');
      // The curated lists stay eagerly stubbed: 'pg' is in GLOBAL_EXTERNALS and the rest are
      // DEPRECATED_EXTERNALS, so listing 'pg' as a user external changes nothing for it.
      expect(opts.stubbedExternals).toEqual(
        expect.arrayContaining(['pg', 'fastembed', 'nodemailer', 'jsdom', 'sqlite3']),
      );
    }
  }, 60000);

  it('stubs a user-configured external that validation could not load', async () => {
    const project = await setupProject('mastra-user-externals-missing-');

    // First attempt: the chunk cannot be executed because an externalized package is not
    // installed in the build environment. Every later attempt succeeds.
    vi.mocked(validate).mockImplementationOnce(() => {
      const error = new ValidationError({
        type: 'Error',
        message: `Cannot find package 'drizzle-orm' imported from ${project.outputDir}`,
        stack: `Error [ERR_MODULE_NOT_FOUND]: Cannot find package 'drizzle-orm' imported from ${project.outputDir}`,
      });
      return Promise.reject(error);
    });

    await expect(build(project)).resolves.toBeDefined();

    const retriedWithStub = vi
      .mocked(validate)
      .mock.calls.some(([, opts]) => opts.stubbedExternals?.includes('drizzle-orm'));
    expect(retriedWithStub).toBe(true);
  }, 60000);
});
