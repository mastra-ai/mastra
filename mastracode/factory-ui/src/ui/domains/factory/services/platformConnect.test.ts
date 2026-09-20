import { describe, expect, it } from 'vitest';

import {
  KNOWLEDGE_IMPORTER_PROVIDER_IDS,
  PLATFORM_CONNECT_PROVIDERS,
  type PlatformConnectProviderId,
} from './platformConnect';

/**
 * The SPA registry mirrors the server's `PLATFORM_CONNECT_PROVIDERS`
 * (`mastracode/factory/src/integrations/platform/connect/routes.ts`). Any
 * drift here would produce dead entries (SPA offers a slug the server
 * doesn't accept) or unroutable connections (server accepts a slug the SPA
 * doesn't know about). This test locks both sides together at the ID level.
 *
 * The server-side counterpart lives in
 * `mastracode/factory/src/integrations/platform/connect/routes.test.ts`.
 */
const EXPECTED_IDS = [
  'jira',
  'incident-io',
  'notion',
  'confluence',
  'linear',
  'zendesk',
  'fireflies',
] as const satisfies readonly PlatformConnectProviderId[];

describe('PLATFORM_CONNECT_PROVIDERS SPA registry', () => {
  it.each(EXPECTED_IDS)('registers %s with a displayName and authKind', id => {
    const meta = PLATFORM_CONNECT_PROVIDERS[id];
    expect(meta).toBeDefined();
    expect(meta.id).toBe(id);
    expect(meta.displayName.length).toBeGreaterThan(0);
    expect(['oauth', 'apiKey']).toContain(meta.authKind);
  });

  it('has exactly the expected slug set (no drift from server)', () => {
    expect(Object.keys(PLATFORM_CONNECT_PROVIDERS).sort()).toEqual([...EXPECTED_IDS].sort());
  });

  it('lists five knowledge importer slugs, jira excluded (already surfaced via intake)', () => {
    expect([...KNOWLEDGE_IMPORTER_PROVIDER_IDS]).toEqual(['notion', 'confluence', 'linear', 'zendesk', 'fireflies']);
    expect(KNOWLEDGE_IMPORTER_PROVIDER_IDS).not.toContain('jira');
  });

  it('every knowledge importer slug is present in the SPA registry', () => {
    for (const id of KNOWLEDGE_IMPORTER_PROVIDER_IDS) {
      expect(PLATFORM_CONNECT_PROVIDERS[id]).toBeDefined();
    }
  });
});
