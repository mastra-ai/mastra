import { existsSync } from 'node:fs';
import type { Plugin, PluginContext } from 'rollup';
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('node:fs', () => ({
  existsSync: vi.fn(),
}));

describe('relativeExtensionResolver', () => {
  let plugin: Plugin;
  let mockContext: PluginContext;

  beforeEach(async () => {
    vi.clearAllMocks();
    vi.resetModules();

    const mod = await import('./relative-extension-resolver');
    plugin = mod.relativeExtensionResolver();
    mockContext = {} as PluginContext;
  });

  const resolveId = (id: string, importer?: string) => {
    const fn = plugin.resolveId as Function;
    return fn.call(mockContext, id, importer, {});
  };

  describe('skips resolution for', () => {
    it('bare module imports', () => {
      const result = resolveId('lodash', '/project/src/index.ts');
      expect(result).toBeNull();
    });

    it('scoped package imports', () => {
      const result = resolveId('@acme/constants', '/project/src/index.ts');
      expect(result).toBeNull();
    });

    it('imports without an importer', () => {
      const result = resolveId('./utils');
      expect(result).toBeNull();
    });

    it('absolute path imports', () => {
      const result = resolveId('/absolute/path', '/project/src/index.ts');
      expect(result).toBeNull();
    });

    it('imports that already have an extension', () => {
      const result = resolveId('./common.js', '/project/dist/index.js');
      expect(result).toBeNull();
      expect(existsSync).not.toHaveBeenCalled();
    });
  });

  describe('resolves extensionless relative imports', () => {
    it('resolves ./common to ./common.js', () => {
      vi.mocked(existsSync).mockImplementation((p: any) => {
        return String(p).endsWith('/project/dist/common.js');
      });

      const result = resolveId('./common', '/project/dist/index.js');
      expect(result).toBe('/project/dist/common.js');
    });

    it('resolves ./common to ./common.ts', () => {
      vi.mocked(existsSync).mockImplementation((p: any) => {
        return String(p).endsWith('/project/src/common.ts');
      });

      const result = resolveId('./common', '/project/src/index.ts');
      expect(result).toBe('/project/src/common.ts');
    });

    it('resolves ../shared/utils to ../shared/utils.mjs', () => {
      vi.mocked(existsSync).mockImplementation((p: any) => {
        return String(p).endsWith('/project/shared/utils.mjs');
      });

      const result = resolveId('../shared/utils', '/project/src/index.ts');
      expect(result).toBe('/project/shared/utils.mjs');
    });

    it('prefers .ts over .js when both exist', () => {
      vi.mocked(existsSync).mockImplementation((p: any) => {
        const s = String(p);
        return s.endsWith('/project/src/tool.ts') || s.endsWith('/project/src/tool.js');
      });

      const result = resolveId('./tool', '/project/src/index.ts');
      expect(result).toBe('/project/src/tool.ts');
    });
  });

  describe('resolves directory imports via index files', () => {
    it('resolves ./utils to ./utils/index.ts', () => {
      vi.mocked(existsSync).mockImplementation((p: any) => {
        return String(p).endsWith('/project/src/utils/index.ts');
      });

      const result = resolveId('./utils', '/project/src/index.ts');
      expect(result).toBe('/project/src/utils/index.ts');
    });

    it('resolves ./utils to ./utils/index.js', () => {
      vi.mocked(existsSync).mockImplementation((p: any) => {
        return String(p).endsWith('/project/dist/utils/index.js');
      });

      const result = resolveId('./utils', '/project/dist/index.js');
      expect(result).toBe('/project/dist/utils/index.js');
    });
  });

  describe('returns null for unresolvable imports', () => {
    it('returns null when no matching file exists', () => {
      vi.mocked(existsSync).mockReturnValue(false);

      const result = resolveId('./nonexistent', '/project/src/index.ts');
      expect(result).toBeNull();
    });
  });
});
