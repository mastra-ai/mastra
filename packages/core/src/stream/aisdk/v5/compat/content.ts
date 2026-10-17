import type { SharedV4FileData } from '@ai-sdk/provider';
import type { DataContent } from '@internal/ai-v7';
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
  data: Uint8Array | string | URL;
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

/** Tags flat file data (bytes, base64 string or URL) as V4 file data. */
export function toV4FileData(data: Uint8Array | string | URL): SharedV4FileData {
  return data instanceof URL ? { type: 'url', url: data } : { type: 'data', data };
}

function isTaggedFileData(data: object): data is SharedV4FileData {
  return 'type' in data && typeof (data as { type: unknown }).type === 'string';
}

/**
 * Normalizes any v7 part data (bare data content, URL, tagged file data, or a
 * provider reference) into V4 tagged file data.
 */
export function anyToV4FileData(data: DataContent | URL | object): SharedV4FileData {
  if (data instanceof URL || typeof data === 'string' || data instanceof Uint8Array) return toV4FileData(data);
  if (data instanceof ArrayBuffer) return { type: 'data', data: new Uint8Array(data) };
  if (isTaggedFileData(data)) return data;
  return { type: 'reference', reference: data as Record<string, string> };
}

/**
 * Returns the flat form (bytes, base64/data-URL string, or URL) of any v7 part
 * data. Provider references and inline text have no flat form and return undefined.
 */
export function flattenFileData(data: DataContent | URL | object): Uint8Array | string | URL | undefined {
  const tagged = anyToV4FileData(data);
  if (tagged.type === 'data') return tagged.data;
  if (tagged.type === 'url') return tagged.url;
  return undefined;
}
