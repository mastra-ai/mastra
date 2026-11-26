// AUTO-GENERATED from NangoHQ/integration-templates @ bb789a55bfcf — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const activateTemplateVersionInputSchema = z.object({
  template_id: z.string().describe('Template ID. Example: "d-e6adcea686a0410aa1f6d05879bf935d"'),
  version_id: z.string().describe('Template version ID. Example: "a7212169-c965-4808-b0ee-f9728250515d"'),
});

const ProviderVersionSchema = z.object({
  id: z.string(),
  template_id: z.string(),
  active: z.number().int(),
  name: z.string().optional(),
  subject: z.string().optional(),
  updated_at: z.string().optional(),
  thumbnail_url: z.string().optional(),
  generate_plain_content: z.boolean().optional(),
  editor: z.string().optional(),
  test_data: z.string().optional(),
});

export const activateTemplateVersionOutputSchema = z.object({
  id: z.string(),
  template_id: z.string(),
  active: z.number().int(),
  name: z.string().optional(),
  subject: z.string().optional(),
  updated_at: z.string().optional(),
});

export function activateTemplateVersionTool(proxy: PlatformProxy) {
  return createTool({
    id: 'sendgrid_activate_template_version',
    description: 'Mark a template version as the active one used when sending.',
    inputSchema: activateTemplateVersionInputSchema,
    outputSchema: activateTemplateVersionOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof activateTemplateVersionOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const response = await platformProxy.post({
        // https://www.twilio.com/docs/sendgrid/api-reference/templates/activate-a-template-version
        endpoint: `/v3/templates/${encodeURIComponent(input.template_id)}/versions/${encodeURIComponent(input.version_id)}/activate`,
        retries: 3,
      });

      const providerVersion = ProviderVersionSchema.parse(response.data);

      return {
        id: providerVersion.id,
        template_id: providerVersion.template_id,
        active: providerVersion.active,
        ...(providerVersion.name !== undefined && { name: providerVersion.name }),
        ...(providerVersion.subject !== undefined && { subject: providerVersion.subject }),
        ...(providerVersion.updated_at !== undefined && { updated_at: providerVersion.updated_at }),
      };
    },
  });
}
