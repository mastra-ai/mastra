import { describe, expect, it } from 'vitest';
import { getReasoningIdentityKeys, hashIdentityValue } from './reasoning-identity';

describe('getReasoningIdentityKeys', () => {
  it('picks up identity fields from any provider namespace', () => {
    const keys = getReasoningIdentityKeys({
      anthropic: { signature: 'sig', redactedData: 'red' },
      bedrock: { signature: 'bsig' },
      google: { thoughtSignature: 'gsig' },
      openai: { itemId: 'rs_1', reasoningEncryptedContent: 'enc' },
      acme: { reasoningDigest: 'dig' },
    });

    expect(keys).toEqual(
      [
        `reasoningDigest:${hashIdentityValue('dig')}`,
        `redactedData:${hashIdentityValue('red')}`,
        `signature:${hashIdentityValue('sig')}`,
        `signature:${hashIdentityValue('bsig')}`,
        `thoughtSignature:${hashIdentityValue('gsig')}`,
        `itemId:${hashIdentityValue('rs_1')}`,
        `reasoningEncryptedContent:${hashIdentityValue('enc')}`,
      ].sort(),
    );
  });

  it('collapses the same identity mirrored under several namespaces', () => {
    expect(getReasoningIdentityKeys({ azure: { itemId: 'rs_1' }, openai: { itemId: 'rs_1' } })).toEqual(
      getReasoningIdentityKeys({ azure: { itemId: 'rs_1' } }),
    );
  });

  it('ignores non-identity metadata, empty values, and non-object sources', () => {
    expect(
      getReasoningIdentityKeys(
        { anthropic: { cacheControl: { type: 'ephemeral' }, usage: 'x', signature: '' } },
        { openai: { reasoningEncryptedContent: null } },
        undefined,
        'string',
        ['array'],
        { acme: 'not-an-object' },
      ),
    ).toEqual([]);
  });

  it('is independent of namespace, field, and source order and de-duplicates', () => {
    const a = getReasoningIdentityKeys({ x: { signature: '1', itemId: '2' }, y: { signature: '3' } });
    const b = getReasoningIdentityKeys(
      { y: { signature: '3' } },
      { x: { itemId: '2', signature: '1' } },
      { y: { signature: '3' } },
    );
    expect(a).toEqual(b);
  });

  it('hashes deterministically and distinguishes values', () => {
    expect(hashIdentityValue('abc')).toBe(hashIdentityValue('abc'));
    expect(hashIdentityValue('abc')).not.toBe(hashIdentityValue('abd'));
    expect(hashIdentityValue('x'.repeat(10_000)).length).toBeLessThan(16);
  });
});
