import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { runReadProcess } from "../read-process.ts";
import type { SourceExecutionContext, SourceOperation } from "../source.ts";
import type {
  AnalysisRequest,
  AnalysisResult,
  DataSource,
  SourceDescriptor,
  ResultTable,
} from "../source.ts";
import type { DatasetMetadata, Filters, MetricResult, Period, Stage } from "./contracts.ts";
import { resultInteger, resultText, validateFilters } from "./contracts.ts";
import { dateOnly, samplePrompts, shiftMonths, validatePeriod } from "./calendar.ts";
import { openSales } from "./database.ts";
import {
  bookings,
  conversion,
  pipeline,
  forecast,
  salesGrowth,
  filterClause,
} from "./opportunity-metrics.ts";
import { customerChurn, revenueChurn, churnSeries, customerCohorts } from "./churn-metrics.ts";

const opportunityFilters = ["ownerId", "segment", "region", "stage"] as const;
const capabilities: SourceDescriptor["capabilities"] = [
  ...["cohortRetention", "cohortChurn"].map(
    (metricId): SourceDescriptor["capabilities"][number] => ({
      metric: metricId,
      description: `First activation month per account with a fixed cohort size. Continuous retention ends at the first complete cancellation; reactivation stays separate. ${metricId === "cohortRetention" ? "Retained" : "Cumulatively churned"} customers / cohort size at each completed month end. Month 0 is activation month end. The overall rate observes selected cohorts at the requested period end, not an average of matrix cells.`,
      unit: "percent",
      calculation: "percentage" as const,
      fields: ["period", "groupBy"],
      groupings: [{ field: "cohort", kind: "matrix" as const }],
      groupedCalculation: "independent" as const,
      filters: [],
    }),
  ),
  {
    metric: "bookings",
    description:
      "Closed-won contract value, counted once. Monthly rows with no closes are zero; monthly conversion omits no-close months as gaps.",
    unit: "USD cents",
    calculation: "total",
    fields: ["period", "filters", "groupBy", "records"],
    groupings: ["month", "segment", "region", "ownerId", "stage"].map((field) => ({
      field,
      kind: field === "month" ? ("series" as const) : ("ranked" as const),
    })),
    filters: [...opportunityFilters],
  },
  {
    metric: "conversion",
    description: "Closed-deal win rate: won / (won + lost).",
    unit: "percent",
    calculation: "percentage",
    fields: ["period", "filters", "groupBy", "records"],
    groupings: ["month", "segment", "region", "ownerId", "stage"].map((field) => ({
      field,
      kind: field === "month" ? ("series" as const) : ("ranked" as const),
    })),
    filters: [...opportunityFilters],
  },
  {
    metric: "growth",
    description: "Bookings growth against matching earlier-year dates.",
    unit: "percent",
    calculation: "percentage",
    fields: ["period", "baseline", "filters"],
    filters: [...opportunityFilters],
  },
  {
    metric: "pipeline",
    description: "Open opportunity values known as of a UTC date.",
    unit: "USD cents",
    calculation: "total",
    fields: ["asOf", "filters"],
    filters: [...opportunityFilters],
  },
  {
    metric: "forecast",
    description:
      "Illustrative fixed-weight scenario; not calibrated or guaranteed revenue. Known bookings are separate.",
    unit: "USD cents",
    calculation: "total",
    fields: ["asOf", "horizon", "filters"],
    filters: [...opportunityFilters],
  },
  {
    metric: "customerChurn",
    description:
      "First full account cancellation in the opening cohort; reactivation separate. Monthly rates use each month's opening accounts, never a sum or mean of monthly rates. No starting accounts means a gap.",
    unit: "percent",
    calculation: "percentage",
    fields: ["period", "groupBy"],
    groupings: [{ field: "month", kind: "series" }],
    groupedCalculation: "independent",
    filters: [],
  },
  {
    metric: "revenueChurn",
    description:
      "Opening-cohort gross MRR losses, capped per account at opening MRR. Monthly rates use each month's opening MRR, never a sum or mean of monthly rates. No opening MRR means a gap.",
    unit: "percent",
    calculation: "percentage",
    fields: ["period", "groupBy"],
    groupings: [{ field: "month", kind: "series" }],
    groupedCalculation: "independent",
    filters: [],
  },
];

function requestPeriod(value: unknown, name: string): Period {
  if (
    !value ||
    typeof value !== "object" ||
    Array.isArray(value) ||
    Object.keys(value).some((key) => key !== "start" && key !== "end") ||
    !("start" in value) ||
    !("end" in value) ||
    typeof value.start !== "string" ||
    typeof value.end !== "string"
  )
    throw new Error(`${name} requires UTC start and exclusive end dates.`);
  const period = { start: value.start, end: value.end };
  validatePeriod(period);
  return period;
}

