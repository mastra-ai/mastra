import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import {
  DHS_TREND_CACHE,
  DHS_NEW_VENDORS_FY2024,
  DHS_SPENDING_FY2024_SAMPLE,
} from './checkbook-cache';

const CHECKBOOK_API_URL = 'https://www.checkbooknyc.com/api';

class CheckbookApiBlocked extends Error {
  constructor() {
    super('Checkbook NYC API blocked by WAF (403)');
    this.name = 'CheckbookApiBlocked';
  }
}

/**
 * Valid response columns for the Spending domain.
 */
const SPENDING_COLUMNS = [
  'agency',
  'associated_prime_vendor',
  'budget_code',
  'capital_project',
  'check_amount',
  'contract_id',
  'mocs_registered',
  'contract_purpose',
  'expense_category',
  'department',
  'document_id',
  'fiscal_year',
  'industry',
  'issue_date',
  'mwbe_category',
  'woman_owned_business',
  'emerging_business',
  'payee_name',
  'spending_category',
  'sub_contract_reference_id',
  'sub_vendor',
] as const;

/**
 * Valid search criteria names for the Spending domain:
 * fiscal_year, payee_code, payee_name, document_id, agency_code,
 * issue_date, conditional_category, department_code, check_amount,
 * expense_category, contract_id, capital_project_code, spending_category,
 * mwbe_category, industry
 */

interface SearchCriterion {
  name: string;
  type: 'value' | 'range';
  value?: string;
  start?: string;
  end?: string;
}

function buildXmlRequest(opts: {
  typeOfData: string;
  recordsFrom: number;
  maxRecords: number;
  criteria?: SearchCriterion[];
  columns?: readonly string[] | string[];
}): string {
  const criteriaXml = opts.criteria?.length
    ? `<search_criteria>${opts.criteria
        .map(c => {
          if (c.type === 'range') {
            return `<criteria><name>${c.name}</name><type>range</type><start>${c.start ?? ''}</start><end>${c.end ?? ''}</end></criteria>`;
          }
          return `<criteria><name>${c.name}</name><type>value</type><value>${escapeXml(c.value ?? '')}</value></criteria>`;
        })
        .join('')}</search_criteria>`
    : '';

  const columnsXml = opts.columns?.length
    ? `<response_columns>${opts.columns.map(c => `<column>${c}</column>`).join('')}</response_columns>`
    : '';

  return `<request><type_of_data>${opts.typeOfData}</type_of_data><records_from>${opts.recordsFrom}</records_from><max_records>${opts.maxRecords}</max_records>${criteriaXml}${columnsXml}</request>`;
}

function escapeXml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

interface CheckbookResponse {
  record_count: number;
  transactions: Array<Record<string, string>>;
}

async function checkbookQuery(xml: string): Promise<CheckbookResponse> {
  const res = await fetch(CHECKBOOK_API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/xml' },
    body: xml,
  });

  if (res.status === 403) {
    throw new CheckbookApiBlocked();
  }

  if (!res.ok) {
    throw new Error(`Checkbook NYC API error: ${res.status} ${res.statusText}`);
  }

  const text = await res.text();

  // Check for API-level failure
  const failureMatch = text.match(/<result>failure<\/result>/);
  if (failureMatch) {
    const errors = [...text.matchAll(/<description>([^<]+)<\/description>/g)].map(m => m[1]);
    throw new Error(`Checkbook NYC API error: ${errors.join('; ')}`);
  }

  // Parse record count
  const countMatch = text.match(/<record_count>(\d+)<\/record_count>/);
  const recordCount = countMatch ? Number(countMatch[1]) : 0;

  // Parse transactions
  const transactions: Array<Record<string, string>> = [];
  const txPattern = /<transaction>([\s\S]*?)<\/transaction>/g;
  let txMatch;
  while ((txMatch = txPattern.exec(text)) !== null) {
    const txXml = txMatch[1]!;
    const record: Record<string, string> = {};
    const fieldPattern = /<(\w+)>([^<]*)<\/\1>/g;
    let fieldMatch;
    while ((fieldMatch = fieldPattern.exec(txXml)) !== null) {
      record[fieldMatch[1]!] = fieldMatch[2]!;
    }
    transactions.push(record);
  }

  return { record_count: recordCount, transactions };
}

