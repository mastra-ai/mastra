// AUTO-GENERATED from rhysbalevicius/integration-templates @ 2faa11af97d8 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy, PlatformProxyRequest } from '../../../runtime/platform-proxy.js';

export const listContactImportsInputSchema = z
  .object({
    status: z.enum(['queued', 'in_progress', 'completed', 'failed']).optional(),
    limit: z.number().int().min(1).max(100).optional(),
    after: z.string().optional(),
    before: z.string().optional(),
  })
  .passthrough();

const ProviderResponseSchema = z
  .object({
    object: z.string().optional(),
    has_more: z.boolean().optional(),
    data: z
      .array(
        z
          .object({
            object: z.string().optional(),
            id: z.string().optional(),
            status: z.enum(['queued', 'in_progress', 'completed', 'failed']).optional(),
            created_at: z.string().optional(),
            completed_at: z.string().nullable().optional(),
            counts: z
              .object({
                total: z.number().int().optional(),
                created: z.number().int().optional(),
                updated: z.number().int().optional(),
                skipped: z.number().int().optional(),
                failed: z.number().int().optional(),
              })
              .passthrough()
              .optional(),
          })
          .passthrough(),
      )
      .optional(),
  })
  .passthrough();

export const listContactImportsOutputSchema = ProviderResponseSchema.extend({ next_cursor: z.string().optional() });

export function listContactImportsTool(proxy: PlatformProxy) {
  return createTool({
    id: 'resend_list_contact_imports',
    description:
      'Retrieve a list of contact imports in Resend. Returns one page; pass next_cursor as after to continue.',
    inputSchema: listContactImportsInputSchema,
    outputSchema: listContactImportsOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof listContactImportsOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const params: Record<string, string> = {};
      if (input['status'] !== undefined)
        params['status'] = Array.isArray(input['status']) ? input['status'].join(',') : String(input['status']);
      if (input['limit'] !== undefined)
        params['limit'] = Array.isArray(input['limit']) ? input['limit'].join(',') : String(input['limit']);
      if (input['after'] !== undefined)
        params['after'] = Array.isArray(input['after']) ? input['after'].join(',') : String(input['after']);
      if (input['before'] !== undefined)
        params['before'] = Array.isArray(input['before']) ? input['before'].join(',') : String(input['before']);
      const config: PlatformProxyRequest = {
        // https://raw.githubusercontent.com/resend/resend-openapi/68c1b66c20ad62020962838832e53af10558c2f5/resend.yaml,
        endpoint: `/contacts/imports`,
        retries: 3,
        params,
      };
      const response = await platformProxy.get(config);
      const data = ProviderResponseSchema.parse(response.data);
      return { ...data, next_cursor: data.has_more ? data.data?.at(-1)?.id : undefined };
    },
  });
}
