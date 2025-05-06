import { describe, it, expect } from 'vitest';
import { registerApiRoute } from './index';

describe('registerApiRoute', () => {
  it('supports registering a route for all methods', () => {
    const route = registerApiRoute('/everything', {
      method: 'ALL',
      handler: c => c.text('anything'),
    });

    expect(route.path).toBe('/everything');
    expect(route.method).toBe('ALL');
  });
});
