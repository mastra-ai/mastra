/**
 * Image dimension detection and resizing utilities.
 *
 * Detects oversized images (exceeding provider limits like Anthropic's 8000px)
 * and resizes them to fit within bounds. Uses:
 * - Pure JS header parsing for dimension detection (PNG, JPEG, WebP, GIF)
 * - `jpeg-js` (already in core) for JPEG decode/encode
 * - `pngjs` for PNG decode/encode
 * - Simple bilinear downsampling for the resize step
 *
 * This is intentionally dependency-light (pure JS, no native bindings). It is
 * slower than a native resizer like sharp for very large images, but avoids a
 * heavy native dependency. If resize latency becomes a problem we can revisit.
 */

import { decode as decodeJpeg, encode as encodeJpeg } from 'jpeg-js';
import { PNG } from 'pngjs';

/** Maximum image dimension (px) accepted by most LLM providers (Anthropic = 8000). */
export const MAX_IMAGE_DIMENSION = 8000;

export interface ImageDimensions {
  width: number;
  height: number;
}

export interface ResizeResult {
  data: Uint8Array;
  mediaType: string;
  resized: boolean;
  originalDimensions?: ImageDimensions;
  newDimensions?: ImageDimensions;
}

// ---------------------------------------------------------------------------
// Dimension detection from binary headers (no full decode needed)
// ---------------------------------------------------------------------------

/**
 * Reads image dimensions from the binary header without decoding the full image.
 * Supports PNG, JPEG, WebP, and GIF.
 */
export function getImageDimensions(data: Uint8Array): ImageDimensions | null {
  if (data.length < 24) return null;

  // PNG: signature (8 bytes) + IHDR length (4 bytes) + "IHDR" (4 bytes) + width (4) + height (4)
  if (isPng(data)) {
    const width = readUint32BE(data, 16);
    const height = readUint32BE(data, 20);
    return { width, height };
  }

  // JPEG: find SOF marker for dimensions
  if (isJpeg(data)) {
    return getJpegDimensions(data);
  }

  // WebP
  if (isWebP(data)) {
    return getWebPDimensions(data);
  }

  // GIF
  if (isGif(data)) {
    const width = data[6]! | (data[7]! << 8);
    const height = data[8]! | (data[9]! << 8);
    return { width, height };
  }

  return null;
}

/**
 * Returns true if the image exceeds the maximum dimension.
 */
export function isOversized(dimensions: ImageDimensions, maxDimension = MAX_IMAGE_DIMENSION): boolean {
  return dimensions.width > maxDimension || dimensions.height > maxDimension;
}

// ---------------------------------------------------------------------------
// Resize logic
// ---------------------------------------------------------------------------

/**
 * Resizes an image if any dimension exceeds `maxDimension`.
 * Returns the (possibly resized) image data and metadata.
 *
 * Supports PNG and JPEG. For unsupported formats (WebP, GIF, ...), returns null
 * to signal the caller should handle it (e.g. drop the image).
 *
 * Async so callers don't need to change if the resize backend later moves to an
 * async/native implementation.
 */
export async function resizeImageIfNeeded(
  data: Uint8Array,
  mediaType: string,
  maxDimension = MAX_IMAGE_DIMENSION,
): Promise<ResizeResult | null> {
  const dimensions = getImageDimensions(data);
  if (!dimensions) return null;

  if (!isOversized(dimensions, maxDimension)) {
    return { data, mediaType, resized: false };
  }

  const { width: targetWidth, height: targetHeight } = computeTargetDimensions(dimensions, maxDimension);

  const normalizedType = mediaType.toLowerCase();

  try {
    if (normalizedType.includes('png')) {
      return resizePng(data, dimensions, targetWidth, targetHeight, mediaType);
    }

    if (normalizedType.includes('jpeg') || normalizedType.includes('jpg')) {
      return resizeJpeg(data, dimensions, targetWidth, targetHeight, mediaType);
    }
  } catch {
    return null;
  }

  // Unsupported format for resize
  return null;
}

/**
 * Computes target dimensions that fit within maxDimension while preserving aspect ratio.
 */