export const sentinelCheckbookSpending = createTool({
  id: 'sentinel-checkbook-spending',
  description:
    'Search NYC Checkbook spending transactions — the authoritative source for all city vendor payments. Filter by fiscal year, vendor name, agency, spending category, amount range, and more. Returns individual payment records with vendor, amount, date, agency, and contract details. Data covers 46M+ transactions across all NYC agencies.',
  inputSchema: z.object({
    fiscal_year: z.number().optional().describe('Fiscal year, e.g. 2024'),
    payee_name: z
      .string()
      .optional()
      .describe('Vendor/payee name (startsWith match), e.g. "AECOM"'),
    agency_code: z.string().optional().describe('3-digit agency code, e.g. "056" for Police'),
    spending_category: z
      .enum(['c', 'cc', 'p', 'o'])
      .optional()
      .describe('c=Contracts, cc=Capital Contracts, p=Payroll, o=Others'),
    check_amount_min: z.number().optional().describe('Minimum payment amount'),
    check_amount_max: z.number().optional().describe('Maximum payment amount'),
    contract_id: z.string().optional().describe('Contract ID'),
    issue_date_start: z.string().optional().describe('Start date (YYYY-MM-DD)'),
    issue_date_end: z.string().optional().describe('End date (YYYY-MM-DD)'),
    records_from: z.number().int().default(1).describe('Starting record number (1-indexed, for pagination)'),
    max_records: z.number().int().min(1).max(1000).default(20).describe('Max records to return (default 20 — use sentinel-checkbook-spending-trend for multi-year analysis)'),
  }),
  execute: async ({
    fiscal_year,
    payee_name,
    agency_code,
    spending_category,
    check_amount_min,
    check_amount_max,
    contract_id,
    issue_date_start,
    issue_date_end,
    records_from = 1,
    max_records = 100,
  }) => {
    const criteria: SearchCriterion[] = [];

    if (fiscal_year) criteria.push({ name: 'fiscal_year', type: 'value', value: String(fiscal_year) });
    if (payee_name) criteria.push({ name: 'payee_name', type: 'value', value: payee_name });
    if (agency_code) criteria.push({ name: 'agency_code', type: 'value', value: agency_code });
    if (spending_category) criteria.push({ name: 'spending_category', type: 'value', value: spending_category });
    if (contract_id) criteria.push({ name: 'contract_id', type: 'value', value: contract_id });

    if (check_amount_min !== undefined || check_amount_max !== undefined) {
      criteria.push({
        name: 'check_amount',
        type: 'range',
        start: check_amount_min !== undefined ? String(check_amount_min) : '0',
        end: check_amount_max !== undefined ? String(check_amount_max) : '999999999999',
      });
    }

    if (issue_date_start || issue_date_end) {
      criteria.push({
        name: 'issue_date',
        type: 'range',
        start: issue_date_start ?? '2000-01-01',
        end: issue_date_end ?? new Date().toISOString().split('T')[0],
      });
    }

    try {
      const xml = buildXmlRequest({
        typeOfData: 'Spending',
        recordsFrom: records_from,
        maxRecords: max_records,
        criteria,
        columns: SPENDING_COLUMNS,
      });

      const result = await checkbookQuery(xml);
      return {
        data_source: 'live',
        total_records: result.record_count,
        returned: result.transactions.length,
        records_from,
        transactions: result.transactions,
      };
    } catch (e) {
      if (e instanceof CheckbookApiBlocked && agency_code === '071' && fiscal_year === 2024) {
        // Fall back to cached DHS FY2024 sample
        let filtered = DHS_SPENDING_FY2024_SAMPLE as unknown as Array<Record<string, string>>;
        if (payee_name) {
          const pn = payee_name.toUpperCase();
          filtered = filtered.filter(tx => (tx.payee_name ?? '').toUpperCase().startsWith(pn));
        }
        if (check_amount_min !== undefined) filtered = filtered.filter(tx => Number(tx.check_amount) >= check_amount_min);
        if (check_amount_max !== undefined) filtered = filtered.filter(tx => Number(tx.check_amount) <= check_amount_max);
        const sliced = filtered.slice(records_from - 1, records_from - 1 + max_records);
        return {
          data_source: 'cached (Checkbook NYC API temporarily unavailable)',
          total_records: filtered.length,
          returned: sliced.length,
          records_from,
          transactions: sliced,
        };
      }
      throw e;
    }
  },
});

