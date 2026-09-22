// AUTO-GENERATED from NangoHQ/integration-templates @ c3091db1e8a6 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const updateMarketingEmailInputSchema = z.object({
  emailId: z.string().describe('The ID of the marketing email to update. Example: "123456789"'),
  name: z.string().optional().describe('The name of the marketing email.'),
  subject: z.string().optional().describe('The subject line of the marketing email.'),
  html: z.string().optional().describe('The HTML content of the marketing email.'),
  fromEmail: z.string().optional().describe('The from email address.'),
  fromName: z.string().optional().describe('The from name.'),
  replyTo: z.string().optional().describe('The reply-to email address.'),
  previewText: z.string().optional().describe('The preview text for the email.'),
});

export const updateMarketingEmailOutputSchema = z.object({
  id: z.string(),
  name: z.string().optional(),
  subject: z.string().optional(),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
});

export function updateMarketingEmailTool(proxy: PlatformProxy) {
  return createTool({
    id: 'hubspot_update_marketing_email',
    description: 'Update a marketing email',
    inputSchema: updateMarketingEmailInputSchema,
    outputSchema: updateMarketingEmailOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof updateMarketingEmailOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      // Build properties object following HubSpot pattern
      const properties: Record<string, string> = {};

      if (input.name) properties['name'] = input.name;
      if (input.subject) properties['subject'] = input.subject;
      if (input.html) properties['html'] = input.html;
      if (input.fromEmail) properties['from.email'] = input.fromEmail;
      if (input.fromName) properties['from.name'] = input.fromName;
      if (input.replyTo) properties['replyTo'] = input.replyTo;
      if (input.previewText) properties['previewText'] = input.previewText;

      const response = await platformProxy.patch({
        // https://developers.hubspot.com/docs/api-reference/marketing-marketing-emails-v3/marketing-emails/patch-marketing-v3-emails-emailId
        endpoint: `/marketing/v3/emails/${input.emailId}`,
        data: { properties },
        retries: 3,
      });

      const data = response.data;

      return {
        id: data.id,
        name: data.name ?? undefined,
        subject: data.subject ?? undefined,
        createdAt: data.createdAt ?? undefined,
        updatedAt: data.updatedAt ?? undefined,
      };
    },
  });
}
