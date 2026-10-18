// AUTO-GENERATED from NangoHQ/integration-templates @ c3091db1e8a6 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy, PlatformProxyRequest } from '../../../runtime/platform-proxy.js';

export const runQueryInputSchema = z.object({
  project_id: z.number().describe('PostHog project ID. Example: 309484'),
  query: z
    .string()
    .describe(
      'HogQL query to execute. Example: "select event, count() from events where timestamp > now() - interval 7 day group by event order by count() desc limit 10"',
    ),
  name: z.string().optional().describe('Optional client-provided name for the query, used for tracking.'),
});

export const runQueryOutputSchema = z.object({
  results: z.array(z.array(z.unknown())).describe('Result rows. Each row is an array of column values.'),
  columns: z.array(z.string()).nullish().describe('Column names for the result rows.'),
  types: z.array(z.string()).nullish().describe('Column types for the result rows.'),
  hogql: z.string().nullish().describe('The HogQL that was executed after normalization.'),
  clickhouse: z.string().nullish().describe('The ClickHouse SQL the query was compiled to.'),
  hasMore: z.boolean().nullish().describe('Whether more rows are available beyond the returned set.'),
  limit: z.number().nullish().describe('Row limit applied to the query.'),
  offset: z.number().nullish().describe('Row offset applied to the query.'),
  error: z.string().nullish().describe('Error message when the query failed.'),
});

const ProviderResponseSchema = z
  .object({
    results: z.array(z.array(z.unknown())),
    columns: z.array(z.string()).nullish(),
    types: z.array(z.string()).nullish(),
    hogql: z.string().nullish(),
    clickhouse: z.string().nullish(),
    hasMore: z.boolean().nullish(),
    limit: z.number().nullish(),
    offset: z.number().nullish(),
    error: z.string().nullish(),
  })
  .passthrough();

export function runQueryTool(proxy: PlatformProxy) {
  return createTool({
    id: 'posthog_run_query',
    description: 'Execute a HogQL (SQL) query against PostHog and return the result rows.',
    inputSchema: runQueryInputSchema,
    outputSchema: runQueryOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof runQueryOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const parsedInput = await platformProxy.zodValidateInput({ zodSchema: runQueryInputSchema, input });

      const config: PlatformProxyRequest = {
        // https://posthog.com/docs/api/query
        endpoint: `/api/projects/${encodeURIComponent(parsedInput.data.project_id)}/query/`,
        data: {
          query: {
            kind: 'HogQLQuery',
            query: parsedInput.data.query,
          },
          ...(parsedInput.data.name !== undefined && { client_query_id: parsedInput.data.name }),
        },
        retries: 3,
      };

      const response = await platformProxy.post(config);

      if (!response.data) {
        throw new platformProxy.ActionError({
          type: 'query_failed',
          message: 'Query returned no data',
          project_id: parsedInput.data.project_id,
        });
      }

      const providerResponse = ProviderResponseSchema.parse(response.data);

      return {
        results: providerResponse.results,
        columns: providerResponse.columns,
        types: providerResponse.types,
        hogql: providerResponse.hogql,
        clickhouse: providerResponse.clickhouse,
        hasMore: providerResponse.hasMore,
        limit: providerResponse.limit,
        offset: providerResponse.offset,
        error: providerResponse.error,
      };
    },
  });
}
