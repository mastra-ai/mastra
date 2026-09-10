// AUTO-GENERATED from NangoHQ/integration-templates @ 56c9369bd7c6 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

const PurposeSchema = z.enum(['assistants', 'batch', 'fine-tune', 'vision']);

export const listFilesInputSchema = z.object({
  purpose: PurposeSchema.optional().describe('Filter by file purpose. Example: "assistants"'),
  cursor: z
    .string()
    .optional()
    .describe('Pagination cursor from the previous response (last_id). Omit for the first page.'),
  limit: z.number().int().min(1).max(10000).optional().describe('Number of files to return (1-10000, default 10000).'),
  order: z.enum(['asc', 'desc']).optional().describe('Sort order by created_at. Example: "desc"'),
});

const FileSchema = z.object({
  id: z.string(),
  object: z.string(),
  bytes: z.number().int(),
  created_at: z.number().int(),
  filename: z.string(),
  purpose: z.string(),
  status: z.string(),
  status_details: z.string().optional().nullable(),
});

const ProviderResponseSchema = z.object({
  data: z.array(FileSchema),
  object: z.string(),
  has_more: z.boolean(),
  first_id: z.string().nullable(),
  last_id: z.string().nullable(),
});

export const listFilesOutputSchema = z.object({
  files: z.array(
    z.object({
      id: z.string(),
      object: z.string(),
      bytes: z.number().int(),
      created_at: z.number().int(),
      filename: z.string(),
      purpose: z.string(),
      status: z.string(),
      status_details: z.string().optional(),
    }),
  ),
  has_more: z.boolean(),
  next_cursor: z.string().optional(),
});

export function listFilesTool(proxy: PlatformProxy) {
  return createTool({
    id: 'openai_list_files',
    description: 'List files from OpenAI',
    inputSchema: listFilesInputSchema,
    outputSchema: listFilesOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof listFilesOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const params: Record<string, string | number> = {};

      if (input.purpose !== undefined) {
        params['purpose'] = input.purpose;
      }
      if (input.cursor !== undefined) {
        params['after'] = input.cursor;
      }
      if (input.limit !== undefined) {
        params['limit'] = input.limit;
      }
      if (input.order !== undefined) {
        params['order'] = input.order;
      }

      const response = await platformProxy.get({
        // https://platform.openai.com/docs/api-reference/files/list
        endpoint: '/v1/files',
        params,
        retries: 3,
      });

      const providerData = ProviderResponseSchema.parse(response.data);

      return {
        files: providerData.data.map(file => ({
          id: file.id,
          object: file.object,
          bytes: file.bytes,
          created_at: file.created_at,
          filename: file.filename,
          purpose: file.purpose,
          status: file.status,
          ...(file.status_details != null && { status_details: file.status_details }),
        })),
        has_more: providerData.has_more,
        ...(providerData.last_id != null && { next_cursor: providerData.last_id }),
      };
    },
  });
}
