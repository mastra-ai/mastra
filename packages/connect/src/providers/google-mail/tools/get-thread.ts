// AUTO-GENERATED from arctic-char/integration-templates @ c3091db1e8a6 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const getThreadInputSchema = z.object({
  id: z.string().describe('The ID of the thread to retrieve. Example: "18e1a2b3c4d5e6f7"'),
  format: z
    .enum(['full', 'metadata', 'minimal'])
    .optional()
    .describe(
      'The format to return the messages in. "full" returns full email data, "metadata" returns only IDs, labels, and headers, "minimal" returns only IDs and labels.',
    ),
  metadataHeaders: z
    .array(z.string())
    .optional()
    .describe('When given and format is METADATA, only include headers specified.'),
});

const MessagePartBodySchema = z.object({
  attachmentId: z.string().optional(),
  data: z.string().optional(),
  size: z.number().optional(),
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
  parts: z.unknown().optional(),
});

const MessageSchema = z.object({
  id: z.string(),
  threadId: z.string().optional(),
  labelIds: z.array(z.string()).optional(),
  snippet: z.string().optional(),
  historyId: z.string().optional(),
  internalDate: z.string().optional(),
  payload: MessagePartSchema.optional(),
  sizeEstimate: z.number().optional(),
  raw: z.string().optional(),
});

const ThreadSchema = z.object({
  id: z.string(),
  historyId: z.string().optional(),
  messages: z.array(MessageSchema).optional(),
  snippet: z.string().optional(),
});

export const getThreadOutputSchema = ThreadSchema;

export function getThreadTool(proxy: PlatformProxy) {
  return createTool({
    id: 'google_mail_get_thread',
    description: 'Retrieve a Gmail thread and its messages.',
    inputSchema: getThreadInputSchema,
    outputSchema: getThreadOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof getThreadOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      // https://developers.google.com/workspace/gmail/api/reference/rest/v1/users.threads/get
      const response = await platformProxy.get({
        endpoint: `/gmail/v1/users/me/threads/${encodeURIComponent(input.id)}`,
        params: {
          ...(input.format !== undefined && { format: input.format }),
          ...(input.metadataHeaders !== undefined &&
            input.metadataHeaders.length > 0 && {
              metadataHeaders: input.metadataHeaders,
            }),
        },
        retries: 3,
      });

      if (!response.data) {
        throw new platformProxy.ActionError({
          type: 'not_found',
          message: 'Thread not found',
          threadId: input.id,
        });
      }

      const thread = ThreadSchema.parse(response.data);

      return thread;
    },
  });
}
