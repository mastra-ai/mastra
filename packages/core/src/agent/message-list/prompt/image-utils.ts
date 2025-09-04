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
