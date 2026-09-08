/**
 * Synchronous image dimension lookup for in-memory image buffers.
 *
 * Uses `probe-image-size`'s sync parsers rather than `image-size`, which has unfixed
 * denial-of-service advisories (GHSA-w3rx-r6r6-pgpr / CVE-2025-71330 and
 * GHSA-5p2g-fcmc-qvqq) affecting every published version, on an archived repository
 * with no fixed release coming. A malformed 32-byte ICNS buffer was enough to hang the
 * parse loop and exhaust the heap, and image bytes reaching agent memory are untrusted.
 *
 * `probe-image-size` covers the formats models actually accept (PNG, JPEG, WebP, GIF,
 * AVIF, BMP, ICO, PSD, SVG, TIFF). Anything else returns `undefined`, which callers
 * already handle as "dimensions unknown".
 */

// Imported for its value only; `probe-image-size` ships no types, and declaring it here
// keeps the untyped import from breaking consumers that compile these source files
// without this package's ambient declarations.
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore TS7016/TS2307 -- probe-image-size ships no types
import probeImageSizeSync from 'probe-image-size/sync';

const probeBuffer = probeImageSizeSync as (buffer: Uint8Array) => { width?: number; height?: number } | null;

/**
 * Read the pixel dimensions of an image buffer.
 *
 * @returns The dimensions, or `undefined` if the buffer isn't a recognized image.
 */
export function measureImageBuffer(buffer: Uint8Array): { width: number; height: number } | undefined {
  let probed: { width?: number; height?: number } | null;

  try {
    probed = probeBuffer(buffer);
  } catch {
    return undefined;
  }

  if (!probed) {
    return undefined;
  }

  const { width, height } = probed;
  if (typeof width !== 'number' || !Number.isFinite(width) || typeof height !== 'number' || !Number.isFinite(height)) {
    return undefined;
  }

  return { width, height };
}
