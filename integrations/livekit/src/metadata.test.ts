import { describe, expect, it } from 'vitest';
import { parseSessionMetadata, serializeSessionMetadata } from './metadata';

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
});
