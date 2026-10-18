// AUTO-GENERATED from NangoHQ/integration-templates @ c3091db1e8a6 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const getMarketingEmailInputSchema = z.object({
  emailId: z.string().describe('The ID of the marketing email to retrieve. Example: "38175169118"'),
});

export const getMarketingEmailOutputSchema = z.object({
  id: z.string(),
  name: z.string().optional(),
  subject: z.string().optional(),
  state: z.string().optional(),
  type: z.string().optional(),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
  publishedAt: z.string().optional(),
  isPublished: z.boolean().optional(),
  isTransactional: z.boolean().optional(),
  archived: z.boolean().optional(),
});

export function getMarketingEmailTool(proxy: PlatformProxy) {
  return createTool({
    id: 'hubspot_get_marketing_email',
    description: 'Get a marketing email by ID',
    inputSchema: getMarketingEmailInputSchema,
    outputSchema: getMarketingEmailOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof getMarketingEmailOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      // https://developers.hubspot.com/docs/api-reference/marketing-marketing-emails-v3/marketing-emails/get-marketing-v3-emails-emailId
      const response = await platformProxy.get({
        endpoint: `/marketing/v3/emails/${input.emailId}`,
        retries: 3,
      });

      if (!response.data) {
        throw new platformProxy.ActionError({
          type: 'not_found',
          message: 'Marketing email not found',
          emailId: input.emailId,
        });
      }

      const data = response.data;

      return {
        id: data.id,
        name: data.name ?? undefined,
        subject: data.subject ?? undefined,
        state: data.state ?? undefined,
        type: data.type ?? undefined,
        createdAt: data.createdAt ?? undefined,
        updatedAt: data.updatedAt ?? undefined,
        publishedAt: data.publishedAt ?? undefined,
        isPublished: data.isPublished ?? undefined,
        isTransactional: data.isTransactional ?? undefined,
        archived: data.archived ?? undefined,
      };
    },
  });
}
