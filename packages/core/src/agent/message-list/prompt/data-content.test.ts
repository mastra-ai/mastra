/**
 * Tests for packages/core/src/agent/message-list/prompt/data-content.ts
 *
 * `convertDataContentToBase64String` is a pure function with no I/O. It
 * fans out on the runtime type of its input (string passthrough,
 * ArrayBuffer, or Uint8Array/Buffer), so coverage exercises each branch
 * plus the documented edge cases (empty input, Buffer-is-a-Uint8Array).
 */
import { describe, expect, it } from 'vitest';

import { convertDataContentToBase64String } from './data-content';

describe('convertDataContentToBase64String', () => {
  it('returns a string input unchanged (no re-encoding)', () => {
    expect(convertDataContentToBase64String('already-base64==')).toBe('already-base64==');
  });

  it('returns an empty string input unchanged', () => {
    expect(convertDataContentToBase64String('')).toBe('');
  });

  it('encodes a Uint8Array to a base64 string', () => {
    const bytes = new Uint8Array([104, 101, 108, 108, 111]); // "hello"

    expect(convertDataContentToBase64String(bytes)).toBe('aGVsbG8=');
  });

  it('encodes an ArrayBuffer to a base64 string', () => {
    const buffer = new Uint8Array([104, 101, 108, 108, 111]).buffer; // "hello"

    expect(convertDataContentToBase64String(buffer)).toBe('aGVsbG8=');
  });

  it('produces the same base64 output for equivalent Uint8Array and ArrayBuffer input', () => {
    const bytes = new Uint8Array([1, 2, 3, 4]);
    const buffer = bytes.buffer;

    expect(convertDataContentToBase64String(bytes)).toBe(convertDataContentToBase64String(buffer));
  });

  it('encodes an empty Uint8Array to an empty base64 string', () => {
    expect(convertDataContentToBase64String(new Uint8Array([]))).toBe('');
  });

  it('encodes an empty ArrayBuffer to an empty base64 string', () => {
    expect(convertDataContentToBase64String(new ArrayBuffer(0))).toBe('');
  });

  it('encodes a Node.js Buffer via the Uint8Array branch (Buffer is a Uint8Array subclass)', () => {
    const buf = Buffer.from('hello', 'utf-8');

    expect(convertDataContentToBase64String(buf)).toBe('aGVsbG8=');
  });

  it('round-trips arbitrary binary bytes (including 0x00 and 0xff) correctly', () => {
    const bytes = new Uint8Array([0, 255, 128, 64, 1]);
    const encoded = convertDataContentToBase64String(bytes);
    const decoded = Buffer.from(encoded, 'base64');

    expect(Array.from(decoded)).toEqual(Array.from(bytes));
  });
});
