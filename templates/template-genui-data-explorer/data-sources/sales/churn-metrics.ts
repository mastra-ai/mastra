import type { DatabaseSync } from "node:sqlite";
import { coverageReason, shiftMonths } from "./calendar.ts";
import { metric, safeInteger, resultInteger, resultText } from "./contracts.ts";
import type { DatasetMetadata, Period } from "./contracts.ts";

interface History {
  accountId: number;
  subscriptionId: number;
  effectiveAt: string;
  mrrCents: number;
}
interface Cohort {
  openingCustomers: number;
  openingMrrCents: number;
  churnedCustomers: number;
  reactivatedCustomers: number;
  grossLossCents: number;
  cancellationLossCents: number;
}

function cohort(db: DatabaseSync, period: Period): Cohort {
  const history = db
    .prepare(`SELECT s.account_id AS accountId, h.subscription_id AS subscriptionId,
    h.effective_at AS effectiveAt, h.mrr_cents AS mrrCents
    FROM subscription_history h JOIN subscriptions s ON s.id=h.subscription_id
    WHERE h.effective_at < ? ORDER BY s.account_id, h.effective_at, h.subscription_id`)
    .all(period.end)
    .map((row) => ({
      accountId: resultInteger(row.accountId),
      subscriptionId: resultInteger(row.subscriptionId),
      effectiveAt: resultText(row.effectiveAt),
      mrrCents: resultInteger(row.mrrCents),
    }));
  const accounts = new Map<number, History[]>();
  for (const entry of history) {
    const rows = accounts.get(entry.accountId) ?? [];
    rows.push(entry);
    accounts.set(entry.accountId, rows);
  }
  const result: Cohort = {
    openingCustomers: 0,
    openingMrrCents: 0,
    churnedCustomers: 0,
    reactivatedCustomers: 0,
    grossLossCents: 0,
    cancellationLossCents: 0,
  };
  for (const rows of accounts.values()) {
    const balances = new Map<number, number>();
    for (const row of rows)
      if (row.effectiveAt < period.start) balances.set(row.subscriptionId, row.mrrCents);
    const total = () => [...balances.values()].reduce((sum, value) => safeInteger(sum + value), 0);
    const opening = total();
    if (opening <= 0) continue;
    result.openingCustomers++;
    result.openingMrrCents = safeInteger(result.openingMrrCents + opening);
    let churned = false;
    let reactivated = false;
    let remaining = opening;
    const dates = new Map<string, History[]>();
    for (const row of rows)
      if (row.effectiveAt >= period.start) {
        const events = dates.get(row.effectiveAt) ?? [];
        events.push(row);
        dates.set(row.effectiveAt, events);
      }
    for (const events of dates.values()) {
      const before = total();
      let cancellations = 0;
      let contractions = 0;
      for (const event of events) {
        const loss = Math.max(0, (balances.get(event.subscriptionId) ?? 0) - event.mrrCents);
        if (event.mrrCents === 0) cancellations = safeInteger(cancellations + loss);
        else contractions = safeInteger(contractions + loss);
        balances.set(event.subscriptionId, event.mrrCents);
      }
      const after = total();
      if (before > 0 && after === 0 && !churned) {
        churned = true;
        result.churnedCustomers++;
      }
      if (before === 0 && after > 0 && churned && !reactivated) {
        reactivated = true;
        result.reactivatedCustomers++;
      }
      // Same-date changes are atomic. Cancellation receives the cap before contraction.
      const cancelled = Math.min(remaining, cancellations);
      remaining -= cancelled;
      const contracted = Math.min(remaining, contractions);
      remaining -= contracted;
      result.cancellationLossCents = safeInteger(result.cancellationLossCents + cancelled);
      result.grossLossCents = safeInteger(result.grossLossCents + cancelled + contracted);
    }
  }
  return result;
}

export function customerChurn(db: DatabaseSync, metadata: DatasetMetadata, period: Period) {
  const reason = coverageReason(metadata, period);
  const counts = reason ? null : cohort(db, period);
  return {
    ...metric(
      metadata,
      period,
      counts?.churnedCustomers ?? null,
      counts?.openingCustomers ?? null,
      reason,
      "percent",
    ),
    reactivatedCustomers: counts?.reactivatedCustomers ?? null,
    convention:
      "First complete account cancellation in the opening cohort; reactivation reported separately.",
  };
}

export function monthlyCustomerChurn(
  db: DatabaseSync,
  metadata: DatasetMetadata,
  monthStart: string,
) {
  if (!monthStart.endsWith("-01"))
    throw new Error("Monthly churn requires the first day of a calendar month.");
  return customerChurn(db, metadata, { start: monthStart, end: shiftMonths(monthStart, 1) });
}

export function trailingCustomerChurn(
  db: DatabaseSync,
  metadata: DatasetMetadata,
  end: string = metadata.coverage.end,
) {
  return customerChurn(db, metadata, { start: shiftMonths(end, -12), end });
}

export function revenueChurn(db: DatabaseSync, metadata: DatasetMetadata, period: Period) {
  const reason = coverageReason(metadata, period);
  const counts = reason ? null : cohort(db, period);
  return {
    ...metric(
      metadata,
      period,
      counts?.grossLossCents ?? null,
      counts?.openingMrrCents ?? null,
      reason,
      "percent",
    ),
    cancellationLossCents: counts?.cancellationLossCents ?? null,
    cancellationOnlyPercent: !counts?.openingMrrCents
      ? null
      : (counts.cancellationLossCents / counts.openingMrrCents) * 100,
    convention:
      "Gross subscription cancellations and contractions in the opening account cohort, capped per account at opening MRR; expansion excluded.",
  };
}
