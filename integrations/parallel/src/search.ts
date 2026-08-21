import { createTool } from '@mastra/core/tools';
import type Parallel from 'parallel-web';
import { z } from 'zod';

import { createLazyParallelClient } from './client.js';
import type { ParallelClientOptions } from './client.js';
import { fetchPolicySchema, searchResultSchema, usageItemSchema, warningSchema } from './schemas.js';
import type { FetchPolicyInput } from './schemas.js';

const inputSchema = z
  .object({
    searchQueries: z
      .array(z.string().min(1))
      .min(1)
      .describe('Concise keyword search queries, ideally 3-6 words each. Provide 2-3 queries for best results.'),
    objective: z
      .string()
      .optional()
      .describe('A self-contained natural-language description of the goal driving the search.'),
    mode: z
      .enum(['turbo', 'fast', 'basic', 'advanced'])
      .optional()
      .describe('Search mode. Defaults to advanced when omitted.'),
    clientModel: z
      .string()
      .optional()
      .describe('Model that will consume the results, used by Parallel to tailor response defaults.'),
    maxResults: z.number().int().positive().optional().describe('Maximum number of results to return.'),
    excerptMaxCharsPerResult: z
      .number()
      .int()
      .positive()
      .optional()
      .describe('Maximum excerpt characters to return for each result.'),
    maxCharsTotal: z
      .number()
      .int()
      .positive()
      .optional()
      .describe('Maximum total excerpt characters across all results.'),
    location: z.string().length(2).optional().describe('ISO 3166-1 alpha-2 country code for geo-targeted results.'),
    includeDomains: z.array(z.string()).max(200).optional().describe('Only return results from these domains.'),
    excludeDomains: z.array(z.string()).max(200).optional().describe('Exclude results from these domains.'),
    afterDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .optional()
      .describe('Only return content published on or after this YYYY-MM-DD date.'),
    fetchPolicy: fetchPolicySchema.optional().describe('Live-fetch and cached-content policy for search results.'),
    sessionId: z.string().optional().describe('Session identifier shared across related Search and Extract calls.'),
  })
  .refine(input => (input.includeDomains?.length ?? 0) + (input.excludeDomains?.length ?? 0) <= 200, {
    message: 'includeDomains and excludeDomains can contain at most 200 domains combined.',
    path: ['includeDomains'],
  });

const outputSchema = z.object({
  searchId: z.string(),
  sessionId: z.string(),
  results: z.array(searchResultSchema),
  usage: z.array(usageItemSchema).optional(),
  warnings: z.array(warningSchema).optional(),
});

type SearchInput = z.infer<typeof inputSchema>;

function toFetchPolicy(input: FetchPolicyInput): Parallel.FetchPolicy {
  return {
    max_age_seconds: input.maxAgeSeconds,
    timeout_seconds: input.timeoutSeconds,
    disable_cache_fallback: input.disableCacheFallback,
  };
}

function toSearchParams(input: SearchInput): Parallel.SearchParams {
  const params: Parallel.SearchParams = {
    search_queries: input.searchQueries,
  };

  if (input.objective !== undefined) params.objective = input.objective;
  if (input.mode !== undefined) params.mode = input.mode;
  if (input.clientModel !== undefined) params.client_model = input.clientModel;
  if (input.maxCharsTotal !== undefined) params.max_chars_total = input.maxCharsTotal;
  if (input.sessionId !== undefined) params.session_id = input.sessionId;

  const sourcePolicy =
    input.includeDomains !== undefined || input.excludeDomains !== undefined || input.afterDate !== undefined
      ? {
          include_domains: input.includeDomains,
          exclude_domains: input.excludeDomains,
          after_date: input.afterDate,
        }
      : undefined;

  if (
    input.maxResults !== undefined ||
    input.excerptMaxCharsPerResult !== undefined ||
    input.location !== undefined ||
    sourcePolicy !== undefined ||
    input.fetchPolicy !== undefined
  ) {
    params.advanced_settings = {
      max_results: input.maxResults,
      excerpt_settings:
        input.excerptMaxCharsPerResult === undefined
          ? undefined
          : { max_chars_per_result: input.excerptMaxCharsPerResult },
      location: input.location,
      source_policy: sourcePolicy,
      fetch_policy: input.fetchPolicy === undefined ? undefined : toFetchPolicy(input.fetchPolicy),
    };
  }

  return params;
}

export function createParallelSearchTool(config?: ParallelClientOptions) {
  const getClient = createLazyParallelClient(config);

  return createTool({
    id: 'parallel-search',
    description:
      'Search the web with Parallel. Returns ranked URLs and token-efficient excerpts focused on the search objective.',
    inputSchema,
    outputSchema,
    execute: async input => {
      const response = await getClient().search(toSearchParams(input));

      return {
        searchId: response.search_id,
        sessionId: response.session_id,
        results: response.results.map(result => ({
          url: result.url,
          title: result.title ?? undefined,
          publishDate: result.publish_date ?? undefined,
          excerpts: result.excerpts,
        })),
        usage: response.usage ?? undefined,
        warnings: response.warnings?.map(warning => ({
          type: warning.type,
          message: warning.message,
          detail: warning.detail ?? undefined,
        })),
      };
    },
  });
}
