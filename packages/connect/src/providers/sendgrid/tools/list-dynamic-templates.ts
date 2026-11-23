// AUTO-GENERATED from NangoHQ/integration-templates @ bb789a55bfcf — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const listDynamicTemplatesInputSchema = z.object({
  cursor: z.string().optional().describe('Pagination cursor from the previous response. Omit for the first page.'),
  page_size: z.number().min(1).max(200).optional().describe('Number of templates to return per page. Defaults to 50.'),
});

const ProviderTemplateVersionSchema = z.object({
  id: z.string(),
  template_id: z.string(),
  active: z.number(),
  name: z.string().optional(),
  subject: z.string().optional(),
  updated_at: z.string().optional(),
  generate_plain_content: z.boolean().optional(),
  html_content: z.string().optional(),
  plain_content: z.string().optional(),
  editor: z.enum(['code', 'design']).or(z.string()).optional(),
  thumbnail_url: z.string().optional(),
});

const ProviderTemplateSchema = z.object({
  id: z.string(),
  name: z.string(),
  generation: z.enum(['legacy', 'dynamic']).or(z.string()),
  updated_at: z.string(),
  versions: z.array(ProviderTemplateVersionSchema).optional(),
});

const ProviderMetadataSchema = z.object({
  prev: z.string().optional(),
  self: z.string().optional(),
  next: z.string().optional(),
  count: z.number().optional(),
});

const ProviderResponseSchema = z.object({
  result: z.array(ProviderTemplateSchema),
  _metadata: ProviderMetadataSchema.optional(),
});

export const listDynamicTemplatesOutputSchema = z.object({
  items: z.array(ProviderTemplateSchema),
  next_cursor: z.string().optional(),
});

export function listDynamicTemplatesTool(proxy: PlatformProxy) {
  return createTool({
    id: 'sendgrid_list_dynamic_templates',
    description: 'List dynamic templates.',
    inputSchema: listDynamicTemplatesInputSchema,
    outputSchema: listDynamicTemplatesOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof listDynamicTemplatesOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      // https://www.twilio.com/docs/sendgrid/api-reference/transactional-templates/retrieve-paged-transactional-templates
      const response = await platformProxy.get({
        endpoint: '/v3/templates',
        params: {
          generations: 'dynamic',
          page_size: input.page_size ?? 50,
          ...(input.cursor !== undefined && { page_token: input.cursor }),
        },
        retries: 3,
      });

      const providerResponse = ProviderResponseSchema.parse(response.data);

      let nextCursor: string | undefined;
      if (providerResponse._metadata?.next !== undefined) {
        const nextUrl = new URL(providerResponse._metadata.next);
        const token = nextUrl.searchParams.get('page_token');
        if (token !== null) {
          nextCursor = token;
        }
      }

      return {
        items: providerResponse.result,
        ...(nextCursor !== undefined && { next_cursor: nextCursor }),
      };
    },
  });
}
