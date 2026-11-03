import type { ContentBlock } from '@modelcontextprotocol/server';

/** MCP content built from a tool's `toModelOutput` value. */
export interface McpToolContent {
  content: ContentBlock[];
  isError: boolean;
}

const DATA_URI = /^data:([^;,]*)((?:;[^;,]*)*),(.*)$/is;

/**
 * Maps the value a Mastra tool's `toModelOutput` returns (an AI SDK tool-result output such as
 * `{ type: 'text' }`, `{ type: 'json' }` or `{ type: 'content', value: [...] }`) to MCP content blocks.
 *
 * Returns `undefined` for any other shape, meaning the caller keeps its default result.
 */
export function modelOutputToMcpContent(value: unknown, toolName: string): McpToolContent | undefined {
  if (!isRecord(value)) return undefined;
  switch (value.type) {
    case 'text':
      return typeof value.value === 'string' ? success([{ type: 'text', text: value.value }]) : undefined;
    case 'json':
      return success([{ type: 'text', text: stringify(value.value) }]);
    case 'error-text':
      return typeof value.value === 'string'
        ? { isError: true, content: [{ type: 'text', text: value.value }] }
        : undefined;
    case 'error-json':
      return { isError: true, content: [{ type: 'text', text: stringify(value.value) }] };
    case 'content':
      return Array.isArray(value.value)
        ? success(value.value.map((part, index) => partToBlock(part, toolName, index)))
        : undefined;
    default:
      return undefined;
  }
}

function partToBlock(part: unknown, toolName: string, index: number): ContentBlock {
  if (!isRecord(part)) return { type: 'text', text: stringify(part) };
  switch (part.type) {
    case 'text':
      if (typeof part.text === 'string') return { type: 'text', text: part.text };
      break;
    case 'media':
    case 'image-data':
    case 'file-data': {
      const fallback = part.type === 'image-data' ? 'image/jpeg' : 'application/octet-stream';
      const mediaType = typeof part.mediaType === 'string' && part.mediaType ? part.mediaType : undefined;
      if (typeof part.data === 'string') {
        const uri = parseDataUri(part.data);
        if (uri) return mediaBlock(uri.data, mediaType ?? (uri.mediaType || fallback), toolName, index);
        // A `data:` URI that can't be decoded isn't Base64 either, so it falls back to JSON text.
        if (/^data:/i.test(part.data)) break;
        return mediaBlock(part.data, mediaType ?? fallback, toolName, index);
      }
      if (part.data instanceof Uint8Array) {
        return mediaBlock(Buffer.from(part.data).toString('base64'), mediaType ?? fallback, toolName, index);
      }
      break;
    }
    case 'image-url':
    case 'file-url': {
      if (typeof part.url !== 'string') break;
      const uri = parseDataUri(part.url);
      // Remote URLs stay text: `resource_link` blocks aren't understood by every client.
      if (!uri) return { type: 'text', text: part.url };
      const fallback = part.type === 'image-url' ? 'image/jpeg' : 'application/octet-stream';
      const mediaType = typeof part.mediaType === 'string' && part.mediaType ? part.mediaType : undefined;
      return mediaBlock(uri.data, mediaType ?? (uri.mediaType || fallback), toolName, index);
    }
  }
  return { type: 'text', text: stringify(part) };
}

function mediaBlock(data: string, mediaType: string, toolName: string, index: number): ContentBlock {
  // Type and subtype are case-insensitive, but some clients match them exactly; parameters keep their case.
  const separator = mediaType.indexOf(';');
  const mimeType =
    separator === -1
      ? mediaType.toLowerCase()
      : mediaType.slice(0, separator).toLowerCase() + mediaType.slice(separator);
  if (mimeType.startsWith('image/')) return { type: 'image', data, mimeType };
  if (mimeType.startsWith('audio/')) return { type: 'audio', data, mimeType };
  return {
    type: 'resource',
    resource: { uri: `mastra://tool-output/${encodeURIComponent(toolName)}/${index}`, mimeType, blob: data },
  };
}

/**
 * Splits a `data:` URI into its media type (with parameters such as `charset`, minus the `base64`
 * marker) and Base64 payload. Returns `undefined` if it can't be decoded.
 */
function parseDataUri(value: string): { mediaType: string; data: string } | undefined {
  const match = DATA_URI.exec(value);
  if (!match) return undefined;
  const [, type = '', params = '', payload = ''] = match;
  const parameters = params
    .split(';')
    .map(param => param.trim())
    .filter(Boolean);
  const base64 = parameters.some(param => param.toLowerCase() === 'base64');
  let data = payload;
  if (!base64) {
    const bytes = decodePercentEncoded(payload);
    if (!bytes) return undefined;
    data = bytes.toString('base64');
  }
  const mediaType = type.trim().toLowerCase();
  const kept = parameters.filter(param => param.toLowerCase() !== 'base64');
  return { mediaType: mediaType && kept.length ? [mediaType, ...kept].join(';') : mediaType, data };
}

/** Decodes `%XX` escapes as raw octets (RFC 2397), not UTF-8 text. Returns `undefined` for a malformed escape. */
function decodePercentEncoded(payload: string): Buffer | undefined {
  const input = Buffer.from(payload, 'utf8');
  const output = Buffer.alloc(input.length);
  let length = 0;
  for (let index = 0; index < input.length; index++) {
    if (input[index] !== 0x25) {
      output[length++] = input[index]!;
      continue;
    }
    const hex = input.toString('latin1', index + 1, index + 3);
    if (!/^[0-9a-f]{2}$/i.test(hex)) return undefined;
    output[length++] = Number.parseInt(hex, 16);
    index += 2;
  }
  return output.subarray(0, length);
}

function success(content: ContentBlock[]): McpToolContent {
  return { isError: false, content };
}

function stringify(value: unknown): string {
  return JSON.stringify(value) ?? String(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
