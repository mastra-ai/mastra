// AUTO-GENERATED from NangoHQ/integration-templates @ bb789a55bfcf — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

const TextInputSchema = z.object({
  maxCharacters: z.number().int().optional().describe('Maximum characters to return for page text.'),
  includeHtmlTags: z.boolean().optional().describe('Include HTML tags in returned text.'),
});

const HighlightsInputSchema = z.object({
  query: z.string().optional().describe('Custom query guiding highlight selection.'),
});

const SummaryInputSchema = z.object({
  query: z.string().optional().describe('Custom query for LLM-generated summary.'),
});

export const searchInputSchema = z
  .object({
    query: z.string().trim().min(1).describe('The search query string.'),
    type: z
      .enum(['auto', 'lite', 'fast', 'instant', 'deep-lite', 'deep', 'deep-reasoning'])
      .optional()
      .describe(
        "Search type: 'auto' (default), 'lite' or 'instant' for the lowest latency ('lite' returns no summaries), 'fast', or 'deep-lite', 'deep', or 'deep-reasoning' for multi-step search that takes several seconds and costs more.",
      ),
    numResults: z.number().int().min(1).max(100).optional().describe('Number of results to return (default 10).'),
    category: z
      .enum(['company', 'people', 'publication', 'news', 'personal site', 'financial report'])
      .optional()
      .describe(
        'Content category filter. company and people do not accept published-date filters, and people does not accept excludeDomains.',
      ),
    includeDomains: z.array(z.string()).optional().describe('Only return results from these domains.'),
    excludeDomains: z.array(z.string()).optional().describe('Exclude results from these domains.'),
    startPublishedDate: z
      .string()
      .refine(val => !isNaN(new Date(val).getTime()), { message: 'Must be a valid ISO 8601 date string.' })
      .optional()
      .describe('ISO 8601 start published date filter.'),
    endPublishedDate: z
      .string()
      .refine(val => !isNaN(new Date(val).getTime()), { message: 'Must be a valid ISO 8601 date string.' })
      .optional()
      .describe('ISO 8601 end published date filter.'),
    text: TextInputSchema.optional().describe('Inline text extraction options (avoids separate /contents call).'),
    highlights: HighlightsInputSchema.optional().describe(
      'Inline highlight extraction options (avoids separate /contents call).',
    ),
    summary: SummaryInputSchema.optional().describe(
      'Inline summary generation options (avoids separate /contents call).',
    ),
  })
  .refine(
    input =>
      !['company', 'people'].includes(input.category ?? '') ||
      (input.startPublishedDate === undefined && input.endPublishedDate === undefined),
    { message: 'The company and people categories do not accept published-date filters.', path: ['category'] },
  )
  .refine(input => input.category !== 'people' || input.excludeDomains === undefined, {
    message: 'The people category does not accept excludeDomains.',
    path: ['excludeDomains'],
  })
  .refine(input => input.type !== 'lite' || input.summary === undefined, {
    message: 'The lite search type does not return summaries; use auto or ask for text or highlights.',
    path: ['summary'],
  });

const ProviderResultSchema = z.object({
  id: z.string().describe('Result ID (the full URL).'),
  title: z.string().nullish().describe('Title of the search result.'),
  url: z.string().nullish().describe('URL of the search result.'),
  publishedDate: z.string().nullish().describe('Estimated published date in ISO 8601 format.'),
  author: z.string().nullable().optional().describe('Author of the content, if available.'),
  score: z.number().optional().describe('Relevance score.'),
  image: z.string().nullish().describe('URL of an image associated with the result.'),
  favicon: z.string().nullish().describe('URL of the favicon for the result domain.'),
  text: z.string().optional().describe('Full page text, when requested via inline content.'),
  highlights: z
    .array(z.string())
    .optional()
    .describe('Highlights extracted from the page, when requested via inline content.'),
  summary: z.string().optional().describe('LLM-generated summary, when requested via inline content.'),
});

const CostDollarsSchema = z.object({
  total: z.number().optional().describe('Total cost in USD.'),
  search: z
    .object({
      neural: z.number().optional().describe('Cost for neural search.'),
    })
    .optional(),
});

export const searchOutputSchema = z.object({
  requestId: z.string().optional().describe('Unique identifier for the request.'),
  results: z.array(ProviderResultSchema),
  costDollars: CostDollarsSchema.optional().describe('Cost breakdown for the request.'),
});

export function searchTool(proxy: PlatformProxy) {
  return createTool({
    id: 'exa_search',
    description:
      "Search the web with Exa and return ranked results, optionally with each page's text, highlights, or summary.",
    inputSchema: searchInputSchema,
    outputSchema: searchOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof searchOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const requestBody: Record<string, unknown> = {
        query: input.query,
      };

      if (input.type !== undefined) {
        requestBody['type'] = input.type;
      }

      if (input.numResults !== undefined) {
        requestBody['numResults'] = input.numResults;
      }

      if (input.category !== undefined) {
        requestBody['category'] = input.category;
      }

      if (input.includeDomains !== undefined) {
        requestBody['includeDomains'] = input.includeDomains;
      }

      if (input.excludeDomains !== undefined) {
        requestBody['excludeDomains'] = input.excludeDomains;
      }

      if (input.startPublishedDate !== undefined) {
        requestBody['startPublishedDate'] = input.startPublishedDate;
      }

      if (input.endPublishedDate !== undefined) {
        requestBody['endPublishedDate'] = input.endPublishedDate;
      }

      const contents: Record<string, unknown> = {};
      if (input.text !== undefined) {
        contents['text'] = input.text;
      }
      if (input.highlights !== undefined) {
        contents['highlights'] = input.highlights;
      }
      if (input.summary !== undefined) {
        contents['summary'] = input.summary;
      }
      if (Object.keys(contents).length > 0) {
        requestBody['contents'] = contents;
      }

      // https://docs.exa.ai/reference/search
      const response = await platformProxy.post({
        endpoint: '/search',
        data: requestBody,
        retries: 3,
      });

      const providerResponse = z
        .object({
          requestId: z.string().optional(),
          results: z.array(z.unknown()),
          costDollars: z.unknown().optional(),
        })
        .parse(response.data);

      const results = providerResponse.results.map((result: unknown) => {
        const parsed = ProviderResultSchema.safeParse(result);
        if (!parsed.success) {
          throw new platformProxy.ActionError({
            type: 'invalid_provider_response',
            message: 'Provider returned a result that does not match the expected schema.',
            details: parsed.error.message,
          });
        }
        return parsed.data;
      });

      const costDollars =
        providerResponse.costDollars !== undefined ? CostDollarsSchema.parse(providerResponse.costDollars) : undefined;

      return {
        requestId: providerResponse.requestId,
        results,
        costDollars,
      };
    },
  });
}