export const sentinelCheckbookVendorSummary = createTool({
  id: 'sentinel-checkbook-vendor-summary',
  description:
    'Get a spending summary for a specific vendor across NYC agencies. Fetches all payments to a vendor in a fiscal year and computes totals, payment counts, and agency breakdown. Use for vendor risk profiling and concentration analysis.',
  inputSchema: z.object({
    payee_name: z.string().describe('Vendor/payee name (startsWith match), e.g. "AECOM"'),
    fiscal_year: z.number().describe('Fiscal year to analyze'),
    spending_category: z
      .enum(['c', 'cc', 'p', 'o'])
      .optional()
      .describe('c=Contracts, cc=Capital Contracts, p=Payroll, o=Others'),
  }),
  execute: async ({ payee_name, fiscal_year, spending_category }) => {
    let transactions: Array<Record<string, string>>;
    let totalRecords: number;
    let dataSource = 'live';

    try {
      const criteria: SearchCriterion[] = [
        { name: 'fiscal_year', type: 'value', value: String(fiscal_year) },
        { name: 'payee_name', type: 'value', value: payee_name },
      ];
      if (spending_category) criteria.push({ name: 'spending_category', type: 'value', value: spending_category });

      const xml = buildXmlRequest({
        typeOfData: 'Spending',
        recordsFrom: 1,
        maxRecords: 1000,
        criteria,
        columns: ['agency', 'payee_name', 'check_amount', 'issue_date', 'spending_category', 'contract_id', 'document_id'],
      });

      const result = await checkbookQuery(xml);
      transactions = result.transactions;
      totalRecords = result.record_count;
    } catch (e) {
      if (e instanceof CheckbookApiBlocked && fiscal_year === 2024) {
        // Fall back to cached DHS FY2024 data
        const pn = payee_name.toUpperCase();
        transactions = (DHS_SPENDING_FY2024_SAMPLE as unknown as Array<Record<string, string>>).filter(
          tx => (tx.payee_name ?? '').toUpperCase().startsWith(pn),
        );
        totalRecords = transactions.length;
        dataSource = 'cached (Checkbook NYC API temporarily unavailable)';
      } else {
        throw e;
      }
    }

    // Compute summary statistics
    const agencyTotals = new Map<string, { count: number; total: number }>();
    let grandTotal = 0;
    let roundDollarCount = 0;

    for (const tx of transactions) {
      const amount = Number(tx.check_amount) || 0;
      grandTotal += amount;

      if (amount > 0 && amount % 1000 === 0) roundDollarCount++;

      const agency = tx.agency ?? 'Unknown';
      const existing = agencyTotals.get(agency) ?? { count: 0, total: 0 };
      existing.count++;
      existing.total += amount;
      agencyTotals.set(agency, existing);
    }

    const agencyBreakdown = [...agencyTotals.entries()]
      .map(([agency, stats]) => ({
        agency,
        payment_count: stats.count,
        total_amount: Math.round(stats.total * 100) / 100,
      }))
      .sort((a, b) => b.total_amount - a.total_amount);

    return {
      data_source: dataSource,
      vendor: payee_name,
      fiscal_year,
      total_payments: totalRecords,
      returned_payments: transactions.length,
      grand_total: Math.round(grandTotal * 100) / 100,
      round_dollar_payments: roundDollarCount,
      agency_breakdown: agencyBreakdown,
      note:
        totalRecords > 1000
          ? `Only first 1000 of ${totalRecords} payments analyzed. Grand total is approximate.`
          : undefined,
    };
  },
});

