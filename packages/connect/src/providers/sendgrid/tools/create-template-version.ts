// AUTO-GENERATED from NangoHQ/integration-templates @ bb789a55bfcf — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy, PlatformProxyRequest } from '../../../runtime/platform-proxy.js';

export const createTemplateVersionInputSchema = z.object({
  template_id: z.string().describe('The ID of the dynamic template. Example: "d-0331074d69814e249a53ab93302cd9ed"'),
  name: z.string().describe('Name of the template version. Example: "v1.1"'),
  subject: z.string().describe('Subject line of the template version. Example: "Welcome aboard"'),
  html_content: z.string().optional().describe('HTML content of the version.'),
  plain_content: z.string().optional().describe('Plain text content of the version.'),
  active: z
    .number()
    .int()
    .min(0)
    .max(1)
    .optional()
    .describe(
      'Set as active (1) or inactive (0). Note: this field is ignored at creation time; use activate-template-version explicitly to control activation.',
    ),
});

const WarningSchema = z.object({
  message: z.string(),
});

const ProviderOutputSchema = z.object({
  id: z.string(),
  template_id: z.string(),
  active: z.number(),
  name: z.string(),
  html_content: z.string().optional(),
  plain_content: z.string().optional(),
  generate_plain_content: z.boolean().optional(),
  subject: z.string(),
  updated_at: z.string().optional(),
  editor: z.string().optional(),
  thumbnail_url: z.string().optional(),
  test_data: z.string().optional(),
  warnings: z.array(WarningSchema).optional(),
});

export const createTemplateVersionOutputSchema = z.object({
  id: z.string(),
  template_id: z.string(),
  active: z.number(),
  name: z.string(),
  html_content: z.string().optional(),
  plain_content: z.string().optional(),
  generate_plain_content: z.boolean().optional(),
  subject: z.string(),
  updated_at: z.string().optional(),
  editor: z.string().optional(),
  thumbnail_url: z.string().optional(),
  test_data: z.string().optional(),
  warnings: z.array(WarningSchema).optional(),
});

export function createTemplateVersionTool(proxy: PlatformProxy) {
  return createTool({
    id: 'sendgrid_create_template_version',
    description: 'Create a new version of a dynamic template.',
    inputSchema: createTemplateVersionInputSchema,
    outputSchema: createTemplateVersionOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof createTemplateVersionOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const config: PlatformProxyRequest = {
        // https://www.twilio.com/docs/sendgrid/api-reference/transactional-templates-versions/create-a-new-transactional-template-version
        endpoint: `/v3/templates/${encodeURIComponent(input.template_id)}/versions`,
        data: {
          name: input.name,
          subject: input.subject,
          ...(input.html_content !== undefined && { html_content: input.html_content }),
          ...(input.plain_content !== undefined && { plain_content: input.plain_content }),
          ...(input.active !== undefined && { active: input.active }),
        },
        retries: 1,
      };

      const response = await platformProxy.post(config);

      if (!response.data) {
        throw new platformProxy.ActionError({
          type: 'no_data',
          message: 'No data returned from SendGrid API.',
        });
      }

      const providerOutput = ProviderOutputSchema.parse(response.data);

      return {
        id: providerOutput.id,
        template_id: providerOutput.template_id,
        active: providerOutput.active,
        name: providerOutput.name,
        ...(providerOutput.html_content !== undefined && { html_content: providerOutput.html_content }),
        ...(providerOutput.plain_content !== undefined && { plain_content: providerOutput.plain_content }),
        ...(providerOutput.generate_plain_content !== undefined && {
          generate_plain_content: providerOutput.generate_plain_content,
        }),
        subject: providerOutput.subject,
        ...(providerOutput.updated_at !== undefined && { updated_at: providerOutput.updated_at }),
        ...(providerOutput.editor !== undefined && { editor: providerOutput.editor }),
        ...(providerOutput.thumbnail_url !== undefined && { thumbnail_url: providerOutput.thumbnail_url }),
        ...(providerOutput.test_data !== undefined && { test_data: providerOutput.test_data }),
        ...(providerOutput.warnings !== undefined && { warnings: providerOutput.warnings }),
      };
    },
  });
}
