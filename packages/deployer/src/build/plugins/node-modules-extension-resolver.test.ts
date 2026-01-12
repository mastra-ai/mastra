import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Plugin, PluginContext } from 'rollup';
import { getPackageInfo } from 'local-pkg';
import { readFile } from 'node:fs/promises';

const mockNodeResolveHandler = vi.fn();

vi.mock('node:fs/promises', () => ({
  exists: vi.fn(),
  readFile: vi.fn(),
}));

vi.mock('local-pkg', () => ({
  getPackageInfo: vi.fn(),
}));

vi.mock('@rollup/plugin-node-resolve', () => ({
  default: () => ({
    resolveId: { handler: mockNodeResolveHandler },
  }),
}));

describe('nodeModulesExtensionResolver', () => {
  let plugin: Plugin;
  let mockContext: PluginContext;

  beforeEach(async () => {
    vi.clearAllMocks();
    vi.resetModules();

    const mod = await import('./node-modules-extension-resolver');
    plugin = mod.nodeModulesExtensionResolver();
    mockContext = {} as PluginContext;
  });

  const resolveId = (id: string, importer?: string) => {
    const fn = plugin.resolveId as Function;
    return fn.call(mockContext, id, importer, {});
  };

  describe('skips resolution for', () => {
    it('relative imports', async () => {
      const result = await resolveId('./utils', '/project/src/index.ts');
      expect(result).toBeNull();
    });

    it('absolute paths', async () => {
      const result = await resolveId('/absolute/path', '/project/src/index.ts');
      expect(result).toBeNull();
    });

    it('absolute windows paths', async () => {
      const result = await resolveId('C:\\absolute\\path', '/project/src/index.ts');
      expect(result).toBeNull();
    });

    it('imports without an importer path', async () => {
      const result = await resolveId('lodash', undefined);
      expect(result).toBeNull();
    });

    it('builtin modules', async () => {
      const result = await resolveId('fs', '/project/src/index.ts');
      expect(result).toBeNull();
    });

    it('node: prefixed builtins', async () => {
      const result = await resolveId('node:path', '/project/src/index.ts');
      expect(result).toBeNull();
    });

    it('direct package imports (non-scoped)', async () => {
      const result = await resolveId('lodash', '/project/src/index.ts');
      expect(result).toBeNull();
    });

    it('direct package imports (scoped)', async () => {
      const result = await resolveId('@mastra/core', '/project/src/index.ts');
      expect(result).toBeNull();
    });

    it('imports with an extension that have exports mapping', async () => {
      const pkgJson = { name: 'hono', exports: { 'hono/utils/mime.js': './dist/utils/mime.js' } };
      // @ts-ignore parital is fine
      vi.mocked(getPackageInfo).mockResolvedValue({ name: 'hono', rootPath: '/project/node_modules/hono' });
      // @ts-ignore  type should be correct
      vi.mocked(readFile).mockResolvedValue(JSON.stringify(pkgJson));

      const result = await resolveId('hono/utils/mime.js', '/project/src/index.ts');

      expect(result).toBeNull();
    });
  });

  describe('imports with JS extension', () => {
    it('It will resolve the import to the correct path if no exports present', async () => {
      const pkgJson = { name: 'lodash' };
      // @ts-ignore parital is fine
      vi.mocked(getPackageInfo).mockResolvedValue({ name: 'lodash', rootPath: '/project/node_modules/lodash' });
      // @ts-ignore  type should be correct
      vi.mocked(readFile).mockResolvedValue(JSON.stringify(pkgJson));

      mockNodeResolveHandler.mockResolvedValue({ id: '/project/node_modules/lodash/fp/get.js' });

      const result = await resolveId('lodash/fp/get.js', '/project/src/index.ts');

      expect(result).toMatchObject({
        external: true,
        id: 'lodash/fp/get.js',
      });
    });

    it('handles .mjs extension', async () => {
      const pkgJson = { name: 'lodash' };
      // @ts-ignore parital is fine
      vi.mocked(getPackageInfo).mockResolvedValue({ name: 'lodash', rootPath: '/project/node_modules/lodash' });
      // @ts-ignore  type should be correct
      vi.mocked(readFile).mockResolvedValue(JSON.stringify(pkgJson));

      mockNodeResolveHandler.mockResolvedValue({ id: '/project/node_modules/lodash/fp/get.mjs' });

      const result = await resolveId('lodash/fp/get.mjs', '/project/src/index.ts');

      expect(result).toMatchObject({
        external: true,
        id: 'lodash/fp/get.mjs',
      });
    });

    it('handles .cjs extension', async () => {
      const pkgJson = { name: 'lodash' };
      // @ts-ignore parital is fine
      vi.mocked(getPackageInfo).mockResolvedValue({ name: 'lodash', rootPath: '/project/node_modules/lodash' });
      // @ts-ignore  type should be correct
      vi.mocked(readFile).mockResolvedValue(JSON.stringify(pkgJson));

      mockNodeResolveHandler.mockResolvedValue({ id: '/project/node_modules/lodash/fp/get.cjs' });

      const result = await resolveId('lodash/fp/get.cjs', '/project/src/index.ts');

      expect(result).toMatchObject({
        external: true,
        id: 'lodash/fp/get.cjs',
      });
    });
  });

  describe('imports without extension', () => {
    it('resolves the import to the correct path if no exports present', async () => {
      const pkgJson = { name: 'lodash' };
      // @ts-ignore parital is fine
      vi.mocked(getPackageInfo).mockResolvedValue({ name: 'lodash', rootPath: '/project/node_modules/lodash' });
      // @ts-ignore  type should be correct
      vi.mocked(readFile).mockResolvedValue(JSON.stringify(pkgJson));

      mockNodeResolveHandler.mockResolvedValue({ id: '/project/node_modules/lodash/fp/get.cjs' });

      const result = await resolveId('lodash/fp/get', '/project/src/index.ts');

      expect(result).toMatchObject({
        external: true,
        id: 'lodash/fp/get.cjs',
      });
    });

    it('returns null when resolution fails completely', async () => {
      mockNodeResolveHandler.mockResolvedValue(null);

      const result = await resolveId('nonexistent/module', '/project/src/index.ts');

      expect(result).toBeNull();
    });
  });

  describe('scoped packages', () => {
    it('handles scoped package subpath imports with exports', async () => {
      const pkgJson = { name: '@my/lodash', exports: {} };
      // @ts-ignore parital is fine
      vi.mocked(getPackageInfo).mockResolvedValue({ name: '@my/lodash', rootPath: '/project/node_modules/@my/lodash' });
      // @ts-ignore  type should be correct
      vi.mocked(readFile).mockResolvedValue(JSON.stringify(pkgJson));

      mockNodeResolveHandler.mockResolvedValue({ id: '/project/node_modules/@my/lodash/fp/get.cjs' });

      const result = await resolveId('@my/lodash/fp/get', '/project/src/index.ts');

      expect(result).toBeNull();
    });

    it('adds extension for scoped package without exports', async () => {
      const pkgJson = { name: '@my/lodash' };
      // @ts-ignore parital is fine
      vi.mocked(getPackageInfo).mockResolvedValue({ name: '@my/lodash', rootPath: '/project/node_modules/@my/lodash' });
      // @ts-ignore  type should be correct
      vi.mocked(readFile).mockResolvedValue(JSON.stringify(pkgJson));
      // @ts-ignore Partial input is fine
      mockNodeResolveHandler.mockResolvedValue({ id: '/project/node_modules/@my/lodash/utils.cjs' });

      const result = await resolveId('@my/lodash/utils', '/project/src/index.ts');

      expect(result).toEqual({ id: '@my/lodash/utils.cjs', external: true });
    });
  });

  describe('edge cases', () => {
    it('handles package.json read failure gracefully', async () => {
      const pkgJson = { name: '@my/lodash' };
      // @ts-ignore parital is fine
      vi.mocked(getPackageInfo).mockResolvedValue({ name: '@my/lodash', rootPath: '/project/node_modules/@my/lodash' });

      vi.mocked(readFile).mockImplementation(() => {
        throw new Error('ENOENT');
      });

      const result = await resolveId('broken/utils', '/project/src/index.ts');

      // Falls through to non-exports path
      expect(result).toBeNull();
    });
  });
});
