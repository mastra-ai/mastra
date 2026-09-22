// AUTO-GENERATED from NangoHQ/integration-templates @ c3091db1e8a6 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const updateDraftInputSchema = z.object({
  id: z.string().describe('The ID of the draft to update. Example: "r-1234567890"'),
  raw: z.string().describe('The raw RFC 2822 formatted MIME message as a base64url encoded string.'),
});

const ProviderMessageSchema = z.object({
  id: z.string(),
  threadId: z.string().optional(),
  labelIds: z.array(z.string()).optional(),
  snippet: z.string().optional(),
  historyId: z.string().optional(),
  internalDate: z.string().optional(),
  payload: z.object({}).passthrough().optional(),
  sizeEstimate: z.number().optional(),
  raw: z.string().optional(),
});

const ProviderDraftSchema = z.object({
  id: z.string(),
  message: ProviderMessageSchema.optional(),
});

export const updateDraftOutputSchema = z.object({
  id: z.string(),
  message: z
    .object({
      id: z.string(),
      threadId: z.string().optional(),
      labelIds: z.array(z.string()).optional(),
      snippet: z.string().optional(),
      historyId: z.string().optional(),
      internalDate: z.string().optional(),
      sizeEstimate: z.number().optional(),
      raw: z.string().optional(),
    })
    .optional(),
});

export function updateDraftTool(proxy: PlatformProxy) {
  return createTool({
    id: 'google_mail_update_draft',
    description: 'Replace an existing draft with new MIME content.',
    inputSchema: updateDraftInputSchema,
    outputSchema: updateDraftOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof updateDraftOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      // https://developers.google.com/workspace/gmail/api/reference/rest/v1/users.drafts/update
      const response = await platformProxy.put({
        endpoint: `/gmail/v1/users/me/drafts/${encodeURIComponent(input.id)}`,
        data: {
          message: {
            raw: input.raw,
          },
        },
        retries: 10,
      });

      const providerDraft = ProviderDraftSchema.parse(response.data);

      return {
        id: providerDraft.id,
        ...(providerDraft.message && {
          message: {
            id: providerDraft.message.id,
            threadId: providerDraft.message.threadId,
            labelIds: providerDraft.message.labelIds,
            snippet: providerDraft.message.snippet,
            historyId: providerDraft.message.historyId,
            internalDate: providerDraft.message.internalDate,
            sizeEstimate: providerDraft.message.sizeEstimate,
            raw: providerDraft.message.raw,
          },
        }),
      };
    },
  });
}
