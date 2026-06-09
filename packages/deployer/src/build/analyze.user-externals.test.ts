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

import { validate } from '../validator/validate';
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
  it('passes user-configured externals to the validation stub list', async () => {
    await mkdir(tempRoot, { recursive: true });
    const tempDir = await mkdtemp(join(tempRoot, 'mastra-user-externals-'));
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

    await analyzeBundle(
      [entryFile],
      entryFile,
      {
        outputDir,
        projectRoot: tempDir,
        platform: 'browser',
        bundlerOptions: {
          externals: ['drizzle-orm', 'pg'],
          enableSourcemap: false,
        },
      },
      noopLogger,
    );

    expect(validate).toHaveBeenCalled();
    for (const [, opts] of vi.mocked(validate).mock.calls) {
      expect(opts.stubbedExternals).toEqual(expect.arrayContaining(['drizzle-orm', 'pg']));
    }
  }, 15000);
});
