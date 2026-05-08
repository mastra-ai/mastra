import type { DataContent } from '@ai-sdk/provider-utils-v5';
import { convertUint8ArrayToBase64 } from '@ai-sdk/provider-utils-v5';

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
