import type { DatabaseSync, SQLInputValue } from "node:sqlite";
import { coverageReason, dateOnly, shiftDays, shiftMonths, validatePeriod } from "./calendar.ts";
import {
  metric,
  STAGE_WEIGHTS,
  salesFiltersSchema,
  safeInteger,
  resultInteger,
  resultText,
  resultOpenStage,
} from "./contracts.ts";
import type { DatasetMetadata, Filters, MetricResult, OpenStage, Period } from "./contracts.ts";

export function filterClause(filters: Filters): { sql: string; params: SQLInputValue[] } {
  const parsed = salesFiltersSchema.parse(filters);
  const parts: string[] = [];
  const params: SQLInputValue[] = [];
  for (const [key, column] of Object.entries({
    ownerId: "h.owner_id",
    segment: "h.segment",
    region: "a.region",
    stage: "h.stage",
  })) {
    const value = parsed[key as keyof Filters];
    if (value !== undefined) {
      parts.push(`${column} = ?`);
      params.push(value);
    }
  }
  return { sql: parts.length ? ` AND ${parts.join(" AND ")}` : "", params };
}

function closed(
  db: DatabaseSync,
  period: Period,
  filters: Filters,
  asOf?: string,
): { won: number; lost: number; bookings: number } {
  const filter = filterClause(filters);
  const statement = db.prepare(`SELECT
    COALESCE(SUM(CASE WHEN h.stage='won' THEN h.value_cents ELSE 0 END), 0) AS bookings,
    COUNT(CASE WHEN h.stage='won' THEN 1 END) AS won,
    COUNT(CASE WHEN h.stage='lost' THEN 1 END) AS lost
    FROM opportunity_history h JOIN opportunities o ON o.id=h.opportunity_id
    JOIN accounts a ON a.id=o.account_id
    WHERE h.stage IN ('won','lost') AND h.effective_at >= ? AND h.effective_at < ?${filter.sql}`);
  statement.setReadBigInts(true);
  const row = statement.get(
    period.start,
    asOf && shiftDays(asOf, 1) < period.end ? shiftDays(asOf, 1) : period.end,
    ...filter.params,
  )!;
  return {
    won: resultInteger(row.won),
    lost: resultInteger(row.lost),
    bookings: resultInteger(row.bookings),
  };
}

export function bookings(
  db: DatabaseSync,
  metadata: DatasetMetadata,
  period: Period,
  filters: Filters = {},
): MetricResult {
  const reason = coverageReason(metadata, period);
  return metric(
    metadata,
    period,
    reason ? null : closed(db, period, filters).bookings,
    null,
    reason,
  );
}

export function conversion(
  db: DatabaseSync,
  metadata: DatasetMetadata,
  period: Period,
  filters: Filters = {},
): MetricResult {
  const reason = coverageReason(metadata, period);
  if (reason) return metric(metadata, period, null, null, reason, "percent");
  const { won, lost } = closed(db, period, filters);
  return metric(metadata, period, won, won + lost);
}

export function salesGrowth(
  db: DatabaseSync,
  metadata: DatasetMetadata,
  comparison: Period,
  baseline: Period = {
    start: shiftMonths(comparison.start, -12),
    end: shiftMonths(comparison.end, -12),
  },
  filters: Filters = {},
): MetricResult & {
  comparisonBookings: number | null;
  baselineBookings: number | null;
  baseline: Period;
} {
  const reason = coverageReason(metadata, comparison) ?? coverageReason(metadata, baseline);
  // Comparable periods retain month/day boundaries after calendar-aware year shifting.
  const years =
    new Date(comparison.start).getUTCFullYear() - new Date(baseline.start).getUTCFullYear();
  const matching =
    years > 0 &&
    baseline.start === shiftMonths(comparison.start, -12 * years) &&
    baseline.end === shiftMonths(comparison.end, -12 * years);
  const unavailable =
    reason ?? (matching ? null : "Compare matching calendar boundaries in an earlier year.");
  if (unavailable)
    return {
      ...metric(metadata, comparison, null, null, unavailable, "percent"),
      comparisonBookings: null,
      baselineBookings: null,
      baseline,
    };
  const comparisonBookings = closed(db, comparison, filters).bookings;
  const baselineBookings = closed(db, baseline, filters).bookings;
  return {
    ...metric(
      metadata,
      comparison,
      comparisonBookings - baselineBookings,
      baselineBookings,
      unavailable,
      "percent",
    ),
    comparisonBookings,
    baselineBookings,
    baseline,
  };
}

