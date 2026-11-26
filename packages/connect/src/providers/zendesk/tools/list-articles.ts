// AUTO-GENERATED from NangoHQ/integration-templates @ bb789a55bfcf — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const listArticlesInputSchema = z.object({
  cursor: z.string().optional().describe('Pagination cursor from the previous response. Omit for the first page.'),
  locale: z.string().optional().describe('Locale to filter articles by. Example: "en-us". Omit to list all locales.'),
  sort_by: z
    .enum(['position', 'title', 'created_at', 'updated_at', 'edited_at'])
    .optional()
    .describe('Sort field. Default is position.'),
  sort_order: z.enum(['asc', 'desc']).optional().describe('Sort order. Default is asc.'),
  label_names: z.string().optional().describe('Comma-separated list of label names to filter by. Up to 10 labels.'),
  section_id: z.string().optional().describe('Filter articles by section ID.'),
  category_id: z.string().optional().describe('Filter articles by category ID.'),
});

const ArticleSchema = z.object({
  id: z.number(),
  author_id: z.number().optional(),
  body: z.string().optional(),
  comments_disabled: z.boolean().optional(),
  content_tag_ids: z.array(z.string()).optional(),
  created_at: z.string().optional(),
  draft: z.boolean().optional(),
  edited_at: z.string().optional(),
  html_url: z.string().optional(),
  label_names: z.array(z.string()).optional(),
  locale: z.string(),
  outdated: z.boolean().optional(),
  outdated_locales: z.array(z.string()).optional(),
  permission_group_id: z.number().optional(),
  position: z.number().optional(),
  promoted: z.boolean().optional(),
  section_id: z.number().optional(),
  source_locale: z.string().optional(),
  title: z.string(),
  updated_at: z.string().optional(),
  url: z.string().optional(),
  user_segment_id: z.number().nullable().optional(),
  user_segment_ids: z.array(z.number()).optional(),
  vote_count: z.number().optional(),
  vote_sum: z.number().optional(),
});

export const listArticlesOutputSchema = z.object({
  articles: z.array(ArticleSchema),
  next_cursor: z.string().optional(),
});

export function listArticlesTool(proxy: PlatformProxy) {
  return createTool({
    id: 'zendesk_list_articles',
    description: 'List Zendesk Help Center articles with pagination',
    inputSchema: listArticlesInputSchema,
    outputSchema: listArticlesOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof listArticlesOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const params: Record<string, string> = {};

      if (input.sort_by !== undefined) {
        params['sort_by'] = input.sort_by;
      }
      if (input.sort_order !== undefined) {
        params['sort_order'] = input.sort_order;
      }
      if (input.label_names !== undefined) {
        params['label_names'] = input.label_names;
      }
      if (input.cursor !== undefined) {
        params['page'] = input.cursor;
      }

      let endpoint: string;
      if (input.section_id !== undefined) {
        endpoint = `/api/v2/help_center/${input.locale !== undefined ? `${encodeURIComponent(input.locale)}/` : ''}sections/${encodeURIComponent(input.section_id)}/articles`;
      } else if (input.category_id !== undefined) {
        endpoint = `/api/v2/help_center/${input.locale !== undefined ? `${encodeURIComponent(input.locale)}/` : ''}categories/${encodeURIComponent(input.category_id)}/articles`;
      } else if (input.locale !== undefined) {
        endpoint = `/api/v2/help_center/${encodeURIComponent(input.locale)}/articles`;
      } else {
        endpoint = '/api/v2/help_center/articles';
      }

      // https://developer.zendesk.com/api-reference/help_center/help-center-api/articles/#list-articles
      const response = await platformProxy.get({
        endpoint: endpoint,
        params: params,
        retries: 3,
      });

      const ResponseSchema = z.object({
        articles: z.array(z.unknown()),
        next_page: z.string().nullable().optional(),
      });

      const parsedResponse = ResponseSchema.safeParse(response.data);
      if (!parsedResponse.success) {
        throw new platformProxy.ActionError({
          type: 'invalid_response',
          message: 'Invalid response from Zendesk API',
          details: parsedResponse.error.message,
        });
      }

      const data = parsedResponse.data;

      const articles = data.articles.map((article: unknown) => {
        const parsed = ArticleSchema.safeParse(article);
        if (!parsed.success) {
          throw new platformProxy.ActionError({
            type: 'invalid_article',
            message: 'Failed to parse article from response',
            details: parsed.error.message,
          });
        }
        return parsed.data;
      });

      let next_cursor: string | undefined;
      if (data.next_page && typeof data.next_page === 'string') {
        const url = new URL(data.next_page);
        const pageParam = url.searchParams.get('page');
        if (pageParam) {
          next_cursor = pageParam;
        }
      }

      return {
        articles: articles,
        ...(next_cursor !== undefined && { next_cursor: next_cursor }),
      };
    },
  });
}
