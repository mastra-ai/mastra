import { describe, expect, it } from 'vitest';

// Importing from the package entry point exercises the generated barrel at
// src/providers/index.ts, which assembles PROVIDERS declaratively from each
// generated provider module's exported registration const.
import { PROVIDERS } from '../index.js';

describe('shipped provider registry', () => {
  it('collects every provider whose directory exists under src/providers', () => {
    const integrationIds = PROVIDERS.map(p => p.integrationId).sort();
    // Extend this list when generated provider branches land.
    expect(integrationIds).toEqual(['anthropic', 'linear', 'notion', 'openai', 'supabase']);
  });

  it('gives every provider the required registration fields', () => {
    for (const provider of PROVIDERS) {
      expect(provider.integrationId).toMatch(/^[a-z0-9][a-z0-9-]*$/);
      expect(provider.envVar).toMatch(/^MASTRA_[A-Z0-9_]+_CONNECTION_ID$/);
      expect(typeof provider.createTools).toBe('function');
    }
  });
});
