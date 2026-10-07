import type { DatabaseSync } from "node:sqlite";
import { coverageReason, shiftMonths } from "./calendar.ts";
import { metric, safeInteger, resultInteger, resultText } from "./contracts.ts";
import type { DatasetMetadata, Period } from "./contracts.ts";
import type { ResultTable } from "../source.ts";

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

function subscriptionAccounts(db: DatabaseSync, end: string) {
  const history = db
    .prepare(`SELECT s.account_id AS accountId, h.subscription_id AS subscriptionId,
    h.effective_at AS effectiveAt, h.mrr_cents AS mrrCents
    FROM subscription_history h JOIN subscriptions s ON s.id=h.subscription_id
    WHERE h.effective_at < ? ORDER BY s.account_id, h.effective_at, h.subscription_id`)
    .all(end)
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
  return accounts;
}

function cohort(accounts: ReadonlyMap<number, readonly History[]>, period: Period): Cohort {
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
      if (row.effectiveAt >= period.start && row.effectiveAt < period.end) {
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
  const counts = reason ? null : cohort(subscriptionAccounts(db, period.end), period);
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

/** Each row has its own opening population; it is not a partition of the period rate. */
export function churnSeries(
  db: DatabaseSync,
  metadata: DatasetMetadata,
  period: Period,
  metricId: "customerChurn" | "revenueChurn",
): ResultTable {
  const reason = coverageReason(metadata, period);
  if (reason) throw new Error(reason);
  if (!period.start.endsWith("-01") || !period.end.endsWith("-01"))
    throw new Error("Monthly churn requires complete calendar months, with first-of-month bounds.");
  const accounts = subscriptionAccounts(db, period.end);
  const rows: ResultTable["rows"] = [];
  for (let month = period.start; month < period.end; month = shiftMonths(month, 1)) {
    const counts = cohort(accounts, { start: month, end: shiftMonths(month, 1) });
    const numerator =
      metricId === "customerChurn" ? counts.churnedCustomers : counts.grossLossCents;
    const denominator =
      metricId === "customerChurn" ? counts.openingCustomers : counts.openingMrrCents;
    // No starting population means no rate. Preserve that month as a chart gap.
    if (denominator === 0) continue;
    rows.push({
      month,
      value: (numerator / denominator) * 100,
      numerator,
      denominator,
      reactivatedCustomers: counts.reactivatedCustomers,
    });
  }
  return {
    kind: "series",
    grouping: "month",
    omitted: 0,
    columns: [
      { key: "month", label: "Month", type: "date" },
      { key: "value", label: "Churn", type: "number", unit: "percent" },
      {
        key: "numerator",
        label: metricId === "customerChurn" ? "Churned customers" : "Gross MRR lost",
        type: "number",
        ...(metricId === "revenueChurn" ? { unit: "USD cents" } : {}),
      },
      {
        key: "denominator",
        label: metricId === "customerChurn" ? "Starting customers" : "Opening MRR",
        type: "number",
        ...(metricId === "revenueChurn" ? { unit: "USD cents" } : {}),
      },
      { key: "reactivatedCustomers", label: "Reactivated customers", type: "number" },
    ],
    rows,
  };
}

export function revenueChurn(db: DatabaseSync, metadata: DatasetMetadata, period: Period) {
  const reason = coverageReason(metadata, period);
  const counts = reason ? null : cohort(subscriptionAccounts(db, period.end), period);
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

interface Lifecycle {
  activation: string;
  cancellation?: string;
  reactivation?: string;
}

/** Account-level changes on one date are atomic, including transfers between subscriptions. */
function activationLifecycle(rows: readonly History[]): Lifecycle | undefined {
  const balances = new Map<number, number>();
  const dates = new Map<string, History[]>();
  for (const row of rows) {
    const events = dates.get(row.effectiveAt) ?? [];
    events.push(row);
    dates.set(row.effectiveAt, events);
  }
  let lifecycle: Lifecycle | undefined;
  let before = 0;
  for (const [date, events] of dates) {
    for (const event of events) balances.set(event.subscriptionId, event.mrrCents);
    const after = [...balances.values()].reduce((sum, value) => safeInteger(sum + value), 0);
    if (!lifecycle && after > 0) lifecycle = { activation: date };
    if (lifecycle && before > 0 && after === 0) lifecycle.cancellation ??= date;
    if (lifecycle?.cancellation && before === 0 && after > 0) lifecycle.reactivation ??= date;
    before = after;
  }
  return lifecycle;
}

/** Continuous retention uses a fixed first-activation cohort and never restores cancelled members. */
export function customerCohorts(
  db: DatabaseSync,
  metadata: DatasetMetadata,
  period: Period,
  metricId: "cohortRetention" | "cohortChurn" = "cohortRetention",
) {
  const reason = coverageReason(metadata, period);
  if (!period.start.endsWith("-01") || !period.end.endsWith("-01"))
    throw new Error(
      "Customer cohorts require complete calendar months, with first-of-month bounds.",
    );
  const cohorts = new Map<string, Lifecycle[]>();
  if (!reason)
    for (const rows of subscriptionAccounts(db, period.end).values()) {
      const lifecycle = activationLifecycle(rows);
      if (!lifecycle || lifecycle.activation < period.start) continue;
      const month = `${lifecycle.activation.slice(0, 7)}-01`;
      const members = cohorts.get(month) ?? [];
      members.push(lifecycle);
      cohorts.set(month, members);
    }
  const matrixRows: ResultTable["rows"] = [];
  let numerator = 0;
  let denominator = 0;
  for (const [month, members] of [...cohorts].toSorted(([a], [b]) => a.localeCompare(b))) {
    denominator += members.length;
    for (
      let age = 0, end = shiftMonths(month, 1);
      end <= period.end;
      age++, end = shiftMonths(end, 1)
    ) {
      const churned = members.filter(
        (member) => member.cancellation && member.cancellation < end,
      ).length;
      const count = metricId === "cohortRetention" ? members.length - churned : churned;
      matrixRows.push({
        cohort: month,
        age,
        value: (count / members.length) * 100,
        numerator: count,
        denominator: members.length,
        reactivatedCustomers: members.filter(
          (member) => member.reactivation && member.reactivation < end,
        ).length,
      });
      if (end === period.end) numerator += count;
    }
  }
  const table: ResultTable = {
    kind: "matrix",
    omitted: 0,
    axes: { x: "age", y: "cohort", value: "value" },
    cohort: true,
    columns: [
      { key: "cohort", label: "First activation cohort", type: "date" },
      { key: "age", label: "Months since activation", type: "number" },
      {
        key: "value",
        label: metricId === "cohortRetention" ? "Continuous retention" : "Cumulative churn",
        type: "number",
        unit: "percent",
      },
      {
        key: "numerator",
        label: metricId === "cohortRetention" ? "Retained customers" : "Churned customers",
        type: "number",
      },
      { key: "denominator", label: "Cohort size", type: "number" },
      { key: "reactivatedCustomers", label: "Reactivated customers (separate)", type: "number" },
    ],
    rows: matrixRows,
  };
  return {
    ...metric(
      metadata,
      period,
      reason ? null : numerator,
      reason ? null : denominator,
      reason,
      "percent",
    ),
    table: reason ? undefined : table,
    cohortCount: reason ? null : cohorts.size,
    convention:
      "First activation month per account; retention ends at the first complete account cancellation. Reactivation is separate. Month 0 is activation month end; the overall rate observes all selected cohort members at the requested period end.",
  };
}
