// AUTO-GENERATED from rhysbalevicius/integration-templates @ 4cdd3a76deb0 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy, PlatformProxyRequest } from '../../../runtime/platform-proxy.js';

export const listBranchLogFieldsInputSchema = z.object({
  project_id: z.string().regex(new RegExp('^[a-z0-9-]{1,60}$')).describe('The Neon project ID'),
  branch_id: z.string().regex(new RegExp('^[a-z0-9-]{1,60}$')).describe('The Neon branch ID'),
});

const ProviderResponseSchema = z.object({ fields: z.array(z.string()) }).passthrough();

export const listBranchLogFieldsOutputSchema = ProviderResponseSchema;

export function listBranchLogFieldsTool(proxy: PlatformProxy) {
  return createTool({
    id: 'neon_list_branch_log_fields',
    description:
      'List branch log fields. Lists the low-cardinality log fields observed on this branch whose\ndistinct values can be discovered with the log field-values endpoint.\n\nThe set is computed per branch and grows as new fields are observed, so\ntreat it as data rather than a fixed list: discover a field here, then\npass it as `field_name` to the field-values endpoint.\n\n**Note**: This endpoint is currently in Private Beta.\n',
    inputSchema: listBranchLogFieldsInputSchema,
    outputSchema: listBranchLogFieldsOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof listBranchLogFieldsOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const config: PlatformProxyRequest = {
        // https://raw.githubusercontent.com/neondatabase/neon-pkgs/af5a839e5900dc98120af6261b5b29d02c74a8e1/packages/sdk/spec/neon-openapi.json,
        endpoint: `/v2/projects/${encodeURIComponent(input['project_id'])}/branches/${encodeURIComponent(input['branch_id'])}/logs/fields`,
        retries: 3,
      };
      const response = await platformProxy.get(config);
      const data = ProviderResponseSchema.parse(response.data);
      return data;
    },
  });
}
