// AUTO-GENERATED from NangoHQ/integration-templates @ bb789a55bfcf — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy, PlatformProxyRequest } from '../../../runtime/platform-proxy.js';

export const cancelStatementInputSchema = z.object({
  statement_handle: z
    .string()
    .describe(
      'The statement handle returned by Snowflake when a statement is submitted. Example: "01c4d2c3-0001-e881-001c-d6c3000130ea"',
    ),
});

const ProviderCancelResponseSchema = z.object({
  code: z.string(),
  message: z.string(),
});

export const cancelStatementOutputSchema = z.object({
  code: z.string(),
  message: z.string(),
});

export function cancelStatementTool(proxy: PlatformProxy) {
  return createTool({
    id: 'snowflake_cancel_statement',
    description: 'Cancel a running Snowflake SQL statement.',
    inputSchema: cancelStatementInputSchema,
    outputSchema: cancelStatementOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof cancelStatementOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const config: PlatformProxyRequest = {
        // https://docs.snowflake.com/en/developer-guide/sql-api/index
        endpoint: `/api/v2/statements/${encodeURIComponent(input.statement_handle)}/cancel`,
        data: {},
        headers: {
          'Content-Type': 'application/json',
        },
        retries: 3,
      };

      const response = await platformProxy.post(config);

      const providerResponse = ProviderCancelResponseSchema.parse(response.data);

      return {
        code: providerResponse.code,
        message: providerResponse.message,
      };
    },
  });
}
