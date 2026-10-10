// AUTO-GENERATED from NangoHQ/integration-templates @ bb789a55bfcf — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

async function getDeveloperToken(platformProxy: PlatformProxy): Promise<string | null> {
  const connection = await platformProxy.getConnection();
  const developerToken = connection.connection_config?.['developer_token'];
  return typeof developerToken === 'string' && developerToken.length > 0 ? developerToken : null;
}

export const validateGoogleAdsMutateInputSchema = z.object({
  path: z.string().describe('Google Ads mutate endpoint path. Example: "v25/customers/1781900691/campaigns:mutate"'),
  body: z
    .record(z.string(), z.unknown())
    .describe('Mutate request body without validateOnly. Example: {"operations":[{"create":{...}}]}'),
  loginCustomerId: z.string().optional().describe('Manager customer ID for MCC hierarchy. Example: "3608201627"'),
});

export const validateGoogleAdsMutateOutputSchema = z.object({}).passthrough();

export function validateGoogleAdsMutateTool(proxy: PlatformProxy) {
  return createTool({
    id: 'google_ads_validate_google_ads_mutate',
    description: 'Validate a mutate request without applying changes.',
    inputSchema: validateGoogleAdsMutateInputSchema,
    outputSchema: validateGoogleAdsMutateOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof validateGoogleAdsMutateOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const developerToken = await getDeveloperToken(platformProxy);
      if (!developerToken) {
        throw new platformProxy.ActionError({
          type: 'missing_config',
          message: 'developer_token is required in connection config',
        });
      }

      const headers: Record<string, string> = {
        'developer-token': developerToken,
      };

      if (input.loginCustomerId) {
        headers['login-customer-id'] = input.loginCustomerId;
      }

      const response = await platformProxy.post({
        // https://developers.google.com/google-ads/api/docs/mutating/service-mutates
        endpoint: input.path,
        data: {
          ...input.body,
          validateOnly: true,
        },
        headers,
        retries: 3,
      });

      const parsed = validateGoogleAdsMutateOutputSchema.parse(response.data);
      return parsed;
    },
  });
}
