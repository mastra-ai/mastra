import { describe, expect, it } from 'vitest';

// Importing from the package entry point exercises the side-effect barrel
// at src/index.ts which imports src/providers/index.ts and every generated
// provider module. Each provider self-registers by pushing into PROVIDERS.
import { PROVIDERS } from '../index.js';

describe('shipped provider registry', () => {
  it('auto-registers every provider whose directory exists under src/providers', () => {
    const integrationIds = PROVIDERS.map(p => p.integrationId).sort();
    // Generated providers ship in stacked PRs. Extend this list when those
    // provider branches land.
    expect(integrationIds).toEqual([]);
  });

  it('gives every provider the required registration fields', () => {
    for (const provider of PROVIDERS) {
      expect(provider.integrationId).toMatch(/^[a-z0-9][a-z0-9-]*$/);
      expect(provider.envVar).toMatch(/^MASTRA_[A-Z0-9_]+_CONNECTION_ID$/);
      expect(typeof provider.createTools).toBe('function');
    }
  });
});
