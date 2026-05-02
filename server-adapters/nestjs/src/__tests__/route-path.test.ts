import { describe, expect, it } from 'vitest';

import { getMastraRoutePath } from '../utils/route-path';

describe('getMastraRoutePath', () => {
  it('strips the configured prefix for Mastra routes', () => {
    expect(getMastraRoutePath('/api/agents', '/api')).toBe('/agents');
    expect(getMastraRoutePath('/api', '/api')).toBe('/');
  });

  it('rejects paths outside the configured prefix', () => {
    expect(getMastraRoutePath('/agents', '/api')).toBeNull();
    expect(getMastraRoutePath('/apiish/agents', '/api')).toBeNull();
  });

  it('keeps unprefixed matching when no prefix is configured', () => {
    expect(getMastraRoutePath('/agents', '')).toBe('/agents');
  });
});
