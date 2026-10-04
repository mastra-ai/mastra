import type {
  AnalysisRequest,
  AnalysisResult,
  DataSource,
  SourceDescriptor,
} from "../../data-sources/source.ts";

// A non-SQL source with hand-authored facts, independent of Sales modules and SQLite.
export class ReferenceSource implements DataSource {
  closed = false;
  readonly fail: boolean;
  constructor(fail: boolean = false) {
    this.fail = fail;
  }

  describe(): SourceDescriptor {
    const period = { start: "2025-03-01", end: "2025-04-01" };
    return {
      id: "reference",
      title: "Independent reference",
      version: "reference-v1",
      datasetVersion: "hand-facts-v1",
      metricVersion: "hand-metrics-v1",
      coverage: { start: "2024-10-01", end: "2026-10-01" },
      asOf: "2026-09-30",
      metadata: { synthetic: true },
      capabilities: [
        {
          metric: "bookings",
          description: "Won contract value",
          unit: "USD cents",
          calculation: "total",
          fields: ["period"],
          filters: [],
        },
        {
          metric: "conversion",
          description: "Closed-deal win rate",
          unit: "percent",
          calculation: "percentage",
          fields: ["period"],
          filters: [],
        },
      ],
      examples: [
        { title: "March bookings", request: { metric: "bookings", period } },
        { title: "March win rate", request: { metric: "conversion", period } },
      ],
    };
  }

  async execute(request: AnalysisRequest): Promise<AnalysisResult> {
    if (this.fail) throw new Error("Reference source unavailable.");
    if (
      request.period?.start !== "2025-03-01" ||
      request.period.end !== "2025-04-01" ||
      Object.keys(request).some((key) => key !== "metric" && key !== "period")
    )
      throw new Error("Unsupported reference request.");
    const facts = [
      { outcome: "won", amount: 12000 },
      { outcome: "lost", amount: 30000 },
    ];
    const won = facts.filter((row) => row.outcome === "won");
    let value: number;
    let numerator: number;
    let denominator: number | null;
    let unit: string;
    if (request.metric === "bookings") {
      value = won.reduce((sum, row) => sum + row.amount, 0);
      numerator = value;
      denominator = null;
      unit = "USD cents";
    } else if (request.metric === "conversion") {
      numerator = won.length;
      denominator = facts.length;
      value = (numerator / denominator) * 100;
      unit = "percent";
    } else throw new Error("Unsupported reference metric.");
    return {
      metric: request.metric,
      request: structuredClone(request),
      status: "available",
      value,
      numerator,
      denominator,
      unit,
      reason: null,
      period: { ...request.period },
      provenance: {
        sourceId: "reference",
        sourceVersion: "reference-v1",
        datasetVersion: "hand-facts-v1",
        metricVersion: "hand-metrics-v1",
        asOf: "2026-09-30",
        coverage: { start: "2024-10-01", end: "2026-10-01" },
        complete: true,
        operations: [
          {
            kind: "read",
            statement: "Read hand-authored complete deal cohort",
            parameters: [request.period.start, request.period.end],
          },
        ],
      },
    };
  }

  async close(): Promise<void> {
    await Promise.resolve();
    this.closed = true;
  }
}
