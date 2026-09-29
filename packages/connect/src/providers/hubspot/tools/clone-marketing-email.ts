// AUTO-GENERATED from NangoHQ/integration-templates @ c3091db1e8a6 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const cloneMarketingEmailInputSchema = z.object({
  emailId: z.string().describe('The email ID to clone. Example: "38175169118"'),
  cloneName: z.string().optional().describe('The name to assign to the cloned email. Example: "Cloned Newsletter"'),
  language: z
    .string()
    .optional()
    .describe('The language code for the cloned email, such as "en" for English. Example: "en"'),
});

export const cloneMarketingEmailOutputSchema = z.object({
  id: z.string(),
  name: z.string().optional(),
  subject: z.string().optional(),
  state: z.string().optional(),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
  clonedFrom: z.string().optional(),
  isPublished: z.boolean().optional(),
  isTransactional: z.boolean().optional(),
  type: z.string().optional(),
  subcategory: z.string().optional(),
});

export function cloneMarketingEmailTool(proxy: PlatformProxy) {
  return createTool({
    id: 'hubspot_clone_marketing_email',
    description: 'Clone an existing marketing email',
    inputSchema: cloneMarketingEmailInputSchema,
    outputSchema: cloneMarketingEmailOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof cloneMarketingEmailOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const response = await platformProxy.post({
        // https://developers.hubspot.com/docs/api-reference/marketing-marketing-emails-v3/marketing-emails/post-marketing-v3-emails-clone
        endpoint: '/marketing/v3/emails/clone',
        data: {
          id: input.emailId,
          ...(input.cloneName && { cloneName: input.cloneName }),
          ...(input.language && { language: input.language }),
        },
        retries: 3,
      });

      const email = response.data;

      return {
        id: email.id,
        name: email.name ?? undefined,
        subject: email.subject ?? undefined,
        state: email.state ?? undefined,
        createdAt: email.createdAt ?? undefined,
        updatedAt: email.updatedAt ?? undefined,
        clonedFrom: email.clonedFrom ?? undefined,
        isPublished: email.isPublished ?? undefined,
        isTransactional: email.isTransactional ?? undefined,
        type: email.type ?? undefined,
        subcategory: email.subcategory ?? undefined,
      };
    },
  });
}
