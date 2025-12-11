import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Plugin, PluginContext } from 'rollup';

const mockResolveFrom = vi.fn();
const mockReadFileSync = vi.fn();
const mockNodeResolveHandler = vi.fn();

vi.mock('resolve-from', () => ({
  default: (importer: string, id: string) => mockResolveFrom(importer, id),
}));

vi.mock('node:fs', () => ({
  readFileSync: (path: string, encoding: string) => mockReadFileSync(path, encoding),
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

    it('imports without importer', async () => {
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
  });

  describe('imports with JS extension', () => {
    it('strips extension for package with exports field', async () => {
      mockResolveFrom.mockReturnValue('/project/node_modules/hono/dist/index.js');
      mockReadFileSync.mockReturnValue(JSON.stringify({ name: 'hono', exports: { '.': './dist/index.js' } }));

      const result = await resolveId('hono/utils/mime.js', '/project/src/index.ts');

      expect(result).toEqual({ id: 'hono/utils/mime', external: true });
    });

    it('keeps extension for package without exports field', async () => {
      mockResolveFrom.mockReturnValue('/project/node_modules/lodash/index.js');
      mockReadFileSync.mockReturnValue(JSON.stringify({ name: 'lodash' }));

      const result = await resolveId('lodash/fp/get.js', '/project/src/index.ts');

      expect(result).toEqual({ id: 'lodash/fp/get.js', external: true });
    });

    it('handles .mjs extension', async () => {
      mockResolveFrom.mockReturnValue('/project/node_modules/pkg/index.mjs');
      mockReadFileSync.mockReturnValue(JSON.stringify({ name: 'pkg' }));

      const result = await resolveId('pkg/utils.mjs', '/project/src/index.ts');

      expect(result).toEqual({ id: 'pkg/utils.mjs', external: true });
    });

    it('handles .cjs extension', async () => {
      mockResolveFrom.mockReturnValue('/project/node_modules/pkg/index.cjs');
      mockReadFileSync.mockReturnValue(JSON.stringify({ name: 'pkg' }));

      const result = await resolveId('pkg/utils.cjs', '/project/src/index.ts');

      expect(result).toEqual({ id: 'pkg/utils.cjs', external: true });
    });
  });

  describe('imports without extension', () => {
    it('marks as external when package has exports', async () => {
      // Package with exports field - Node.js resolves via exports map
      mockResolveFrom.mockReturnValue('/project/node_modules/date-fns/dist/format.js');
      mockReadFileSync.mockReturnValue(
        JSON.stringify({ name: 'date-fns', exports: { './format': './dist/format.js' } }),
      );
      mockNodeResolveHandler.mockResolvedValue({ id: '/project/node_modules/date-fns/dist/format.js' });

      const result = await resolveId('date-fns/format', '/project/src/index.ts');

      expect(result).toEqual({ id: 'date-fns/format', external: true });
    });

    it('adds extension when node-resolve finds file but direct resolve fails', async () => {
      // Simulate: node-resolve finds file, but direct safeResolve fails, then succeeds with .js
      mockNodeResolveHandler.mockResolvedValue({ id: '/project/node_modules/lodash/fp/get.js' });
      mockResolveFrom
        .mockReturnValueOnce(null) // safeResolve(id) fails
        .mockReturnValueOnce('/project/node_modules/lodash/fp/get.js'); // safeResolve(id + '.js') succeeds

      const result = await resolveId('lodash/fp/get', '/project/src/index.ts');

      expect(result).toEqual({ id: 'lodash/fp/get.js', external: true });
    });

    it('returns null when resolution fails completely', async () => {
      mockNodeResolveHandler.mockResolvedValue(null);

      const result = await resolveId('nonexistent/module', '/project/src/index.ts');

      expect(result).toBeNull();
    });

    it('keeps import as-is for package with exports field', async () => {
      mockResolveFrom.mockReturnValue('/project/node_modules/hono/dist/utils/mime.js');
      mockReadFileSync.mockReturnValue(JSON.stringify({ name: 'hono', exports: { './*': './dist/*.js' } }));
      mockNodeResolveHandler.mockResolvedValue({ id: '/project/node_modules/hono/dist/utils/mime.js' });

      const result = await resolveId('hono/utils/mime', '/project/src/index.ts');

      expect(result).toEqual({ id: 'hono/utils/mime', external: true });
    });

    it('adds extension for subpath matching resolved file', async () => {
      // lodash/fp/get resolves to /node_modules/lodash/fp/get.js
      mockResolveFrom.mockReturnValue('/project/node_modules/lodash/fp/get.js');
      mockReadFileSync.mockReturnValue(JSON.stringify({ name: 'lodash' })); // no exports
      mockNodeResolveHandler.mockResolvedValue({ id: '/project/node_modules/lodash/fp/get.js' });

      const result = await resolveId('lodash/fp/get', '/project/src/index.ts');

      expect(result).toEqual({ id: 'lodash/fp/get.js', external: true });
    });
  });

  describe('scoped packages', () => {
    it('handles scoped package subpath imports with exports', async () => {
      mockResolveFrom.mockReturnValue('/project/node_modules/@org/pkg/dist/utils.js');
      mockReadFileSync.mockReturnValue(JSON.stringify({ name: '@org/pkg', exports: { './*': './dist/*.js' } }));
      mockNodeResolveHandler.mockResolvedValue({ id: '/project/node_modules/@org/pkg/dist/utils.js' });

      const result = await resolveId('@org/pkg/utils', '/project/src/index.ts');

      expect(result).toEqual({ id: '@org/pkg/utils', external: true });
    });

    it('adds extension for scoped package without exports', async () => {
      mockResolveFrom.mockReturnValue('/project/node_modules/@org/pkg/utils.js');
      mockReadFileSync.mockReturnValue(JSON.stringify({ name: '@org/pkg' })); // no exports
      mockNodeResolveHandler.mockResolvedValue({ id: '/project/node_modules/@org/pkg/utils.js' });

      const result = await resolveId('@org/pkg/utils', '/project/src/index.ts');

      expect(result).toEqual({ id: '@org/pkg/utils.js', external: true });
    });
  });

  describe('edge cases', () => {
    it('handles package.json read failure gracefully', async () => {
      mockResolveFrom.mockReturnValue('/project/node_modules/broken/index.js');
      mockReadFileSync.mockImplementation(() => {
        throw new Error('ENOENT');
      });

      const result = await resolveId('broken/utils.js', '/project/src/index.ts');

      // Falls through to non-exports path
      expect(result).toEqual({ id: 'broken/utils.js', external: true });
    });

    it('handles resolved path without JS extension', async () => {
      mockResolveFrom.mockReturnValue('/project/node_modules/pkg/data.json');
      mockReadFileSync.mockReturnValue(JSON.stringify({ name: 'pkg' }));
      mockNodeResolveHandler.mockResolvedValue({ id: '/project/node_modules/pkg/data.json' });

      const result = await resolveId('pkg/data', '/project/src/index.ts');

      expect(result).toEqual({ id: 'pkg/data', external: true });
    });
  });
});
