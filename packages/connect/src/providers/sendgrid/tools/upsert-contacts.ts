// AUTO-GENERATED from NangoHQ/integration-templates @ bb789a55bfcf — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

const ContactSchema = z
  .object({
    email: z.string().email().optional().describe('Primary email identifier. Example: "user@example.com"'),
    first_name: z.string().optional(),
    last_name: z.string().optional(),
    address_line_1: z.string().optional(),
    address_line_2: z.string().optional(),
    alternate_emails: z.array(z.string().email()).optional(),
    city: z.string().optional(),
    state_province_region: z.string().optional(),
    country: z.string().optional(),
    postal_code: z.string().optional(),
    phone_number_id: z.string().optional(),
    external_id: z.string().optional(),
    anonymous_id: z.string().optional(),
    unique_name: z.string().optional(),
    whatsapp: z.string().optional(),
    line: z.string().optional(),
    facebook: z.string().optional(),
    custom_fields: z.record(z.string(), z.unknown()).optional(),
  })
  .passthrough()
  .refine(
    contact => {
      return Boolean(contact.email || contact.phone_number_id || contact.external_id || contact.anonymous_id);
    },
    {
      message:
        'Each contact must include at least one identifier: email, phone_number_id, external_id, or anonymous_id.',
    },
  );

export const upsertContactsInputSchema = z.object({
  list_ids: z
    .array(z.string())
    .optional()
    .describe('List IDs to add all contacts to. Example: ["fa1dbbb4-10af-42d7-b07e-d1ab501a805b"]'),
  contacts: z.array(ContactSchema).min(1).max(30000).describe('Contacts to upsert. Min 1, max 30000.'),
});

const JobResultSchema = z.object({
  created_count: z.number().optional(),
  updated_count: z.number().optional(),
  deleted_count: z.number().optional(),
  errored_count: z.number().optional(),
  error_indices: z.array(z.number()).optional(),
  unmodified_count: z.number().optional(),
  new_count: z.number().optional(),
});

const ImportStatusSchema = z.object({
  status: z.string(),
  id: z.string(),
  finished_at: z.string().nullable().optional(),
  started_at: z.string().optional(),
  expires_at: z.string().optional(),
  results: JobResultSchema.optional(),
  errors: z
    .array(
      z.object({
        message: z.string(),
        field: z.string().optional(),
      }),
    )
    .optional(),
});

export const upsertContactsOutputSchema = z.object({
  job_id: z.string(),
  status: z.string(),
  finished_at: z.string().optional(),
  started_at: z.string().optional(),
  expires_at: z.string().optional(),
  results: JobResultSchema.optional(),
  errors: z
    .array(
      z.object({
        message: z.string(),
        field: z.string().optional(),
      }),
    )
    .optional(),
});

export function upsertContactsTool(proxy: PlatformProxy) {
  return createTool({
    id: 'sendgrid_upsert_contacts',
    description: 'Create or update marketing contacts, optionally adding them to lists.',
    inputSchema: upsertContactsInputSchema,
    outputSchema: upsertContactsOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof upsertContactsOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const requestBody: { list_ids?: string[]; contacts: unknown[] } = {
        contacts: input.contacts,
      };

      if (input.list_ids !== undefined) {
        requestBody.list_ids = input.list_ids;
      }

      const response = await platformProxy.put({
        // https://www.twilio.com/docs/sendgrid/api-reference/contacts/add-or-update-a-contact
        endpoint: '/v3/marketing/contacts',
        data: requestBody,
        retries: 1,
      });

      const upsertResponse = z
        .object({
          job_id: z.string(),
        })
        .parse(response.data);

      const jobId = upsertResponse.job_id;
      const targetCount = input.contacts.length;
      const maxAttempts = 20;
      const delayMs = 3000;

      const isTestEnvironment = typeof platformProxy.log === 'function' && 'mock' in platformProxy.log;
      const sleep = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms));

      for (let attempt = 0; attempt < maxAttempts; attempt++) {
        await sleep(isTestEnvironment ? 0 : delayMs);

        const pollResponse = await platformProxy.get({
          // https://www.twilio.com/docs/sendgrid/api-reference/contacts/import-contacts-status
          endpoint: `/v3/marketing/contacts/imports/${encodeURIComponent(jobId)}`,
          params: {
            _: String(attempt),
          },
          retries: 3,
        });

        const status = ImportStatusSchema.parse(pollResponse.data);
        const terminalStatuses = ['completed', 'errored', 'failed'];
        const processedCount =
          (status.results?.created_count ?? 0) +
          (status.results?.updated_count ?? 0) +
          (status.results?.errored_count ?? 0) +
          (status.results?.unmodified_count ?? 0) +
          (status.results?.deleted_count ?? 0);

        if (processedCount >= targetCount || terminalStatuses.includes(status.status)) {
          return {
            job_id: status.id,
            status: status.status,
            ...(status.finished_at != null && { finished_at: status.finished_at }),
            ...(status.started_at != null && { started_at: status.started_at }),
            ...(status.expires_at != null && { expires_at: status.expires_at }),
            ...(status.results != null && { results: status.results }),
            ...(status.errors != null && { errors: status.errors }),
          };
        }
      }

      throw new platformProxy.ActionError({
        type: 'timeout',
        message: `Contact upsert job ${jobId} did not complete within the polling window.`,
      });
    },
  });
}
