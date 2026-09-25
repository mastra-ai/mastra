import { ErrorCategory, ErrorDomain, MastraError } from '../../../error';
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

/**
 * Checks whether inline base64 content can be decoded and, for image types with a known
 * file signature (and PDF), whether it starts like one. Mislabelled images are fine: any
 * known image signature passes. Providers reject anything else on every turn.
 */
function isValidInlineContent(base64: string, mediaType: string | undefined): boolean {
  const payload = base64.replace(/\s/g, '').replace(/-/g, '+').replace(/_/g, '/');
  if (!payload || !STRICT_BASE64_PATTERN.test(payload)) return false;
  const unpaddedLength = payload.replace(/=+$/, '').length;
  if (unpaddedLength % 4 === 1 || (unpaddedLength !== payload.length && payload.length % 4 !== 0)) return false;

  if (mediaType && SIGNED_IMAGE_MEDIA_TYPES.has(mediaType)) {
    return detectMediaType({ data: payload, signatures: imageMediaTypeSignatures }) !== undefined;
  }
  if (mediaType === 'application/pdf') return payload.startsWith('JVBER'); // "%PDF"
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
