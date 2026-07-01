import sharp from 'sharp';
import { describe, expect, it } from 'vitest';

import { getImageDimensions, isOversized, resizeImageIfNeeded, computeTargetDimensions } from './image-resize';

// ---------------------------------------------------------------------------
// Test helpers: create minimal valid image buffers using sharp
// ---------------------------------------------------------------------------

async function createPngBuffer(width: number, height: number): Promise<Uint8Array> {
  const channels = 4;
  const pixels = Buffer.alloc(width * height * channels);
  for (let i = 0; i < width * height; i++) {
    pixels[i * channels] = 255; // R
    pixels[i * channels + 1] = 0; // G
    pixels[i * channels + 2] = 0; // B
    pixels[i * channels + 3] = 255; // A
  }
  const buf = await sharp(pixels, { raw: { width, height, channels } }).png().toBuffer();
  return new Uint8Array(buf);
}

async function createJpegBuffer(width: number, height: number): Promise<Uint8Array> {
  const channels = 3;
  const pixels = Buffer.alloc(width * height * channels);
  for (let i = 0; i < width * height; i++) {
    pixels[i * channels] = 0; // R
    pixels[i * channels + 1] = 0; // G
    pixels[i * channels + 2] = 255; // B
  }
  const buf = await sharp(pixels, { raw: { width, height, channels } }).jpeg({ quality: 80 }).toBuffer();
  return new Uint8Array(buf);
}

// ---------------------------------------------------------------------------
// getImageDimensions
// ---------------------------------------------------------------------------

describe('getImageDimensions', () => {
  it('reads PNG dimensions from header', async () => {
    const buf = await createPngBuffer(100, 200);
    const dims = getImageDimensions(buf);
    expect(dims).toEqual({ width: 100, height: 200 });
  });

  it('reads JPEG dimensions', async () => {
    const buf = await createJpegBuffer(300, 150);
    const dims = getImageDimensions(buf);
    expect(dims).toEqual({ width: 300, height: 150 });
  });

  it('returns null for unrecognized format', () => {
    const buf = new Uint8Array(25);
    expect(getImageDimensions(buf)).toBeNull();
  });

  it('returns null for data too short', () => {
    const buf = new Uint8Array([0x89, 0x50, 0x4e, 0x47]);
    expect(getImageDimensions(buf)).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// isOversized
// ---------------------------------------------------------------------------

describe('isOversized', () => {
  it('returns false for images within limit', () => {
    expect(isOversized({ width: 7999, height: 7999 })).toBe(false);
    expect(isOversized({ width: 8000, height: 8000 })).toBe(false);
  });

  it('returns true when width exceeds limit', () => {
    expect(isOversized({ width: 8001, height: 100 })).toBe(true);
  });

  it('returns true when height exceeds limit', () => {
    expect(isOversized({ width: 100, height: 8001 })).toBe(true);
  });

  it('supports custom max dimension', () => {
    expect(isOversized({ width: 5000, height: 5000 }, 4000)).toBe(true);
    expect(isOversized({ width: 3000, height: 3000 }, 4000)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// computeTargetDimensions
// ---------------------------------------------------------------------------

describe('computeTargetDimensions', () => {
  it('scales down proportionally when width exceeds max', () => {
    const result = computeTargetDimensions({ width: 10000, height: 5000 }, 8000);
    expect(result.width).toBe(8000);
    expect(result.height).toBe(4000);
  });

  it('scales down proportionally when height exceeds max', () => {
    const result = computeTargetDimensions({ width: 4000, height: 16000 }, 8000);
    expect(result.width).toBe(2000);
    expect(result.height).toBe(8000);
  });

  it('uses the smaller scale factor when both exceed', () => {
    const result = computeTargetDimensions({ width: 10000, height: 20000 }, 8000);
    expect(result.width).toBe(4000);
    expect(result.height).toBe(8000);
  });
});

// ---------------------------------------------------------------------------
// resizeImageIfNeeded
// ---------------------------------------------------------------------------

describe('resizeImageIfNeeded', () => {
  it('returns unchanged for images within limit', async () => {
    const buf = await createPngBuffer(100, 100);
    const result = await resizeImageIfNeeded(buf, 'image/png');
    expect(result).not.toBeNull();
    expect(result!.resized).toBe(false);
    expect(result!.data).toBe(buf);
  });

  it('resizes oversized PNG images', async () => {
    const buf = await createPngBuffer(200, 100);
    const result = await resizeImageIfNeeded(buf, 'image/png', 150);
    expect(result).not.toBeNull();
    expect(result!.resized).toBe(true);
    expect(result!.newDimensions!.width).toBe(150);
    expect(result!.newDimensions!.height).toBe(75);
    expect(result!.originalDimensions).toEqual({ width: 200, height: 100 });

    const resizedDims = getImageDimensions(result!.data);
    expect(resizedDims).toEqual({ width: 150, height: 75 });
  });

  it('resizes oversized JPEG images', async () => {
    const buf = await createJpegBuffer(200, 100);
    const result = await resizeImageIfNeeded(buf, 'image/jpeg', 150);
    expect(result).not.toBeNull();
    expect(result!.resized).toBe(true);
    expect(result!.newDimensions!.width).toBe(150);
    expect(result!.newDimensions!.height).toBe(75);

    const resizedDims = getImageDimensions(result!.data);
    expect(resizedDims).toEqual({ width: 150, height: 75 });
  });

  it('returns null for unsupported formats', async () => {
    // Create a fake buffer that looks like a GIF but exceeds limits
    const buf = new Uint8Array(100);
    buf[0] = 0x47; // G
    buf[1] = 0x49; // I
    buf[2] = 0x46; // F
    buf[3] = 0x38; // 8
    buf[4] = 0x39; // 9
    buf[5] = 0x61; // a
    // Set dimensions > limit (little-endian)
    buf[6] = 0x01; // width low byte = 1
    buf[7] = 0x90; // width high byte = 0x90 -> 0x9001 = 36865
    buf[8] = 0x01; // height low byte
    buf[9] = 0x90; // height high byte
    // GIF resize should fail because this isn't a valid GIF (no actual image data)
    const result = await resizeImageIfNeeded(buf, 'image/gif', 8000);
    expect(result).toBeNull();
  });

  it('handles the 8000px limit correctly', async () => {
    const buf = await createPngBuffer(50, 100);
    const result1 = await resizeImageIfNeeded(buf, 'image/png', 100);
    expect(result1!.resized).toBe(false);

    const result2 = await resizeImageIfNeeded(buf, 'image/png', 80);
    expect(result2!.resized).toBe(true);
    expect(result2!.newDimensions!.height).toBeLessThanOrEqual(80);
    expect(result2!.newDimensions!.width).toBeLessThanOrEqual(80);
  });
});
