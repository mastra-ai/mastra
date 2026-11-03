import { describe, expect, it } from 'vitest';
import { LiveKitSessionMetadataSchema, parseSessionMetadata, serializeSessionMetadata } from './metadata';

describe('parseSessionMetadata', () => {
  it('parses a JSON object', () => {
    expect(parseSessionMetadata('{"agentId":"support","threadId":"t1"}')).toEqual({
      agentId: 'support',
      threadId: 't1',
    });
  });

  it('returns an empty object for missing metadata', () => {
    expect(parseSessionMetadata(undefined)).toEqual({});
    expect(parseSessionMetadata(null)).toEqual({});
    expect(parseSessionMetadata('')).toEqual({});
  });

  it('returns an empty object for non-JSON metadata', () => {
    expect(parseSessionMetadata('not json')).toEqual({});
  });

  it('returns an empty object for non-object JSON', () => {
    expect(parseSessionMetadata('["a"]')).toEqual({});
    expect(parseSessionMetadata('"hello"')).toEqual({});
    expect(parseSessionMetadata('42')).toEqual({});
  });

  it('round-trips through serializeSessionMetadata', () => {
    const metadata = {
      agentId: 'support',
      threadId: 'thread-1',
      resourceId: 'user-1',
      requestContext: { tenant: 'acme' },
    };
    expect(parseSessionMetadata(serializeSessionMetadata(metadata))).toEqual(metadata);
  });

  it('keeps legacy metadata permissive, including custom fields with the new name', () => {
    const metadata = { agentId: 42, sessionConfig: 'application-defined', custom: ['value'] };
    expect(parseSessionMetadata(JSON.stringify(metadata))).toEqual(metadata);
  });
});

describe('validated session metadata', () => {
  it('accepts legacy fields without requiring session configuration or adding defaults', () => {
    const metadata = { agentId: 'support', requestContext: { tenant: 'acme' }, custom: { value: 42 } };
    expect(parseSessionMetadata(JSON.stringify(metadata), { validate: true })).toEqual(metadata);
    for (const raw of [undefined, null, '']) {
      expect(parseSessionMetadata(raw, { validate: true })).toEqual({});
    }
  });

  it('round-trips server-validated configuration through LiveKit JSON metadata', () => {
    const metadata = LiveKitSessionMetadataSchema.parse({
      agentId: 'support',
      threadId: 't1',
      resourceId: 'user-1',
      requestContext: { tenant: 'acme' },
      sessionConfig: {
        version: 1,
        options: { userAwayTimeout: null, turnHandling: { interruption: { enabled: false } } },
      },
      custom: 'preserved',
    });
    expect(parseSessionMetadata(serializeSessionMetadata(metadata), { validate: true })).toEqual(metadata);
  });

  it.each([
    'not json',
    'null',
    '[]',
    '42',
    '{"agentId":42}',
    '{"requestContext":[]}',
    '{"sessionConfig":{"version":2,"options":{}}}',
  ])('rejects invalid metadata only when validation is enabled: %s', raw => {
    expect(() => parseSessionMetadata(raw, { validate: true })).toThrow();
    expect(() => parseSessionMetadata(raw)).not.toThrow();
  });
});
