// AUTO-GENERATED from arctic-char/integration-templates @ c3091db1e8a6 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const listMessagesInputSchema = z.object({
  q: z
    .string()
    .optional()
    .describe(
      'Only return messages matching the specified query. Supports the same query format as the Gmail search box. For example: "from:someuser@example.com rfc822msgid: is:unread"',
    ),
  labelIds: z
    .array(z.string())
    .optional()
    .describe('Only return messages with labels that match all of the specified label IDs.'),
  includeSpamTrash: z.boolean().optional().describe('Include messages from SPAM and TRASH in the results.'),
  maxResults: z
    .number()
    .int()
    .min(1)
    .max(500)
    .optional()
    .describe('Maximum number of messages to return. Defaults to 100. The maximum allowed value is 500.'),
  pageToken: z.string().optional().describe('Page token to retrieve a specific page of results in the list.'),
});

const MessageSchema = z.object({
  id: z.string(),
  threadId: z.string(),
});

export const listMessagesOutputSchema = z.object({
  messages: z.array(MessageSchema),
  nextPageToken: z.string().optional(),
  resultSizeEstimate: z.number().int().optional(),
});

export function listMessagesTool(proxy: PlatformProxy) {
  return createTool({
    id: 'google_mail_list_messages',
    description: 'List messages matching Gmail query and label filters.',
    inputSchema: listMessagesInputSchema,
    outputSchema: listMessagesOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof listMessagesOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      // https://developers.google.com/gmail/api/reference/rest/v1/users.messages/list
      const response = await platformProxy.get({
        endpoint: '/gmail/v1/users/me/messages',
        params: {
          ...(input.q !== undefined && { q: input.q }),
          ...(input.labelIds !== undefined && input.labelIds.length > 0 && { labelIds: input.labelIds }),
          ...(input.includeSpamTrash !== undefined && { includeSpamTrash: String(input.includeSpamTrash) }),
          ...(input.maxResults !== undefined && { maxResults: String(input.maxResults) }),
          ...(input.pageToken !== undefined && { pageToken: input.pageToken }),
        },
        retries: 3,
      });

      const providerResponse = z
        .object({
          messages: z
            .array(
              z.object({
                id: z.string(),
                threadId: z.string(),
              }),
            )
            .optional(),
          nextPageToken: z.string().optional(),
          resultSizeEstimate: z.number().int().optional(),
        })
        .parse(response.data);

      return {
        messages: providerResponse.messages ?? [],
        ...(providerResponse.nextPageToken !== undefined && { nextPageToken: providerResponse.nextPageToken }),
        ...(providerResponse.resultSizeEstimate !== undefined && {
          resultSizeEstimate: providerResponse.resultSizeEstimate,
        }),
      };
    },
  });
}
