// AUTO-GENERATED from NangoHQ/integration-templates @ bb789a55bfcf — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const listContactsInputSchema = z.object({});

const ProviderContactSchema = z.object({
  id: z.string(),
  email: z.string().nullable().optional(),
  first_name: z.string().nullable().optional(),
  last_name: z.string().nullable().optional(),
  unique_name: z.string().nullable().optional(),
  phone_number_id: z.string().nullable().optional(),
  external_id: z.string().nullable().optional(),
  anonymous_id: z.string().nullable().optional(),
  alternate_emails: z.array(z.string()).nullable().optional(),
  address_line_1: z.string().nullable().optional(),
  address_line_2: z.string().nullable().optional(),
  city: z.string().nullable().optional(),
  state_province_region: z.string().nullable().optional(),
  country: z.string().nullable().optional(),
  postal_code: z.string().nullable().optional(),
  phone_number: z.string().nullable().optional(),
  whatsapp: z.string().nullable().optional(),
  line: z.string().nullable().optional(),
  facebook: z.string().nullable().optional(),
  list_ids: z.array(z.string()).nullable().optional(),
  segment_ids: z.array(z.string()).nullable().optional(),
  custom_fields: z.record(z.string(), z.unknown()).nullable().optional(),
  created_at: z.string().nullable().optional(),
  updated_at: z.string().nullable().optional(),
});

const OutputContactSchema = z.object({
  id: z.string(),
  email: z.string().optional(),
  first_name: z.string().optional(),
  last_name: z.string().optional(),
  unique_name: z.string().optional(),
  phone_number_id: z.string().optional(),
  external_id: z.string().optional(),
  anonymous_id: z.string().optional(),
  alternate_emails: z.array(z.string()).optional(),
  address_line_1: z.string().optional(),
  address_line_2: z.string().optional(),
  city: z.string().optional(),
  state_province_region: z.string().optional(),
  country: z.string().optional(),
  postal_code: z.string().optional(),
  phone_number: z.string().optional(),
  whatsapp: z.string().optional(),
  line: z.string().optional(),
  facebook: z.string().optional(),
  list_ids: z.array(z.string()).optional(),
  segment_ids: z.array(z.string()).optional(),
  custom_fields: z.record(z.string(), z.unknown()).optional(),
  created_at: z.string().optional(),
  updated_at: z.string().optional(),
});

export const listContactsOutputSchema = z.object({
  contacts: z.array(OutputContactSchema),
  contact_count: z.number().optional(),
});

export function listContactsTool(proxy: PlatformProxy) {
  return createTool({
    id: 'sendgrid_list_contacts',
    description: 'List marketing contacts (small, capped result set).',
    inputSchema: listContactsInputSchema,
    outputSchema: listContactsOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof listContactsOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      // https://www.twilio.com/docs/sendgrid/api-reference/contacts/get-sample-contacts
      const response = await platformProxy.get({
        endpoint: '/v3/marketing/contacts',
        retries: 3,
      });

      const providerResponse = z
        .object({
          result: z.array(z.unknown()),
          contact_count: z.number().optional(),
        })
        .parse(response.data);

      const contacts = providerResponse.result.map(item => {
        const raw = ProviderContactSchema.parse(item);
        return {
          id: raw.id,
          ...(raw.email != null && { email: raw.email }),
          ...(raw.first_name != null && { first_name: raw.first_name }),
          ...(raw.last_name != null && { last_name: raw.last_name }),
          ...(raw.unique_name != null && { unique_name: raw.unique_name }),
          ...(raw.phone_number_id != null && { phone_number_id: raw.phone_number_id }),
          ...(raw.external_id != null && { external_id: raw.external_id }),
          ...(raw.anonymous_id != null && { anonymous_id: raw.anonymous_id }),
          ...(raw.alternate_emails != null && { alternate_emails: raw.alternate_emails }),
          ...(raw.address_line_1 != null && { address_line_1: raw.address_line_1 }),
          ...(raw.address_line_2 != null && { address_line_2: raw.address_line_2 }),
          ...(raw.city != null && { city: raw.city }),
          ...(raw.state_province_region != null && { state_province_region: raw.state_province_region }),
          ...(raw.country != null && { country: raw.country }),
          ...(raw.postal_code != null && { postal_code: raw.postal_code }),
          ...(raw.phone_number != null && { phone_number: raw.phone_number }),
          ...(raw.whatsapp != null && { whatsapp: raw.whatsapp }),
          ...(raw.line != null && { line: raw.line }),
          ...(raw.facebook != null && { facebook: raw.facebook }),
          ...(raw.list_ids != null && { list_ids: raw.list_ids }),
          ...(raw.segment_ids != null && { segment_ids: raw.segment_ids }),
          ...(raw.custom_fields != null && { custom_fields: raw.custom_fields }),
          ...(raw.created_at != null && { created_at: raw.created_at }),
          ...(raw.updated_at != null && { updated_at: raw.updated_at }),
        };
      });

      return {
        contacts,
        contact_count: providerResponse.contact_count,
      };
    },
  });
}
