// AUTO-GENERATED from rhysbalevicius/integration-templates @ 06fb7396c6b2 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy, PlatformProxyRequest } from '../../../runtime/platform-proxy.js';

export const getContactImportInputSchema = z.object({ id: z.string() }).passthrough();

const ProviderResponseSchema = z
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
  .passthrough();

export const getContactImportOutputSchema = ProviderResponseSchema;

export function getContactImportTool(proxy: PlatformProxy) {
  return createTool({
    id: 'resend_get_contact_import',
    description: 'Retrieve a single contact import in Resend.',
    inputSchema: getContactImportInputSchema,
    outputSchema: getContactImportOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof getContactImportOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const config: PlatformProxyRequest = {
        // https://raw.githubusercontent.com/resend/resend-openapi/68c1b66c20ad62020962838832e53af10558c2f5/resend.yaml,
        endpoint: `/contacts/imports/${encodeURIComponent(input['id'])}`,
        retries: 3,
      };
      const response = await platformProxy.get(config);
      const data = ProviderResponseSchema.parse(response.data);
      return data;
    },
  });
}
