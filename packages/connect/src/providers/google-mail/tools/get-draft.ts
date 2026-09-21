// AUTO-GENERATED from arctic-char/integration-templates @ c3091db1e8a6 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const getDraftInputSchema = z.object({
  id: z.string().describe('The ID of the draft to retrieve. Example: "r-1234567890"'),
  userId: z
    .string()
    .optional()
    .describe(
      'The user\'s email address. Special value "me" can be used to indicate the authenticated user. Defaults to "me".',
    ),
});

const MessagePartBodySchema = z.object({
  attachmentId: z.string().optional(),
  size: z.number().optional(),
  data: z.string().optional(),
});

const MessageHeaderSchema = z.object({
  name: z.string(),
  value: z.string(),
});

const MessagePartSchema = z.object({
  partId: z.string().optional(),
  mimeType: z.string().optional(),
  filename: z.string().optional(),
  headers: z.array(MessageHeaderSchema).optional(),
  body: MessagePartBodySchema.optional(),
  parts: z.array(z.unknown()).optional(),
});

const MessageSchema = z.object({
  id: z.string().optional(),
  threadId: z.string().optional(),
  labelIds: z.array(z.string()).optional(),
  snippet: z.string().optional(),
  historyId: z.string().optional(),
  internalDate: z.string().optional(),
  payload: MessagePartSchema.optional(),
  sizeEstimate: z.number().optional(),
  raw: z.string().optional(),
});

const DraftResponseSchema = z.object({
  id: z.string(),
  message: MessageSchema.optional(),
});

export const getDraftOutputSchema = z.object({
  id: z.string(),
  message: z
    .object({
      id: z.string().optional(),
      threadId: z.string().optional(),
      labelIds: z.array(z.string()).optional(),
      snippet: z.string().optional(),
      historyId: z.string().optional(),
      internalDate: z.string().optional(),
      payload: z
        .object({
          partId: z.string().optional(),
          mimeType: z.string().optional(),
          filename: z.string().optional(),
          headers: z.array(MessageHeaderSchema).optional(),
          body: MessagePartBodySchema.optional(),
          parts: z.array(z.unknown()).optional(),
        })
        .optional(),
      sizeEstimate: z.number().optional(),
      raw: z.string().optional(),
    })
    .optional(),
});

export function getDraftTool(proxy: PlatformProxy) {
  return createTool({
    id: 'google_mail_get_draft',
    description: 'Retrieve a draft and its embedded message payload.',
    inputSchema: getDraftInputSchema,
    outputSchema: getDraftOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof getDraftOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const userId = input.userId || 'me';
      const encodedId = encodeURIComponent(input.id);

      // https://developers.google.com/workspace/gmail/api/reference/rest/v1/users.drafts/get
      const response = await platformProxy.get({
        endpoint: `/gmail/v1/users/${encodeURIComponent(userId)}/drafts/${encodedId}`,
        retries: 3,
      });

      if (!response.data) {
        throw new platformProxy.ActionError({
          type: 'not_found',
          message: 'Draft not found',
          id: input.id,
        });
      }

      const raw = DraftResponseSchema.parse(response.data);

      return {
        id: raw.id,
        ...(raw.message && {
          message: {
            id: raw.message.id,
            threadId: raw.message.threadId,
            labelIds: raw.message.labelIds,
            snippet: raw.message.snippet,
            historyId: raw.message.historyId,
            internalDate: raw.message.internalDate,
            payload: raw.message.payload && {
              partId: raw.message.payload.partId,
              mimeType: raw.message.payload.mimeType,
              filename: raw.message.payload.filename,
              headers: raw.message.payload.headers,
              body: raw.message.payload.body && {
                attachmentId: raw.message.payload.body.attachmentId,
                size: raw.message.payload.body.size,
                data: raw.message.payload.body.data,
              },
              parts: raw.message.payload.parts,
            },
            sizeEstimate: raw.message.sizeEstimate,
            raw: raw.message.raw,
          },
        }),
      };
    },
  });
}
