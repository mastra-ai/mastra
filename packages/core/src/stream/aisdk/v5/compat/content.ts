import type { LanguageModelV2DataContent } from '@ai-sdk/provider-v5';
import type { DataContent } from '@internal/ai-sdk-v5';
import { ErrorCategory, ErrorDomain, MastraError } from '../../../../error';

function splitDataUrl(dataUrl: string): {
  mediaType: string | undefined;
  base64Content: string | undefined;
} {
  try {
    const [header, base64Content] = dataUrl.split(',');
    return {
      mediaType: header?.split(';')[0]?.split(':')[1],
      base64Content,
    };
  } catch {
    return {
      mediaType: undefined,
      base64Content: undefined,
    };
  }
}

/**
 * Flat generated-file data is `string | Uint8Array`, where strings normally
 * hold base64. URL-backed V4 generated files flatten to http(s) URL strings
 * (matching AI SDK v7's own conversion), so consumers that interpret string
 * data as base64 must use this check to tell the two apart. Base64 content
 * never parses as an http(s) URL, making the check unambiguous.
 */
export function isUrlString(data: string): boolean {
  if (!data.startsWith('http://') && !data.startsWith('https://')) {
    return false;
  }

  try {
    new URL(data);
    return true;
  } catch {
    return false;
  }
}

export function convertToDataContent(content: DataContent | URL): {
  data: LanguageModelV2DataContent;
  mediaType: string | undefined;
} {
  // Buffer & Uint8Array:
  if (content instanceof Uint8Array) {
    return { data: content, mediaType: undefined };
  }

  // ArrayBuffer needs conversion to Uint8Array (lightweight):
  if (content instanceof ArrayBuffer) {
    return { data: new Uint8Array(content), mediaType: undefined };
  }

  // Attempt to create a URL from the data. If it fails, we can assume the data
  // is not a URL and likely some other sort of data.
  if (typeof content === 'string') {
    try {
      content = new URL(content);
    } catch {
      // ignored
    }
  }

  // Extract data from data URL:
  if (content instanceof URL && content.protocol === 'data:') {
    const { mediaType: dataUrlMediaType, base64Content } = splitDataUrl(content.toString());

    if (dataUrlMediaType == null || base64Content == null) {
      throw new MastraError({
        id: 'INVALID_DATA_URL_FORMAT',
        text: `Invalid data URL format in content ${content.toString()}`,
        domain: ErrorDomain.LLM,
        category: ErrorCategory.USER,
      });
    }

    return { data: base64Content, mediaType: dataUrlMediaType };
  }

  return { data: content, mediaType: undefined };
}
