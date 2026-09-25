import { describe, expect, it } from 'vitest';

// Importing from the package entry point exercises the generated barrel at
// src/providers/index.ts, which assembles TOOLS declaratively from each
// generated provider module's exported registration const.
// eslint-disable-next-line @typescript-eslint/no-deprecated
import { PROVIDERS, TOOLS } from '../index.js';

describe('shipped provider registry', () => {
  it('exports TOOLS as the canonical registry with PROVIDERS as a deprecated alias', () => {
    // eslint-disable-next-line @typescript-eslint/no-deprecated
    expect(PROVIDERS).toBe(TOOLS);
  });

  it('collects every provider whose directory exists under src/providers', () => {
    const integrationIds = PROVIDERS.map(p => p.integrationId).sort();
    // Extend this list when generated provider branches land.
    expect(integrationIds).toEqual([
      'anthropic',
      'clerk',
      'discord',
      'fireflies',
      'github',
      'google-calendar',
      'google-mail',
      'hubspot',
      'incident-io',
      'jira',
      'linear',
      'notion',
      'openai',
      'posthog',
      'resend',
      'slack',
      'snowflake',
      'stripe',
      'supabase',
      'twitter-v2',
      'workos',
    ]);
  });

  it('gives every provider the required registration fields', () => {
    for (const provider of PROVIDERS) {
      expect(provider.integrationId).toMatch(/^[a-z0-9][a-z0-9-]*$/);
      expect(provider.envVar).toMatch(/^MASTRA_[A-Z0-9_]+_CONNECTION_ID$/);
      expect(provider.transport).not.toBe('mcp');
      if (provider.transport !== 'mcp') expect(typeof provider.createTools).toBe('function');
    }
  });
});
