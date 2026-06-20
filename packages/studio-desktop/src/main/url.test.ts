import { describe, expect, it } from 'vitest';
import { buildLocalUrl, normalizeServerUrl, toModelsEndpoint } from './url';

describe('desktop URLs', () => {
  it('builds localhost URLs with stable 127.0.0.1 binding', () => {
    expect(buildLocalUrl(3133)).toBe('http://127.0.0.1:3133/');
    expect(buildLocalUrl(3133, 'agents')).toBe('http://127.0.0.1:3133/agents');
  });

  it('normalizes server URLs before deriving the models endpoint', () => {
    expect(normalizeServerUrl('http://localhost:1234/v1/')).toBe('http://localhost:1234/v1');
    expect(toModelsEndpoint('http://localhost:1234/v1/')).toBe('http://localhost:1234/v1/models');
  });
});