function requestDate(value: unknown): string {
  if (typeof value !== "string") throw new Error("asOf requires a UTC date.");
  return dateOnly(value);
}

function requestStage(value: unknown): Stage {
  if (
    value !== "qualification" &&
    value !== "discovery" &&
    value !== "proposal" &&
    value !== "negotiation" &&
    value !== "won" &&
    value !== "lost"
  )
    throw new Error("Unknown opportunity stage.");
  return value;
}

function requestFilters(value: unknown): Filters {
  if (value === undefined) return {};
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error("Filters must be an object.");
  const result: Filters = {};
  for (const [key, field] of Object.entries(value)) {
    if (key === "ownerId" && typeof field === "number") result.ownerId = field;
    else if (key === "segment" && typeof field === "string") result.segment = field;
    else if (key === "region" && typeof field === "string") result.region = field;
    else if (key === "stage") result.stage = requestStage(field);
    else throw new Error(`Invalid or unsupported Sales filter '${key}'.`);
  }
  validateFilters(result);
  return result;
}

export class SalesSource implements DataSource {
  readonly #path: string;
  readonly #connection;
  readonly #metadata: DatasetMetadata;
  readonly #descriptor: SourceDescriptor;

  constructor(path: string) {
    this.#path = path;
    this.#connection = openSales(path);
    this.#metadata = this.#connection.metadata;
    const { coverage, ...metadata } = this.#metadata;
    const period = { start: shiftMonths(coverage.end, -12), end: coverage.end };
    const prompts = samplePrompts(this.#metadata);
    this.#descriptor = {
      id: "sales",
      title: "B2B SaaS Sales",
      version: "sales-sqlite-v1",
      datasetVersion: `${metadata.generator}:${metadata.schema}:${metadata.seed}:${metadata.anchor}`,
      coverage,
      asOf: metadata.asOf,
      metadata: { ...metadata },
      metricVersion: metadata.metrics,
      capabilities,
      examples: [
        {
          title: "Bookings in the last 12 complete months",
          request: { metric: "bookings", period },
        },
        { title: "Closed-deal win rate", request: { metric: "conversion", period } },
        { title: prompts[0]!, request: { metric: "growth", period } },
        { title: prompts[1]!, request: { metric: "customerChurn", period } },
        { title: "Gross MRR churn", request: { metric: "revenueChurn", period } },
        {
          title: "Continuous customer retention by activation cohort",
          request: { metric: "cohortRetention", period, groupBy: "cohort" },
        },
        {
          title: "Cumulative customer churn by activation cohort",
          request: { metric: "cohortChurn", period, groupBy: "cohort" },
        },
        {
          title: "Monthly customer churn",
          request: { metric: "customerChurn", period, groupBy: "month" },
        },
        {
          title: "Monthly gross revenue churn",
          request: { metric: "revenueChurn", period, groupBy: "month" },
        },
        {
          title: prompts[2]!,
          request: { metric: "pipeline", asOf: metadata.asOf },
        },
        {
          title: prompts[3]!,
          request: {
            metric: "forecast",
            asOf: metadata.asOf,
            horizon: { start: coverage.end, end: shiftMonths(coverage.end, 3) },
          },
        },
      ],
    };
  }

  describe(): SourceDescriptor {
    return this.#descriptor;
  }

