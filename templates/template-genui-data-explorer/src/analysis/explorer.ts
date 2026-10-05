import type { TelemetrySink } from "../observability/telemetry.ts";
import type { Memory } from "@mastra/memory";
import { components, acceptedWorkspace } from "../ui/catalog.ts";
import type { ComponentDeclaration, ComponentBinding } from "../ui/catalog.ts";
import { randomUUID } from "node:crypto";
import { Mastra } from "@mastra/core/mastra";
import { RequestContext } from "@mastra/core/request-context";
import type { MastraModelConfig } from "@mastra/core/llm";
import { sourceDescriptorSchema, SourceError } from "../../data-sources/source.ts";
import type { DataSource, SourceDescriptor } from "../../data-sources/source.ts";
import { analyticalWorkflow, bounded, sessionFrom } from "./workflow.ts";
import type { Session } from "./workflow.ts";
import { explorerAgent } from "../mastra/agent.ts";
import { LIMITS, questionSchema } from "./contracts.ts";
import type { AnalysisEvent, Outcome, VerifiedResult } from "./contracts.ts";

export class DataExplorer {
  readonly mastra: Mastra;
  readonly agent;
  readonly workflow;
  readonly telemetry: TelemetrySink | undefined;
  readonly #catalog: readonly ComponentDeclaration[];
  readonly #source: DataSource;
  readonly #descriptor: SourceDescriptor;
  readonly #active = new Set<string>();
  readonly #lastComplete = new Map<string, readonly VerifiedResult[]>();
  constructor(
    source: DataSource,
    model: MastraModelConfig,
    options: {
      catalog?: readonly ComponentDeclaration[];
      memory?: Memory;
      telemetry?: TelemetrySink;
      mastra?: Mastra;
    } = {},
  ) {
    this.telemetry = options.telemetry;
    this.#catalog = options.catalog ?? components;
    this.#source = source;
    this.#descriptor = sourceDescriptorSchema.parse(source.describe());
    this.workflow = analyticalWorkflow();
    this.agent = explorerAgent(this.workflow, this.#descriptor, model, this.#catalog, options);
    this.mastra =
      options.mastra ??
      new Mastra({
        agents: { dataExplorer: this.agent },
        workflows: { groundedAnalysis: this.workflow },
        logger: false,
      });
    if (options.mastra) {
      this.mastra.addAgent(this.agent, "dataExplorer");
      this.mastra.addWorkflow(this.workflow, "groundedAnalysis");
    }
  }
  describe(): SourceDescriptor {
    return structuredClone(this.#descriptor);
  }
  lastComplete(workspaceId: string): readonly VerifiedResult[] {
    return structuredClone(this.#lastComplete.get(workspaceId) ?? []);
  }
  async analyze(
    input: unknown,
    options: {
      signal?: AbortSignal;
      onEvent?: (event: AnalysisEvent) => void;
      accepted?: { components: readonly ComponentBinding[]; results: readonly VerifiedResult[] };
      filters?: import("../../data-sources/source.ts").AnalysisRequest["filters"];
      execute?: (
        context: RequestContext,
        session: Session,
      ) => Promise<{ finishReason: string | undefined }>;
      onComplete?: (session: Session) => void | Promise<void>;
    } = {},
  ): Promise<Outcome> {
    const started = Date.now();
    const traceId = randomUUID();
    const parsed = questionSchema.safeParse(input);
    const identity = {
      requestId: parsed.success ? parsed.data.requestId : "invalid",
      workspaceId: parsed.success ? parsed.data.workspaceId : "invalid",
      traceId,
    };
    const emit = (event: Omit<AnalysisEvent, "requestId" | "workspaceId" | "traceId">) => {
      try {
        options.onEvent?.({ ...identity, ...event });
      } catch {
        /* A disconnected consumer cannot change execution. */
      }
    };
    this.telemetry?.record({
      type: "analysis-start",
      ...identity,
      threadId: parsed.success ? parsed.data.threadId : "invalid",
      status: options.accepted?.components.length ? "follow-up" : "initial",
      sourceId: this.#descriptor.id,
      datasetVersion: this.#descriptor.datasetVersion,
    });
    const finish = (outcome: Omit<Outcome, "requestId" | "workspaceId" | "traceId">) => {
      const result = { ...identity, ...outcome };
      this.telemetry?.record({
        type: "analysis-end",
        ...identity,
        status: result.status,
        elapsedMs: Date.now() - started,
      });
      if (["rejected", "unsupported"].includes(result.status))
        this.telemetry?.record({ type: "guardrail", ...identity, status: result.status });
      emit({ type: "terminal", outcome: result });
      return result;
    };
    if (!parsed.success)
      return finish({
        status: "rejected",
        code: "invalid-input",
        results: [],
        message:
          "Send a question with valid server request identifiers; SQL, paths and source overrides are unsupported.",
      });
    const question = parsed.data;
    if (this.#active.has(question.workspaceId))
      return finish({
        status: "rejected",
        code: "busy",
        results: [],
        message:
          "An analysis is already active in this workspace. Cancel it or wait for completion.",
      });
    if (
      /\b(SELECT|INSERT|DELETE|DROP|ATTACH|PRAGMA|UPDATE\s+\w+\s+SET|sqlite_master|workspace_store|trace_store)\b/i.test(
        question.question,
      )
    )
      return finish({
        status: "rejected",
        code: "invalid-input",
        results: [],
        message: "Ask for a supported metric. Raw SQL, writes and internal stores are unavailable.",
      });
    if (/\b(why|caus(?:e|ed|ation)|guarantee(?:d)?)\b/i.test(question.question))
      return finish({
        status: "unsupported",
        code: "unsupported",
        results: [],
        message:
          "These descriptive data do not establish causes or guaranteed outcomes. Ask for an observed metric or illustrative scenario.",
      });
    this.#active.add(question.workspaceId);
    const controller = new AbortController();
    const cancel = () =>
      controller.abort(
        new SourceError("cancelled", "Analysis cancelled. The last complete result is preserved."),
      );
    options.signal?.addEventListener("abort", cancel, { once: true });
    if (options.signal?.aborted) cancel();
    const deadline = Date.now() + LIMITS.analysisMs;
    const timer = setTimeout(
      () =>
        controller.abort(
          new SourceError(
            "timeout",
            "The analysis exceeded its overall deadline. Ask a smaller question.",
          ),
        ),
      LIMITS.analysisMs,
    );
    const session: Session = {
      question,
      source: this.#source,
      descriptor: structuredClone(this.#descriptor),
      controller,
      deadline,
      traceId,
      results: [],
      cleanups: [],
      emit,
      steps: 0,
      telemetry: this.telemetry,
      ...(options.filters ? { filters: options.filters } : {}),
    };
    const requestContext = new RequestContext();
    requestContext.set("analysis-session", session);
    requestContext.set("requestId", question.requestId);
    requestContext.set("workspaceId", question.workspaceId);
    requestContext.set("threadId", question.threadId);
    requestContext.set("analysisTraceId", traceId);
    requestContext.set("datasetVersion", this.#descriptor.datasetVersion);
    requestContext.set("identity", "local-demo-user");
    requestContext.set("source", structuredClone(this.#descriptor));
    requestContext.set("limits", LIMITS);
    let outcome: Omit<Outcome, "requestId" | "workspaceId" | "traceId">;
    try {
      controller.signal.throwIfAborted();
      if (options.accepted)
        session.accepted = acceptedWorkspace(
          question.baseRevision,
          options.accepted.components,
          options.accepted.results,
          this.#catalog,
        );
      emit({ type: "progress", stage: "planning" });
      const generated = await bounded(
        options.execute
          ? options.execute(requestContext, session)
          : this.agent.generate(question.question, {
              requestContext,
              abortSignal: controller.signal,
            }),
        controller.signal,
      );
      controller.signal.throwIfAborted();
      if (session.failure) throw session.failure;
      if (generated.finishReason === "length" || generated.finishReason === "tool-calls")
        throw new SourceError(
          "budget-exceeded",
          "The model exhausted its response or step budget. Ask a smaller question.",
        );
      if (!session.results.length)
        outcome = {
          status: "clarification-required",
          results: [],
          message:
            "Choose an advertised metric and a covered period. No verified result was produced.",
        };
      else {
        const unavailable = session.results.find((result) => result.data.status === "unavailable");
        outcome = {
          status: unavailable
            ? unavailable.data.denominator === 0
              ? "empty"
              : "unsupported"
            : "complete",
          results: session.results,
          message: session.results.map((result) => result.explanation).join("\n"),
        };
        if (!unavailable) {
          await options.onComplete?.(session);
          controller.signal.throwIfAborted();
          this.#lastComplete.set(question.workspaceId, structuredClone(session.results));
        }
      }
    } catch (error) {
      const failure = controller.signal.aborted
        ? controller.signal.reason
        : (session.failure ?? error);
      const safe =
        failure instanceof SourceError
          ? failure
          : new SourceError(
              "provider-unavailable",
              "The model provider is unavailable. Check server configuration and retry; no automatic model retry was made.",
            );
      outcome = {
        status:
          safe.code === "cancelled"
            ? "cancelled"
            : safe.code === "unsupported"
              ? "unsupported"
              : safe.code === "invalid-input"
                ? "rejected"
                : "failed",
        code: safe.code,
        results: session.results,
        message: safe.message,
      };
    } finally {
      clearTimeout(timer);
      options.signal?.removeEventListener("abort", cancel);
      // Native workers register their actual close promises. Uncooperative remote reads
      // may continue remotely, but their late results cannot publish into this run.
      await Promise.all(session.cleanups);
      this.#active.delete(question.workspaceId);
    }
    return finish(outcome);
  }
  async *stream(
    input: unknown,
    options: { signal?: AbortSignal } = {},
  ): AsyncGenerator<AnalysisEvent> {
    const queue: AnalysisEvent[] = [];
    let wake: (() => void) | undefined;
    let done = false;
    const controller = new AbortController();
    const cancel = () => controller.abort();
    options.signal?.addEventListener("abort", cancel, { once: true });
    if (options.signal?.aborted) cancel();
    const completion = this.analyze(input, {
      signal: controller.signal,
      onEvent: (event) => {
        queue.push(event);
        wake?.();
      },
    }).finally(() => {
      done = true;
      wake?.();
    });
    try {
      while (!done || queue.length) {
        if (queue.length) yield queue.shift()!;
        else
          await new Promise<void>((resolve) => {
            wake = resolve;
          });
      }
      await completion;
    } finally {
      controller.abort();
      options.signal?.removeEventListener("abort", cancel);
      await completion;
    }
  }
  async close(): Promise<void> {
    await this.#source.close();
  }
}
