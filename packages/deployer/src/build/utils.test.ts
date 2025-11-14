import { posix } from 'path';
import { describe, it, expect } from 'vitest';
import { getPackageName, getCompiledDepCachePath, slash, findNativePackageModule } from './utils';

describe('getPackageName', () => {
  it('should return the full scoped package name for scoped packages', () => {
    expect(getPackageName('@scope/package')).toBe('@scope/package');
    expect(getPackageName('@scope/package/subpath')).toBe('@scope/package');
  });

  it('should return the first part for unscoped packages', () => {
    expect(getPackageName('package')).toBe('package');
    expect(getPackageName('package/subpath')).toBe('package');
  });

  it('should handle empty string', () => {
    expect(getPackageName('')).toBe('');
  });

  it('should handle only scope', () => {
    expect(getPackageName('@scope')).toBe('@scope');
  });

  it('should handle multiple slashes', () => {
    expect(getPackageName('foo/bar/baz')).toBe('foo');
    expect(getPackageName('@scope/foo/bar/baz')).toBe('@scope/foo');
  });
});

describe('getCompiledDepCachePath', () => {
  it('should generate the correct cache path for a regular package', () => {
    const rootPath = '/path/to/package';
    const packageName = 'my-package';
    const expected = posix.join('/path/to/package', 'node_modules', '.cache', 'my-package');

    const result = getCompiledDepCachePath(rootPath, packageName);

    expect(result).toBe(expected);
  });
});

describe('slash', () => {
  describe('Windows paths', () => {
    it('should convert Windows backslashes to forward slashes', () => {
      expect(slash('C:\\Users\\user\\code\\mastra')).toBe('C:/Users/user/code/mastra');
    });

    it('should handle relative Windows paths', () => {
      expect(slash('src\\components\\Button.tsx')).toBe('src/components/Button.tsx');
    });

    it('should handle mixed separators', () => {
      expect(slash('C:\\Users/user\\code/mastra')).toBe('C:/Users/user/code/mastra');
    });

    it('should handle single backslash', () => {
      expect(slash('folder\\file.txt')).toBe('folder/file.txt');
    });
  });

  describe('POSIX paths', () => {
    it('should leave forward slashes unchanged', () => {
      expect(slash('/home/user/code/mastra')).toBe('/home/user/code/mastra');
    });

    it('should leave relative POSIX paths unchanged', () => {
      expect(slash('src/components/Button.tsx')).toBe('src/components/Button.tsx');
    });
  });

  describe('Extended-length paths', () => {
    it('should not modify UNC extended-length paths', () => {
      const extendedPath = '\\\\?\\C:\\very\\long\\path\\name';
      expect(slash(extendedPath)).toBe(extendedPath);
    });

    it('should not modify UNC server extended-length paths', () => {
      const extendedPath = '\\\\?\\UNC\\server\\share\\file';
      expect(slash(extendedPath)).toBe(extendedPath);
    });

    it('should handle extended-length path variations', () => {
      const extendedPath = '\\\\?\\D:\\some\\very\\long\\directory\\structure';
      expect(slash(extendedPath)).toBe(extendedPath);
    });
  });

  describe('Edge cases', () => {
    it('should handle empty string', () => {
      expect(slash('')).toBe('');
    });

    it('should handle single character', () => {
      expect(slash('\\')).toBe('/');
      expect(slash('/')).toBe('/');
    });

    it('should handle only separators', () => {
      expect(slash('\\\\')).toBe('//');
      expect(slash('//')).toBe('//');
    });

    it('should handle filename without path', () => {
      expect(slash('file.txt')).toBe('file.txt');
    });

    it('should handle path with trailing separator', () => {
      expect(slash('C:\\Users\\user\\')).toBe('C:/Users/user/');
    });

    it('should handle path with leading separator', () => {
      expect(slash('\\Users\\user')).toBe('/Users/user');
    });
  });

  describe('Real-world examples', () => {
    it('should handle typical Windows absolute paths', () => {
      expect(slash('C:\\Program Files\\Node.js\\node.exe')).toBe('C:/Program Files/Node.js/node.exe');
    });

    it('should handle Windows relative paths with parent directories', () => {
      expect(slash('..\\..\\src\\index.ts')).toBe('../../src/index.ts');
    });

    it('should handle node_modules paths', () => {
      expect(slash('node_modules\\@types\\node\\index.d.ts')).toBe('node_modules/@types/node/index.d.ts');
    });

    it('should handle workspace package paths', () => {
      expect(slash('packages\\shared\\src\\utils.ts')).toBe('packages/shared/src/utils.ts');
    });
  });
});

