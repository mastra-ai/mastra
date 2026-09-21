// AUTO-GENERATED from arctic-char/integration-templates @ c3091db1e8a6 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy, PlatformProxyRequest } from '../../../runtime/platform-proxy.js';

export const submitFormInputSchema = z.object({
  portal_id: z.string().describe('The HubSpot portal (account) ID the form belongs to. Example: "12345678"'),
  form_guid: z.string().describe('The GUID of the form to submit. Example: "a1b2c3d4-e5f6-7890-abcd-ef1234567890"'),
  fields: z
    .array(
      z.object({
        name: z.string().describe('Field name from the form definition. Example: "email"'),
        value: z.string().describe('Value to submit for the field.'),
        object_type_id: z.string().optional().describe('Object type ID for the field. Example: "0-1" for contacts.'),
      }),
    )
    .describe('Form field values to submit.'),
  page_uri: z.string().optional().describe('URI of the page the submission came from.'),
  page_name: z.string().optional().describe('Name or title of the page the submission came from.'),
  hutk: z
    .string()
    .optional()
    .describe('HubSpot usertoken (hubspotutk cookie value) to associate the submission with a visitor session.'),
});

export const submitFormOutputSchema = z.object({
  inline_message: z.string().optional(),
  redirect_uri: z.string().optional(),
});

const ProviderResponseSchema = z
  .object({
    inlineMessage: z.string().optional(),
    redirectUri: z.string().optional(),
  })
  .passthrough();

export function submitFormTool(proxy: PlatformProxy) {
  return createTool({
    id: 'hubspot_submit_form',
    description: 'Submit a HubSpot form on behalf of a visitor, using the authenticated form submission endpoint.',
    inputSchema: submitFormInputSchema,
    outputSchema: submitFormOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof submitFormOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const parsedInput = await platformProxy.zodValidateInput({ zodSchema: submitFormInputSchema, input });

      const context: Record<string, string> = {};
      if (parsedInput.data.page_uri) {
        context['pageUri'] = parsedInput.data.page_uri;
      }
      if (parsedInput.data.page_name) {
        context['pageName'] = parsedInput.data.page_name;
      }
      if (parsedInput.data.hutk) {
        context['hutk'] = parsedInput.data.hutk;
      }

      const config: PlatformProxyRequest = {
        // https://developers.hubspot.com/docs/api/marketing/forms (Submit data to a form — authenticated endpoint)
        endpoint: `/submissions/v3/integration/secure/submit/${encodeURIComponent(parsedInput.data.portal_id)}/${encodeURIComponent(parsedInput.data.form_guid)}`,
        data: {
          fields: parsedInput.data.fields.map(field => ({
            name: field.name,
            value: field.value,
            ...(field.object_type_id && { objectTypeId: field.object_type_id }),
          })),
          ...(Object.keys(context).length > 0 && { context }),
        },
        retries: 3,
      };

      const response = await platformProxy.post(config);

      const providerResponse = ProviderResponseSchema.parse(response.data ?? {});

      return {
        inline_message: providerResponse.inlineMessage,
        redirect_uri: providerResponse.redirectUri,
      };
    },
  });
}