export function computeTargetDimensions(dimensions: ImageDimensions, maxDimension: number): ImageDimensions {
  const { width, height } = dimensions;
  const scale = Math.min(maxDimension / width, maxDimension / height);
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

// ---------------------------------------------------------------------------
// Format-specific resize implementations
// ---------------------------------------------------------------------------

function resizePng(
  data: Uint8Array,
  originalDimensions: ImageDimensions,
  targetWidth: number,
  targetHeight: number,
  mediaType: string,
): ResizeResult {
  const png = PNG.sync.read(Buffer.from(data));
  const resizedPixels = bilinearResize(png.data, png.width, png.height, targetWidth, targetHeight);

  const outPng = new PNG({ width: targetWidth, height: targetHeight });
  outPng.data = resizedPixels;
  const encoded = PNG.sync.write(outPng);

  return {
    data: new Uint8Array(encoded),
    mediaType,
    resized: true,
    originalDimensions,
    newDimensions: { width: targetWidth, height: targetHeight },
  };
}

function resizeJpeg(
  data: Uint8Array,
  originalDimensions: ImageDimensions,
  targetWidth: number,
  targetHeight: number,
  mediaType: string,
): ResizeResult {
  const decoded = decodeJpeg(data, {
    useTArray: true,
    formatAsRGBA: true,
    // jpeg-js defaults (100MP/512MB) are too low: the decoder's internal
    // buffers use ~13× the raw pixel count in bytes, so even a 32MP JPEG
    // exceeds 512MB. We keep maxResolutionInMP at the default 100MP (sufficient
    // for the ≤8000px target) but raise the memory cap so the decoder can
    // actually process images up to that resolution.
    maxMemoryUsageInMB: 2048,
  });
  const resizedPixels = bilinearResize(
    Buffer.from(decoded.data),
    decoded.width,
    decoded.height,
    targetWidth,
    targetHeight,
  );

  const encoded = encodeJpeg({ data: resizedPixels, width: targetWidth, height: targetHeight }, 85);

  return {
    data: new Uint8Array(encoded.data),
    mediaType,
    resized: true,
    originalDimensions,
    newDimensions: { width: targetWidth, height: targetHeight },
  };
}

// ---------------------------------------------------------------------------
// Bilinear interpolation downsampler
// ---------------------------------------------------------------------------

/**
 * Resizes RGBA pixel data using bilinear interpolation.
 * Input and output are both flat RGBA buffers (4 bytes per pixel).
 */
export function bilinearResize(
  srcPixels: Buffer,
  srcWidth: number,
  srcHeight: number,
  dstWidth: number,
  dstHeight: number,
): Buffer {
  const dst = Buffer.alloc(dstWidth * dstHeight * 4);

  const xRatio = srcWidth / dstWidth;
  const yRatio = srcHeight / dstHeight;

  for (let dstY = 0; dstY < dstHeight; dstY++) {
    const srcYf = dstY * yRatio;
    const srcY0 = Math.floor(srcYf);
    const srcY1 = Math.min(srcY0 + 1, srcHeight - 1);
    const yFrac = srcYf - srcY0;

    for (let dstX = 0; dstX < dstWidth; dstX++) {
      const srcXf = dstX * xRatio;
      const srcX0 = Math.floor(srcXf);
      const srcX1 = Math.min(srcX0 + 1, srcWidth - 1);
      const xFrac = srcXf - srcX0;

      const idx00 = (srcY0 * srcWidth + srcX0) * 4;
      const idx10 = (srcY0 * srcWidth + srcX1) * 4;
      const idx01 = (srcY1 * srcWidth + srcX0) * 4;
      const idx11 = (srcY1 * srcWidth + srcX1) * 4;
      const dstIdx = (dstY * dstWidth + dstX) * 4;

      for (let c = 0; c < 4; c++) {
        const v00 = srcPixels[idx00 + c]!;
        const v10 = srcPixels[idx10 + c]!;
        const v01 = srcPixels[idx01 + c]!;
        const v11 = srcPixels[idx11 + c]!;

        const top = v00 + (v10 - v00) * xFrac;
        const bottom = v01 + (v11 - v01) * xFrac;
        dst[dstIdx + c] = Math.round(top + (bottom - top) * yFrac);
      }
    }
  }

  return dst;
}

// ---------------------------------------------------------------------------
// Format detection helpers
// ---------------------------------------------------------------------------

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

function isPng(data: Uint8Array): boolean {
  return PNG_SIGNATURE.every((byte, i) => data[i] === byte);
}

function isJpeg(data: Uint8Array): boolean {
  return data[0] === 0xff && data[1] === 0xd8;
}

function isWebP(data: Uint8Array): boolean {
  return (
    data[0] === 0x52 && // R
    data[1] === 0x49 && // I
    data[2] === 0x46 && // F
    data[3] === 0x46 && // F
    data[8] === 0x57 && // W
    data[9] === 0x45 && // E
    data[10] === 0x42 && // B
    data[11] === 0x50 // P
  );
}

function isGif(data: Uint8Array): boolean {
  return (
    data[0] === 0x47 && // G
    data[1] === 0x49 && // I
    data[2] === 0x46 // F
  );
}

// ---------------------------------------------------------------------------
// JPEG SOF dimension parsing
// ---------------------------------------------------------------------------

function getJpegDimensions(data: Uint8Array): ImageDimensions | null {
  // Scan for SOF markers (0xFF 0xC0 through 0xFF 0xCF, excluding 0xC4 and 0xCC)
  let offset = 2; // skip SOI marker
  while (offset < data.length - 9) {
    if (data[offset] !== 0xff) {
      offset++;
      continue;
    }

    const marker = data[offset + 1]!;

    // SOF markers: C0-CF except C4 (DHT) and CC (DAC)
    if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xcc) {
      const height = readUint16BE(data, offset + 5);
      const width = readUint16BE(data, offset + 7);
      return { width, height };
    }

    // Skip to next marker using segment length
    const segLength = readUint16BE(data, offset + 2);
    offset += 2 + segLength;
  }

  return null;
}

