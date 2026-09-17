import { describe, expect, it } from 'vitest';
import { decodeGetSecretRequest, encodeGetSecretResponse } from './build-session';

describe('build session wire format', () => {
  it('decodes GetSecretRequest.ID and skips unknown fields', () => {
    // ID = "GH_TOKEN" (field 1), annotations map entry (field 2), an unknown varint (field 9).
    const id = Buffer.from('GH_TOKEN');
    const entry = Buffer.concat([Buffer.from([0x0a, 1, 0x6b, 0x12, 1, 0x76])]);
    const wire = Buffer.concat([
      Buffer.from([0x0a, id.length]),
      id,
      Buffer.from([0x12, entry.length]),
      entry,
      Buffer.from([0x48, 0x01]),
    ]);
    expect(decodeGetSecretRequest(wire)).toEqual({ id: 'GH_TOKEN' });
    expect(decodeGetSecretRequest(Buffer.alloc(0))).toEqual({ id: '' });
  });

  it('encodes GetSecretResponse.data with a multi-byte varint length', () => {
    const data = Buffer.alloc(300, 0x61);
    const wire = encodeGetSecretResponse({ data });
    expect([...wire.subarray(0, 3)]).toEqual([0x0a, 0xac, 0x02]);
    expect(wire.subarray(3).equals(data)).toBe(true);
  });
});
