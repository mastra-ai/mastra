// AUTO-GENERATED from NangoHQ/integration-templates @ bb789a55bfcf — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const getDynamicTemplateInputSchema = z.object({
  template_id: z.string().describe('The ID of the dynamic template. Example: d-e6adcea686a0410aa1f6d05879bf935d'),
});

const TemplateVersionSchema = z.object({
  id: z.string(),
  template_id: z.string(),
  active: z.number(),
  name: z.string().optional(),
  subject: z.string().optional(),
  updated_at: z.string(),
  generate_plain_content: z.boolean().optional(),
  html_content: z.string().optional(),
  plain_content: z.string().optional(),
  editor: z.enum(['code', 'design']).or(z.string()).optional(),
  thumbnail_url: z.string().optional(),
  test_data: z.string().optional(),
});

export const getDynamicTemplateOutputSchema = z.object({
  id: z.string(),
  name: z.string(),
  generation: z.enum(['legacy', 'dynamic']).or(z.string()),
  updated_at: z.string(),
  warning: z
    .object({
      message: z.string(),
    })
    .optional(),
  versions: z.array(TemplateVersionSchema).optional(),
});

export function getDynamicTemplateTool(proxy: PlatformProxy) {
  return createTool({
    id: 'sendgrid_get_dynamic_template',
    description: 'Get a single dynamic template and all of its versions.',
    inputSchema: getDynamicTemplateInputSchema,
    outputSchema: getDynamicTemplateOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof getDynamicTemplateOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const response = await platformProxy.get({
        // https://docs.sendgrid.com/api-reference/transactional-templates/retrieve-a-single-transactional-template
        endpoint: `/v3/templates/${encodeURIComponent(input.template_id)}`,
        retries: 3,
      });

      const providerTemplate = getDynamicTemplateOutputSchema.parse(response.data);

      return providerTemplate;
    },
  });
}
