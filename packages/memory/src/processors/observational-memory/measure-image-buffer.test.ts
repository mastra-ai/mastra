import { describe, expect, it } from 'vitest';

import { measureImageBuffer } from './measure-image-buffer';

const PNG_1X1 = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
);

const GIF_1X1 = Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64');

/**
 * 32-byte ICNS whose second entry declares a length of 0. The `image-size` parser this
 * module replaced never advanced past it, looping forever while pushing to an array until
 * the heap was exhausted (GHSA-w3rx-r6r6-pgpr / CVE-2025-71330).
 */
function craftedIcns(): Buffer {
  const buffer = Buffer.alloc(32);
  buffer.write('icns', 0, 'ascii');
  buffer.writeUInt32BE(32, 4); // declared file length
  buffer.write('ic09', 8, 'ascii');
  buffer.writeUInt32BE(8, 12); // entry 1 length, advances the offset
  buffer.write('ic09', 16, 'ascii');
  buffer.writeUInt32BE(0, 20); // entry 2 length of 0, never advances the offset
  return buffer;
}

describe('measureImageBuffer', () => {
  it('reads dimensions from a PNG', () => {
    expect(measureImageBuffer(PNG_1X1)).toEqual({ width: 1, height: 1 });
  });

  it('reads dimensions from a GIF', () => {
    expect(measureImageBuffer(GIF_1X1)).toEqual({ width: 1, height: 1 });
  });

  it('returns undefined for a buffer that is not an image', () => {
    expect(measureImageBuffer(Buffer.from([1, 2, 3, 4]))).toBeUndefined();
  });

  it('returns undefined for an empty buffer', () => {
    expect(measureImageBuffer(Buffer.alloc(0))).toBeUndefined();
  });

  it('returns promptly on the malformed ICNS that hung the previous parser', () => {
    const startedAt = Date.now();
    expect(measureImageBuffer(craftedIcns())).toBeUndefined();
    expect(Date.now() - startedAt).toBeLessThan(1000);
  });
});
