import { z } from "zod";
import { analysisResultSchema, failureCodes } from "../../data-sources/source.ts";
import type { AnalysisResult, SourceCapability } from "../../data-sources/source.ts";

export const LIMITS = Object.freeze({
  steps: 8,
  responseTokens: 1024,
  queryMs: 5000,
  analysisMs: 60000,
  rows: 1000,
  bytes: 1048576,
  readRetries: 1,
});
export const questionSchema = z.strictObject({
  threadId: z.string().min(1).max(128),
  workspaceId: z.string().min(1).max(128),
  requestId: z.string().min(1).max(128),
  baseRevision: z.number().int().nonnegative(),
  question: z.string().trim().min(1).max(4000),
});
export type Question = z.infer<typeof questionSchema>;
export const verifiedResultSchema = z.strictObject({
  resultId: z.string(),
  queryId: z.string(),
  workflowId: z.string(),
  workflowRunId: z.string(),
  requestId: z.string(),
  workspaceId: z.string(),
  threadId: z.string(),
  baseRevision: z.number().int(),
  traceId: z.string(),
  data: analysisResultSchema,
  checks: z.array(
    z.enum(["schema", "identity", "versions", "request", "unit", "completeness", "calculation"]),
  ),
  elapsedMs: z.number().nonnegative(),
  explanation: z.string(),
});
export type VerifiedResult = z.infer<typeof verifiedResultSchema>;
export type TerminalStatus =
  | "complete"
  | "clarification-required"
  | "unsupported"
  | "rejected"
  | "empty"
  | "cancelled"
  | "failed";
export interface Outcome {
  status: TerminalStatus;
  requestId: string;
  workspaceId: string;
  traceId: string;
  results: readonly VerifiedResult[];
  message: string;
  code?: (typeof failureCodes)[number];
}
export interface AnalysisEvent {
  type: "progress" | "terminal";
  requestId: string;
  workspaceId: string;
  traceId: string;
  workflowId?: string;
  workflowRunId?: string;
  queryId?: string;
  resultId?: string;
  stage?: "planning" | "validating" | "reading" | "retrying" | "verifying";
  outcome?: Outcome;
}

/** Only source operands that passed calculation checks can supply explanatory numbers. */
export function explain(result: AnalysisResult, capability: SourceCapability): string {
  const period = result.period
    ? ` for ${result.period.start} to ${result.period.end} (exclusive)`
    : "";
  const clock = result.provenance.asOf ? ` Saved reference date: ${result.provenance.asOf}.` : "";
  const snapshot = result.request.asOf ? ` Analytical snapshot: ${result.request.asOf}.` : "";
  const filters =
    result.request.filters && Object.keys(result.request.filters).length
      ? ` Applied filters: ${JSON.stringify(result.request.filters)}.`
      : "";
  if (result.status === "unavailable") {
    const limitation =
      result.denominator === 0
        ? "The denominator is zero."
        : "No complete value is available for the requested periods.";
    const coverage = result.provenance.coverage
      ? ` Source coverage: ${result.provenance.coverage.start} to ${result.provenance.coverage.end} (exclusive).`
      : "";
    return `${result.metric}${period} is unavailable: ${limitation}${clock}${snapshot}${filters}${coverage} Metric definition: ${capability.description}`;
  }
  const calculation =
    capability.calculation === "total"
      ? `Verified total: ${result.numerator}.`
      : `Verified calculation: ${result.numerator} / ${result.denominator} × 100.`;
  return `${result.metric}${period}: ${result.value} ${result.unit}. ${calculation}${clock}${snapshot}${filters} Metric definition: ${capability.description} Source: ${result.provenance.sourceId}; metric definition: ${result.provenance.metricVersion}. These observations do not establish causation.`;
}
