import { randomUUID } from "node:crypto";
import { isDeepStrictEqual } from "node:util";
import { RequestContext } from "@mastra/core/request-context";
import { createStep, createWorkflow } from "@mastra/core/workflows";
import {
  analysisRequestSchema,
  resultSchemaFor,
  resultRecordCount,
  SourceError,
} from "../../data-sources/source.ts";
import type {
  AnalysisRequest,
  DataSource,
  SourceDescriptor,
  SourceExecutionContext,
} from "../../data-sources/source.ts";
import { explain, LIMITS, verifiedResultSchema } from "./contracts.ts";
import type { AnalysisEvent, Question, VerifiedResult } from "./contracts.ts";

export interface Session {
  question: Question;
  source: DataSource;
  descriptor: SourceDescriptor;
  controller: AbortController;
  deadline: number;
  traceId: string;
  results: VerifiedResult[];
  cleanups: Promise<void>[];
  emit: (event: Omit<AnalysisEvent, "requestId" | "workspaceId" | "traceId">) => void;
  steps: number;
  failure?: SourceError;
  workflowRunId?: string;
}
export function sessionFrom(context: RequestContext | undefined): Session {
  const session = context?.get("analysis-session") as Session | undefined;
  if (!session || !session.controller || !session.source)
    throw new SourceError("invalid-input", "Server analysis context is required.");
  session.controller.signal.throwIfAborted();
  return session;
}
export async function bounded<T>(task: Promise<T>, signal: AbortSignal): Promise<T> {
  if (signal.aborted) {
    void task.catch(() => {});
    signal.throwIfAborted();
  }
  let abort!: () => void;
  const interrupted = new Promise<never>((_, reject) => {
    abort = () => reject(signal.reason);
    signal.addEventListener("abort", abort, { once: true });
  });
  try {
    return await Promise.race([task, interrupted]);
  } finally {
    signal.removeEventListener("abort", abort);
  }
}
function validatePlan(request: AnalysisRequest, descriptor: SourceDescriptor): void {
  const capability = descriptor.capabilities.find((item) => item.metric === request.metric);
  if (!capability)
    throw new SourceError(
      "unsupported",
      "This source does not support that metric. Choose an advertised capability.",
    );
  if (
    Object.keys(request).some(
      (key) => key !== "metric" && !capability.fields.includes(key as never),
    )
  )
    throw new SourceError("invalid-input", "This metric does not support the requested fields.");
  if (Object.keys(request.filters ?? {}).some((key) => !capability.filters.includes(key)))
    throw new SourceError("invalid-input", "This source does not support the requested filters.");
}

