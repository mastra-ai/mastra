import { createTool } from '@mastra/core/tools';
import type Parallel from 'parallel-web';
import { z } from 'zod';

import { createLazyParallelClient } from './client.js';
import type { ParallelClientOptions } from './client.js';
import { fetchPolicySchema, usageItemSchema, warningSchema } from './schemas.js';
import type { FetchPolicyInput } from './schemas.js';

const inputSchema = z.object({
  urls: z.array(z.string().url()).min(1).max(20).describe('URLs to extract content from (1-20).'),
  objective: z
    .string()
    .optional()
    .describe('A natural-language description of the information to focus on while extracting.'),
  searchQueries: z
    .array(z.string().min(1))
    .min(1)
    .optional()
    .describe('Optional keyword queries used with the objective to focus excerpts.'),
  excerptMaxCharsPerResult: z
    .number()
    .int()
    .positive()
    .optional()
    .describe('Maximum excerpt characters to return for each URL.'),
  clientModel: z
    .string()
    .optional()
    .describe('Model that will consume the results, used by Parallel to tailor response defaults.'),
  fullContent: z
    .union([z.boolean(), z.number().int().positive()])
    .optional()
    .describe('Return full page content. Pass a character limit instead of true to cap content per URL.'),
  maxCharsTotal: z
    .number()
    .int()
    .positive()
    .optional()
    .describe('Maximum total characters across all extracted results.'),
  fetchPolicy: fetchPolicySchema.optional().describe('Live-fetch and cached-content policy for extracted URLs.'),
  sessionId: z.string().optional().describe('Session identifier shared across related Search and Extract calls.'),
});

const outputSchema = z.object({
  extractId: z.string(),
  sessionId: z.string(),
  results: z.array(
    z.object({
      url: z.string(),
      title: z.string().optional(),
      publishDate: z.string().optional(),
      excerpts: z.array(z.string()),
      fullContent: z.string().optional(),
    }),
  ),
  errors: z.array(
    z.object({
      url: z.string(),
      errorType: z.string(),
      httpStatusCode: z.number().optional(),
      content: z.string().optional(),
    }),
  ),
  usage: z.array(usageItemSchema).optional(),
  warnings: z.array(warningSchema).optional(),
});

type ExtractInput = z.infer<typeof inputSchema>;

function toFetchPolicy(input: FetchPolicyInput): Parallel.FetchPolicy {
  return {
    max_age_seconds: input.maxAgeSeconds,
    timeout_seconds: input.timeoutSeconds,
    disable_cache_fallback: input.disableCacheFallback,
  };
}

function toExtractParams(input: ExtractInput): Parallel.ExtractParams {
  const params: Parallel.ExtractParams = {
    urls: input.urls,
  };

  if (input.objective !== undefined) params.objective = input.objective;
  if (input.searchQueries !== undefined) params.search_queries = input.searchQueries;
  if (input.clientModel !== undefined) params.client_model = input.clientModel;
  if (input.maxCharsTotal !== undefined) params.max_chars_total = input.maxCharsTotal;
  if (input.sessionId !== undefined) params.session_id = input.sessionId;

  if (
    input.excerptMaxCharsPerResult !== undefined ||
    input.fullContent !== undefined ||
    input.fetchPolicy !== undefined
  ) {
    params.advanced_settings = {
      excerpt_settings:
        input.excerptMaxCharsPerResult === undefined
          ? undefined
          : { max_chars_per_result: input.excerptMaxCharsPerResult },
      full_content:
        typeof input.fullContent === 'number' ? { max_chars_per_result: input.fullContent } : input.fullContent,
      fetch_policy: input.fetchPolicy === undefined ? undefined : toFetchPolicy(input.fetchPolicy),
    };
  }

  return params;
}

export function createParallelExtractTool(config?: ParallelClientOptions) {
  const getClient = createLazyParallelClient(config);

  return createTool({
    id: 'parallel-extract',
    description:
      'Extract relevant excerpts or full page content from URLs with Parallel. Returns successful results and per-URL errors.',
    inputSchema,
    outputSchema,
    execute: async input => {
      const response = await getClient().extract(toExtractParams(input));

      return {
        extractId: response.extract_id,
        sessionId: response.session_id,
        results: response.results.map(result => ({
          url: result.url,
          title: result.title ?? undefined,
          publishDate: result.publish_date ?? undefined,
          excerpts: result.excerpts,
          fullContent: result.full_content ?? undefined,
        })),
        errors: response.errors.map(error => ({
          url: error.url,
          errorType: error.error_type,
          httpStatusCode: error.http_status_code ?? undefined,
          content: error.content ?? undefined,
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
