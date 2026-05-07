import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { MrScraperClientOptions } from './config.js';
import { resolveAppToken } from './config.js';
import { RESULTS } from './constants.js';
import { mrScraperGet } from './http.js';
import { mrScraperApiResultSchema } from './schemas.js';

const sortFieldSchema = z.enum([
  'createdAt',
  'updatedAt',
  'id',
  'type',
  'url',
  'status',
  'error',
  'tokenUsage',
  'runtime',
]);

const listResultsInput = z.object({
  sortField: sortFieldSchema.optional().default('updatedAt'),
  sortOrder: z.enum(['ASC', 'DESC']).optional().default('DESC'),
  pageSize: z.number().int().min(1).max(500).optional().default(10),
  page: z.number().int().min(1).optional().default(1),
  search: z.string().optional().describe('Optional free-text filter'),
  dateRangeColumn: z.string().optional().describe('Column for date range filter (use with startAt/endAt)'),
  startAt: z.string().optional(),
  endAt: z.string().optional(),
});

export function createMrscraperGetAllResultsTool(config?: MrScraperClientOptions) {
  return createTool({
    id: 'mrscraper-get-all-results',
    description:
      'List MrScraper scraping results with sorting, pagination, optional search, and optional date range filters.',
    inputSchema: listResultsInput,
    outputSchema: mrScraperApiResultSchema,
    execute: async input => {
      const token = resolveAppToken(config);
      const params = new URLSearchParams();
      params.set('sortField', input.sortField ?? 'updatedAt');
      params.set('sortOrder', input.sortOrder ?? 'DESC');
      params.set('pageSize', String(input.pageSize ?? 10));
      params.set('page', String(input.page ?? 1));
      if (input.search) params.set('search', input.search);
      if (input.dateRangeColumn) params.set('dateRangeColumn', input.dateRangeColumn);
      if (input.startAt) params.set('startAt', input.startAt);
      if (input.endAt) params.set('endAt', input.endAt);

      const url = `${RESULTS}?${params.toString()}`;
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        accept: 'application/json',
        'x-api-token': token,
      };
      return mrScraperGet(url, { headers });
    },
  });
}

const byIdInput = z.object({
  resultId: z.string().min(1).describe('Result id from list or scraper run responses'),
});

export function createMrscraperGetResultByIdTool(config?: MrScraperClientOptions) {
  return createTool({
    id: 'mrscraper-get-result-by-id',
    description: 'Fetch a single MrScraper result record by id (full extracted payload and metadata).',
    inputSchema: byIdInput,
    outputSchema: mrScraperApiResultSchema,
    execute: async input => {
      const token = resolveAppToken(config);
      const url = `${RESULTS}/${encodeURIComponent(input.resultId)}`;
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        accept: 'application/json',
        'x-api-token': token,
      };
      return mrScraperGet(url, { headers });
    },
  });
}
