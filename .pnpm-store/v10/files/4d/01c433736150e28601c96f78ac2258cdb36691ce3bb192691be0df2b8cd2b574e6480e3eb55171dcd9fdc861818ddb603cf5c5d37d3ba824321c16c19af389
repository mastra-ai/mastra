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
export declare function parseDataUri(dataUri: string): DataUriParts;
/**
 * Creates a data URI from base64 content and MIME type.
 *
 * @param base64Content - The base64 encoded content
 * @param mimeType - The MIME type (defaults to 'application/octet-stream')
 * @returns A properly formatted data URI
 */
export declare function createDataUri(base64Content: string, mimeType?: string): string;
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
export declare function imageContentToString(image: ImageContent, fallbackMimeType?: string): string;
/**
 * Converts various image data formats to a data URI string.
 *
 * @param image - The image data in various formats
 * @param mimeType - MIME type for the data URI (defaults to 'image/png')
 * @returns Data URI string
 */
export declare function imageContentToDataUri(image: ImageContent, mimeType?: string): string;
/**
 * Gets a stable cache key component for image content.
 * Used for generating hash keys for caching purposes.
 *
 * @param image - The image data in various formats
 * @returns A string or number suitable for cache key generation
 */
export declare function getImageCacheKey(image: ImageContent): string | number;
/**
 * Checks if a string is a valid URL (including protocol-relative URLs).
 *
 * @param str - The string to check
 * @returns true if the string is a valid URL
 */
export declare function isValidUrl(str: string): boolean;
/**
 * Categorizes a string as a URL, data URI, or raw data (base64/other).
 * Also extracts MIME type from data URIs when present.
 *
 * @param data - The string data to categorize
 * @param fallbackMimeType - Optional fallback MIME type
 * @returns Categorized data with type and extracted MIME type
 */
export declare function categorizeFileData(data: string, fallbackMimeType?: string): {
    type: 'url' | 'dataUri' | 'raw';
    mimeType?: string;
    data: string;
};
/**
 * Classifies a string as a URL, data URI, or raw data.
 *
 * @param data - The string to classify
 * @returns Object with classification and extracted metadata
 */
export declare function classifyFileData(data: string): {
    type: 'url' | 'dataUri' | 'base64' | 'other';
    mimeType?: string;
};
//# sourceMappingURL=image-utils.d.ts.map