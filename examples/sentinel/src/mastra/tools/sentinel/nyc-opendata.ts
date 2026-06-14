import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { soqlQuery, buildWhereClause, soqlEscape } from './helpers';

const NYC_PAYROLL_DATASET = 'k397-673e';

export const sentinelNycPayrollSearch = createTool({
  id: 'sentinel-nyc-payroll-search',
  description:
    'Search NYC citywide payroll data by agency, title, fiscal year, and salary range. Returns employee-level compensation records including base salary, overtime, and other pay. Data covers all NYC agencies.',
  inputSchema: z.object({
    agency_name: z.string().optional().describe('Agency name filter, e.g. "POLICE DEPARTMENT"'),
    fiscal_year: z.number().optional().describe('Fiscal year, e.g. 2024'),
    title_description: z.string().optional().describe('Job title filter, e.g. "MANAGER"'),
    min_base_salary: z.number().optional().describe('Minimum base salary'),
    max_base_salary: z.number().optional().describe('Maximum base salary'),
    limit: z.number().int().min(1).max(1000).default(100).describe('Max records to return (default 100)'),
    order_by: z.string().optional().default('base_salary DESC').describe('SoQL order clause'),
  }),
  execute: async ({ agency_name, fiscal_year, title_description, min_base_salary, max_base_salary, limit = 100, order_by = 'base_salary DESC' }) => {
    const conditions: Array<string | undefined> = [];
    if (agency_name) conditions.push(`upper(agency_name) LIKE '%${soqlEscape(agency_name.toUpperCase())}%'`);
    if (fiscal_year) conditions.push(`fiscal_year = ${fiscal_year}`);
    if (title_description) conditions.push(`upper(title_description) LIKE '%${soqlEscape(title_description.toUpperCase())}%'`);
    if (min_base_salary !== undefined) conditions.push(`base_salary >= ${min_base_salary}`);
    if (max_base_salary !== undefined) conditions.push(`base_salary <= ${max_base_salary}`);

    const where = buildWhereClause(conditions);
    const params: Record<string, string> = {
      $limit: String(limit),
      $order: order_by,
    };
    if (where) params.$where = where;

    const results = await soqlQuery(NYC_PAYROLL_DATASET, params);
    return { count: results.length, records: results };
  },
});

export const sentinelNycPayrollAggregation = createTool({
  id: 'sentinel-nyc-payroll-aggregation',
  description:
    'Aggregate NYC payroll data — total spending, average salary, employee counts, overtime totals — grouped by agency, title, pay basis, or fiscal year. Use for detecting payroll anomalies and spending concentration.',
  inputSchema: z.object({
    group_by: z
      .enum(['agency_name', 'title_description', 'pay_basis', 'fiscal_year'])
      .describe('Field to group results by'),
    fiscal_year: z.number().optional().describe('Filter to a specific fiscal year'),
    agency_name: z.string().optional().describe('Filter to a specific agency'),
    having_min_total: z.number().optional().describe('Only include groups with total pay above this amount'),
    limit: z.number().int().min(1).max(200).default(50).describe('Max groups to return'),
  }),
  execute: async ({ group_by, fiscal_year, agency_name, having_min_total, limit }) => {
    const select = [
      group_by,
      'COUNT(*) as employee_count',
      'SUM(base_salary) as total_base_salary',
      'AVG(base_salary) as avg_base_salary',
      'SUM(total_ot_paid) as total_overtime',
      'SUM(total_other_pay) as total_other_pay',
    ].join(', ');

    const conditions: Array<string | undefined> = [];
    if (fiscal_year) conditions.push(`fiscal_year = ${fiscal_year}`);
    if (agency_name) conditions.push(`upper(agency_name) LIKE '%${soqlEscape(agency_name.toUpperCase())}%'`);
    const where = buildWhereClause(conditions);

    const params: Record<string, string> = {
      $select: select,
      $group: group_by,
      $order: 'total_base_salary DESC',
      $limit: String(limit),
    };
    if (where) params.$where = where;
    if (having_min_total) params.$having = `SUM(base_salary) > ${having_min_total}`;

    const results = await soqlQuery(NYC_PAYROLL_DATASET, params);
    return { count: results.length, groups: results };
  },
});

export const sentinelNycPayrollOvertimeOutliers = createTool({
  id: 'sentinel-nyc-payroll-overtime-outliers',
  description:
    'Find NYC employees with unusually high overtime relative to their base salary. Returns employees where OT-to-salary ratio exceeds a configurable threshold. High overtime ratios can indicate staffing issues, abuse, or policy violations.',
  inputSchema: z.object({
    fiscal_year: z.number().default(2024).describe('Fiscal year to analyze'),
    agency_name: z.string().optional().describe('Filter to a specific agency'),
    ot_to_salary_ratio_min: z
      .number()
      .default(0.5)
      .describe('Minimum ratio of total_ot_paid to base_salary (default 0.5 = OT is 50%+ of base)'),
    limit: z.number().int().min(1).max(200).default(50).describe('Max records to return'),
  }),
  execute: async ({ fiscal_year, agency_name, ot_to_salary_ratio_min, limit }) => {
    const conditions: string[] = [
      `fiscal_year = ${fiscal_year}`,
      'base_salary > 0',
      'total_ot_paid > 0',
      `total_ot_paid / base_salary >= ${ot_to_salary_ratio_min}`,
    ];
    if (agency_name) conditions.push(`upper(agency_name) LIKE '%${soqlEscape(agency_name.toUpperCase())}%'`);

    const params: Record<string, string> = {
      $where: buildWhereClause(conditions),
      $order: 'total_ot_paid DESC',
      $limit: String(limit),
    };

    const results = (await soqlQuery(NYC_PAYROLL_DATASET, params)) as Array<Record<string, unknown>>;

    const enriched = results.map(r => {
      const base = Number(r.base_salary) || 0;
      const ot = Number(r.total_ot_paid) || 0;
      return {
        ...r,
        ot_to_salary_ratio: base > 0 ? Math.round((ot / base) * 1000) / 1000 : null,
        total_compensation: base + ot + (Number(r.total_other_pay) || 0),
      };
    });

    return { count: enriched.length, records: enriched };
  },
});

export const sentinelNycDatasetQuery = createTool({
  id: 'sentinel-nyc-dataset-query',
  description:
    'Run a SoQL query against any NYC Open Data dataset by its 4x4 identifier. Use for ad-hoc exploration of contracts, revenue, budget, or other datasets. Common datasets: k397-673e (payroll), erm2-nwe9 (311 calls), 43nn-pn8j (contracts).',
  inputSchema: z.object({
    dataset_id: z
      .string()
      .regex(/^[a-z0-9]{4}-[a-z0-9]{4}$/)
      .describe('Socrata dataset 4x4 ID, e.g. "k397-673e"'),
    select: z.string().optional().describe('SoQL $select clause, e.g. "agency_name, SUM(base_salary)"'),
    where: z.string().optional().describe('SoQL $where clause, e.g. "fiscal_year = 2024"'),
    group: z.string().optional().describe('SoQL $group clause'),
    order: z.string().optional().describe('SoQL $order clause'),
    limit: z.number().int().min(1).max(1000).default(100).describe('Max records to return'),
  }),
  execute: async ({ dataset_id, select, where, group, order, limit }) => {
    const params: Record<string, string> = { $limit: String(limit) };
    if (select) params.$select = select;
    if (where) params.$where = where;
    if (group) params.$group = group;
    if (order) params.$order = order;

    const results = await soqlQuery(dataset_id, params);
    return { dataset_id, count: results.length, records: results };
  },
});
