import { encode as encodeJpeg } from 'jpeg-js';
import { PNG } from 'pngjs';
import { describe, expect, it } from 'vitest';

import {
  getImageDimensions,
  isOversized,
  resizeImageIfNeeded,
  computeTargetDimensions,
  MAX_IMAGE_DIMENSION,
} from './image-resize';

// ---------------------------------------------------------------------------
// Test helpers: create minimal valid image buffers using pure-JS encoders
// ---------------------------------------------------------------------------

function createPngBuffer(width: number, height: number): Uint8Array {
  const png = new PNG({ width, height });
  for (let i = 0; i < width * height; i++) {
    png.data[i * 4] = 255; // R
    png.data[i * 4 + 1] = 0; // G
    png.data[i * 4 + 2] = 0; // B
    png.data[i * 4 + 3] = 255; // A
  }
  return new Uint8Array(PNG.sync.write(png));
}

function createJpegBuffer(width: number, height: number): Uint8Array {
  const channels = 4;
  const pixels = Buffer.alloc(width * height * channels);
  for (let i = 0; i < width * height; i++) {
    pixels[i * channels] = 0; // R
    pixels[i * channels + 1] = 0; // G
    pixels[i * channels + 2] = 255; // B
    pixels[i * channels + 3] = 255; // A
  }
  const encoded = encodeJpeg({ data: pixels, width, height }, 80);
  return new Uint8Array(encoded.data);
}

/**
 * Builds a minimal valid WebP (VP8X extended) header encoding the given
 * dimensions. Only the header bytes needed by `getImageDimensions` are set —
 * there is no real image body, which is sufficient for dimension-parsing tests.
 */
function createWebpHeader(width: number, height: number): Uint8Array {
  const buf = new Uint8Array(30);
  // RIFF
  buf.set([0x52, 0x49, 0x46, 0x46], 0); // "RIFF"
  buf.set([0x57, 0x45, 0x42, 0x50], 8); // "WEBP"
  buf.set([0x56, 0x50, 0x38, 0x58], 12); // "VP8X"
  // width - 1 as 24-bit little-endian at offset 24
  const w = width - 1;
  buf[24] = w & 0xff;
  buf[25] = (w >> 8) & 0xff;
  buf[26] = (w >> 16) & 0xff;
  // height - 1 as 24-bit little-endian at offset 27
  const h = height - 1;
  buf[27] = h & 0xff;
  buf[28] = (h >> 8) & 0xff;
  buf[29] = (h >> 16) & 0xff;
  return buf;
}

// ---------------------------------------------------------------------------
// getImageDimensions
// ---------------------------------------------------------------------------

