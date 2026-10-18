import type { TelemetrySink } from "../observability/telemetry.ts";
import { randomUUID } from "node:crypto";
import { RequestContext } from "@mastra/core/request-context";
import { createStep, createWorkflow } from "@mastra/core/workflows";
import { analysisRequestSchema, SourceError, validFilterValue } from "../../data-sources/source.ts";
import type {
  AnalysisRequest,
  DataSource,
  SourceDescriptor,
  SourceExecutionContext,
} from "../../data-sources/source.ts";
import { verifySourceResult } from "./verification.ts";
import { explain, LIMITS, verifiedResultSchema } from "./contracts.ts";
import type { AnalysisEvent, Question, VerifiedResult } from "./contracts.ts";

export interface Session {
  telemetry?: TelemetrySink | undefined;
  question: Question;
  source: DataSource;
  descriptor: SourceDescriptor;
  controller: AbortController;
  deadline: number;
  traceId: string;
  results: VerifiedResult[];
  cleanups: Promise<void>[];
  emit: (event: Omit<AnalysisEvent, "requestId" | "workspaceId" | "traceId">) => void;
  modelRounds: number;
  toolCalls: number;
  filters?: AnalysisRequest["filters"];
  composition?: import("../components/catalog.ts").Composition;
  accepted?: import("./composition.ts").AcceptedWorkspace;
  correctionTarget?: import("./composition.ts").AcceptedWorkspace["components"][number];
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
  if (request.groupBy && !capability.groupings?.some((group) => group.field === request.groupBy))
    throw new SourceError("invalid-input", "This source does not support the requested grouping.");
  if (
    Object.entries(request.filters ?? {}).some(
      ([key, value]) => !validFilterValue(capability, key, value),
    )
  )
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
      const capability = session.descriptor.capabilities.find(
        (entry) => entry.metric === inputData.metric,
      );
      // Saved filters apply only to metrics advertising those fields.
      // Explicit tool filters remain intact so unsupported requests still fail validation.
      const inheritedFilters = Object.fromEntries(
        Object.entries(session.filters ?? {}).filter(
          ([field]) => capability?.fields.includes("filters") && capability.filters.includes(field),
        ),
      );
      const plan = {
        ...inputData,
        ...(Object.keys(inheritedFilters).length
          ? { filters: { ...inheritedFilters, ...inputData.filters } }
          : {}),
      };
      try {
        validatePlan(plan, session.descriptor);
        session.telemetry?.record({
          type: "plan-validated",
          requestId: session.question.requestId,
          workspaceId: session.question.workspaceId,
          traceId: session.traceId,
          workflowId: "grounded-analysis",
          workflowRunId: session.workflowRunId!,
          metric: plan.metric,
          operation: JSON.stringify(plan),
        });
      } catch (error) {
        session.failure = error as SourceError;
        throw error;
      }
      return plan;
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
        trackCleanup: (promise) => {
          // Observe rejection immediately, even if the read continues before final cleanup.
          session.cleanups.push(promise.catch(() => {}));
        },
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
          session.telemetry?.record({
            type: "query-attempt",
            requestId: session.question.requestId,
            workspaceId: session.question.workspaceId,
            traceId: session.traceId,
            workflowId: "grounded-analysis",
            workflowRunId: session.workflowRunId!,
            queryId,
            sourceId: session.descriptor.id,
          });
          try {
            raw = await bounded(
              session.source.execute(structuredClone(inputData), context),
              controller.signal,
            );
            session.telemetry?.record({
              type: "query-success",
              requestId: session.question.requestId,
              workspaceId: session.question.workspaceId,
              traceId: session.traceId,
              queryId,
              elapsedMs: Date.now() - started,
            });
            break;
          } catch (error) {
            session.telemetry?.record({
              type: "query-failure",
              requestId: session.question.requestId,
              workspaceId: session.question.workspaceId,
              traceId: session.traceId,
              queryId,
              status: error instanceof SourceError ? error.code : "source-unavailable",
              elapsedMs: Date.now() - started,
            });
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
        const { data, capability } = verifySourceResult(
          raw,
          inputData,
          session.descriptor,
          LIMITS.bytes,
          LIMITS.rows,
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
        session.telemetry?.record({
          type: "calculation-verified",
          requestId: session.question.requestId,
          workspaceId: session.question.workspaceId,
          traceId: session.traceId,
          queryId,
          resultId: result.resultId,
          metric: data.metric,
          operation: JSON.stringify(data.provenance.operations),
        });
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
