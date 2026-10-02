import { convertBase64ToUint8Array } from '@ai-sdk/provider-utils-v6';
import { detectMediaType, imageMediaTypeSignatures } from '../../../stream/aisdk/v5/compat/media';
import { convertDataContentToBase64String } from './data-content';

/**
 * Image content can be a string (URL or data URI), a URL object, or binary data
 */
export type ImageContent = string | URL | Uint8Array | ArrayBuffer | Buffer;

/**
 * Represents the parsed components of a data URI
 */
export interface DataUriParts {
  mimeType?: string;
  base64Content: string;
  isDataUri: boolean;
}

/**
 * Parses a data URI string into its components.
 * Format: data:[<mediatype>][;base64],<data>
 *
 * @param dataUri - The data URI string to parse
 * @returns Parsed components including MIME type and base64 content
 */
export function parseDataUri(dataUri: string): DataUriParts {
  if (!dataUri.startsWith('data:')) {
    return {
      isDataUri: false,
      base64Content: dataUri,
    };
  }

  const base64Index = dataUri.indexOf(',');
  if (base64Index === -1) {
    // Malformed data URI, return as-is
    return {
      isDataUri: true,
      base64Content: dataUri,
    };
  }

  const header = dataUri.substring(5, base64Index); // Skip 'data:' prefix
  const base64Content = dataUri.substring(base64Index + 1);

  // Extract MIME type from header (before ';base64' or ';')
  const semicolonIndex = header.indexOf(';');
  const mimeType = semicolonIndex !== -1 ? header.substring(0, semicolonIndex) : header;

  return {
    isDataUri: true,
    mimeType: mimeType || undefined,
    base64Content,
  };
}

/**
 * Creates a data URI from base64 content and MIME type.
 *
 * @param base64Content - The base64 encoded content
 * @param mimeType - The MIME type (defaults to 'application/octet-stream')
 * @returns A properly formatted data URI
 */
export function createDataUri(base64Content: string, mimeType: string = 'application/octet-stream'): string {
  // If it's already a data URI, return as-is
  if (base64Content.startsWith('data:')) {
    return base64Content;
  }
  return `data:${mimeType};base64,${base64Content}`;
}

/**
 * Converts various image data formats to a string representation.
 * - Strings are returned as-is (could be URLs or data URIs)
 * - URL objects are converted to strings
 * - Binary data (Uint8Array, ArrayBuffer, Buffer) is converted to base64
 *
 * @param image - The image data in various formats
 * @param fallbackMimeType - MIME type to use when creating data URIs from binary data
 * @returns String representation of the image (URL, data URI, or base64)
 */
export function imageContentToString(image: ImageContent, fallbackMimeType?: string): string {
  if (typeof image === 'string') {
    return image;
  }

  if (image instanceof URL) {
    return image.toString();
  }

  if (image instanceof Uint8Array || image instanceof ArrayBuffer || (globalThis.Buffer && Buffer.isBuffer(image))) {
    // Convert binary data to base64
    const base64 = convertDataContentToBase64String(image);
    // If it's not already a data URI, create one
    if (fallbackMimeType && !base64.startsWith('data:')) {
      return `data:${fallbackMimeType};base64,${base64}`;
    }
    return base64;
  }

  // Fallback for unknown types - try to convert to string
  return String(image);
}

/**
 * Converts various image data formats to a data URI string.
 *
 * @param image - The image data in various formats
 * @param mimeType - MIME type for the data URI (defaults to 'image/png')
 * @returns Data URI string
 */
export function imageContentToDataUri(image: ImageContent, mimeType: string = 'image/png'): string {
  const imageStr = imageContentToString(image, mimeType);

  // If it's already a data URI, return as-is
  if (imageStr.startsWith('data:')) {
    return imageStr;
  }

  // If it's an HTTP(S) URL, return as-is (can't convert to data URI)
  if (imageStr.startsWith('http://') || imageStr.startsWith('https://')) {
    return imageStr;
  }

  // Otherwise, assume it's base64 and create a data URI
  return `data:${mimeType};base64,${imageStr}`;
}