  async execute(
    request: AnalysisRequest,
    context?: SourceExecutionContext,
  ): Promise<AnalysisResult> {
    const execution = context ?? {
      signal: new AbortController().signal,
      deadline: Date.now() + 5000,
      maxRows: 1000,
      maxBytes: 1048576,
      requestId: "inspection",
      queryId: "inspection",
      traceId: "inspection",
    };
    const adjacentWorker = new URL(
      import.meta.url.endsWith(".ts") ? "./read-worker.ts" : "./read-worker.js",
      import.meta.url,
    );
    // Native Mastra bundles modules; compiled read workers remain isolated template assets.
    const worker = existsSync(adjacentWorker)
      ? adjacentWorker
      : pathToFileURL(
          resolve(
            process.env.TEMPLATE_DIRECTORY ?? process.cwd(),
            "dist/data-sources/sales/read-worker.js",
          ),
        );
    return runReadProcess(
      worker,
      { path: this.#path, request, maxRows: execution.maxRows, maxBytes: execution.maxBytes },
      execution,
    );
  }

  /** Worker-only synchronous implementation; never exposed as a model tool. */
  executeRead(request: AnalysisRequest): AnalysisResult {
    if (!request || typeof request !== "object" || Array.isArray(request))
      throw new Error("An analytical request is required.");
    const capability = capabilities.find((entry) => entry.metric === request.metric);
    if (!capability)
      throw new Error(
        `Unsupported Sales metric '${request.metric}'. Choose an advertised capability.`,
      );
    const allowed = new Set<string>(["metric", ...capability.fields]);
    if (Object.keys(request).some((key) => !allowed.has(key)))
      throw new Error(`Unsupported fields for Sales metric '${request.metric}'.`);
    if (request.groupBy && !capability.groupings?.some((group) => group.field === request.groupBy))
      throw new Error("Choose an advertised Sales grouping.");
    const filters = requestFilters(request.filters);
    const operations: SourceOperation[] = [];
    const db = new Proxy(this.#connection.db, {
      get(target, key) {
        if (key !== "prepare") {
          const value = Reflect.get(target, key, target);
          return typeof value === "function" ? value.bind(target) : value;
        }
        return (sql: string) => {
          const statement = target.prepare(sql);
          return new Proxy(statement, {
            get(prepared, method) {
              const value = Reflect.get(prepared, method, prepared);
              if (method === "get" || method === "all")
                return (...parameters: (string | number | bigint | null)[]) => {
                  operations.push({
                    kind: "sql",
                    statement: sql,
                    parameters: parameters.map((value) =>
                      typeof value === "bigint" ? Number(value) : value,
                    ),
                  });
                  return value.apply(prepared, parameters);
                };
              return typeof value === "function" ? value.bind(prepared) : value;
            },
          });
        };
      },
    });
    const metadata = this.#metadata;
    let result: MetricResult;
    let details: AnalysisResult["details"];
    let table: ResultTable | undefined;
    switch (request.metric) {
      case "bookings":
        result = bookings(db, metadata, requestPeriod(request.period, "period"), filters);
        break;
      case "conversion":
        result = conversion(db, metadata, requestPeriod(request.period, "period"), filters);
        break;
      case "growth": {
        const comparison = requestPeriod(request.period, "period");
        const baseline =
          request.baseline === undefined ? undefined : requestPeriod(request.baseline, "baseline");
        const growth = salesGrowth(db, metadata, comparison, baseline, filters);
        result = growth;
        details = {
          comparisonBookings: growth.comparisonBookings,
          baselineBookings: growth.baselineBookings,
          baseline: growth.baseline,
        };
        break;
      }
      case "pipeline": {
        const open = pipeline(db, metadata, requestDate(request.asOf), filters);
        result = open;
        details = { rows: open.rows.map((row) => ({ ...row })) };
        break;
      }
      case "forecast": {
        const scenario = forecast(
          db,
          metadata,
          requestDate(request.asOf),
          requestPeriod(request.horizon, "horizon"),
          filters,
        );
        result = scenario;
        details = {
          weightedOpenCents: scenario.weightedOpenCents,
          bookedCents: scenario.bookedCents,
          stageWeights: scenario.stageWeights,
          assumption: scenario.assumption,
          rows: scenario.rows.map((row) => ({ ...row })),
        };
        break;
      }
      case "cohortRetention":
      case "cohortChurn": {
        const cohorts = customerCohorts(
          db,
          metadata,
          requestPeriod(request.period, "period"),
          request.metric,
        );
        result = cohorts;
        if (request.groupBy) table = cohorts.table;
        details = { convention: cohorts.convention, cohortCount: cohorts.cohortCount };
        break;
      }
      case "customerChurn": {
        const churn = customerChurn(db, metadata, requestPeriod(request.period, "period"));
        result = churn;
        if (request.groupBy && (result.status === "available" || result.denominator === 0))
          table = churnSeries(db, metadata, result.period, "customerChurn");
        details = {
          reactivatedCustomers: churn.reactivatedCustomers,
          convention: churn.convention,
        };
        break;
      }
      case "revenueChurn": {
        const churn = revenueChurn(db, metadata, requestPeriod(request.period, "period"));
        result = churn;
        if (request.groupBy && (result.status === "available" || result.denominator === 0))
          table = churnSeries(db, metadata, result.period, "revenueChurn");
        details = {
          cancellationLossCents: churn.cancellationLossCents,
          cancellationOnlyPercent: churn.cancellationOnlyPercent,
          convention: churn.convention,
        };
        break;
      }
      default:
        throw new Error("Unsupported Sales metric.");
    }
    table ??=
      result.status === "available" &&
      (request.groupBy || request.records) &&
      (request.metric === "bookings" || request.metric === "conversion")
        ? this.closedTable(db, request, filters)
        : undefined;
    return {
      ...(table ? { table } : {}),
      metric: request.metric,
      request: structuredClone(request),
      status: result.status,
      value: result.value,
      unit: result.unit,
      numerator: result.numerator,
      denominator: result.denominator,
      reason: result.reason,
      period: result.period,
      ...(details === undefined ? {} : { details }),
      provenance: {
        sourceId: this.#descriptor.id,
        sourceVersion: this.#descriptor.version,
        datasetVersion: this.#descriptor.datasetVersion,
        metricVersion: result.metricVersion,
        asOf: metadata.asOf,
        coverage: metadata.coverage,
        complete: true,
        operations,
      },
    };
  }

