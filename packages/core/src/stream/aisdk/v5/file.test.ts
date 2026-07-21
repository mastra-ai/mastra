import { describe, expect, it } from 'vitest';
import { DefaultGeneratedFile } from './file';

describe('DefaultGeneratedFile', () => {
  it('converts base64 string data to a Uint8Array', () => {
    const file = new DefaultGeneratedFile({ data: 'aGVsbG8=', mediaType: 'text/plain' });

    expect(file.base64).toBe('aGVsbG8=');
    expect(file.uint8Array).toEqual(new Uint8Array([104, 101, 108, 108, 111]));
  });

  it('converts Uint8Array data to base64 lazily', () => {
    const bytes = new Uint8Array([104, 101, 108, 108, 111]);
    const file = new DefaultGeneratedFile({ data: bytes, mediaType: 'text/plain' });

    expect(file.uint8Array).toBe(bytes);
    expect(file.base64).toBe('aGVsbG8=');
  });

  it('throws a descriptive error instead of base64-decoding URL-backed file data', () => {
    // URL-backed V4 generated files flatten to URL strings in the base64 slot.
    const file = new DefaultGeneratedFile({
      data: 'https://example.com/generated.jpeg',
      mediaType: 'image/jpeg',
    });

    expect(file.base64).toBe('https://example.com/generated.jpeg');
    expect(() => file.uint8Array).toThrow('Cannot convert URL-backed generated file to Uint8Array');
  });
});
