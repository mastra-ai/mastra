import { convertBase64ToUint8Array, convertUint8ArrayToBase64 } from '@ai-sdk/provider-utils';
import { z } from 'zod';

/**
Data content. Can either be a base64-encoded string, a Uint8Array, an ArrayBuffer, or a Buffer.
 */
export type DataContent = string | Uint8Array | ArrayBuffer | Buffer;

/**
@internal
 */
export const dataContentSchema: z.ZodType<DataContent> = z.union([
  z.string(),
  z.instanceof(Uint8Array),
  z.instanceof(ArrayBuffer),
  z.custom(
    // Buffer might not be available in some environments such as CloudFlare:
    (value: unknown): value is Buffer => globalThis.Buffer?.isBuffer(value) ?? false,
    { message: 'Must be a Buffer' },
  ),
]);

/**
Converts data content to a base64-encoded string.

@param content - Data content to convert.
@returns Base64-encoded string.
*/
export function convertDataContentToBase64String(content: DataContent): string {
  if (typeof content === 'string') {
    return content;
  }

  if (content instanceof ArrayBuffer) {
    return convertUint8ArrayToBase64(new Uint8Array(content));
  }

  return convertUint8ArrayToBase64(content);
}

/**
Converts data content to a Uint8Array.

@param content - Data content to convert.
@returns Uint8Array.
 */
export function convertDataContentToUint8Array(content: DataContent): Uint8Array {
  if (content instanceof Uint8Array) {
    return content;
  }

  if (typeof content === 'string') {
    try {
      return convertBase64ToUint8Array(content);
    } catch (error) {
      throw new Error('Invalid data content. Content string is not a base64-encoded media.', {
        cause: error,
      });
    }
  }

  if (content instanceof ArrayBuffer) {
    return new Uint8Array(content);
  }

  throw new Error(content);
}

/**
 * Converts a Uint8Array to a string of text.
 *
 * @param uint8Array - The Uint8Array to convert.
 * @returns The converted string.
 */
export function convertUint8ArrayToText(uint8Array: Uint8Array): string {
  try {
    return new TextDecoder().decode(uint8Array);
  } catch {
    throw new Error('Error decoding Uint8Array to text');
  }
}
