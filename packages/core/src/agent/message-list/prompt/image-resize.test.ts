import { encode as encodeJpeg } from 'jpeg-js';
import { PNG } from 'pngjs';
import { describe, expect, it } from 'vitest';

import {
  getImageDimensions,
  isOversized,
  resizeImageIfNeeded,
  computeTargetDimensions,
  bilinearResize,
} from './image-resize';

// ---------------------------------------------------------------------------
// Test helpers: create minimal valid image buffers
// ---------------------------------------------------------------------------

function createPngBuffer(width: number, height: number): Uint8Array {
  const png = new PNG({ width, height });
  // Fill with solid red
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (width * y + x) * 4;
      png.data[idx] = 255; // R
      png.data[idx + 1] = 0; // G
      png.data[idx + 2] = 0; // B
      png.data[idx + 3] = 255; // A
    }
  }
  return new Uint8Array(PNG.sync.write(png));
}

function createJpegBuffer(width: number, height: number): Uint8Array {
  const data = Buffer.alloc(width * height * 4);
  // Fill with solid blue
  for (let i = 0; i < width * height; i++) {
    data[i * 4] = 0; // R
    data[i * 4 + 1] = 0; // G
    data[i * 4 + 2] = 255; // B
    data[i * 4 + 3] = 255; // A
  }
  const encoded = encodeJpeg({ data, width, height }, 80);
  return new Uint8Array(encoded.data);
}

// ---------------------------------------------------------------------------
// getImageDimensions
// ---------------------------------------------------------------------------

describe('getImageDimensions', () => {
  it('reads PNG dimensions from header', () => {
    const buf = createPngBuffer(100, 200);
    const dims = getImageDimensions(buf);
    expect(dims).toEqual({ width: 100, height: 200 });
  });

  it('reads JPEG dimensions', () => {
    const buf = createJpegBuffer(300, 150);
    const dims = getImageDimensions(buf);
    expect(dims).toEqual({ width: 300, height: 150 });
  });

  it('returns null for unrecognized format', () => {
    const buf = new Uint8Array([
      0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24,
    ]);
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
    // scale = min(8000/10000, 8000/20000) = min(0.8, 0.4) = 0.4
    expect(result.width).toBe(4000);
    expect(result.height).toBe(8000);
  });
});

// ---------------------------------------------------------------------------
// bilinearResize
// ---------------------------------------------------------------------------

describe('bilinearResize', () => {
  it('produces output buffer with correct size', () => {
    const src = Buffer.alloc(10 * 10 * 4, 128);
    const dst = bilinearResize(src, 10, 10, 5, 5);
    expect(dst.length).toBe(5 * 5 * 4);
  });

  it('preserves solid color', () => {
    const src = Buffer.alloc(4 * 4 * 4);
    // Fill with solid green
    for (let i = 0; i < 4 * 4; i++) {
      src[i * 4] = 0;
      src[i * 4 + 1] = 255;
      src[i * 4 + 2] = 0;
      src[i * 4 + 3] = 255;
    }
    const dst = bilinearResize(src, 4, 4, 2, 2);
    // All pixels should be green
    for (let i = 0; i < 2 * 2; i++) {
      expect(dst[i * 4]).toBe(0);
      expect(dst[i * 4 + 1]).toBe(255);
      expect(dst[i * 4 + 2]).toBe(0);
      expect(dst[i * 4 + 3]).toBe(255);
    }
  });
});

// ---------------------------------------------------------------------------
// resizeImageIfNeeded
// ---------------------------------------------------------------------------

describe('resizeImageIfNeeded', () => {
  it('returns unchanged for images within limit', () => {
    const buf = createPngBuffer(100, 100);
    const result = resizeImageIfNeeded(buf, 'image/png');
    expect(result).not.toBeNull();
    expect(result!.resized).toBe(false);
    expect(result!.data).toBe(buf);
  });

  it('resizes oversized PNG images', () => {
    // Create a PNG that exceeds the limit (use a small custom limit for testing)
    const buf = createPngBuffer(200, 100);
    const result = resizeImageIfNeeded(buf, 'image/png', 150);
    expect(result).not.toBeNull();
    expect(result!.resized).toBe(true);
    expect(result!.newDimensions!.width).toBe(150);
    expect(result!.newDimensions!.height).toBe(75);
    expect(result!.originalDimensions).toEqual({ width: 200, height: 100 });

    // Verify the result is a valid PNG
    const resizedDims = getImageDimensions(result!.data);
    expect(resizedDims).toEqual({ width: 150, height: 75 });
  });

  it('resizes oversized JPEG images', () => {
    const buf = createJpegBuffer(200, 100);
    const result = resizeImageIfNeeded(buf, 'image/jpeg', 150);
    expect(result).not.toBeNull();
    expect(result!.resized).toBe(true);
    expect(result!.newDimensions!.width).toBe(150);
    expect(result!.newDimensions!.height).toBe(75);

    // Verify the result is a valid JPEG
    const resizedDims = getImageDimensions(result!.data);
    expect(resizedDims).toEqual({ width: 150, height: 75 });
  });

  it('returns null for unsupported formats', () => {
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
    const result = resizeImageIfNeeded(buf, 'image/gif', 8000);
    expect(result).toBeNull(); // GIF resize not supported
  });

  it('handles the 8000px limit correctly', () => {
    // Create a small image with custom max dimension to simulate
    const buf = createPngBuffer(50, 100);
    // Should not resize when within limit
    const result1 = resizeImageIfNeeded(buf, 'image/png', 100);
    expect(result1!.resized).toBe(false);

    // Should resize when exceeding limit
    const result2 = resizeImageIfNeeded(buf, 'image/png', 80);
    expect(result2!.resized).toBe(true);
    expect(result2!.newDimensions!.height).toBeLessThanOrEqual(80);
    expect(result2!.newDimensions!.width).toBeLessThanOrEqual(80);
  });
});
