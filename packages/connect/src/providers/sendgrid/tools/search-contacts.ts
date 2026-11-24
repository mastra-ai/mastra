// AUTO-GENERATED from NangoHQ/integration-templates @ bb789a55bfcf — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const searchContactsInputSchema = z.object({
  query: z.string().describe('An SGQL search string. Example: "email LIKE \'%example.com%\'"'),
});

const ProviderContactSchema = z.object({
  id: z.string(),
  first_name: z.string().nullish(),
  last_name: z.string().nullish(),
  unique_name: z.string().nullish(),
  email: z.string().nullish(),
  phone_number_id: z.string().nullish(),
  external_id: z.string().nullish(),
  anonymous_id: z.string().nullish(),
  alternate_emails: z.array(z.string()).nullish(),
  address_line_1: z.string().nullish(),
  address_line_2: z.string().nullish(),
  city: z.string().nullish(),
  state_province_region: z.string().nullish(),
  country: z.string().nullish(),
  postal_code: z.string().nullish(),
  phone_number: z.string().nullish(),
  whatsapp: z.string().nullish(),
  line: z.string().nullish(),
  facebook: z.string().nullish(),
  list_ids: z.array(z.string()).nullish(),
  segment_ids: z.array(z.string()).nullish(),
  custom_fields: z.record(z.string(), z.unknown()).nullish(),
  created_at: z.string().nullish(),
  updated_at: z.string().nullish(),
});

const ContactSchema = z.object({
  id: z.string(),
  first_name: z.string().optional(),
  last_name: z.string().optional(),
  unique_name: z.string().optional(),
  email: z.string().optional(),
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

export const searchContactsOutputSchema = z.object({
  contacts: z.array(ContactSchema),
  contact_count: z.number(),
});

function mapContact(raw: unknown): z.infer<typeof ContactSchema> | undefined {
  const parsed = ProviderContactSchema.safeParse(raw);
  if (!parsed.success) {
    return undefined;
  }
  const c = parsed.data;
  const contact: z.infer<typeof ContactSchema> = {
    id: c.id,
  };
  if (c.first_name != null) contact.first_name = c.first_name;
  if (c.last_name != null) contact.last_name = c.last_name;
  if (c.unique_name != null) contact.unique_name = c.unique_name;
  if (c.email != null) contact.email = c.email;
  if (c.phone_number_id != null) contact.phone_number_id = c.phone_number_id;
  if (c.external_id != null) contact.external_id = c.external_id;
  if (c.anonymous_id != null) contact.anonymous_id = c.anonymous_id;
  if (c.alternate_emails != null) contact.alternate_emails = c.alternate_emails;
  if (c.address_line_1 != null) contact.address_line_1 = c.address_line_1;
  if (c.address_line_2 != null) contact.address_line_2 = c.address_line_2;
  if (c.city != null) contact.city = c.city;
  if (c.state_province_region != null) contact.state_province_region = c.state_province_region;
  if (c.country != null) contact.country = c.country;
  if (c.postal_code != null) contact.postal_code = c.postal_code;
  if (c.phone_number != null) contact.phone_number = c.phone_number;
  if (c.whatsapp != null) contact.whatsapp = c.whatsapp;
  if (c.line != null) contact.line = c.line;
  if (c.facebook != null) contact.facebook = c.facebook;
  if (c.list_ids != null) contact.list_ids = c.list_ids;
  if (c.segment_ids != null) contact.segment_ids = c.segment_ids;
  if (c.custom_fields != null) contact.custom_fields = c.custom_fields;
  if (c.created_at != null) contact.created_at = c.created_at;
  if (c.updated_at != null) contact.updated_at = c.updated_at;
  return contact;
}

export function searchContactsTool(proxy: PlatformProxy) {
  return createTool({
    id: 'sendgrid_search_contacts',
    description: 'Search marketing contacts with a SQL-like query.',
    inputSchema: searchContactsInputSchema,
    outputSchema: searchContactsOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof searchContactsOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const response = await platformProxy.post({
        // https://www.twilio.com/docs/sendgrid/api-reference/contacts/search-contacts
        endpoint: '/v3/marketing/contacts/search',
        data: {
          query: input.query,
        },
        retries: 3,
      });

      const SearchResultSchema = z.object({
        result: z.array(z.unknown()).optional().default([]),
        contact_count: z.number().optional().default(0),
      });

      const parsed = SearchResultSchema.parse(response.data);

      const contacts = parsed.result.flatMap((item: unknown) => {
        const contact = mapContact(item);
        return contact ? [contact] : [];
      });

      return {
        contacts,
        contact_count: parsed.contact_count,
      };
    },
  });
}
