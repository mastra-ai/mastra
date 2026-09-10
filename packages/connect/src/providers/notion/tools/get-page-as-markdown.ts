// AUTO-GENERATED from NangoHQ/integration-templates @ 56c9369bd7c6 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const getPageAsMarkdownInputSchema = z.object({
  page_id: z
    .string()
    .describe('The ID of the page to retrieve as markdown. Example: "b55c9c91-384d-452b-81db-d1ef79372b75"'),
  include_transcript: z.boolean().optional().describe('Include meeting note transcripts (default: false)'),
});

const ProviderPageMarkdownSchema = z.object({
  object: z.literal('page_markdown'),
  id: z.string(),
  markdown: z.string(),
  truncated: z.boolean(),
  unknown_block_ids: z.array(z.string()),
});

export const getPageAsMarkdownOutputSchema = z.object({
  id: z.string(),
  markdown: z.string(),
  truncated: z.boolean(),
  unknown_block_ids: z.array(z.string()),
});

export function getPageAsMarkdownTool(proxy: PlatformProxy) {
  return createTool({
    id: 'notion_get_page_as_markdown',
    description: 'Retrieve a page in the current markdown export format if available.',
    inputSchema: getPageAsMarkdownInputSchema,
    outputSchema: getPageAsMarkdownOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof getPageAsMarkdownOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      // https://developers.notion.com/reference/retrieve-page-markdown
      const response = await platformProxy.get({
        endpoint: `/v1/pages/${encodeURIComponent(input.page_id)}/markdown`,
        params: {
          ...(input.include_transcript !== undefined && { include_transcript: input.include_transcript.toString() }),
        },
        headers: {
          'Notion-Version': '2026-03-11',
        },
        retries: 3,
      });

      if (!response.data) {
        throw new platformProxy.ActionError({
          type: 'not_found',
          message: 'Page not found or markdown not available',
          page_id: input.page_id,
        });
      }

      const pageMarkdown = ProviderPageMarkdownSchema.parse(response.data);

      return {
        id: pageMarkdown.id,
        markdown: pageMarkdown.markdown,
        truncated: pageMarkdown.truncated,
        unknown_block_ids: pageMarkdown.unknown_block_ids,
      };
    },
  });
}
