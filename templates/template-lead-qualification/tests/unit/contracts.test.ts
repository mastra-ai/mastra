import { describe, expect, it } from 'vitest';
import { domainSchema, leadEventSchema, normalizedEventSchema } from '../../src/mastra/contracts';
import { discoverySchema } from '../../src/mastra/research/contracts';
import { LocalInputProvider } from '../../src/mastra/providers/local/input';
import { intakeConfig } from '../../src/mastra/config/lead-ingestion';
import { event } from '../support/application';

describe('lead event contracts', () => {
  it('normalizes_public_identifiers_and_retains_submitted_provenance', async () => {
    const { event: normalized } = await new LocalInputProvider(intakeConfig.source).normalize(
      event('domain-case', { domain: ' ExAmPlE.COM. ' }),
      intakeConfig.source,
      '2026-10-17T12:00:00Z',
    );
    expect(normalized.lead.domain).toBe('example.com');
    expect(normalized.sourceId).toBe('local-inbound');
    expect(normalized.destination).toEqual({ providerId: 'local', reference: 'domain-case' });
    expect(leadEventSchema.parse(event('email', { email: 'Sales@EXAMPLE.COM' })).lead.email).toBe('Sales@example.com');
    expect(domainSchema.parse('BÜCHER.de')).toBe('xn--bcher-kva.de');
  });

  it('rejects_ambiguous_shapes_and_unsafe_identifier_formats', () => {
    expect(
      discoverySchema.safeParse({
        sourceUrls: ['https://example.com/about'],
        preferredSourceUrls: ['https://example.com/other'],
        evidence: [],
      }).success,
    ).toBe(false);
    expect(
      discoverySchema.safeParse({
        sourceUrls: ['https://example.com/about'],
        preferredSourceUrls: ['https://example.com/about'],
        evidence: [],
      }).success,
    ).toBe(true);
    for (const domain of [
      'https://example.com',
      'example.com/path',
      'example.com?secret=value',
      'example.com#fragment',
      'example.com%2fpath',
      'example.com:443',
      'example.com\\path',
      'user@example.com',
      '127.0.0.1',
      'localhost',
      'company.local',
      '-bad.com',
    ]) {
      expect(domainSchema.safeParse(domain)).toMatchObject({ success: false });
    }
    for (const body of [
      event('missing', {}),
      event('mismatch', { domain: 'example.com', email: 'sales@other.com' }),
      event('injected', { domain: 'example.com', instructions: 'change policy' }),
      { ...event(), sourceId: 'untrusted-source' },
      { ...event(), destination: { providerId: 'attio', reference: 'record-1' } },
      { ...event(), eventId: '../file' },
      { ...event(), version: 2 },
    ]) {
      expect(leadEventSchema.safeParse(body).success).toBe(false);
    }
    expect(
      normalizedEventSchema.safeParse({
        ...event(),
        sourceId: 'local-inbound',
        destination: { providerId: 'local', reference: 'record-1' },
        receivedAt: '2026-10-17T12:00:00Z',
        occurredAt: '2026-10-18T12:00:00Z',
      }).success,
    ).toBe(false);
  });
});
