// AUTO-GENERATED from rhysbalevicius/integration-templates @ 2464f5a43eaa — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy, PlatformProxyRequest } from '../../../runtime/platform-proxy.js';

export const listBranchLogFieldValuesInputSchema = z
  .object({
    project_id: z.string().regex(new RegExp('^[a-z0-9-]{1,60}$')).describe('The Neon project ID'),
    branch_id: z.string().regex(new RegExp('^[a-z0-9-]{1,60}$')).describe('The Neon branch ID'),
    field_name: z
      .string()
      .min(1)
      .describe(
        'The log field whose distinct values should be returned. Must be one of\nthe names returned by the log fields endpoint for this branch.\n',
      ),
    since: z
      .string()
      .regex(new RegExp('^[0-9]{1,6}(ms|s|m|h|d)$'))
      .describe(
        'Length of the lookup window, ending at `end_time` or at the current\ntime when `end_time` is omitted. Mutually exclusive with\n`start_time`. Defaults to six hours.\n',
      )
      .optional(),
    start_time: z
      .string()
      .datetime({ offset: true })
      .describe('Inclusive beginning of the lookup window. Mutually exclusive with\n`since`.\n')
      .optional(),
    end_time: z
      .string()
      .datetime({ offset: true })
      .describe('Exclusive end of the lookup window. Defaults to the current time.')
      .optional(),
    source: z
      .enum(['function', 'storage', 'pg_endpoint'])
      .describe('Only consider records emitted by this Neon service.')
      .optional(),
    limit: z
      .number()
      .int()
      .min(1)
      .max(1000)
      .describe(
        "Maximum number of distinct values to return. The response sets\n`is_truncated` when this bound, or the server's own scan cap, cut the\nlist short.\n",
      )
      .optional(),
  })
  .refine(input => input.since === undefined || input.start_time === undefined, {
    message: 'Use either since or start_time, not both',
  })
  .refine(
    input =>
      input.start_time === undefined ||
      input.end_time === undefined ||
      Date.parse(input.start_time) < Date.parse(input.end_time),
    {
      message: 'start_time must precede end_time',
      path: ['end_time'],
    },
  );

const ProviderResponseSchema = z.object({ values: z.array(z.string()), is_truncated: z.boolean() }).passthrough();

export const listBranchLogFieldValuesOutputSchema = ProviderResponseSchema;

export function listBranchLogFieldValuesTool(proxy: PlatformProxy) {
  return createTool({
    id: 'neon_list_branch_log_field_values',
    description:
      'List branch log field values. Lists the distinct values observed for a low-cardinality log field in\nthe requested time range. Call the log fields endpoint first to learn\nwhich `field_name` values this branch supports; a field that branch has\nnever emitted is rejected with `unknown_field`.\n\nGive the window either as `since` or as an explicit `start_time`;\nsupplying both is rejected. If neither is given, the previous six hours\nare used. The maximum supported time range is seven days.\n\n**Note**: This endpoint is currently in Private Beta.\n',
    inputSchema: listBranchLogFieldValuesInputSchema,
    outputSchema: listBranchLogFieldValuesOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof listBranchLogFieldValuesOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const params: Record<string, string | number> = {};
      if (input['since'] !== undefined) params['since'] = input['since'];
      if (input['start_time'] !== undefined) params['start_time'] = input['start_time'];
      if (input['end_time'] !== undefined) params['end_time'] = input['end_time'];
      if (input['source'] !== undefined) params['source'] = input['source'];
      if (input['limit'] !== undefined) params['limit'] = input['limit'];
      const config: PlatformProxyRequest = {
        // https://raw.githubusercontent.com/neondatabase/neon-pkgs/af5a839e5900dc98120af6261b5b29d02c74a8e1/packages/sdk/spec/neon-openapi.json,
        endpoint: `/v2/projects/${encodeURIComponent(input['project_id'])}/branches/${encodeURIComponent(input['branch_id'])}/logs/fields/${encodeURIComponent(input['field_name'])}/values`,
        retries: 3,
        params,
      };
      const response = await platformProxy.get(config);
      const data = ProviderResponseSchema.parse(response.data);
      return data;
    },
  });
}
