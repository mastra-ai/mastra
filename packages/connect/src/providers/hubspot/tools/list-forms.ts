// AUTO-GENERATED from arctic-char/integration-templates @ c3091db1e8a6 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const listFormsInputSchema = z.object({
  cursor: z
    .string()
    .optional()
    .describe('Pagination cursor from previous response. Maps to HubSpot "after" parameter. Omit for first page.'),
});

const FormSchema = z.object({
  id: z.string(),
  name: z.string().optional(),
  formType: z.string().optional(),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
});

export const listFormsOutputSchema = z.object({
  items: z.array(FormSchema),
  nextCursor: z.string().optional(),
});

export function listFormsTool(proxy: PlatformProxy) {
  return createTool({
    id: 'hubspot_list_forms',
    description: 'List forms',
    inputSchema: listFormsInputSchema,
    outputSchema: listFormsOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof listFormsOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      // https://developers.hubspot.com/docs/api-reference/marketing-forms-v3/forms/get-marketing-v3-forms-
      const response = await platformProxy.get({
        endpoint: '/marketing/v3/forms/',
        params: {
          limit: '100',
          ...(input.cursor && { after: input.cursor }),
        },
        retries: 3,
      });

      const data = response.data;

      return {
        items: (data.results || []).map((form: any) => ({
          id: form.id,
          name: form.name ?? undefined,
          formType: form.formType ?? undefined,
          createdAt: form.createdAt ?? undefined,
          updatedAt: form.updatedAt ?? undefined,
        })),
        nextCursor: data.paging?.next?.after || undefined,
      };
    },
  });
}
