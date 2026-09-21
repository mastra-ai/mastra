// AUTO-GENERATED from arctic-char/integration-templates @ c3091db1e8a6 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const listDraftsInputSchema = z.object({
  maxResults: z
    .number()
    .int()
    .min(1)
    .max(500)
    .optional()
    .describe('Maximum number of drafts to return. Default is 100. Maximum allowed is 500.'),
  pageToken: z
    .string()
    .optional()
    .describe('Page token to retrieve a specific page of results in the list. Omit for the first page.'),
  q: z.string().optional().describe('Query to filter drafts. Supports the same query format as the Gmail search box.'),
  includeSpamTrash: z.boolean().optional().describe('Include drafts from SPAM and TRASH in the results.'),
});

const DraftMessageSchema = z.object({
  id: z.string(),
  threadId: z.string(),
});

const DraftSchema = z.object({
  id: z.string(),
  message: DraftMessageSchema.optional(),
});

const ProviderResponseSchema = z.object({
  drafts: z.array(DraftSchema).optional(),
  nextPageToken: z.string().optional(),
  resultSizeEstimate: z.number().int().optional(),
});

export const listDraftsOutputSchema = z.object({
  drafts: z.array(DraftSchema),
  nextPageToken: z.string().optional(),
  resultSizeEstimate: z.number().int().optional(),
});

export function listDraftsTool(proxy: PlatformProxy) {
  return createTool({
    id: 'google_mail_list_drafts',
    description: 'List drafts in the mailbox with pagination support.',
    inputSchema: listDraftsInputSchema,
    outputSchema: listDraftsOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof listDraftsOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      // https://developers.google.com/workspace/gmail/api/reference/rest/v1/users.drafts/list
      const response = await platformProxy.get({
        endpoint: '/gmail/v1/users/me/drafts',
        params: {
          ...(input.maxResults !== undefined && { maxResults: String(input.maxResults) }),
          ...(input.pageToken !== undefined && { pageToken: input.pageToken }),
          ...(input.q !== undefined && { q: input.q }),
          ...(input.includeSpamTrash !== undefined && { includeSpamTrash: String(input.includeSpamTrash) }),
        },
        retries: 3,
      });

      const providerData = ProviderResponseSchema.parse(response.data);

      return {
        drafts: providerData.drafts ?? [],
        ...(providerData.nextPageToken !== undefined && { nextPageToken: providerData.nextPageToken }),
        ...(providerData.resultSizeEstimate !== undefined && { resultSizeEstimate: providerData.resultSizeEstimate }),
      };
    },
  });
}
