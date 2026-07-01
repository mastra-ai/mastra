/**
 * Image dimension detection and resizing utilities.
 *
 * Detects oversized images (exceeding provider limits like Anthropic's 8000px)
 * and resizes them to fit within bounds using sharp (native libvips bindings).
 * Dimension detection uses pure-JS header parsing to avoid full decode overhead.
 */

import type sharp from 'sharp';

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
// Resize logic (sharp)
// ---------------------------------------------------------------------------

let _sharp: typeof sharp | undefined;

async function getSharp(): Promise<typeof sharp> {
  if (!_sharp) {
    _sharp = (await import('sharp')).default;
  }
  return _sharp;
}

/**
 * Resizes an image if any dimension exceeds `maxDimension`.
 * Returns the (possibly resized) image data and metadata.
 *
 * Uses sharp for high-performance native resizing with lanczos3 interpolation.
 * Supports PNG, JPEG, WebP, and GIF. For truly unsupported formats, returns null.
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

  try {
    const sharpFn = await getSharp();
    const pipeline = sharpFn(Buffer.from(data)).resize(targetWidth, targetHeight, {
      fit: 'fill',
      kernel: 'lanczos3',
    });

    const normalizedType = mediaType.toLowerCase();
    let outputBuffer: Buffer;

    if (normalizedType.includes('png')) {
      outputBuffer = await pipeline.png().toBuffer();
    } else if (normalizedType.includes('jpeg') || normalizedType.includes('jpg')) {
      outputBuffer = await pipeline.jpeg({ quality: 85 }).toBuffer();
    } else if (normalizedType.includes('webp')) {
      outputBuffer = await pipeline.webp({ quality: 85 }).toBuffer();
    } else if (normalizedType.includes('gif')) {
      outputBuffer = await pipeline.gif().toBuffer();
    } else {
      // Try PNG as safe fallback
      outputBuffer = await pipeline.png().toBuffer();
    }

    return {
      data: new Uint8Array(outputBuffer),
      mediaType,
      resized: true,
      originalDimensions: dimensions,
      newDimensions: { width: targetWidth, height: targetHeight },
    };
  } catch {
    return null;
  }
}

/**
 * Computes target dimensions that fit within maxDimension while preserving aspect ratio.
 */
export function computeTargetDimensions(dimensions: ImageDimensions, maxDimension: number): ImageDimensions {
  const { width, height } = dimensions;
  const scale = Math.min(maxDimension / width, maxDimension / height);
  return {
    width: Math.round(width * scale),
    height: Math.round(height * scale),
  };
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
