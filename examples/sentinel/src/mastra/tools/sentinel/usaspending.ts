import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { usaSpendingPost, usaSpendingGet } from './helpers';

export const sentinelFederalAwardsSearch = createTool({
  id: 'sentinel-federal-awards-search',
  description:
    'Search federal awards (grants, contracts, loans) by recipient, awarding agency, keyword, date range, or location on USAspending.gov. Returns award-level detail including amounts, recipients, and descriptions.',
  inputSchema: z.object({
    keywords: z.array(z.string()).optional().describe('Search terms, e.g. ["New York City", "housing"]'),
    award_type: z
      .enum(['contracts', 'grants', 'direct_payments', 'loans', 'other'])
      .optional()
      .describe('Filter by award type'),
    recipient_search_text: z.string().optional().describe('Recipient or vendor name'),
    awarding_agency_name: z.string().optional().describe('Federal awarding agency name'),
    date_range_start: z.string().optional().describe('Start date (YYYY-MM-DD)'),
    date_range_end: z.string().optional().describe('End date (YYYY-MM-DD)'),
    page: z.number().int().default(1).describe('Page number'),
    limit: z.number().int().min(1).max(100).default(25).describe('Results per page'),
  }),
  execute: async ({
    keywords,
    award_type,
    recipient_search_text,
    awarding_agency_name,
    date_range_start,
    date_range_end,
    page,
    limit,
  }) => {
    const awardTypeMap: Record<string, string[]> = {
      contracts: ['A', 'B', 'C', 'D'],
      grants: ['02', '03', '04', '05'],
      direct_payments: ['06', '10'],
      loans: ['07', '08'],
      other: ['09', '11'],
    };

    const filters: Record<string, unknown> = {};
    if (keywords?.length) filters.keywords = keywords;
    if (award_type) filters.award_type_codes = awardTypeMap[award_type] ?? [];
    if (recipient_search_text) filters.recipient_search_text = [recipient_search_text];
    if (awarding_agency_name) filters.agencies = [{ type: 'awarding', tier: 'toptier', name: awarding_agency_name }];
    if (date_range_start || date_range_end) {
      filters.time_period = [
        {
          start_date: date_range_start ?? '2000-01-01',
          end_date: date_range_end ?? new Date().toISOString().split('T')[0],
        },
      ];
    }

    const fields = [
      'Award ID',
      'Recipient Name',
      'Award Amount',
      'Total Outlays',
      'Description',
      'Start Date',
      'End Date',
      'Awarding Agency',
      'Awarding Sub Agency',
      'Award Type',
      'generated_internal_id',
    ];

    const data = (await usaSpendingPost('search/spending_by_award/', {
      filters,
      fields,
      page,
      limit,
      sort: 'Award Amount',
      order: 'desc',
    })) as {
      results?: Array<Record<string, unknown>>;
      page_metadata?: { total?: number; page?: number; hasNext?: boolean };
    };

    return {
      results: data.results ?? [],
      total: data.page_metadata?.total ?? 0,
      page: data.page_metadata?.page ?? page,
      has_next: data.page_metadata?.hasNext ?? false,
    };
  },
});

export const sentinelFederalSpendingByAgency = createTool({
  id: 'sentinel-federal-spending-by-agency',
  description:
    'Aggregate federal spending over time for a specific awarding or funding agency. Useful for trend analysis, year-over-year comparisons, and identifying spending anomalies at the agency level.',
  inputSchema: z.object({
    fiscal_year: z.number().describe('Fiscal year to analyze'),
    agency_name: z.string().describe('Federal agency name'),
    group_by: z
      .enum(['fiscal_year', 'quarter', 'month'])
      .default('quarter')
      .describe('Time granularity for aggregation'),
    award_type: z
      .enum(['contracts', 'grants', 'direct_payments', 'loans', 'other'])
      .optional()
      .describe('Filter by award type'),
  }),
  execute: async ({ fiscal_year, agency_name, group_by, award_type }) => {
    const awardTypeMap: Record<string, string[]> = {
      contracts: ['A', 'B', 'C', 'D'],
      grants: ['02', '03', '04', '05'],
      direct_payments: ['06', '10'],
      loans: ['07', '08'],
      other: ['09', '11'],
    };

    const filters: Record<string, unknown> = {
      agencies: [{ type: 'awarding', tier: 'toptier', name: agency_name }],
      time_period: [
        {
          start_date: `${fiscal_year - 1}-10-01`,
          end_date: `${fiscal_year}-09-30`,
        },
      ],
    };
    if (award_type) filters.award_type_codes = awardTypeMap[award_type] ?? [];

    const data = (await usaSpendingPost('search/spending_over_time/', {
      filters,
      group: group_by,
    })) as {
      results?: Array<Record<string, unknown>>;
      group?: string;
    };

    return {
      agency: agency_name,
      fiscal_year,
      group_by,
      time_series: data.results ?? [],
    };
  },
});

export const sentinelFederalAwardDetail = createTool({
  id: 'sentinel-federal-award-detail',
  description:
    'Get full detail for a single federal award by its generated unique award ID from USAspending.gov. Includes financial history, funding accounts, recipient details, and award description.',
  inputSchema: z.object({
    award_id: z.string().describe('USAspending generated unique award ID (from search results)'),
  }),
  execute: async ({ award_id }) => {
    const data = (await usaSpendingGet(`awards/${encodeURIComponent(award_id)}/`)) as Record<string, unknown>;
    return data;
  },
});

export const sentinelFederalRecipientProfile = createTool({
  id: 'sentinel-federal-recipient-profile',
  description:
    'Look up a federal award recipient profile on USAspending.gov including total awards received, award breakdown by type, and parent/child organization relationships. Use for vendor risk assessment.',
  inputSchema: z.object({
    keyword: z.string().describe('Recipient name to search'),
    limit: z.number().int().min(1).max(50).default(10).describe('Max results'),
  }),
  execute: async ({ keyword, limit }) => {
    const data = (await usaSpendingPost('recipient/duns/', {
      keyword,
      limit,
    })) as {
      results?: Array<Record<string, unknown>>;
      page_metadata?: { total?: number };
    };

    return {
      total: data.page_metadata?.total ?? 0,
      recipients: data.results ?? [],
    };
  },
});