export const sentinelCheckbookSpendingTrend = createTool({
  id: 'sentinel-checkbook-spending-trend',
  description:
    'Get year-over-year spending trends for an agency or vendor across multiple fiscal years (FY2010–FY2024). Returns ONLY aggregated summaries per year — total spending, payment count, unique vendor count, and top vendors. No raw transactions. Use for longitudinal analysis, trend detection, and new vendor identification. Common agency codes: 071=Dept of Homeless Services, 040=Dept of Education, 056=Police, 057=Fire, 068=Dept of Health, 069=Dept of Social Services, 846=Dept of Environmental Protection, 841=Dept of Transportation.',
  inputSchema: z.object({
    agency_code: z.string().optional().describe('3-digit agency code to filter by'),
    payee_name: z.string().optional().describe('Vendor name to track across years'),
    spending_category: z
      .enum(['c', 'cc', 'p', 'o'])
      .optional()
      .describe('c=Contracts, cc=Capital Contracts, p=Payroll, o=Others'),
    year_from: z.number().default(2010).describe('Start fiscal year (earliest: 2010)'),
    year_to: z.number().default(2024).describe('End fiscal year (latest: 2024)'),
    max_records_per_year: z
      .number()
      .int()
      .min(100)
      .max(1000)
      .default(200)
      .describe('Max transactions to fetch per year for aggregation (default 200)'),
  }),
  execute: async ({
    agency_code,
    payee_name,
    spending_category,
    year_from = 2010,
    year_to = 2024,
    max_records_per_year = 200,
  }) => {
    // Try live API first with a quick probe
    let useLiveApi = true;
    try {
      await checkbookQuery(buildXmlRequest({
        typeOfData: 'Spending', recordsFrom: 1, maxRecords: 1, criteria: [
          { name: 'fiscal_year', type: 'value', value: '2024' },
        ], columns: ['payee_name'],
      }));
    } catch (e) {
      if (e instanceof CheckbookApiBlocked) useLiveApi = false;
      else throw e;
    }

    // Fall back to cache for DHS queries
    if (!useLiveApi && agency_code === '071') {
      const cached = DHS_TREND_CACHE.filter(r => r.fiscal_year >= year_from && r.fiscal_year <= year_to);
      return {
        years_covered: `FY${year_from}–FY${year_to}`,
        data_source: 'cached (Checkbook NYC API temporarily unavailable)',
        trend: cached,
        new_vendors_in_latest_year: year_to === 2024
          ? { compared_to: 'FY2023', vendors: DHS_NEW_VENDORS_FY2024 }
          : null,
      };
    }

    if (!useLiveApi) {
      throw new Error('Checkbook NYC API is temporarily blocked by WAF. Cached data only available for DHS (agency_code=071).');
    }

    const years = Array.from({ length: year_to - year_from + 1 }, (_, i) => year_from + i);

    const yearResults = await Promise.all(
      years.map(async year => {
        const criteria: SearchCriterion[] = [
          { name: 'fiscal_year', type: 'value', value: String(year) },
        ];
        if (agency_code) criteria.push({ name: 'agency_code', type: 'value', value: agency_code });
        if (payee_name) criteria.push({ name: 'payee_name', type: 'value', value: payee_name });
        if (spending_category) criteria.push({ name: 'spending_category', type: 'value', value: spending_category });

        const xml = buildXmlRequest({
          typeOfData: 'Spending',
          recordsFrom: 1,
          maxRecords: max_records_per_year,
          criteria,
          columns: ['payee_name', 'check_amount', 'agency'],
        });

        try {
          const result = await checkbookQuery(xml);

          const vendors = new Map<string, { count: number; total: number }>();
          let totalSpending = 0;

          for (const tx of result.transactions) {
            const amount = Number(tx.check_amount) || 0;
            totalSpending += amount;
            const vendor = tx.payee_name ?? 'Unknown';
            const existing = vendors.get(vendor) ?? { count: 0, total: 0 };
            existing.count++;
            existing.total += amount;
            vendors.set(vendor, existing);
          }

          const topVendors = [...vendors.entries()]
            .map(([name, stats]) => ({ name, payments: stats.count, total: Math.round(stats.total * 100) / 100 }))
            .sort((a, b) => b.total - a.total)
            .slice(0, 5);

          return {
            fiscal_year: year,
            total_records: result.record_count,
            total_spending: Math.round(totalSpending * 100) / 100,
            unique_vendors: vendors.size,
            top_5_vendors: topVendors,
          };
        } catch {
          return { fiscal_year: year, total_records: 0, total_spending: 0, unique_vendors: 0, top_5_vendors: [] };
        }
      }),
    );

    // Find new vendors in the latest year that weren't in the prior year
    const latestYear = yearResults[yearResults.length - 1];
    const priorYear = yearResults.length >= 2 ? yearResults[yearResults.length - 2] : null;
    let newVendors: Array<{ name: string; payments: number; total: number }> = [];

    if (latestYear && priorYear) {
      const latestVendors = new Map<string, { count: number; total: number }>();
      const criteria: SearchCriterion[] = [
        { name: 'fiscal_year', type: 'value', value: String(latestYear.fiscal_year) },
      ];
      if (agency_code) criteria.push({ name: 'agency_code', type: 'value', value: agency_code });
      if (spending_category) criteria.push({ name: 'spending_category', type: 'value', value: spending_category });

      const priorCriteria: SearchCriterion[] = [
        { name: 'fiscal_year', type: 'value', value: String(priorYear.fiscal_year) },
      ];
      if (agency_code) priorCriteria.push({ name: 'agency_code', type: 'value', value: agency_code });
      if (spending_category) priorCriteria.push({ name: 'spending_category', type: 'value', value: spending_category });

      try {
        const [latestData, priorData] = await Promise.all([
          checkbookQuery(buildXmlRequest({
            typeOfData: 'Spending', recordsFrom: 1, maxRecords: 1000, criteria,
            columns: ['payee_name', 'check_amount'],
          })),
          checkbookQuery(buildXmlRequest({
            typeOfData: 'Spending', recordsFrom: 1, maxRecords: 1000, criteria: priorCriteria,
            columns: ['payee_name', 'check_amount'],
          })),
        ]);

        const priorAllVendors = new Set(priorData.transactions.map(tx => tx.payee_name));

        for (const tx of latestData.transactions) {
          const vendor = tx.payee_name ?? 'Unknown';
          if (!priorAllVendors.has(vendor)) {
            const existing = latestVendors.get(vendor) ?? { count: 0, total: 0 };
            existing.count++;
            existing.total += Number(tx.check_amount) || 0;
            latestVendors.set(vendor, existing);
          }
        }

        newVendors = [...latestVendors.entries()]
          .map(([name, stats]) => ({ name, payments: stats.count, total: Math.round(stats.total * 100) / 100 }))
          .sort((a, b) => b.total - a.total)
          .slice(0, 10);
      } catch { /* skip new vendor detection on error */ }
    }

    return {
      years_covered: `FY${year_from}–FY${year_to}`,
      data_source: 'live',
      trend: yearResults,
      new_vendors_in_latest_year: newVendors.length > 0
        ? { compared_to: `FY${year_to - 1}`, vendors: newVendors }
        : null,
    };
  },
});

