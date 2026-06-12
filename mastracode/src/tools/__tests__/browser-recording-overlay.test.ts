import { encode as encodeJpegBytes } from 'jpeg-js';
import { describe, expect, it } from 'vitest';

import { decodeJpeg, drawCaptionOnFrame, encodeJpeg, selectCaptionAt } from '../browser-recording-overlay.js';
import type { RecordingCaption, RgbaFrame } from '../browser-recording-overlay.js';

function makeJpeg(width: number, height: number, rgba: [number, number, number, number] = [10, 20, 30, 255]): Uint8Array {
  const data = new Uint8Array(width * height * 4);
  for (let i = 0; i < width * height; i++) {
    data[i * 4] = rgba[0];
    data[i * 4 + 1] = rgba[1];
    data[i * 4 + 2] = rgba[2];
    data[i * 4 + 3] = rgba[3];
  }
  const encoded = encodeJpegBytes({ data, width, height }, 90);
  return new Uint8Array(encoded.data.buffer, encoded.data.byteOffset, encoded.data.byteLength);
}

function makeRgbaFrame(
  width: number,
  height: number,
  rgba: [number, number, number, number] = [50, 50, 50, 255],
): RgbaFrame {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < width * height; i++) {
    data[i * 4] = rgba[0];
    data[i * 4 + 1] = rgba[1];
    data[i * 4 + 2] = rgba[2];
    data[i * 4 + 3] = rgba[3];
  }
  return { width, height, data };
}

describe('selectCaptionAt', () => {
  const captions: RecordingCaption[] = [
    { timestampMs: 0, text: 'first', durationMs: 1000 },
    { timestampMs: 500, text: 'second', durationMs: 1000 },
    { timestampMs: 2000, text: 'third', durationMs: 500 },
  ];

  it('returns undefined when no caption window contains t', () => {
    expect(selectCaptionAt(captions, 1600)).toBeUndefined();
    expect(selectCaptionAt(captions, 2500)).toBeUndefined();
  });

  it('returns the only caption whose window contains t', () => {
    expect(selectCaptionAt(captions, 100)?.text).toBe('first');
    expect(selectCaptionAt(captions, 2100)?.text).toBe('third');
  });

  it('picks the newer caption when windows overlap', () => {
    // At t=600, both "first" (0..1000) and "second" (500..1500) are active.
    expect(selectCaptionAt(captions, 600)?.text).toBe('second');
  });

  it('treats the end of the window as exclusive', () => {
    // "third" covers [2000, 2500) — at 2500 nothing is active.
    expect(selectCaptionAt(captions, 2499)?.text).toBe('third');
    expect(selectCaptionAt(captions, 2500)).toBeUndefined();
  });

  it('handles an empty caption list', () => {
    expect(selectCaptionAt([], 100)).toBeUndefined();
  });
});

describe('decodeJpeg', () => {
  it('decodes a JPEG buffer into an RGBA frame with correct dimensions', () => {
    const jpeg = makeJpeg(8, 4, [200, 100, 50, 255]);
    const frame = decodeJpeg(jpeg);
    expect(frame.width).toBe(8);
    expect(frame.height).toBe(4);
    expect(frame.data.length).toBe(8 * 4 * 4);
    // JPEG is lossy — colors are close but not exact.
    expect(frame.data[0]).toBeGreaterThan(150);
    expect(frame.data[3]).toBe(255);
  });
});

describe('drawCaptionOnFrame', () => {
  it('modifies pixels in the bottom strip and leaves top pixels untouched', () => {
    const frame = makeRgbaFrame(120, 80, [50, 50, 50, 255]);
    const beforeTop = frame.data[0];
    const beforeMid = frame.data[(40 * 120 + 60) * 4];

    drawCaptionOnFrame(frame, 'hello world');

    // Top pixel should remain untouched.
    expect(frame.data[0]).toBe(beforeTop);
    // Mid pixel (above the caption strip) should also be untouched.
    expect(frame.data[(40 * 120 + 60) * 4]).toBe(beforeMid);
    // A pixel inside the strip near the bottom should differ from the original color.
    const stripIdx = ((80 - 12) * 120 + 60) * 4;
    expect(frame.data[stripIdx]).not.toBe(50);
  });

  it('is a no-op for empty or whitespace captions', () => {
    const frame = makeRgbaFrame(40, 30);
    const snapshot = new Uint8ClampedArray(frame.data);

    drawCaptionOnFrame(frame, '');
    drawCaptionOnFrame(frame, '   ');

    expect(frame.data).toEqual(snapshot);
  });

  it('truncates captions by code point without splitting emoji surrogate pairs', () => {
    const frame = makeRgbaFrame(36, 30);

    expect(() => drawCaptionOnFrame(frame, 'loading 🚀🚀🚀')).not.toThrow();
  });
});

describe('encodeJpeg', () => {
  it('produces JPEG bytes that round-trip back to the same dimensions', () => {
    const original = makeRgbaFrame(64, 32, [200, 100, 50, 255]);
    const jpegBytes = encodeJpeg(original);
    // JPEG magic: FF D8 FF.
    expect(jpegBytes[0]).toBe(0xff);
    expect(jpegBytes[1]).toBe(0xd8);
    expect(jpegBytes[2]).toBe(0xff);

    const roundTripped = decodeJpeg(jpegBytes);
    expect(roundTripped.width).toBe(64);
    expect(roundTripped.height).toBe(32);
  });
});