  private closedTable(
    db: import("node:sqlite").DatabaseSync,
    request: AnalysisRequest,
    filters: Filters,
  ): ResultTable {
    const period = requestPeriod(request.period, "period");
    const filter = filterClause(filters);
    const where = ` FROM opportunity_history h JOIN opportunities o ON o.id=h.opportunity_id JOIN accounts a ON a.id=o.account_id WHERE h.stage IN ('won','lost') AND h.effective_at >= ? AND h.effective_at < ?${filter.sql}`;
    if (request.records) {
      if (request.groupBy) throw new Error("Choose grouped data or records, not both.");
      const rows = db
        .prepare(
          `SELECT h.opportunity_id AS opportunityId, a.name AS account, h.effective_at AS date, h.stage, h.value_cents AS value${where}${request.metric === "bookings" ? " AND h.stage='won'" : ""} ORDER BY h.effective_at,h.opportunity_id LIMIT 1001`,
        )
        .all(period.start, period.end, ...filter.params);
      if (rows.length > 1000)
        throw new Error("Record inspection exceeds 1000 rows. Narrow the period or filters.");
      return {
        kind: "records",
        omitted: 0,
        columns: [
          { key: "opportunityId", label: "Opportunity", type: "id" },
          { key: "account", label: "Account", type: "category" },
          { key: "date", label: "Closed date (UTC)", type: "date" },
          { key: "stage", label: "Outcome", type: "category" },
          { key: "value", label: "Contract value", type: "number", unit: "USD cents" },
        ],
        rows: rows.map((row) => ({
          opportunityId: resultInteger(row.opportunityId),
          account: resultText(row.account),
          date: resultText(row.date),
          stage: resultText(row.stage),
          value: resultInteger(row.value),
        })),
      };
    }
    const dimensions: Readonly<Record<string, string>> = {
      month: "substr(h.effective_at,1,7)||'-01'",
      segment: "h.segment",
      region: "a.region",
      ownerId: "CAST(h.owner_id AS TEXT)",
      stage: "h.stage",
    };
    const dimension = request.groupBy ? dimensions[request.groupBy] : undefined;
    if (!dimension) throw new Error("A supported grouping is required.");
    const rows = db
      .prepare(
        `SELECT ${dimension} AS label, COALESCE(SUM(CASE WHEN h.stage='won' THEN h.value_cents ELSE 0 END),0) AS amount, COUNT(CASE WHEN h.stage='won' THEN 1 END) AS won, COUNT(*) AS closed${where} GROUP BY ${dimension} ORDER BY ${request.groupBy === "month" ? "label" : request.metric === "conversion" ? "1.0*won/closed DESC,label" : "amount DESC,label"} LIMIT 1001`,
      )
      .all(period.start, period.end, ...filter.params);
    if (rows.length > 1000) throw new Error("Grouping exceeds the result limit.");
    const tableRows = rows.map((row) => {
      const numerator = resultInteger(request.metric === "bookings" ? row.amount : row.won);
      const denominator = resultInteger(row.closed);
      return {
        label: resultText(row.label),
        value: request.metric === "bookings" ? numerator : (numerator / denominator) * 100,
        numerator,
        denominator,
      };
    });
    if (request.groupBy === "month" && request.metric === "bookings") {
      let month = `${period.start.slice(0, 7)}-01`;
      while (month < period.end) {
        if (!tableRows.some((row) => row.label === month))
          tableRows.push({ label: month, value: 0, numerator: 0, denominator: 0 });
        month = shiftMonths(month, 1);
      }
      tableRows.sort((a, b) => a.label.localeCompare(b.label));
    }
    return {
      kind: request.groupBy === "month" ? "series" : "ranked",
      omitted: 0,
      columns: [
        {
          key: "label",
          label: request.groupBy!,
          type: request.groupBy === "month" ? "date" : "category",
        },
        {
          key: "value",
          label: request.metric,
          type: "number",
          unit: request.metric === "bookings" ? "USD cents" : "percent",
        },
        {
          key: "numerator",
          label: request.metric === "bookings" ? "Closed-won contract value" : "Won opportunities",
          type: "number",
          ...(request.metric === "bookings" ? { unit: "USD cents" } : {}),
        },
        { key: "denominator", label: "Closed opportunities", type: "number" },
      ],
      rows: tableRows,
    };
  }

  close(): void {
    this.#connection.db.close();
  }
}