export function analyticalWorkflow() {
  const validate = createStep({
    id: "validate-plan",
    inputSchema: analysisRequestSchema,
    outputSchema: analysisRequestSchema,
    execute: async ({ inputData, requestContext }) => {
      const session = sessionFrom(requestContext);
      session.emit({
        type: "progress",
        stage: "validating",
        workflowId: "grounded-analysis",
        workflowRunId: session.workflowRunId!,
      });
      try {
        validatePlan(inputData, session.descriptor);
      } catch (error) {
        session.failure = error as SourceError;
        throw error;
      }
      return inputData;
    },
  });
  const read = createStep({
    id: "read-source",
    inputSchema: analysisRequestSchema,
    outputSchema: verifiedResultSchema,
    execute: async ({ inputData, requestContext }) => {
      const session = sessionFrom(requestContext);
      const queryId = randomUUID();
      const started = Date.now();
      const controller = new AbortController();
      const abort = () => controller.abort(session.controller.signal.reason);
      session.controller.signal.addEventListener("abort", abort, { once: true });
      const timer = setTimeout(
        () =>
          controller.abort(
            new SourceError("timeout", "The source read timed out. Narrow the question and retry."),
          ),
        Math.max(1, Math.min(LIMITS.queryMs, session.deadline - Date.now())),
      );
      const context: SourceExecutionContext = {
        signal: controller.signal,
        deadline: Math.min(session.deadline, started + LIMITS.queryMs),
        maxRows: LIMITS.rows,
        maxBytes: LIMITS.bytes,
        requestId: session.question.requestId,
        queryId,
        traceId: session.traceId,
        trackCleanup: (promise) => session.cleanups.push(promise),
      };
      try {
        let raw: unknown;
        for (let attempt = 0; ; attempt++) {
          controller.signal.throwIfAborted();
          session.emit({
            type: "progress",
            stage: attempt === 0 ? "reading" : "retrying",
            queryId,
            workflowId: "grounded-analysis",
            workflowRunId: session.workflowRunId!,
          });
          try {
            raw = await bounded(
              session.source.execute(structuredClone(inputData), context),
              controller.signal,
            );
            break;
          } catch (error) {
            if (
              !(error instanceof SourceError) ||
              !error.retryable ||
              !["rate-limit", "source-unavailable"].includes(error.code) ||
              attempt >= LIMITS.readRetries ||
              controller.signal.aborted
            )
              throw error;
          }
        }
        controller.signal.throwIfAborted();
        sessionFrom(requestContext);
        session.emit({
          type: "progress",
          stage: "verifying",
          queryId,
          workflowId: "grounded-analysis",
          workflowRunId: session.workflowRunId!,
        });
        if (Buffer.byteLength(JSON.stringify(raw)) > LIMITS.bytes)
          throw new SourceError(
            "incomplete-result",
            "The source exceeded the result byte limit. Narrow the analysis.",
          );
        const descriptor = session.descriptor;
        const capability = descriptor.capabilities.find(
          (item) => item.metric === inputData.metric,
        )!;
        const parsed = resultSchemaFor(capability).safeParse(raw);
        if (!parsed.success)
          throw new SourceError(
            "invalid-result",
            "The source returned malformed analytical data. Check the connector before retrying.",
          );
        const data = parsed.data;
        // Narrative assumptions belong to versioned server capabilities, not connector output.
        if (data.details) delete data.details.assumption;
        if (data.provenance.sourceId !== descriptor.id)
          throw new SourceError(
            "invalid-result",
            "The result source does not match the selected source.",
          );
        if (
          data.provenance.sourceVersion !== descriptor.version ||
          data.provenance.datasetVersion !== descriptor.datasetVersion ||
          data.provenance.metricVersion !== descriptor.metricVersion ||
          data.provenance.asOf !== descriptor.asOf ||
          !isDeepStrictEqual(data.provenance.coverage, descriptor.coverage)
        )
          throw new SourceError(
            "invalid-result",
            "The result source versions or clock changed. Reopen the source and retry.",
          );
        if (
          data.metric !== inputData.metric ||
          !isDeepStrictEqual(data.request, inputData) ||
          (inputData.period && !isDeepStrictEqual(data.period, inputData.period)) ||
          (inputData.horizon && !isDeepStrictEqual(data.period, inputData.horizon)) ||
          (inputData.asOf &&
            !inputData.horizon &&
            data.period &&
            (data.period.start !== inputData.asOf ||
              data.period.end !==
                new Date(new Date(`${inputData.asOf}T00:00:00Z`).getTime() + 86400000)
                  .toISOString()
                  .slice(0, 10)))
        )
          throw new SourceError(
            "invalid-result",
            "The result does not match the requested metric, period and filters.",
          );
        if (!data.provenance.complete || resultRecordCount(data) > LIMITS.rows)
          throw new SourceError(
            "incomplete-result",
            "The source returned incomplete or oversized data. Partial totals are unavailable.",
          );
        const result = verifiedResultSchema.parse({
          resultId: randomUUID(),
          queryId,
          workflowId: "grounded-analysis",
          workflowRunId: session.workflowRunId!,
          requestId: session.question.requestId,
          workspaceId: session.question.workspaceId,
          threadId: session.question.threadId,
          baseRevision: session.question.baseRevision,
          traceId: session.traceId,
          data,
          checks: [
            "schema",
            "identity",
            "versions",
            "request",
            "unit",
            "completeness",
            "calculation",
          ],
          elapsedMs: Date.now() - started,
          explanation: explain(data, capability),
        });
        sessionFrom(requestContext);
        session.results.push(result);
        return result;
      } catch (error) {
        session.failure =
          error instanceof SourceError
            ? error
            : new SourceError(
                "source-unavailable",
                "The source read failed. Check the connector and retry.",
              );
        throw session.failure;
      } finally {
        clearTimeout(timer);
        session.controller.signal.removeEventListener("abort", abort);
      }
    },
  });
  return createWorkflow({
    id: "grounded-analysis",
    inputSchema: analysisRequestSchema,
    outputSchema: verifiedResultSchema,
    options: { shouldPersistSnapshot: () => false },
  })
    .then(validate)
    .then(read)
    .commit();
}
