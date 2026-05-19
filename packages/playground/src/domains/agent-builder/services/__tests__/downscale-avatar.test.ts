import { describe, it, expect } from 'vitest';
import { estimateDataUrlBytes } from '../downscale-avatar';

describe('estimateDataUrlBytes', () => {
  it('returns 0 for a string without a comma', () => {
    expect(estimateDataUrlBytes('no-comma')).toBe(0);
  });

  it('estimates the correct byte length for a small base64 payload', () => {
    // 4 base64 chars = 3 bytes
    const dataUrl = 'data:image/png;base64,AAAA';
    expect(estimateDataUrlBytes(dataUrl)).toBe(3);
  });

  it('accounts for base64 padding (=)', () => {
    // "AA==" → 1 byte (4 chars, 2 padding)
    const dataUrl = 'data:image/png;base64,AA==';
    expect(estimateDataUrlBytes(dataUrl)).toBe(1);

    // "AAA=" → 2 bytes (4 chars, 1 padding)
    const dataUrl2 = 'data:image/png;base64,AAA=';
    expect(estimateDataUrlBytes(dataUrl2)).toBe(2);
  });

  it('estimates correctly for a larger payload', () => {
    // 100 bytes → ceil(100/3)*4 = 136 base64 chars with padding
    const buf = Buffer.alloc(100, 0x42);
    const b64 = buf.toString('base64');
    const dataUrl = `data:image/png;base64,${b64}`;
    expect(estimateDataUrlBytes(dataUrl)).toBe(100);
  });

  it('estimates correctly for a 512KB payload', () => {
    const size = 512 * 1024;
    const buf = Buffer.alloc(size, 0);
    const b64 = buf.toString('base64');
    const dataUrl = `data:image/png;base64,${b64}`;
    expect(estimateDataUrlBytes(dataUrl)).toBe(size);
  });
});
