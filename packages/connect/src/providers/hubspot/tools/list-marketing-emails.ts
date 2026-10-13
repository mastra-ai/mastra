// AUTO-GENERATED from NangoHQ/integration-templates @ c3091db1e8a6 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const listMarketingEmailsInputSchema = z.object({
  cursor: z.string().optional().describe('Pagination cursor from previous response. Omit for first page.'),
});

const MarketingEmailSchema = z.object({
  id: z.string(),
  name: z.string().optional(),
  subject: z.string().optional(),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
  type: z.string().optional(),
  state: z.string().optional(),
});

export const listMarketingEmailsOutputSchema = z.object({
  emails: z.array(MarketingEmailSchema),
  nextCursor: z.string().optional(),
});

export function listMarketingEmailsTool(proxy: PlatformProxy) {
  return createTool({
    id: 'hubspot_list_marketing_emails',
    description: 'List marketing emails',
    inputSchema: listMarketingEmailsInputSchema,
    outputSchema: listMarketingEmailsOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof listMarketingEmailsOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const response = await platformProxy.get({
        // https://developers.hubspot.com/docs/api-reference/marketing-marketing-emails-v3/marketing-emails/get-marketing-v3-emails-
        endpoint: '/marketing/v3/emails',
        params: {
          limit: '100',
          ...(input.cursor && { after: input.cursor }),
        },
        retries: 3,
      });

      const emails =
        response.data.results?.map((email: any) => ({
          id: email.id,
          name: email.name ?? undefined,
          subject: email.subject ?? undefined,
          createdAt: email.createdAt ?? undefined,
          updatedAt: email.updatedAt ?? undefined,
          type: email.type ?? undefined,
          state: email.state ?? undefined,
        })) || [];

      return {
        emails,
        nextCursor: response.data.paging?.next?.after || undefined,
      };
    },
  });
}
