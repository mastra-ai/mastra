// AUTO-GENERATED from NangoHQ/integration-templates @ bb789a55bfcf — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

const TemplateWarningSchema = z.object({
  message: z.string(),
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
});

export const updateDynamicTemplateOutputSchema = z
  .object({
    id: z.string(),
    name: z.string(),
    generation: z.enum(['legacy', 'dynamic']).or(z.string()),
    updated_at: z.string(),
    warning: TemplateWarningSchema.optional(),
    versions: z.array(TemplateVersionSchema).optional(),
  })
  .passthrough();

export const updateDynamicTemplateInputSchema = z.object({
  templateId: z.string().describe('The ID of the transactional template.'),
  name: z.string().max(100).describe('The new name for the transactional template.'),
});

export function updateDynamicTemplateTool(proxy: PlatformProxy) {
  return createTool({
    id: 'sendgrid_update_dynamic_template',
    description: 'Rename a dynamic template.',
    inputSchema: updateDynamicTemplateInputSchema,
    outputSchema: updateDynamicTemplateOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof updateDynamicTemplateOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      // https://www.twilio.com/docs/sendgrid/api-reference/transactional-templates/edit-a-transactional-template
      const response = await platformProxy.patch({
        endpoint: `/v3/templates/${encodeURIComponent(input.templateId)}`,
        data: {
          name: input.name,
        },
        retries: 3,
      });

      const parsed = updateDynamicTemplateOutputSchema.safeParse(response.data);
      if (!parsed.success) {
        throw new platformProxy.ActionError({
          message: 'Invalid response from SendGrid API',
          details: parsed.error.issues,
        });
      }

      return parsed.data;
    },
  });
}