export const sentinelCheckbookContracts = createTool({
  id: 'sentinel-checkbook-contracts',
  description:
    'Search NYC Checkbook contract records. Filter by fiscal year, vendor, agency, contract status, and category. Returns contract details including vendor, amounts, purpose, and MWBE status. Use for contract-level audit analysis.',
  inputSchema: z.object({
    fiscal_year: z.number().optional().describe('Fiscal year'),
    vendor_name: z.string().optional().describe('Vendor/prime vendor name (startsWith match)'),
    agency_code: z.string().optional().describe('3-digit agency code'),
    contract_status: z
      .enum(['registered', 'active', 'pending'])
      .default('registered')
      .describe('Contract status'),
    contract_category: z
      .enum(['expense', 'revenue'])
      .default('expense')
      .describe('Contract category'),
    max_records: z.number().int().min(1).max(500).default(50).describe('Max records to return'),
  }),
  execute: async ({
    fiscal_year,
    vendor_name,
    agency_code,
    contract_status = 'registered',
    contract_category = 'expense',
    max_records = 50,
  }) => {
    const criteria: SearchCriterion[] = [];
    if (fiscal_year) criteria.push({ name: 'fiscal_year', type: 'value', value: String(fiscal_year) });
    if (vendor_name) criteria.push({ name: 'vendor_name', type: 'value', value: vendor_name });
    if (agency_code) criteria.push({ name: 'agency_code', type: 'value', value: agency_code });

    // Contracts requires status and category as top-level search criteria
    criteria.push({ name: 'status', type: 'value', value: contract_status });
    criteria.push({ name: 'category', type: 'value', value: contract_category });

    const xml = buildXmlRequest({
      typeOfData: 'Contracts',
      recordsFrom: 1,
      maxRecords: max_records,
      criteria,
    });

    const result = await checkbookQuery(xml);
    return {
      total_records: result.record_count,
      returned: result.transactions.length,
      contracts: result.transactions,
    };
  },
});
