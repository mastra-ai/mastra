// AUTO-GENERATED from rhysbalevicius/integration-templates @ 15123cf72c67 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy, PlatformProxyRequest } from '../../../runtime/platform-proxy.js';

export const compareBranchSchemaInputSchema = z
  .object({
    project_id: z.string().regex(new RegExp('^[a-z0-9-]{1,60}$')).describe('The Neon project ID'),
    branch_id: z.string().regex(new RegExp('^[a-z0-9-]{1,60}$')).describe('The branch ID'),
    base_branch_id: z
      .string()
      .regex(new RegExp('^[a-z0-9-]{1,60}$'))
      .describe('The branch ID to compare the schema with')
      .optional(),
    db_name: z.string().describe('Name of the database for which the schema is retrieved'),
    lsn: z.string().describe('The Log Sequence Number (LSN) for which the schema is retrieved\n').optional(),
    timestamp: z
      .string()
      .datetime({ offset: true })
      .describe('The point in time for which the schema is retrieved\n')
      .optional(),
    base_lsn: z.string().describe('The Log Sequence Number (LSN) for the base branch schema\n').optional(),
    base_timestamp: z
      .string()
      .datetime({ offset: true })
      .describe('The point in time for the base branch schema\n')
      .optional(),
  })
  .refine(input => input.lsn === undefined || input.timestamp === undefined, {
    message: 'Use either lsn or timestamp, not both',
  })
  .refine(input => input.base_lsn === undefined || input.base_timestamp === undefined, {
    message: 'Use either base_lsn or base_timestamp, not both',
  });

const ProviderResponseSchema = z.object({ diff: z.string().optional() }).passthrough();

export const compareBranchSchemaOutputSchema = ProviderResponseSchema;

export function compareBranchSchemaTool(proxy: PlatformProxy) {
  return createTool({
    id: 'neon_compare_branch_schema',
    description:
      "Compare database schema. Compares the schema from the specified database with another branch's schema.",
    inputSchema: compareBranchSchemaInputSchema,
    outputSchema: compareBranchSchemaOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof compareBranchSchemaOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const params: Record<string, string | number> = {};
      if (input['base_branch_id'] !== undefined) params['base_branch_id'] = input['base_branch_id'];
      if (input['db_name'] !== undefined) params['db_name'] = input['db_name'];
      if (input['lsn'] !== undefined) params['lsn'] = input['lsn'];
      if (input['timestamp'] !== undefined) params['timestamp'] = input['timestamp'];
      if (input['base_lsn'] !== undefined) params['base_lsn'] = input['base_lsn'];
      if (input['base_timestamp'] !== undefined) params['base_timestamp'] = input['base_timestamp'];
      const config: PlatformProxyRequest = {
        // https://raw.githubusercontent.com/neondatabase/neon-pkgs/af5a839e5900dc98120af6261b5b29d02c74a8e1/packages/sdk/spec/neon-openapi.json,
        endpoint: `/v2/projects/${encodeURIComponent(input['project_id'])}/branches/${encodeURIComponent(input['branch_id'])}/compare_schema`,
        retries: 3,
        params,
      };
      const response = await platformProxy.get(config);
      const data = ProviderResponseSchema.parse(response.data);
      return data;
    },
  });
}
