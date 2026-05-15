import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { IMastraLogger } from '@mastra/core/logger';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type * as ValidateModule from '../validator/validate';
import { validate } from '../validator/validate';
import { analyzeBundle } from './analyze';

vi.mock('../bundler/workspaceDependencies', () => ({
  getWorkspaceInformation: vi.fn().mockResolvedValue({
    workspaceMap: new Map(),
    workspaceRoot: undefined,
  }),
}));

vi.mock('./analyze/analyzeEntry', () => ({
  analyzeEntry: vi.fn().mockResolvedValue({
    dependencies: new Map(),
    output: {
      code: 'export const mastra = new Mastra({});',
      map: null,
    },
  }),
}));

vi.mock('./analyze/bundleExternals', () => ({
  bundleExternals: vi.fn().mockResolvedValue({
    fileNameToDependencyMap: new Map(),
    usedExternals: {},
    output: [
      {
        type: 'chunk',
        fileName: '.mastra/.build/custom-user-external.mjs',
        name: 'custom-user-external',
        isEntry: true,
        isDynamicEntry: false,
        imports: ['custom-user-external/pg-core'],
        importedBindings: {
          'custom-user-external/pg-core': ['pgTable', 'text', 'default', '*', 'pgTable'],
        },
      },
    ],
  }),
}));

vi.mock('../validator/validate', async importOriginal => {
  const actual = await importOriginal<typeof ValidateModule>();

  return {
    ...actual,
    validate: vi.fn().mockResolvedValue(undefined),
  };
});

const tempDirs: string[] = [];
const logger = {
  info: vi.fn(),
  warn: vi.fn(),
  debug: vi.fn(),
  error: vi.fn(),
} as unknown as IMastraLogger;

afterEach(async () => {
  vi.clearAllMocks();
  await Promise.all(tempDirs.splice(0).map(dir => rm(dir, { recursive: true, force: true })));
});

describe('user externals validation', () => {
  it.each([
    ['configured external', ['custom-user-external']],
    ['externals preset', true],
  ] as const)('should pass %s and named imports to output validation', async (_name, externals) => {
    const tempDir = await mkdtemp(join(tmpdir(), 'mastra-user-externals-'));
    tempDirs.push(tempDir);
    const outputDir = join(tempDir, '.mastra', '.build');
    const entryFile = join(tempDir, 'index.ts');

    await mkdir(outputDir, { recursive: true });
    await writeFile(
      entryFile,
      `
        class Mastra {
          constructor(_config: unknown) {}
        }

        export const mastra = new Mastra({});
      `,
    );

    await analyzeBundle(
      [entryFile],
      entryFile,
      {
        outputDir,
        projectRoot: tempDir,
        platform: 'node',
        isDev: true,
        bundlerOptions: {
          externals,
          enableSourcemap: false,
        },
      },
      logger,
    );

    expect(validate).toHaveBeenCalledWith(
      join(tempDir, '.mastra', '.build', 'custom-user-external.mjs'),
      expect.objectContaining({
        stubbedExternals: expect.arrayContaining(['custom-user-external']),
        stubbedExternalExports: {
          'custom-user-external/pg-core': ['pgTable', 'text', 'default', '*'],
        },
      }),
    );
  });
});
