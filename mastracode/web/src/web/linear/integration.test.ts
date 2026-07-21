import { describe, expect, it } from 'vitest';

import { LinearIntegration } from './integration.js';

describe('LinearIntegration FactoryIntegration surface', () => {
  it('provides normalized intake without claiming source-control support', () => {
    const linear = new LinearIntegration({ clientId: 'linear-client', clientSecret: 'linear-secret' });

    expect(linear.id).toBe('linear');
    expect(linear.intake).toBeDefined();
    expect('sourceControl' in linear).toBe(false);
  });

  it('throws listing every missing required field', () => {
    expect(() => new LinearIntegration({ clientId: '', clientSecret: '' })).toThrow(/clientId, clientSecret/);
  });
});
