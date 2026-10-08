import { isDeepStrictEqual } from "node:util";
import type { AnalysisRequest, SourceDescriptor } from "../../data-sources/source.ts";
import type { Outcome } from "../../src/analysis/contracts.ts";
import type { ComponentBinding } from "../../src/components/catalog.ts";

export const dimensions = [
  "query-semantics",
  "numeric-correctness",
  "provenance",
  "visual-suitability",
  "axes-units-completeness",
  "filtered-aggregates",
  "paraphrase-equivalence",
  "unsupported-claims",
] as const;
export type Dimension = (typeof dimensions)[number];
export interface QualityCase {
  id: string;
  question: string;
  plan?: AnalysisRequest;
  expected: {
    status: Outcome["status"];
    value?: number | null;
    numerator?: number | null;
    denominator?: number | null;
    unit?: string;
    component?: string;
    x?: string;
    scenario?: boolean;
  };
  pair?: string;
}
export interface Observation {
  case: QualityCase;
  outcome: Outcome;
  components: readonly ComponentBinding[];
  source: SourceDescriptor;
}
export interface Check {
  dimension: Dimension;
  caseId: string;
  passed: boolean;
  reason: string;
}

/** Expectations are supplied separately from observed agent/tool output. No model judge or retries. */
export function assess(observation: Observation): Check[] {
  const { case: item, outcome, source, components } = observation;
  const checks: Check[] = [];
  const add = (dimension: Dimension, passed: boolean, reason: string) =>
    checks.push({
      dimension,
      caseId: item.id,
      passed,
      reason: passed ? "Matched expected outcome." : reason,
    });
  add(
    "unsupported-claims",
    outcome.status === item.expected.status,
    `Expected ${item.expected.status}; received ${outcome.status}.`,
  );
  if (!item.plan) return checks;
  const result = outcome.results[0];
  add(
    "query-semantics",
    Boolean(result && isDeepStrictEqual(result.data.request, item.plan)),
    "Verified metric/period/filter intent differs from the expected plan.",
  );
  const equal = (actual: number | null | undefined, expected: number | null | undefined) =>
    expected === undefined ||
    (typeof expected === "number" && item.expected.unit === "percent"
      ? typeof actual === "number" && Math.abs(actual - expected) <= 0.01
      : actual === expected);
  add(
    "numeric-correctness",
    Boolean(
      result &&
      equal(result.data.value, item.expected.value) &&
      equal(result.data.numerator, item.expected.numerator) &&
      equal(result.data.denominator, item.expected.denominator) &&
      result.data.unit === item.expected.unit,
    ),
    "Values, counts, denominator or units differ from independent truth.",
  );
  add(
    "provenance",
    Boolean(
      result &&
      result.data.provenance.sourceId === source.id &&
      result.data.provenance.datasetVersion === source.datasetVersion &&
      result.data.provenance.metricVersion === source.metricVersion &&
      result.data.provenance.sourceVersion === source.version &&
      isDeepStrictEqual(result.data.provenance.coverage, source.coverage) &&
      result.data.provenance.asOf === source.asOf &&
      result.requestId === outcome.requestId &&
      result.workspaceId === outcome.workspaceId &&
      result.traceId === outcome.traceId &&
      result.data.provenance.operations.length,
    ),
    "Missing or mismatched source/result provenance.",
  );
  if (item.plan.filters)
    add(
      "filtered-aggregates",
      Boolean(
        result &&
        isDeepStrictEqual(result.data.request.filters, item.plan.filters) &&
        equal(result.data.value, item.expected.value),
      ),
      "Filtered value differs from independent cohort truth.",
    );
  if (item.expected.component && item.expected.status === "complete") {
    const view = components.find((binding) => binding.resultId === result?.resultId);
    add(
      "visual-suitability",
      view?.component === item.expected.component,
      "Composition does not select the expected suitable registered view.",
    );
    add(
      "axes-units-completeness",
      Boolean(
        result &&
        view &&
        result.data.provenance.complete &&
        (!result.data.table || result.data.table.omitted === 0) &&
        (!item.expected.x ||
          (view.properties.x === item.expected.x && view.properties.y === "value")) &&
        (!item.expected.scenario || view.properties.scenario === true),
      ),
      "Axes, full coverage, typed units or forecast scenario label are unsuitable.",
    );
  }
  return checks;
}
export function qualityReport(
  observations: readonly Observation[],
  metadata: {
    model: string;
    corpusVersion: string;
    mode: "deterministic" | "live";
    budget?: unknown;
  },
) {
  const checks = observations.flatMap(assess);
  const pairs = new Map<string, Observation[]>();
  for (const item of observations)
    if (item.case.pair) pairs.set(item.case.pair, [...(pairs.get(item.case.pair) ?? []), item]);
  for (const [pair, items] of pairs) {
    const signature = (item: Observation) => ({
      status: item.outcome.status,
      results: item.outcome.results.map(({ data }) => ({
        request: data.request,
        value: data.value,
        numerator: data.numerator,
        denominator: data.denominator,
        unit: data.unit,
      })),
    });
    checks.push({
      dimension: "paraphrase-equivalence",
      caseId: pair,
      passed: items.length === 2 && isDeepStrictEqual(signature(items[0]!), signature(items[1]!)),
      reason: "Both questions must produce equivalent metric context and values.",
    });
  }
  const summary = dimensions.map((dimension) => {
    const applicable = checks.filter((check) => check.dimension === dimension);
    const failures = applicable.filter((check) => !check.passed);
    const threshold =
      metadata.mode === "live" &&
      ["visual-suitability", "paraphrase-equivalence"].includes(dimension)
        ? 0.9
        : 1;
    const rate = applicable.length
      ? (applicable.length - failures.length) / applicable.length
      : null;
    return {
      dimension,
      applicable: applicable.length,
      passed: applicable.length - failures.length,
      failures,
      rate,
      threshold,
      accepted: rate !== null && rate >= threshold,
    };
  });
  return {
    ...metadata,
    datasets: [...new Set(observations.map((item) => item.source.datasetVersion))],
    totalCases: observations.length,
    summary,
    checks,
    passed: summary.every((item) => item.accepted),
  };
}
