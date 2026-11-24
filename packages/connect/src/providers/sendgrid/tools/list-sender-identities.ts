// AUTO-GENERATED from NangoHQ/integration-templates @ bb789a55bfcf — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const listSenderIdentitiesInputSchema = z.object({
  cursor: z
    .string()
    .regex(/^\d+$/)
    .optional()
    .describe('Pagination cursor from the previous response. Omit for the first page.'),
  limit: z.number().int().positive().optional().describe('Maximum number of results to return.'),
});

const SenderIdentitySchema = z.object({
  id: z.number(),
  nickname: z.string(),
  from_email: z.string(),
  from_name: z.string().optional(),
  reply_to: z.string().optional(),
  reply_to_name: z.string().optional(),
  address: z.string().optional(),
  address2: z.string().optional(),
  state: z.string().optional(),
  city: z.string().optional(),
  zip: z.string().optional(),
  country: z.string().optional(),
  verified: z.boolean(),
  locked: z.boolean(),
});

export const listSenderIdentitiesOutputSchema = z.object({
  results: z.array(SenderIdentitySchema),
  next_cursor: z.string().optional(),
});

const ProviderResponseSchema = z.object({
  results: z.array(SenderIdentitySchema),
});

export function listSenderIdentitiesTool(proxy: PlatformProxy) {
  return createTool({
    id: 'sendgrid_list_sender_identities',
    description: 'List verified sender identities.',
    inputSchema: listSenderIdentitiesInputSchema,
    outputSchema: listSenderIdentitiesOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof listSenderIdentitiesOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      // https://www.twilio.com/docs/sendgrid/api-reference/sender-verification/get-all-verified-senders
      const response = await platformProxy.get({
        endpoint: '/v3/verified_senders',
        params: {
          ...(input.limit !== undefined && { limit: input.limit }),
          ...(input.cursor !== undefined && { lastSeenID: Number(input.cursor) }),
        },
        retries: 3,
      });

      const providerResponse = ProviderResponseSchema.parse(response.data);
      const rawResults = providerResponse.results;
      const verifiedResults = rawResults.filter(sender => sender.verified);

      const lastResult = rawResults.at(-1);
      const nextCursor =
        input.limit !== undefined && rawResults.length === input.limit && lastResult !== undefined
          ? String(lastResult.id)
          : undefined;

      return {
        results: verifiedResults,
        ...(nextCursor !== undefined && { next_cursor: nextCursor }),
      };
    },
  });
}
