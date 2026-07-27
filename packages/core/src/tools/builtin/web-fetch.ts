import { z } from 'zod/v4';

import { createTool } from '../tool';

const MAX_CONTENT_LENGTH = 100_000;
const TIMEOUT_MS = 15_000;

function isHttpUrl(url: string): boolean {
  try {
    const parsedUrl = new URL(url);
    return parsedUrl.protocol === 'http:' || parsedUrl.protocol === 'https:';
  } catch {
    return false;
  }
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    if (error.name === 'TimeoutError') {
      return `Request timed out after ${TIMEOUT_MS}ms.`;
    }

    return error.message;
  }

  return 'Unknown error';
}

export const webFetchTool = createTool({
  id: 'web_fetch',
  description: 'Fetch a web page by URL and return text content with basic response metadata.',
  inputSchema: z.object({
    url: z.string().min(1).describe('The fully qualified HTTP or HTTPS URL to fetch.'),
  }),
  outputSchema: z.object({
    content: z.string(),
    truncated: z.boolean().optional(),
    status: z.number().optional(),
    statusText: z.string().optional(),
    contentType: z.string().nullable().optional(),
    url: z.string().optional(),
    ok: z.boolean().optional(),
    isError: z.boolean().optional(),
  }),
  execute: async ({ url }: { url: string }) => {
    if (!isHttpUrl(url)) {
      return {
        content: 'Failed to fetch URL: only HTTP and HTTPS URLs are supported.',
        isError: true,
      };
    }

    try {
      const response = await fetch(url, {
        headers: {
          'user-agent': 'Mastra Web Fetch Tool/1.0',
          accept: 'text/html,text/plain,application/json,application/xml;q=0.9,*/*;q=0.8',
        },
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      const text = await response.text();
      const content = text.slice(0, MAX_CONTENT_LENGTH);

      return {
        content,
        truncated: text.length > content.length,
        status: response.status,
        statusText: response.statusText,
        contentType: response.headers.get('content-type'),
        url: response.url,
        ok: response.ok,
      };
    } catch (error) {
      return {
        content: `Failed to fetch URL: ${getErrorMessage(error)}`,
        isError: true,
      };
    }
  },
});
