import { describe, it, expect } from 'vitest';
import { getPackageName } from './utils';

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