describe('findNativePackageModule', () => {
  describe('Basic filtering', () => {
    it('should return the first real node_modules package', () => {
      const moduleIds = ['/Users/user/project/node_modules/bcrypt/bcrypt.js', '/Users/user/project/src/index.js'];
      expect(findNativePackageModule(moduleIds)).toBe('/Users/user/project/node_modules/bcrypt/bcrypt.js');
    });

    it('should skip virtual modules (prefixed with \\x00)', () => {
      const moduleIds = [
        '\x00/Users/user/project/node_modules/bcrypt/bcrypt.js?commonjs-module',
        '/Users/user/project/node_modules/bcrypt/bcrypt.js',
      ];
      expect(findNativePackageModule(moduleIds)).toBe('/Users/user/project/node_modules/bcrypt/bcrypt.js');
    });

    it('should skip non-node_modules paths', () => {
      const moduleIds = [
        '/Users/user/project/src/utils.js',
        '/Users/user/project/packages/tools/index.js',
        '/Users/user/project/node_modules/sharp/lib/index.js',
      ];
      expect(findNativePackageModule(moduleIds)).toBe('/Users/user/project/node_modules/sharp/lib/index.js');
    });

    it('should return undefined if no node_modules packages found', () => {
      const moduleIds = [
        '/Users/user/project/src/index.js',
        '/Users/user/project/packages/tools/index.js',
        '\x00virtual-module',
      ];
      expect(findNativePackageModule(moduleIds)).toBeUndefined();
    });

    it('should return undefined for empty array', () => {
      expect(findNativePackageModule([])).toBeUndefined();
    });
  });

  describe('Native binding loader filtering', () => {
    it('should skip node-gyp-build', () => {
      const moduleIds = [
        '/Users/user/project/node_modules/node-gyp-build/index.js',
        '/Users/user/project/node_modules/bcrypt/bcrypt.js',
      ];
      expect(findNativePackageModule(moduleIds)).toBe('/Users/user/project/node_modules/bcrypt/bcrypt.js');
    });

    it('should skip prebuild-install', () => {
      const moduleIds = [
        '/Users/user/project/node_modules/prebuild-install/index.js',
        '/Users/user/project/node_modules/sharp/lib/index.js',
      ];
      expect(findNativePackageModule(moduleIds)).toBe('/Users/user/project/node_modules/sharp/lib/index.js');
    });

    it('should skip bindings', () => {
      const moduleIds = [
        '/Users/user/project/node_modules/bindings/index.js',
        '/Users/user/project/node_modules/sqlite3/lib/sqlite3.js',
      ];
      expect(findNativePackageModule(moduleIds)).toBe('/Users/user/project/node_modules/sqlite3/lib/sqlite3.js');
    });

    it('should skip node-addon-api', () => {
      const moduleIds = [
        '/Users/user/project/node_modules/node-addon-api/index.js',
        '/Users/user/project/node_modules/better-sqlite3/lib/index.js',
      ];
      expect(findNativePackageModule(moduleIds)).toBe('/Users/user/project/node_modules/better-sqlite3/lib/index.js');
    });

    it('should skip node-pre-gyp', () => {
      const moduleIds = [
        '/Users/user/project/node_modules/node-pre-gyp/lib/index.js',
        '/Users/user/project/node_modules/canvas/lib/canvas.js',
      ];
      expect(findNativePackageModule(moduleIds)).toBe('/Users/user/project/node_modules/canvas/lib/canvas.js');
    });

    it('should skip nan (Native Abstractions for Node.js)', () => {
      const moduleIds = [
        '/Users/user/project/node_modules/nan/nan.h',
        '/Users/user/project/node_modules/leveldown/binding.js',
      ];
      expect(findNativePackageModule(moduleIds)).toBe('/Users/user/project/node_modules/leveldown/binding.js');
    });

    it('should skip multiple loaders and return first real package', () => {
      const moduleIds = [
        '/Users/user/project/node_modules/node-gyp-build/index.js',
        '/Users/user/project/node_modules/prebuild-install/index.js',
        '/Users/user/project/node_modules/bindings/bindings.js',
        '/Users/user/project/node_modules/bcrypt/bcrypt.js',
      ];
      expect(findNativePackageModule(moduleIds)).toBe('/Users/user/project/node_modules/bcrypt/bcrypt.js');
    });
  });

  describe('pnpm paths', () => {
    it('should handle pnpm virtual store paths', () => {
      const moduleIds = [
        '/Users/user/project/node_modules/.pnpm/node-gyp-build@4.8.4/node_modules/node-gyp-build/index.js',
        '/Users/user/project/node_modules/.pnpm/bcrypt@6.0.0/node_modules/bcrypt/bcrypt.js',
      ];
      expect(findNativePackageModule(moduleIds)).toBe(
        '/Users/user/project/node_modules/.pnpm/bcrypt@6.0.0/node_modules/bcrypt/bcrypt.js',
      );
    });

    it('should skip loaders with version in pnpm paths', () => {
      const moduleIds = [
        '/Users/user/project/node_modules/.pnpm/node-gyp-build@4.8.4/node_modules/node-gyp-build/index.js',
        '/Users/user/project/node_modules/.pnpm/sharp@0.33.0/node_modules/sharp/lib/index.js',
      ];
      expect(findNativePackageModule(moduleIds)).toBe(
        '/Users/user/project/node_modules/.pnpm/sharp@0.33.0/node_modules/sharp/lib/index.js',
      );
    });

    it('should handle complex pnpm dependency chains', () => {
      const moduleIds = [
        '\x00/project/node_modules/.pnpm/bcrypt@6.0.0/node_modules/bcrypt/bcrypt.js?commonjs-module',
        '\x00commonjs-dynamic-modules',
        '/project/node_modules/.pnpm/node-gyp-build@4.8.4/node_modules/node-gyp-build/node-gyp-build.js',
        '/project/node_modules/.pnpm/node-gyp-build@4.8.4/node_modules/node-gyp-build/index.js',
        '/project/node_modules/.pnpm/bcrypt@6.0.0/node_modules/bcrypt/promises.js',
        '/project/node_modules/.pnpm/bcrypt@6.0.0/node_modules/bcrypt/bcrypt.js',
      ];
      expect(findNativePackageModule(moduleIds)).toBe(
        '/project/node_modules/.pnpm/bcrypt@6.0.0/node_modules/bcrypt/promises.js',
      );
    });
  });

  describe('Real-world scenarios', () => {
    it('should identify sharp as the native package', () => {
      const moduleIds = [
        '/Users/user/project/node_modules/prebuild-install/bin.js',
        '/Users/user/project/node_modules/sharp/lib/libvips.js',
        '/Users/user/project/node_modules/sharp/lib/index.js',
        '/Users/user/project/src/image-processor.js',
      ];
      expect(findNativePackageModule(moduleIds)).toBe('/Users/user/project/node_modules/sharp/lib/libvips.js');
    });

    it('should handle workspace packages using native dependencies', () => {
      const moduleIds = [
        '\x00commonjs-modules',
        '/Users/user/project/node_modules/.pnpm/node-gyp-build@4.8.4/node_modules/node-gyp-build/index.js',
        '/Users/user/project/node_modules/.pnpm/better-sqlite3@9.0.0/node_modules/better-sqlite3/lib/index.js',
        '/Users/user/project/packages/database-wrapper/src/index.ts',
        '/Users/user/project/packages/api/src/routes.ts',
        '\x00virtual-entry',
      ];
      expect(findNativePackageModule(moduleIds)).toBe(
        '/Users/user/project/node_modules/.pnpm/better-sqlite3@9.0.0/node_modules/better-sqlite3/lib/index.js',
      );
    });
  });

  describe('Edge cases', () => {
    it('should handle paths with loader names in package names', () => {
      const moduleIds = [
        '/Users/user/project/node_modules/my-node-gyp-build-wrapper/index.js',
        '/Users/user/project/node_modules/bcrypt/bcrypt.js',
      ];
      expect(findNativePackageModule(moduleIds)).toBe(
        '/Users/user/project/node_modules/my-node-gyp-build-wrapper/index.js',
      );
    });

    it('should handle scoped packages', () => {
      const moduleIds = [
        '/Users/user/project/node_modules/@company/native-module/index.js',
        '/Users/user/project/src/index.js',
      ];
      expect(findNativePackageModule(moduleIds)).toBe(
        '/Users/user/project/node_modules/@company/native-module/index.js',
      );
    });

    it('should handle querystring suffixes', () => {
      const moduleIds = [
        '\x00/Users/user/project/node_modules/bcrypt/bcrypt.js?commonjs-module&external',
        '/Users/user/project/node_modules/bcrypt/bcrypt.js?commonjs-module',
        '/Users/user/project/node_modules/bcrypt/bcrypt.js',
      ];
      expect(findNativePackageModule(moduleIds)).toBe(
        '/Users/user/project/node_modules/bcrypt/bcrypt.js?commonjs-module',
      );
    });
  });
});
