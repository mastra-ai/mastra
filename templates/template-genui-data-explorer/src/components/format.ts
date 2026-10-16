import type { AnalysisResult } from "../../data-sources/source.ts";

export function metricName(metric: string) {
  const words = metric
    .replace(
      /([a-z])([A-Z])/g,
      (_, first: string, second: string) => `${first} ${second.toLowerCase()}`,
    )
    .replace(/[_-]/g, " ");
  return words.charAt(0).toUpperCase() + words.slice(1);
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
    return typeof value === "string" ? formatDate(value) : String(value ?? "Unavailable");
  if (unit === "USD cents")
    return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(
      value / 100,
    );
  if (unit === "percent") return `${value.toFixed(2)}%`;
  const formatted = new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(value);
  return unit ? `${formatted} ${unit}` : formatted;
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
  const name = data.presentation?.label ?? metricName(data.metric);
  if (data.request.records) return `${name} records`;
  if (data.table?.interval === "month") return `Monthly ${name.toLowerCase()}`;
  const group = data.request.groupBy;
  const label = data.table?.columns.find(
    (column) => column.key === (data.table?.grouping ?? data.table?.axes?.y),
  )?.label;
  return group ? `${name} by ${label ?? metricName(group).toLowerCase()}` : name;
}
/** Chat summaries use checked source values rather than free-form model prose. */
export function humanAnswer(data: AnalysisResult) {
  const name = data.presentation?.label ?? metricName(data.metric);
  const period = periodLabel(data);
  if (data.status === "unavailable")
    return data.table?.rows.length
      ? `${viewTitle(data)} is available for ${period}. The whole-period value is unavailable.`
      : `${name} is unavailable for ${period || "this request"}.`;
  const filters = Object.entries(data.request.filters ?? {})
    .map(([field, value]) => `${metricName(field)}: ${value}`)
    .join(" · ");
  const scenario = data.presentation?.scenario
    ? " Illustrative scenario; outcomes are not guaranteed."
    : "";
  return `${name}: ${formatValue(data.value, data.unit)}${period ? ` · ${period}` : ""}.${filters ? ` ${filters}.` : ""}${scenario}`;
}