/**
 * Gets a stable cache key component for image content.
 * Used for generating hash keys for caching purposes.
 *
 * @param image - The image data in various formats
 * @returns A string or number suitable for cache key generation
 */
export function getImageCacheKey(image: ImageContent): string | number {
  if (image instanceof URL) {
    return image.toString();
  }

  if (typeof image === 'string') {
    return image.length;
  }

  if (image instanceof Uint8Array) {
    return image.byteLength;
  }

  if (image instanceof ArrayBuffer) {
    return image.byteLength;
  }

  return image;
}

/**
 * Checks if a string is a valid URL (including protocol-relative URLs).
 *
 * @param str - The string to check
 * @returns true if the string is a valid URL
 */
export function isValidUrl(str: string): boolean {
  try {
    new URL(str);
    return true;
  } catch {
    // Try as protocol-relative URL
    if (str.startsWith('//')) {
      try {
        new URL(`https:${str}`);
        return true;
      } catch {
        return false;
      }
    }
    return false;
  }
}

// Characters of the standard and URL-safe base64 alphabets, plus padding and whitespace.
// Deliberately loose: it only has to catch strings that clearly aren't base64 (paths, hosts).
const BASE64_PATTERN = /^[A-Za-z0-9+/\-_=\s]*$/;

/**
 * Checks whether a string plausibly holds raw base64 content. Relative paths such as
 * `/api/images/foo.png` fail, so they aren't wrapped as a data URL that can never decode.
 */
export function isBase64Like(data: string): boolean {
  return BASE64_PATTERN.test(data);
}

const STRICT_BASE64_PATTERN = /^[A-Za-z0-9+/]*={0,2}$/;
const SIGNED_IMAGE_MEDIA_TYPES = new Set<string>([
  ...imageMediaTypeSignatures.map(signature => signature.mediaType),
  'image/jpg',
]);
const HEIF_BRANDS = new Set([
  'heic',
  'heix',
  'hevc',
  'hevx',
  'heim',
  'heis',
  'hevm',
  'hevs',
  'mif1',
  'msf1',
  'avif',
  'avis',
]);

const ascii = (bytes: Uint8Array, start: number, length = 4) =>
  String.fromCharCode(...bytes.subarray(start, start + length));

/**
 * HEIC and AVIF files start with an ISO BMFF `ftyp` box whose size and brand list vary (iPhone
 * HEIC uses a 24-byte box), so the fixed signature table misses most real files. Check the box
 * structure instead: `ftyp` at byte 4, then a HEIF/AVIF major or compatible brand.
 */
function isHeifImage(bytes: Uint8Array): boolean {
  if (bytes.length < 16 || ascii(bytes, 4) !== 'ftyp') return false;
  const boxSize = ((bytes[0]! << 24) | (bytes[1]! << 16) | (bytes[2]! << 8) | bytes[3]!) >>> 0;
  if (boxSize < 16 || boxSize % 4 !== 0) return false;
  if (HEIF_BRANDS.has(ascii(bytes, 8))) return true;
  for (let offset = 16; offset + 4 <= Math.min(boxSize, bytes.length); offset += 4) {
    if (HEIF_BRANDS.has(ascii(bytes, offset))) return true;
  }
  return false;
}

const VERIFIED_AUDIO_MEDIA_TYPES = new Set([
  'audio/mpeg',
  'audio/mp3',
  'audio/wav',
  'audio/x-wav',
  'audio/wave',
  'audio/vnd.wave',
  'audio/ogg',
  'audio/opus',
  'audio/flac',
  'audio/x-flac',
  'audio/aac',
  'audio/x-aac',
  'audio/mp4',
  'audio/m4a',
  'audio/x-m4a',
  'audio/webm',
  'audio/aiff',
  'audio/x-aiff',
  'audio/amr',
  'audio/3gpp',
]);

/**
 * Recognizes the common audio containers. Like images, any known container passes whatever
 * audio type it's labelled as.
 */
