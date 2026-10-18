// AUTO-GENERATED from NangoHQ/integration-templates @ c3091db1e8a6 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const getMessageInputSchema = z.object({
  id: z.string().describe('The ID of the message to retrieve. Example: "12345abc"'),
  format: z
    .enum(['full', 'metadata', 'minimal', 'raw'])
    .optional()
    .describe('The format to return the message in. Values: full, metadata, minimal, raw. Example: "full"'),
  metadataHeaders: z
    .array(z.string())
    .optional()
    .describe('When format is metadata, only include headers specified in this array. Example: ["Subject", "From"]'),
});

const MessagePartBodySchema = z.object({
  attachmentId: z.string().optional(),
  size: z.number().optional(),
  data: z.string().optional(),
});

const MessagePartSchema = z.object({
  partId: z.string().optional(),
  mimeType: z.string().optional(),
  filename: z.string().optional(),
  headers: z
    .array(
      z.object({
        name: z.string(),
        value: z.string(),
      }),
    )
    .optional(),
  body: MessagePartBodySchema.optional(),
  parts: z.array(z.unknown()).optional(),
});

const ProviderMessageSchema = z.object({
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

export const getMessageOutputSchema = z.object({
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

export function getMessageTool(proxy: PlatformProxy) {
  return createTool({
    id: 'google_mail_get_message',
    description: 'Retrieve a specific Gmail message with optional format selection.',
    inputSchema: getMessageInputSchema,
    outputSchema: getMessageOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof getMessageOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const params: Record<string, any> = {};

      if (input.format !== undefined) {
        params['format'] = input.format;
      }

      if (input.metadataHeaders !== undefined) {
        params['metadataHeaders'] = input.metadataHeaders;
      }

      // https://developers.google.com/workspace/gmail/api/reference/rest/v1/users.messages/get
      const response = await platformProxy.get({
        endpoint: `/gmail/v1/users/me/messages/${encodeURIComponent(input.id)}`,
        params,
        retries: 3,
      });

      if (!response.data) {
        throw new platformProxy.ActionError({
          type: 'not_found',
          message: 'Message not found',
          id: input.id,
        });
      }

      const providerMessage = ProviderMessageSchema.parse(response.data);

      return {
        id: providerMessage.id,
        threadId: providerMessage.threadId,
        labelIds: providerMessage.labelIds,
        snippet: providerMessage.snippet,
        historyId: providerMessage.historyId,
        internalDate: providerMessage.internalDate,
        payload: providerMessage.payload,
        sizeEstimate: providerMessage.sizeEstimate,
        raw: providerMessage.raw,
      };
    },
  });
}