export interface PipelineRow {
  opportunityId: number;
  stage: OpenStage;
  valueCents: number;
  expectedClose: string;
  ownerId: number;
  segment: string;
  region: string;
}

export function pipeline(
  db: DatabaseSync,
  metadata: DatasetMetadata,
  asOf: string,
  filters: Filters = {},
): MetricResult & { rows: PipelineRow[] } {
  dateOnly(asOf);
  const period = { start: asOf, end: shiftDays(asOf, 1) };
  const reason = coverageReason(metadata, period);
  if (reason) return { ...metric(metadata, period, null, null, reason), rows: [] };
  const filter = filterClause(filters);
  const rows = db
    .prepare(`SELECT h.opportunity_id AS opportunityId, h.stage, h.value_cents AS valueCents,
    h.expected_close AS expectedClose, h.owner_id AS ownerId, h.segment, a.region
    FROM opportunity_history h JOIN opportunities o ON o.id=h.opportunity_id JOIN accounts a ON a.id=o.account_id
    WHERE h.effective_at=(SELECT MAX(latest.effective_at) FROM opportunity_history latest
      WHERE latest.opportunity_id=h.opportunity_id AND latest.effective_at <= ?)
    AND h.stage NOT IN ('won','lost')${filter.sql} ORDER BY h.opportunity_id`)
    .all(asOf, ...filter.params)
    .map((row) => ({
      opportunityId: resultInteger(row.opportunityId),
      stage: resultOpenStage(row.stage),
      valueCents: resultInteger(row.valueCents),
      expectedClose: dateOnly(resultText(row.expectedClose)),
      ownerId: resultInteger(row.ownerId),
      segment: resultText(row.segment),
      region: resultText(row.region),
    }));
  return {
    ...metric(
      metadata,
      period,
      rows.reduce((total, row) => total + row.valueCents, 0),
    ),
    rows,
  };
}

export function forecast(
  db: DatabaseSync,
  metadata: DatasetMetadata,
  asOf: string,
  horizon: Period,
  filters: Filters = {},
) {
  validatePeriod(horizon);
  const open = pipeline(db, metadata, asOf, filters);
  const candidates = open.rows.filter(
    (row) => row.expectedClose >= horizon.start && row.expectedClose < horizon.end,
  );
  // Weight percentages in integer arithmetic; round to a cent only once.
  const weightedHundredths = candidates.reduce(
    (sum, row) => safeInteger(sum + safeInteger(row.valueCents * (STAGE_WEIGHTS[row.stage] * 100))),
    0,
  );
  const weightedOpenCents = Math.round(weightedHundredths / 100);
  const bookedCents =
    open.reason || horizon.start < metadata.coverage.start
      ? null
      : closed(db, horizon, filters, asOf).bookings;
  const reason =
    open.reason ??
    (horizon.start < metadata.coverage.start
      ? "The forecast horizon starts before available history."
      : null);
  return {
    ...metric(metadata, horizon, reason ? null : weightedOpenCents, null, reason),
    asOf,
    weightedOpenCents: reason ? null : weightedOpenCents,
    bookedCents,
    stageWeights: STAGE_WEIGHTS,
    assumption: "Illustrative fixed-weight scenario; not calibrated or guaranteed revenue.",
    rows: candidates,
  };
}