function isAudio(bytes: Uint8Array): boolean {
  if (ascii(bytes, 0, 3) === 'ID3') return true; // MP3, AAC, or FLAC with ID3 tags
  if (bytes[0] === 0xff && (bytes[1]! & 0xe0) === 0xe0) return true; // MPEG audio or AAC ADTS frame
  if (ascii(bytes, 0) === 'RIFF' && ascii(bytes, 8) === 'WAVE') return true;
  if (['OggS', 'fLaC', 'ADIF', 'FORM'].includes(ascii(bytes, 0)) || ascii(bytes, 0, 5) === '#!AMR') return true;
  if (bytes[0] === 0x1a && bytes[1] === 0x45 && bytes[2] === 0xdf && bytes[3] === 0xa3) return true; // WebM
  return ascii(bytes, 4) === 'ftyp'; // MP4, M4A, 3GP
}

function isTextMediaType(mediaType: string): boolean {
  return (
    mediaType.startsWith('text/') ||
    [
      'application/json',
      'application/xml',
      'application/javascript',
      'application/yaml',
      'application/x-yaml',
    ].includes(mediaType) ||
    mediaType.endsWith('+json') ||
    mediaType.endsWith('+xml')
  );
}

/** Text content must be UTF-8 without control characters other than whitespace. */
function decodeText(bytes: Uint8Array, truncated: boolean): string | undefined {
  try {
    const text = new TextDecoder('utf-8', { fatal: true }).decode(bytes, { stream: truncated });
    return /[\x00-\x08\x0B\x0E-\x1F\x7F]/.test(text) ? undefined : text;
  } catch {
    return undefined;
  }
}

/**
 * Checks whether inline base64 content can be decoded and, where its media type allows,
 * whether it looks like that kind of file: image and audio signatures, `%PDF` for PDFs, and
 * UTF-8 text for text types (an SVG must start with `<`). Mislabelled images and audio are
 * fine: any known signature passes. Providers reject anything else on every turn.
 */
function isValidInlineContent(base64: string, mediaType: string | undefined): boolean {
  const payload = base64.replace(/\s/g, '').replace(/-/g, '+').replace(/_/g, '/');
  if (!payload || !STRICT_BASE64_PATTERN.test(payload)) return false;
  const unpaddedLength = payload.replace(/=+$/, '').length;
  if (unpaddedLength % 4 === 1 || (unpaddedLength !== payload.length && payload.length % 4 !== 0)) return false;
  if (!mediaType) return true;

  // Decode only the start of the payload. Compare decoded bytes: base64 prefixes depend on the
  // bytes that follow a signature (e.g. a WebP's file size), so a real file can fail a text match.
  const head = (chars: number) => convertBase64ToUint8Array(payload.slice(0, chars));

  if (SIGNED_IMAGE_MEDIA_TYPES.has(mediaType)) {
    const bytes = head(64);
    return detectMediaType({ data: bytes, signatures: imageMediaTypeSignatures }) !== undefined || isHeifImage(bytes);
  }
  if (VERIFIED_AUDIO_MEDIA_TYPES.has(mediaType)) return isAudio(head(64));
  if (mediaType === 'application/pdf') {
    // The PDF spec allows up to 1 KB of bytes before the `%PDF` header.
    return ascii(head(1368), 0, 1026).includes('%PDF');
  }
  if (isTextMediaType(mediaType)) {
    const chars = 1368;
    const text = decodeText(head(chars), payload.length > chars);
    if (text === undefined) return false;
    return (
      mediaType !== 'image/svg+xml' ||
      text
        .replace(/^\uFEFF/, '')
        .trimStart()
        .startsWith('<')
    );
  }
  return true;
}

/**
 * Checks whether file/image part data can be sent to a model: an OpenAI file ID (`file-...`),
 * an absolute URL (any scheme), or inline content (raw base64 or a data URL) that decodes and,
 * for images and PDFs, looks like one. Anything else, such as a relative path or a path that
 * was wrapped as a base64 data URL, can't be downloaded or decoded.
 */
export function isSendableFileData(data: string, mediaType?: string): boolean {
  if (data.startsWith('data:')) {
    const comma = data.indexOf(',');
    if (comma === -1) return false;
    const header = data.slice(5, comma);
    // Only base64 data URLs carry content to check; percent-encoded ones are plain text.
    if (!/;base64$/i.test(header)) return true;
    return isValidInlineContent(data.slice(comma + 1), header.split(';')[0] || mediaType);
  }
  if (data.startsWith('file-') || isAbsoluteUrl(data)) return true;
  return isValidInlineContent(data, mediaType);
}

