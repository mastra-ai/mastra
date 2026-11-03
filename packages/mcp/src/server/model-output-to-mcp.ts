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

function mediaBlock(data: string, mimeType: string, toolName: string, index: number): ContentBlock {
  if (mimeType.startsWith('image/')) return { type: 'image', data, mimeType };
  if (mimeType.startsWith('audio/')) return { type: 'audio', data, mimeType };
  return {
    type: 'resource',
    resource: { uri: `mastra://tool-output/${encodeURIComponent(toolName)}/${index}`, mimeType, blob: data },
  };
}

/** Splits a `data:` URI into its media type and Base64 payload. */
function parseDataUri(value: string): { mediaType: string; data: string } | undefined {
  const match = DATA_URI.exec(value);
  if (!match) return undefined;
  const [, mediaType = '', params = '', payload = ''] = match;
  const base64 = params.split(';').some(param => param.toLowerCase() === 'base64');
  const data = base64 ? payload : Buffer.from(decodeURIComponent(payload), 'utf8').toString('base64');
  return { mediaType: mediaType.trim().toLowerCase(), data };
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