describe('getImageDimensions', () => {
  it('reads PNG dimensions from header', async () => {
    const buf = createPngBuffer(100, 200);
    const dims = getImageDimensions(buf);
    expect(dims).toEqual({ width: 100, height: 200 });
  });

  it('reads JPEG dimensions', async () => {
    const buf = createJpegBuffer(300, 150);
    const dims = getImageDimensions(buf);
    expect(dims).toEqual({ width: 300, height: 150 });
  });

  it('reads WebP dimensions from header', () => {
    const buf = createWebpHeader(400, 250);
    const dims = getImageDimensions(buf);
    expect(dims).not.toBeNull();
    expect(dims!.width).toBe(400);
    expect(dims!.height).toBe(250);
  });

  it('reads GIF dimensions from header', () => {
    // Minimal GIF89a header: signature (6 bytes) + width (2 LE) + height (2 LE)
    const buf = new Uint8Array(100);
    buf[0] = 0x47; // G
    buf[1] = 0x49; // I
    buf[2] = 0x46; // F
    buf[3] = 0x38; // 8
    buf[4] = 0x39; // 9
    buf[5] = 0x61; // a
    // 320x240 in little-endian
    buf[6] = 0x40; // 320 & 0xFF
    buf[7] = 0x01; // 320 >> 8
    buf[8] = 0xf0; // 240 & 0xFF
    buf[9] = 0x00; // 240 >> 8
    const dims = getImageDimensions(buf);
    expect(dims).toEqual({ width: 320, height: 240 });
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

  it('clamps to at least 1px for very thin images', () => {
    const result = computeTargetDimensions({ width: 100000, height: 1 }, 8000);
    expect(result.width).toBe(8000);
    expect(result.height).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// resizeImageIfNeeded
// ---------------------------------------------------------------------------

describe('resizeImageIfNeeded', () => {
  it('returns unchanged for images within limit', async () => {
    const buf = createPngBuffer(100, 100);
    const result = await resizeImageIfNeeded(buf, 'image/png');
    expect(result).not.toBeNull();
    expect(result!.resized).toBe(false);
    expect(result!.data).toBe(buf);
  });

  it('resizes oversized PNG images', async () => {
    const buf = createPngBuffer(200, 100);
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
    const buf = createJpegBuffer(200, 100);
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
    const buf = createPngBuffer(50, 100);
    const result1 = await resizeImageIfNeeded(buf, 'image/png', 100);
    expect(result1!.resized).toBe(false);

    const result2 = await resizeImageIfNeeded(buf, 'image/png', 80);
    expect(result2!.resized).toBe(true);
    expect(result2!.newDimensions!.height).toBeLessThanOrEqual(80);
    expect(result2!.newDimensions!.width).toBeLessThanOrEqual(80);
  });
});

// ---------------------------------------------------------------------------
// Scenario tests: realistic large images exceeding 8000px
// ---------------------------------------------------------------------------

describe('large image scenarios (8000px+ resize)', () => {
  it('resizes an 8500x5000 PNG screenshot to fit within 8000px', async () => {
    const buf = createPngBuffer(8500, 5000);

    const dims = getImageDimensions(buf);
    expect(dims).toEqual({ width: 8500, height: 5000 });
    expect(isOversized(dims!)).toBe(true);

    const result = await resizeImageIfNeeded(buf, 'image/png');
    expect(result).not.toBeNull();
    expect(result!.resized).toBe(true);
    expect(result!.originalDimensions).toEqual({ width: 8500, height: 5000 });
    expect(result!.newDimensions!.width).toBeLessThanOrEqual(MAX_IMAGE_DIMENSION);
    expect(result!.newDimensions!.height).toBeLessThanOrEqual(MAX_IMAGE_DIMENSION);

    const outputDims = getImageDimensions(result!.data);
    expect(outputDims!.width).toBeLessThanOrEqual(MAX_IMAGE_DIMENSION);
    expect(outputDims!.height).toBeLessThanOrEqual(MAX_IMAGE_DIMENSION);
    expect(outputDims!.width).toBeGreaterThan(0);
    expect(outputDims!.height).toBeGreaterThan(0);
  }, 60_000);

  it('resizes a 12000x8000 JPEG screenshot to fit within 8000px', async () => {
    const buf = createJpegBuffer(12000, 8000);

    const dims = getImageDimensions(buf);
    expect(dims).toEqual({ width: 12000, height: 8000 });
    expect(isOversized(dims!)).toBe(true);

    const result = await resizeImageIfNeeded(buf, 'image/jpeg');
    expect(result).not.toBeNull();
    expect(result!.resized).toBe(true);
    expect(result!.originalDimensions).toEqual({ width: 12000, height: 8000 });
    expect(result!.newDimensions!.width).toBeLessThanOrEqual(MAX_IMAGE_DIMENSION);
    expect(result!.newDimensions!.height).toBeLessThanOrEqual(MAX_IMAGE_DIMENSION);

    const outputDims = getImageDimensions(result!.data);
    expect(outputDims!.width).toBeLessThanOrEqual(MAX_IMAGE_DIMENSION);
    expect(outputDims!.height).toBeLessThanOrEqual(MAX_IMAGE_DIMENSION);
  }, 60_000);

  it('preserves aspect ratio when resizing a wide 10000x2000 PNG', async () => {
    const buf = createPngBuffer(10000, 2000);

    const result = await resizeImageIfNeeded(buf, 'image/png');
    expect(result).not.toBeNull();
    expect(result!.resized).toBe(true);
    expect(result!.newDimensions!.width).toBe(8000);
    expect(result!.newDimensions!.height).toBe(1600);

    const outputDims = getImageDimensions(result!.data);
    expect(outputDims).toEqual({ width: 8000, height: 1600 });
  }, 60_000);

  it('preserves aspect ratio when resizing a tall 3000x10000 PNG', async () => {
    const buf = createPngBuffer(3000, 10000);

    const result = await resizeImageIfNeeded(buf, 'image/png');
    expect(result).not.toBeNull();
    expect(result!.resized).toBe(true);
    expect(result!.newDimensions!.width).toBe(2400);
    expect(result!.newDimensions!.height).toBe(8000);

    const outputDims = getImageDimensions(result!.data);
    expect(outputDims).toEqual({ width: 2400, height: 8000 });
  }, 60_000);

  it('does not resize an exactly 8000x8000 PNG', async () => {
    const buf = createPngBuffer(8000, 8000);

    const dims = getImageDimensions(buf);
    expect(dims).toEqual({ width: 8000, height: 8000 });
    expect(isOversized(dims!)).toBe(false);

    const result = await resizeImageIfNeeded(buf, 'image/png');
    expect(result).not.toBeNull();
    expect(result!.resized).toBe(false);
    expect(result!.data).toBe(buf);
  }, 60_000);

  it('returns null for an oversized WebP image (unsupported by pure-JS resize)', () => {
    const buf = createWebpHeader(9000, 6000);

    const dims = getImageDimensions(buf);
    expect(dims).not.toBeNull();
    expect(isOversized(dims!)).toBe(true);

    // WebP resize is not supported by the pure-JS backend; the caller drops it.
    return expect(resizeImageIfNeeded(buf, 'image/webp')).resolves.toBeNull();
  });

  it('produces valid output that can be re-parsed after resize', async () => {
    const buf = createPngBuffer(8500, 5000);

    const result = await resizeImageIfNeeded(buf, 'image/png');
    expect(result).not.toBeNull();
    expect(result!.resized).toBe(true);

    const secondResult = await resizeImageIfNeeded(result!.data, 'image/png');
    expect(secondResult).not.toBeNull();
    expect(secondResult!.resized).toBe(false);
  }, 60_000);

  it('handles base64 round-trip for oversized images', async () => {
    const buf = createPngBuffer(8500, 5000);
    const base64 = Buffer.from(buf).toString('base64');
    const decoded = new Uint8Array(Buffer.from(base64, 'base64'));

    const result = await resizeImageIfNeeded(decoded, 'image/png');
    expect(result).not.toBeNull();
    expect(result!.resized).toBe(true);
    expect(result!.newDimensions!.width).toBeLessThanOrEqual(MAX_IMAGE_DIMENSION);
    expect(result!.newDimensions!.height).toBeLessThanOrEqual(MAX_IMAGE_DIMENSION);

    const reEncoded = Buffer.from(result!.data).toString('base64');
    const reDecoded = new Uint8Array(Buffer.from(reEncoded, 'base64'));
    const dims = getImageDimensions(reDecoded);
    expect(dims!.width).toBeLessThanOrEqual(MAX_IMAGE_DIMENSION);
    expect(dims!.height).toBeLessThanOrEqual(MAX_IMAGE_DIMENSION);
  }, 60_000);
});
