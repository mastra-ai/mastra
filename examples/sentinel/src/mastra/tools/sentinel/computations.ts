import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

export const sentinelZscoreOutliers = createTool({
  id: 'sentinel-zscore-outliers',
  description:
    'Compute z-scores for a numeric array and identify statistical outliers. Provide payment amounts, salary figures, or any numeric series. Returns each value with its z-score and flags those exceeding the threshold.',
  inputSchema: z.object({
    values: z
      .array(
        z.object({
          id: z.string().describe('Row identifier (e.g. vendor name, employee ID, transaction ID)'),
          amount: z.number().describe('Numeric value to analyze'),
        }),
      )
      .min(3)
      .describe('At least 3 data points required for meaningful z-score analysis'),
    threshold: z.number().default(2.5).describe('Z-score threshold for flagging outliers (default 2.5)'),
  }),
  execute: async ({ values, threshold = 2.5 }) => {
    const amounts = values.map(v => v.amount);
    const n = amounts.length;
    const mean = amounts.reduce((sum, a) => sum + a, 0) / n;
    const variance = amounts.reduce((sum, a) => sum + (a - mean) ** 2, 0) / n;
    const stdDev = Math.sqrt(variance);

    if (stdDev === 0) {
      return {
        mean,
        std_dev: 0,
        outliers: [],
        total_count: n,
        outlier_count: 0,
        note: 'All values are identical — no variance detected.',
      };
    }

    const scored = values.map(v => ({
      id: v.id,
      amount: v.amount,
      z_score: Math.round(((v.amount - mean) / stdDev) * 1000) / 1000,
    }));

    const outliers = scored
      .filter(v => Math.abs(v.z_score) >= threshold)
      .sort((a, b) => Math.abs(b.z_score) - Math.abs(a.z_score));

    return {
      mean: Math.round(mean * 100) / 100,
      std_dev: Math.round(stdDev * 100) / 100,
      threshold,
      outliers,
      total_count: n,
      outlier_count: outliers.length,
    };
  },
});

export const sentinelPatternFlags = createTool({
  id: 'sentinel-pattern-flags',
  description:
    'Scan a list of payment records for common audit red flags: round-dollar amounts, split payments just below an approval threshold, end-of-period bunching, and duplicate amounts to the same vendor.',
  inputSchema: z.object({
    payments: z.array(
      z.object({
        id: z.string().describe('Transaction or document ID'),
        amount: z.number().describe('Payment amount in dollars'),
        vendor: z.string().describe('Vendor or payee name'),
        date: z.string().describe('Payment date (ISO 8601 or YYYY-MM-DD)'),
      }),
    ),
    approval_threshold: z
      .number()
      .default(25000)
      .describe('Dollar threshold requiring additional approval (default $25,000)'),
    period_end_days: z
      .number()
      .default(5)
      .describe('Days before a quarter/fiscal-year end to flag as bunching (default 5)'),
  }),
  execute: async ({ payments, approval_threshold = 25000, period_end_days = 5 }) => {
    const flags: Array<{ id: string; type: string; detail: string }> = [];

    // Quarter and fiscal year end dates (NYC fiscal year ends June 30)
    const periodEndDates = [
      { month: 9, day: 30 }, // Q1 end (Sep 30)
      { month: 12, day: 31 }, // Q2 end (Dec 31)
      { month: 3, day: 31 }, // Q3 end (Mar 31)
      { month: 6, day: 30 }, // FY end (Jun 30)
    ];

    function isNearPeriodEnd(dateStr: string): { near: boolean; period: string } {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return { near: false, period: '' };
      for (const pe of periodEndDates) {
        const endDate = new Date(d.getFullYear(), pe.month - 1, pe.day);
        const diffMs = endDate.getTime() - d.getTime();
        const diffDays = diffMs / (1000 * 60 * 60 * 24);
        if (diffDays >= 0 && diffDays <= period_end_days) {
          const label = pe.month === 6 ? 'fiscal year end' : `Q${periodEndDates.indexOf(pe) + 1} end`;
          return { near: true, period: label };
        }
      }
      return { near: false, period: '' };
    }

    // 1. Round-dollar amounts (exact multiples of 1000 over $5,000)
    for (const p of payments) {
      if (p.amount >= 5000 && p.amount % 1000 === 0) {
        flags.push({
          id: p.id,
          type: 'round_dollar',
          detail: `$${p.amount.toLocaleString()} is a round-dollar amount`,
        });
      }
    }

    // 2. Split payments: multiple payments to same vendor just below threshold
    const vendorPayments = new Map<string, typeof payments>();
    for (const p of payments) {
      const key = p.vendor.toLowerCase().trim();
      if (!vendorPayments.has(key)) vendorPayments.set(key, []);
      vendorPayments.get(key)!.push(p);
    }

    for (const [, vPayments] of vendorPayments) {
      const belowThreshold = vPayments.filter(
        p => p.amount >= approval_threshold * 0.7 && p.amount < approval_threshold,
      );
      if (belowThreshold.length >= 2) {
        const total = belowThreshold.reduce((s, p) => s + p.amount, 0);
        if (total >= approval_threshold) {
          for (const p of belowThreshold) {
            flags.push({
              id: p.id,
              type: 'split_payment',
              detail: `$${p.amount.toLocaleString()} to "${p.vendor}" — ${belowThreshold.length} payments totaling $${total.toLocaleString()} appear split below $${approval_threshold.toLocaleString()} threshold`,
            });
          }
        }
      }
    }

    // 3. End-of-period bunching
    for (const p of payments) {
      const result = isNearPeriodEnd(p.date);
      if (result.near) {
        flags.push({
          id: p.id,
          type: 'period_end_bunching',
          detail: `$${p.amount.toLocaleString()} on ${p.date} is within ${period_end_days} days of ${result.period}`,
        });
      }
    }

    // 4. Duplicate amounts to same vendor
    for (const [, vPayments] of vendorPayments) {
      const amountCounts = new Map<number, typeof payments>();
      for (const p of vPayments) {
        if (!amountCounts.has(p.amount)) amountCounts.set(p.amount, []);
        amountCounts.get(p.amount)!.push(p);
      }
      for (const [amount, dups] of amountCounts) {
        if (dups.length >= 2) {
          for (const p of dups) {
            flags.push({
              id: p.id,
              type: 'duplicate_amount',
              detail: `$${amount.toLocaleString()} paid to "${p.vendor}" appears ${dups.length} times`,
            });
          }
        }
      }
    }

    // Deduplicate flags by id+type
    const seen = new Set<string>();
    const uniqueFlags = flags.filter(f => {
      const key = `${f.id}:${f.type}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    return {
      flags: uniqueFlags,
      summary: {
        total_payments: payments.length,
        round_dollar_count: uniqueFlags.filter(f => f.type === 'round_dollar').length,
        split_payment_count: uniqueFlags.filter(f => f.type === 'split_payment').length,
        period_end_bunching_count: uniqueFlags.filter(f => f.type === 'period_end_bunching').length,
        duplicate_amount_count: uniqueFlags.filter(f => f.type === 'duplicate_amount').length,
        total_flags: uniqueFlags.length,
      },
    };
  },
});