// ---------------------------------------------------------------------------
// WebP dimension parsing
// ---------------------------------------------------------------------------

function getWebPDimensions(data: Uint8Array): ImageDimensions | null {
  if (data.length < 30) return null;

  // VP8 (lossy)
  if (data[12] === 0x56 && data[13] === 0x50 && data[14] === 0x38 && data[15] === 0x20) {
    const offset = 26;
    if (offset + 4 > data.length) return null;
    const width = (data[offset]! | (data[offset + 1]! << 8)) & 0x3fff;
    const height = (data[offset + 2]! | (data[offset + 3]! << 8)) & 0x3fff;
    return { width, height };
  }

  // VP8L (lossless)
  if (data[12] === 0x56 && data[13] === 0x50 && data[14] === 0x38 && data[15] === 0x4c) {
    const offset = 21;
    if (offset + 4 > data.length) return null;
    const bits = data[offset]! | (data[offset + 1]! << 8) | (data[offset + 2]! << 16) | (data[offset + 3]! << 24);
    const width = (bits & 0x3fff) + 1;
    const height = ((bits >> 14) & 0x3fff) + 1;
    return { width, height };
  }

  // VP8X (extended)
  if (data[12] === 0x56 && data[13] === 0x50 && data[14] === 0x38 && data[15] === 0x58) {
    const offset = 24;
    if (offset + 6 > data.length) return null;
    const width = (data[offset]! | (data[offset + 1]! << 8) | (data[offset + 2]! << 16)) + 1;
    const height = (data[offset + 3]! | (data[offset + 4]! << 8) | (data[offset + 5]! << 16)) + 1;
    return { width, height };
  }

  return null;
}

// ---------------------------------------------------------------------------
// Binary reading helpers
// ---------------------------------------------------------------------------

function readUint32BE(data: Uint8Array, offset: number): number {
  return (data[offset]! << 24) | (data[offset + 1]! << 16) | (data[offset + 2]! << 8) | data[offset + 3]!;
}

function readUint16BE(data: Uint8Array, offset: number): number {
  return (data[offset]! << 8) | data[offset + 1]!;
}
