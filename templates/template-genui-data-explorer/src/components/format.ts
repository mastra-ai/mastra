import type { AnalysisResult } from "../../data-sources/source.ts";

const names: Record<string, string> = {
  bookings: "Bookings",
  conversion: "Closed-deal win rate",
  growth: "Bookings growth",
  pipeline: "Open pipeline",
  forecast: "Weighted forecast",
  customerChurn: "Customer churn",
  revenueChurn: "Gross revenue churn",
  cohortRetention: "Continuous customer retention",
  cohortChurn: "Cumulative customer churn",
};
export function metricName(metric: string) {
  const name = Object.hasOwn(names, metric) ? names[metric] : undefined;
  return name ?? metric.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/[_-]/g, " ");
}
export function formatDate(value: string, monthOnly = false) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const date = new Date(`${value}T00:00:00Z`);
  if (!Number.isFinite(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "UTC",
    year: "numeric",
    month: "short",
    ...(monthOnly ? {} : { day: "numeric" }),
  }).format(date);
}
export function formatValue(value: unknown, unit?: string) {
  if (typeof value !== "number")
    return typeof value === "string"
      ? formatDate(value.replace(/^Synthetic (account|representative) (\d+)$/, "Example $1 $2"))
      : String(value ?? "Unavailable");
  if (unit === "USD cents")
    return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(
      value / 100,
    );
  if (unit === "percent") return `${value.toFixed(2)}%`;
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(value);
}
export function periodLabel(data: AnalysisResult) {
  if (data.period) {
    const last = new Date(`${data.period.end}T00:00:00Z`);
    last.setUTCDate(last.getUTCDate() - 1);
    return `${formatDate(data.period.start)} – ${formatDate(last.toISOString().slice(0, 10))}`;
  }
  return data.request.asOf ? `As of ${formatDate(data.request.asOf)}` : "";
}
export function viewTitle(data: AnalysisResult) {
  const name = metricName(data.metric);
  if (data.request.records) return `${name} records`;
  if (data.request.groupBy === "month") return `Monthly ${name.toLowerCase()}`;
  if (data.table?.kind === "matrix") return `${name} by activation cohort`;
  const group = data.request.groupBy;
  return group ? `${name} by ${group === "ownerId" ? "sales representative" : group}` : name;
}
/** Chat summaries use checked source values rather than free-form model prose. */
export function humanAnswer(data: AnalysisResult) {
  const name = metricName(data.metric);
  const period = periodLabel(data);
  if (data.status === "unavailable")
    return data.table?.kind === "series" && data.table.rows.length
      ? `${viewTitle(data)} is available for ${period}. The whole-period rate is unavailable because its starting population is empty.`
      : `${name} is unavailable for ${period || "this request"}.`;
  const filters = Object.entries(data.request.filters ?? {})
    .map(([field, value]) => `${field === "ownerId" ? "Sales representative" : field}: ${value}`)
    .join(" · ");
  const scenario =
    data.metric === "forecast" ? " Illustrative scenario, not guaranteed revenue." : "";
  return `${name}: ${formatValue(data.value, data.unit)}${period ? ` · ${period}` : ""}.${filters ? ` ${filters}.` : ""}${scenario}`;
}
