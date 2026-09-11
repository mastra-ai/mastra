// AUTO-GENERATED from rhysbalevicius/integration-templates @ 9629ccfaefd5 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy, PlatformProxyRequest } from '../../../runtime/platform-proxy.js';

export const getProjectConsumptionInputSchema = z
  .object({
    cursor: z
      .string()
      .describe(
        'Cursor from the previous response (`pagination.cursor`). Pass it to fetch the next page\nof projects. Pages are ordered by project creation order (newest first).\n',
      )
      .optional(),
    limit: z
      .number()
      .int()
      .min(1)
      .max(100)
      .describe('Maximum number of projects per page. Allowed range: 1 to 100. Default: 10.\n')
      .optional(),
    project_ids: z
      .array(z.string().regex(new RegExp('^([a-z0-9-]{1,60}(,[a-z0-9-]{1,60}){0,99})?$')))
      .min(0)
      .max(100)
      .describe(
        'Optional project IDs to filter the response (up to 100). If omitted, projects in the\norganization are included across pages (use `cursor` and `limit`).\n\nPass multiple IDs as repeated query parameters or a comma-separated list:\n- `project_ids=cold-poetry-09157238&project_ids=quiet-snow-71788278`\n- `project_ids=cold-poetry-09157238,quiet-snow-71788278`\n',
      )
      .optional(),
    from: z
      .string()
      .datetime({ offset: true })
      .describe(
        'Specify the start `date-time` for the consumption period.\nThe `date-time` value is rounded according to the specified `granularity`.\nFor example, `2024-03-15T15:30:00Z` for `daily` granularity will be rounded to `2024-03-15T00:00:00Z`.\nThe specified `date-time` value must respect the specified `granularity`:\n- For `hourly`, consumption metrics are limited to the last 168 hours.\n- For `daily`, consumption metrics are limited to the last 60 days.\n- For `monthly`, consumption metrics are limited to the last year.\n\nThe earliest allowed `from` value is `March 1, 2024, at 00:00:00 UTC`.\nMetrics are returned from when the account upgraded to an eligible plan, which may be\nlater than that date.\n',
      ),
    to: z
      .string()
      .datetime({ offset: true })
      .describe(
        'Specify the end `date-time` for the consumption period.\nThe `date-time` value is rounded according to the specified `granularity`.\nFor example, `2024-03-15T15:30:00Z` for `daily` granularity will be rounded to `2024-03-15T00:00:00Z`.\nThe specified `date-time` value must respect the specified `granularity`:\n- For `hourly`, consumption metrics are limited to the last 168 hours.\n- For `daily`, consumption metrics are limited to the last 60 days.\n- For `monthly`, consumption metrics are limited to the last year.\n',
      ),
    granularity: z
      .enum(['hourly', 'daily', 'monthly'])
      .describe(
        'Specify the granularity of consumption metrics.\nHourly, daily, and monthly metrics are available for the last 168 hours, 60 days,\nand 1 year, respectively.\n',
      ),
    org_id: z
      .string()
      .regex(new RegExp('^[a-z0-9-]{1,60}$'))
      .describe('Organization ID. Metrics are returned for projects in this organization.\n'),
    metrics: z
      .array(
        z.enum([
          'compute_unit_seconds',
          'root_branch_bytes_month',
          'child_branch_bytes_month',
          'instant_restore_bytes_month',
          'public_network_transfer_bytes',
          'private_network_transfer_bytes',
          'extra_branches_month',
          'snapshot_storage_bytes_month',
        ]),
      )
      .min(1)
      .describe('Metrics to return; supply each metric as a separate array item.'),
  })
  .refine(input => Date.parse(input.from) < Date.parse(input.to), { message: 'from must precede to', path: ['to'] });

const ProviderResponseSchema = z
  .object({
    projects: z.array(
      z
        .object({
          project_id: z.string(),
          periods: z.array(
            z
              .object({
                period_id: z.string(),
                period_plan: z.string(),
                period_start: z.string(),
                period_end: z.string().optional(),
                consumption: z.array(
                  z
                    .object({
                      timeframe_start: z.string().optional(),
                      timeframe_end: z.string().optional(),
                      metrics: z
                        .array(z.object({ metric_name: z.string(), value: z.number().int() }).passthrough())
                        .optional(),
                    })
                    .passthrough(),
                ),
              })
              .passthrough(),
          ),
        })
        .passthrough(),
    ),
    pagination: z
      .object({ cursor: z.string().min(1) })
      .passthrough()
      .optional(),
  })
  .passthrough();

export const getProjectConsumptionOutputSchema = ProviderResponseSchema.extend({ next_cursor: z.string().optional() });

export function getProjectConsumptionTool(proxy: PlatformProxy) {
  return createTool({
    id: 'neon_get_project_consumption',
    description:
      'Retrieve project consumption metrics. Returns consumption metrics for up to `limit` projects per page. If `project_ids` is omitted,\nprojects in the organization are included across pages (use `cursor`). If `project_ids` is\nprovided, the response is limited to those projects (up to 100). Available for accounts on\nLaunch, Scale, Agent, Business, and Enterprise plans.\n\nHistory starts when the account upgrades to an eligible plan.\n\nThe `metrics` query parameter is required. Supported values:\n`compute_unit_seconds`, `root_branch_bytes_month`, `child_branch_bytes_month`,\n`instant_restore_bytes_month`, `public_network_transfer_bytes`, `private_network_transfer_bytes`,\n`extra_branches_month`, `snapshot_storage_bytes_month`.\n\nConsumption metrics within each project are returned in ascending time order (oldest first).\nThis request does not wake project computes.\n Returns one page; pass next_cursor as cursor to continue.',
    inputSchema: getProjectConsumptionInputSchema,
    outputSchema: getProjectConsumptionOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof getProjectConsumptionOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const params: Record<string, string | number> = {};
      if (input['cursor'] !== undefined) params['cursor'] = input['cursor'];
      if (input['limit'] !== undefined) params['limit'] = input['limit'];
      if (input['project_ids'] !== undefined) params['project_ids'] = input['project_ids'].join(',');
      if (input['from'] !== undefined) params['from'] = input['from'];
      if (input['to'] !== undefined) params['to'] = input['to'];
      if (input['granularity'] !== undefined) params['granularity'] = input['granularity'];
      if (input['org_id'] !== undefined) params['org_id'] = input['org_id'];
      if (input['metrics'] !== undefined) params['metrics'] = input['metrics'].join(',');
      const config: PlatformProxyRequest = {
        // https://raw.githubusercontent.com/neondatabase/neon-pkgs/af5a839e5900dc98120af6261b5b29d02c74a8e1/packages/sdk/spec/neon-openapi.json,
        endpoint: `/v2/consumption_history/v2/projects`,
        retries: 3,
        params,
      };
      const response = await platformProxy.get(config);
      const data = ProviderResponseSchema.parse(response.data);
      return { ...data, next_cursor: data.pagination?.cursor || undefined };
    },
  });
}
