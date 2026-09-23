import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';

import { GeoIpKnownSchema, GeoIpLookupResultSchema } from '../../src/providers/geoip-contracts.js';

describe('integration GeoIP boundaries', () => {
  it('keeps cache persistence independent from the concrete provider', async () => {
    const source = await readFile('src/db/geoip-cache-operations.ts', 'utf8');

    expect(source).toContain('../providers/geoip-contracts.js');
    expect(source).not.toContain('../providers/geoip-provider.js');
  });

  it('keeps the extracted cache evidence contract strict', () => {
    const known = {
      outcome: 'known' as const,
      countryCode: 'BR',
      observedAt: '2026-09-01T12:00:00.000Z',
      provider: 'ipinfo-lite' as const,
      confidence: 0.7 as const,
      confidenceProvenance: 'policy-v1' as const,
    };

    expect(GeoIpKnownSchema.parse(known)).toEqual(known);
    expect(GeoIpLookupResultSchema.safeParse({ ...known, extra: true }).success).toBe(false);
  });
});
