// AUTO-GENERATED from NangoHQ/integration-templates @ bb789a55bfcf — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

async function getDeveloperToken(platformProxy: PlatformProxy): Promise<string | null> {
  const connection = await platformProxy.getConnection();
  const developerToken = connection.connection_config?.['developer_token'];
  return typeof developerToken === 'string' && developerToken.length > 0 ? developerToken : null;
}

const MonthlySearchVolumeSchema = z.object({
  year: z.string().optional(),
  month: z.string().optional(),
  monthlySearches: z.string().optional(),
});

const KeywordIdeaMetricsSchema = z.object({
  avgMonthlySearches: z.string().optional(),
  monthlySearchVolumes: z.array(MonthlySearchVolumeSchema).optional(),
  competition: z.string().optional(),
  competitionIndex: z.string().optional(),
  lowTopOfPageBidMicros: z.string().optional(),
  highTopOfPageBidMicros: z.string().optional(),
});

const KeywordIdeaResultSchema = z.object({
  text: z.string().optional(),
  keywordIdeaMetrics: KeywordIdeaMetricsSchema.optional(),
  closeVariants: z.array(z.string()).optional(),
});

export const generateKeywordIdeasOutputSchema = z.object({
  results: z.array(KeywordIdeaResultSchema),
  nextPageToken: z.string().optional(),
  totalSize: z.string().optional(),
});

export const generateKeywordIdeasInputSchema = z
  .object({
    customerId: z.string().describe('Google Ads customer ID. Example: "1781900691"'),
    keywords: z.array(z.string()).optional().describe('Seed keywords to generate ideas from. Example: ["plumber"]'),
    url: z.string().optional().describe('URL seed to generate ideas from. Example: "https://example.com/plumbing"'),
    site: z.string().optional().describe('Site seed to generate ideas from. Example: "example.com"'),
    language: z.string().optional().describe('Language constant resource name. Example: "languageConstants/1000"'),
    geoTargetConstants: z
      .array(z.string())
      .optional()
      .describe('Geo target constant resource names. Example: ["geoTargetConstants/2840"]'),
    keywordPlanNetwork: z.string().optional().describe('Keyword plan network. Example: "GOOGLE_SEARCH"'),
    loginCustomerId: z
      .string()
      .optional()
      .describe('Login customer ID when accessing via a manager account. Example: "3608201627"'),
    includeAdultKeywords: z.boolean().optional().describe('Whether to include adult keywords in the response.'),
    pageToken: z.string().optional().describe('Pagination token for the next page of results.'),
    pageSize: z.number().optional().describe('Number of results to retrieve in a single page.'),
  })
  .refine(
    data => {
      return Boolean(data.keywords && data.keywords.length > 0) || Boolean(data.url) || Boolean(data.site);
    },
    {
      message: 'At least one of keywords, url, or site must be provided.',
    },
  );

export function generateKeywordIdeasTool(proxy: PlatformProxy) {
  return createTool({
    id: 'google_ads_generate_keyword_ideas',
    description: 'Generate keyword ideas and search volume/competition metrics from a seed keyword list or URL.',
    inputSchema: generateKeywordIdeasInputSchema,
    outputSchema: generateKeywordIdeasOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof generateKeywordIdeasOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const developerToken = await getDeveloperToken(platformProxy);
      if (!developerToken) {
        throw new platformProxy.ActionError({
          type: 'missing_config',
          message: 'developer_token is required in connection config',
        });
      }

      const seed: Record<string, unknown> = {};

      if (input.keywords && input.keywords.length > 0 && input.url) {
        seed['keywordAndUrlSeed'] = {
          keywords: input.keywords,
          url: input.url,
        };
      } else if (input.keywords && input.keywords.length > 0) {
        seed['keywordSeed'] = {
          keywords: input.keywords,
        };
      } else if (input.url) {
        seed['urlSeed'] = {
          url: input.url,
        };
      } else if (input.site) {
        seed['siteSeed'] = {
          site: input.site,
        };
      }

      const body: Record<string, unknown> = {
        ...seed,
        ...(input.language !== undefined && { language: input.language }),
        ...(input.geoTargetConstants !== undefined && { geoTargetConstants: input.geoTargetConstants }),
        ...(input.keywordPlanNetwork !== undefined && { keywordPlanNetwork: input.keywordPlanNetwork }),
        ...(input.includeAdultKeywords !== undefined && { includeAdultKeywords: input.includeAdultKeywords }),
        ...(input.pageToken !== undefined && { pageToken: input.pageToken }),
        ...(input.pageSize !== undefined && { pageSize: input.pageSize }),
      };

      const headers: Record<string, string> = {
        'developer-token': developerToken,
      };

      if (input.loginCustomerId) {
        headers['login-customer-id'] = input.loginCustomerId;
      }

      const response = await platformProxy.post({
        // https://developers.google.com/google-ads/api/reference/rpc/v25/KeywordPlanIdeaService/GenerateKeywordIdeas
        endpoint: `v25/customers/${encodeURIComponent(input.customerId)}:generateKeywordIdeas`,
        data: body,
        headers,
        retries: 3,
      });

      const ProviderResponseSchema = z.object({
        results: z.array(
          z.object({
            text: z.string().optional(),
            keywordIdeaMetrics: z
              .object({
                avgMonthlySearches: z.string().optional(),
                monthlySearchVolumes: z
                  .array(
                    z.object({
                      year: z.string().optional(),
                      month: z.string().optional(),
                      monthlySearches: z.string().optional(),
                    }),
                  )
                  .optional(),
                competition: z.string().optional(),
                competitionIndex: z.string().optional(),
                lowTopOfPageBidMicros: z.string().optional(),
                highTopOfPageBidMicros: z.string().optional(),
              })
              .optional(),
            closeVariants: z.array(z.string()).optional(),
          }),
        ),
        nextPageToken: z.string().optional(),
        totalSize: z.string().optional(),
      });

      const parsed = ProviderResponseSchema.parse(response.data);

      return {
        results: parsed.results.map(result => ({
          text: result.text,
          keywordIdeaMetrics: result.keywordIdeaMetrics,
          closeVariants: result.closeVariants,
        })),
        nextPageToken: parsed.nextPageToken,
        totalSize: parsed.totalSize,
      };
    },
  });
}
