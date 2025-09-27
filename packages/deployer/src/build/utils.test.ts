import { posix } from 'path';
import { describe, it, expect } from 'vitest';
import { getPackageName, getCompiledDepCachePath, slash } from './utils';

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