/**
 * Checks if a string parses as an absolute URL (any scheme, e.g. `https:`, `gs:`, `s3:`).
 * Unlike {@link isValidUrl}, protocol-relative and relative paths are not accepted.
 */
export function isAbsoluteUrl(str: string): boolean {
  try {
    new URL(str);
    return true;
  } catch {
    return false;
  }
}

/**
 * Categorizes a string as a URL, data URI, or raw data (base64/other).
 * Also extracts MIME type from data URIs when present.
 *
 * @param data - The string data to categorize
 * @param fallbackMimeType - Optional fallback MIME type
 * @returns Categorized data with type and extracted MIME type
 */
export function categorizeFileData(
  data: string,
  fallbackMimeType?: string,
): {
  type: 'url' | 'dataUri' | 'raw' | 'providerFileId';
  mimeType?: string;
  data: string;
} {
  // Parse as data URI first to extract MIME type
  const parsed = parseDataUri(data);
  const mimeType = parsed.isDataUri && parsed.mimeType ? parsed.mimeType : fallbackMimeType;

  // Check if it's a data URI
  if (parsed.isDataUri) {
    return {
      type: 'dataUri',
      mimeType,
      data,
    };
  }

  // Check if it's an OpenAI Files API file ID — pass through as-is so
  // @ai-sdk/openai can forward it as { file_id: "file-..." } to the API.
  // Distinct from 'url': the value is NOT parseable by `new URL()`, so call
  // sites that construct URLs must handle it explicitly. Collision risk with
  // raw base64 is negligible (standard base64 has no '-').
  if (data.startsWith('file-')) {
    return {
      type: 'providerFileId',
      mimeType,
      data,
    };
  }

  // Check if it's a URL
  if (isValidUrl(data)) {
    return {
      type: 'url',
      mimeType,
      data,
    };
  }

  // Otherwise it's raw data (likely base64 or other string data)
  return {
    type: 'raw',
    mimeType,
    data,
  };
}

/**
 * Resolve a stored file part's media type and payload across the AI SDK v4 and v5 shapes.
 *
 * Stored "v2" file parts are typed as the AI SDK v4 UI shape (`mimeType`/`data`), but
 * v5-shaped file parts (`mediaType`/`url`, renamed in the v5 Media Type Standardization)
 * reach the same read sites. Reading only the v4 fields leaves a v5 part with both values
 * `undefined`, which downstream becomes `contentType: undefined` (making `attachmentsToParts`
 * throw) or collapses distinct parts onto a single cache key. Read whichever shape is present.
 *
 * Returns the RAW resolved values (undefined-preserving); call sites that build a
 * `contentType` should apply their own `'application/octet-stream'` fallback. Mirrors #17366.
 */
export function resolveFilePartMediaTypeAndData(part: unknown): { mediaType: string | undefined; data: unknown } {
  // Narrow the boundary: the stored union only describes v4, so widen it here to read
  // either shape without an `as any` cast.
  const filePart = part as { mimeType?: string; data?: unknown; mediaType?: string; url?: unknown };
  return {
    mediaType: filePart.mimeType ?? filePart.mediaType,
    data: filePart.data ?? filePart.url,
  };
}

/**
 * Classifies a string as a URL, data URI, or raw data.
 *
 * @param data - The string to classify
 * @returns Object with classification and extracted metadata
 */
export function classifyFileData(data: string): {
  type: 'url' | 'dataUri' | 'base64' | 'other';
  mimeType?: string;
} {
  // Check if it's a data URI
  const parsed = parseDataUri(data);
  if (parsed.isDataUri) {
    return {
      type: 'dataUri',
      mimeType: parsed.mimeType,
    };
  }

  // Check if it's a URL
  if (isValidUrl(data)) {
    return { type: 'url' };
  }

  // Check if it looks like base64 (simple heuristic)
  if (/^[A-Za-z0-9+/\-_]+=*$/.test(data) && data.length > 20) {
    return { type: 'base64' };
  }

  return { type: 'other' };
}
