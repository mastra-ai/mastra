import type { AnalysisRequest, AnalysisResult, DataSource, SourceDescriptor } from "../source.ts";
import type { DatasetMetadata, Filters, MetricResult, Period, Stage } from "./contracts.ts";
import { validateFilters } from "./contracts.ts";
import { dateOnly, samplePrompts, shiftMonths, validatePeriod } from "./calendar.ts";
import { openSales } from "./database.ts";
import { bookings, conversion, pipeline, forecast, salesGrowth } from "./opportunity-metrics.ts";
import { customerChurn, revenueChurn } from "./churn-metrics.ts";

const opportunityFilters = ["ownerId", "segment", "region", "stage"] as const;
const capabilities: SourceDescriptor["capabilities"] = [
  {
    metric: "bookings",
    description: "Closed-won contract value, counted once.",
    unit: "USD cents",
    fields: ["period", "filters"],
    filters: opportunityFilters,
  },
  {
    metric: "conversion",
    description: "Closed-deal win rate: won / (won + lost).",
    unit: "percent",
    fields: ["period", "filters"],
    filters: opportunityFilters,
  },
  {
    metric: "growth",
    description: "Bookings growth against matching earlier-year dates.",
    unit: "percent",
    fields: ["period", "baseline", "filters"],
    filters: opportunityFilters,
  },
  {
    metric: "pipeline",
    description: "Open opportunity values known as of a UTC date.",
    unit: "USD cents",
    fields: ["asOf", "filters"],
    filters: opportunityFilters,
  },
  {
    metric: "forecast",
    description: "Illustrative fixed-weight open-pipeline scenario, with known bookings separate.",
    unit: "USD cents",
    fields: ["asOf", "horizon", "filters"],
    filters: opportunityFilters,
  },
  {
    metric: "customerChurn",
    description: "First full account cancellation in the opening cohort; reactivation separate.",
    unit: "percent",
    fields: ["period"],
    filters: [],
  },
  {
    metric: "revenueChurn",
    description: "Opening-cohort gross MRR losses, capped per account at opening MRR.",
    unit: "percent",
    fields: ["period"],
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
  readonly #connection;
  readonly #metadata: DatasetMetadata;
  readonly #descriptor: SourceDescriptor;

  constructor(path: string) {
    this.#connection = openSales(path);
    this.#metadata = this.#connection.metadata;
    const { coverage, ...metadata } = this.#metadata;
    const period = { start: shiftMonths(coverage.end, -12), end: coverage.end };
    const prompts = samplePrompts(this.#metadata);
    this.#descriptor = {
      id: "sales",
      title: "Synthetic B2B SaaS Sales",
      version: "sales-sqlite-v1",
      datasetVersion: `${metadata.generator}:${metadata.schema}:${metadata.seed}:${metadata.anchor}`,
      coverage,
      asOf: metadata.asOf,
      metadata: { ...metadata, synthetic: true },
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

  async execute(request: AnalysisRequest): Promise<AnalysisResult> {
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
    const filters = requestFilters(request.filters);
    const db = this.#connection.db;
    const metadata = this.#metadata;
    let result: MetricResult;
    let details: AnalysisResult["details"];
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
      case "customerChurn": {
        const churn = customerChurn(db, metadata, requestPeriod(request.period, "period"));
        result = churn;
        details = {
          reactivatedCustomers: churn.reactivatedCustomers,
          convention: churn.convention,
        };
        break;
      }
      case "revenueChurn": {
        const churn = revenueChurn(db, metadata, requestPeriod(request.period, "period"));
        result = churn;
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
    return {
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
      },
    };
  }

  close(): void {
    this.#connection.db.close();
  }
}
