import { mkdir, mkdtemp, realpath, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { extractMastraOption } from './extract-mastra-option';

const _dirname = dirname(fileURLToPath(import.meta.url));
const mastraCoreDir = join(_dirname, '../../../node_modules/@mastra/core');

/** Writes `value` as pretty-printed JSON to `path`. */
async function writeJson(path: string, value: unknown) {
  await writeFile(path, JSON.stringify(value, null, 2));
}

/**
 * Creates a minimal pnpm-style monorepo:
 * - packages/lib: workspace package whose `exports` point to raw TypeScript sources
 *   that use extensionless relative imports and a dependency only `lib` declares
 * - apps/app: Mastra app with an apiRoutes handler importing `@repo/lib`
 */
async function createRawTsWorkspace(root: string) {
  await writeJson(join(root, 'package.json'), { name: 'root', private: true });
  await writeFile(join(root, 'pnpm-workspace.yaml'), "packages:\n  - 'apps/*'\n  - 'packages/*'\n");

  const libDir = join(root, 'packages/lib');
  await mkdir(join(libDir, 'src'), { recursive: true });
  await writeJson(join(libDir, 'package.json'), {
    name: '@repo/lib',
    version: '1.0.0',
    type: 'module',
    exports: { '.': './src/index.ts' },
    dependencies: { 'lib-only-dep': '1.0.0' },
  });
  const libOnlyDepDir = join(libDir, 'node_modules/lib-only-dep');
  await mkdir(libOnlyDepDir, { recursive: true });
  await writeJson(join(libOnlyDepDir, 'package.json'), {
    name: 'lib-only-dep',
    version: '1.0.0',
    type: 'module',
    exports: './index.js',
  });
  await writeFile(join(libOnlyDepDir, 'index.js'), 'export const add = (a, b) => a + b;\n');
  await writeFile(
    join(libDir, 'src/sum.ts'),
    "import { add } from 'lib-only-dep';\n\nexport const sum = (values: number[]): number => values.reduce(add, 0);\n",
  );
  await writeFile(join(libDir, 'src/index.ts'), "export { sum } from './sum';\n");

  const appDir = join(root, 'apps/app');
  await mkdir(join(appDir, 'src/mastra'), { recursive: true });
  await mkdir(join(appDir, 'node_modules/@repo'), { recursive: true });
  await mkdir(join(appDir, 'node_modules/@mastra'), { recursive: true });
  await writeJson(join(appDir, 'package.json'), {
    name: '@repo/app',
    version: '1.0.0',
    type: 'module',
    dependencies: { '@mastra/core': '*', '@repo/lib': 'workspace:*' },
  });
  await symlink(libDir, join(appDir, 'node_modules/@repo/lib'), 'dir');
  await symlink(mastraCoreDir, join(appDir, 'node_modules/@mastra/core'), 'dir');

  const entryFile = join(appDir, 'src/mastra/index.ts');
  await writeFile(
    entryFile,
    `import { Mastra } from '@mastra/core/mastra';
import { sum } from '@repo/lib';

export const mastra = new Mastra({
  server: {
    port: 4567,
    apiRoutes: [
      {
        path: '/sum',
        method: 'GET',
        handler: async (c: { json: (body: unknown) => unknown }) => c.json({ total: sum([1, 2, 3]) }),
      },
    ],
  },
});
`,
  );

  return { appDir, entryFile };
}

describe('extractMastraOption with raw-TS workspace packages', () => {
  let root: string;
  let appDir: string;
  let entryFile: string;
  let originalCwd: string;

  beforeAll(async () => {
    root = await realpath(await mkdtemp(join(tmpdir(), 'mastra-extract-workspace-')));
    ({ appDir, entryFile } = await createRawTsWorkspace(root));
    originalCwd = process.cwd();
    process.chdir(appDir);
  });

  afterAll(async () => {
    process.chdir(originalCwd);
    await rm(root, { recursive: true, force: true });
  });

  it('inlines and transpiles workspace packages imported from apiRoutes handlers', async () => {
    const result = await extractMastraOption('server', entryFile, join(appDir, '.mastra/output'));

    expect(result).not.toBeNull();
    const code = result?.bundleOutput.output[0].code;
    expect(code).not.toContain('@repo/lib');
    // dependencies of workspace packages are resolved from the workspace package, not from the app
    expect(code).toContain('packages/lib/node_modules/lib-only-dep/index.js');

    const server = await result?.getConfig();
    expect(server?.port).toBe(4567);

    const route = server?.apiRoutes?.[0] as
      | { handler: (c: { json: (body: unknown) => unknown }) => Promise<unknown> }
      | undefined;
    const response = await route?.handler({ json: (body: unknown) => body });
    expect(response).toEqual({ total: 6 });
  });
});
