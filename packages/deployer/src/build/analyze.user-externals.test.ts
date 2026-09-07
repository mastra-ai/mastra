import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { noopLogger } from '@mastra/core/logger';
import type { IMastraLogger } from '@mastra/core/logger';
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

  function build(
    { entryFile, outputDir, projectRoot }: Awaited<ReturnType<typeof setupProject>>,
    { externals = ['drizzle-orm', 'pg'], logger = noopLogger }: { externals?: string[]; logger?: IMastraLogger } = {},
  ) {
    return analyzeBundle(
      [entryFile],
      entryFile,
      {
        outputDir,
        projectRoot,
        platform: 'browser',
        bundlerOptions: {
          externals,
          enableSourcemap: false,
        },
      },
      logger,
    );
  }

  function missingPackage(packageName: string, outputDir: string) {
    return new ValidationError({
      type: 'Error',
      message: `Cannot find package '${packageName}' imported from ${outputDir}`,
      stack: `Error [ERR_MODULE_NOT_FOUND]: Cannot find package '${packageName}' imported from ${outputDir}`,
    });
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

  it('keeps stubbing when the retry surfaces another externalized package', async () => {
    const project = await setupProject('mastra-user-externals-chain-');

    // Stubbing the first package lets the chunk run further, where it trips over a second
    // externalized package that is not installed either. The third attempt succeeds.
    vi.mocked(validate)
      .mockImplementationOnce(() => Promise.reject(missingPackage('drizzle-orm', project.outputDir)))
      .mockImplementationOnce(() => Promise.reject(missingPackage('ioredis', project.outputDir)));

    await expect(build(project, { externals: ['drizzle-orm', 'pg', 'ioredis'] })).resolves.toBeDefined();

    const retriedWithBothStubs = vi
      .mocked(validate)
      .mock.calls.some(
        ([, opts]) => opts.stubbedExternals?.includes('drizzle-orm') && opts.stubbedExternals?.includes('ioredis'),
      );
    expect(retriedWithBothStubs).toBe(true);
  }, 60000);

  it('warns instead of failing when the stub itself cannot link', async () => {
    const project = await setupProject('mastra-user-externals-stub-link-');
    const logger = { ...noopLogger, warn: vi.fn() } as IMastraLogger;

    // The stub is a bare `export default {}`, so a chunk with a named import from the
    // externalized package cannot link against it. That says nothing about the bundle.
    vi.mocked(validate)
      .mockImplementationOnce(() => Promise.reject(missingPackage('drizzle-orm', project.outputDir)))
      .mockImplementationOnce(() =>
        Promise.reject(
          new ValidationError({
            type: 'SyntaxError',
            message: "The requested module 'drizzle-orm' does not provide an export named 'sql'",
            stack: `SyntaxError: The requested module 'drizzle-orm' does not provide an export named 'sql'\n    at ModuleJob._instantiate (node:internal/modules/esm/module_job:180:21)`,
          }),
        ),
      );

    await expect(build(project, { logger })).resolves.toBeDefined();

    expect(logger.warn).toHaveBeenCalledTimes(1);
    expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('"drizzle-orm"'));
  }, 60000);

  it('still fails the build when the retry surfaces a defect the stub did not cause', async () => {
    const project = await setupProject('mastra-user-externals-retry-defect-');
    const logger = { ...noopLogger, warn: vi.fn() } as IMastraLogger;

    // With the externalized package out of the way the chunk gets further and hits a genuine
    // bundling problem in a package that is *not* externalized. That must not be swallowed.
    vi.mocked(validate)
      .mockImplementationOnce(() => Promise.reject(missingPackage('drizzle-orm', project.outputDir)))
      .mockImplementationOnce(() =>
        Promise.reject(
          new ValidationError({
            type: 'TypeError',
            message: "Cannot read properties of undefined (reading 'prototype')",
            stack: `TypeError: Cannot read properties of undefined (reading 'prototype')\n    at Object.<anonymous> (${project.projectRoot}/node_modules/legacy-cjs-package/index.js:3:41)`,
          }),
        ),
      );

    await expect(build(project, { logger })).rejects.toThrow(/legacy-cjs-package/);
    expect(logger.warn).not.toHaveBeenCalled();
  }, 60000);
});
