import { convertUint8ArrayToBase64 } from '@internal/ai-sdk-v4';
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
