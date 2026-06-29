import { describe, expect, it } from 'vitest';

import { getMastraRoutePath } from '../utils/route-path';

describe('getMastraRoutePath', () => {
  it('returns the original path when no prefix is configured', () => {
    expect(getMastraRoutePath('/agents')).toBe('/agents');
    expect(getMastraRoutePath('/agents', '')).toBe('/agents');
  });

  it('normalizes and strips a matching prefix', () => {
    expect(getMastraRoutePath('/api/agents', '/api')).toBe('/agents');
    expect(getMastraRoutePath('/api/agents', 'api')).toBe('/agents');
    expect(getMastraRoutePath('/api/agents', '/api/')).toBe('/agents');
  });

  it('normalizes an exact prefix match to the root route', () => {
    expect(getMastraRoutePath('/api', '/api')).toBe('/');
  });

  it('returns null for paths outside the configured prefix', () => {
    expect(getMastraRoutePath('/agents', '/api')).toBeNull();
    expect(getMastraRoutePath('/apiish/agents', '/api')).toBeNull();
  });
});
