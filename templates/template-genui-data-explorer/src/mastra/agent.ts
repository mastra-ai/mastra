import { randomUUID } from "node:crypto";
import { Agent } from "@mastra/core/agent";
import { createTool } from "@mastra/core/tools";
import type { MastraModelConfig } from "@mastra/core/llm";
import type { Memory } from "@mastra/memory";
import { analysisToolSchema, SourceError, hasAvailableData } from "../../data-sources/source.ts";
import type { SourceDescriptor } from "../../data-sources/source.ts";
import {
  agentCatalog,
  compositionSchema,
  compositionInputSchema,
  validateComposition,
} from "../ui/catalog.ts";
import { z } from "zod";
import type { ComponentDeclaration } from "../ui/catalog.ts";
import { LIMITS, representationSchema, representation } from "../analysis/contracts.ts";
import { sessionFrom } from "../analysis/workflow.ts";
import type { analyticalWorkflow, Session } from "../analysis/workflow.ts";

export function explorerAgent(
  workflow: ReturnType<typeof analyticalWorkflow>,
  descriptor: SourceDescriptor,
  model: MastraModelConfig,
  catalog: readonly ComponentDeclaration[],
  options: { catalog?: readonly ComponentDeclaration[]; memory?: Memory },
) {
  const analyze = createTool({
    id: "analyze",
    description:
      "Execute a supported typed read-only metric. The server chooses the source, clock and limits. Never submit SQL, paths or numeric facts.",
    inputSchema: analysisToolSchema(descriptor),
    outputSchema: representationSchema,
    execute: async (inputData, context) => {
      const session = sessionFrom(context?.requestContext);
      if (++session.steps > LIMITS.steps) {
        session.failure = new SourceError(
          "budget-exceeded",
          "The analysis reached its model/tool step limit. Ask a smaller question.",
        );
        throw session.failure;
      }
      try {
        const run = await workflow.createRun({
          runId: randomUUID(),
          shouldPersistSnapshot: () => false,
        });
        session.workflowRunId = run.runId;
        const output = await run.start({ inputData, requestContext: context?.requestContext });
        if (output.status !== "success")
          throw (
            session.failure ??
            new SourceError(
              "invalid-input",
              "The analytical workflow could not complete this request.",
            )
          );
        sessionFrom(context?.requestContext);
        const view = representation(output.result, session.descriptor);
        return {
          ...view,
          ...(options.catalog
            ? {
                compatibleComponents: catalog
                  .filter(
                    (entry) =>
                      entry.enabled &&
                      entry.roles.includes(view.role) &&
                      entry.units.includes(view.unit),
                  )
                  .map(({ id, version, kind }) => ({ id, version, kind })),
              }
            : {}),
        };
      } catch (error) {
        session.failure =
          error instanceof SourceError
            ? error
            : new SourceError(
                "invalid-result",
                "The analytical workflow failed. Check the source and retry.",
              );
        throw session.failure;
      }
    },
  });

  const compose = (inputSchema: z.ZodType = compositionSchema) =>
    createTool({
      id: "compose",
      description:
        "Choose enabled UI components bound only to verified analyze result IDs. No numeric facts, code or URLs. Charts need x/y column bindings. Preserve unrelated cards by adding components.",
      inputSchema,
      outputSchema: compositionSchema,
      execute: async (input, context) => {
        const session = sessionFrom(context?.requestContext);
        if (++session.steps > LIMITS.steps)
          throw new SourceError("budget-exceeded", "The composition exceeded the step limit.");
        try {
          session.composition = validateComposition(input, session.results, catalog);
          return session.composition;
        } catch (error) {
          session.failure = new SourceError(
            "invalid-result",
            error instanceof z.ZodError
              ? "Invalid UI composition: component properties do not match the registered view contract."
              : error instanceof Error
                ? `Invalid UI composition: ${error.message}`
                : "Invalid UI composition. Select an enabled view compatible with the verified result.",
          );
          throw session.failure;
        }
      },
    });
  return new Agent({
    id: "data-explorer",
    name: "Data Explorer",
    model,
    maxRetries: 0,
    instructions: ({ requestContext }) =>
      [
        "Select supported metrics with analyze. Use the source's saved clock for relative questions. Ask for clarification when ambiguous. Never claim causation from descriptive data, supply raw SQL, or invent facts. Return only a brief nonnumeric acknowledgement after tool calls.",
        "For the included Sales source, sales means bookings (closed-won contract value), not MRR or recognized revenue. Last month means the final complete month in the source's saved coverage. A chart request needs a supported grouped result, even for one month: use month for a trend or a requested category for a comparison. A scalar alone cannot satisfy a chart request. For monthly customer or revenue churn, use groupBy=month; each month uses its own starting population. For customer retention cohorts use cohortRetention; for a cohort chart of customer churn use cohortChurn. Both use groupBy=cohort and first activation cohorts with continuous retention: cancelled members never return, reactivation is separate. A cohort matrix cannot be replaced with aggregate churn. Cohort dates select activation months; ages stop at the requested period end. Subscription cohorts do not support opportunity segment filters or revenue-retention cohorts.",
        "Periods are start-inclusive and end-exclusive. For the last N complete months, if coverage.end is the first of a month, use it as the exclusive end and subtract N calendar months for the start. Do not use the inclusive asOf day as a period end. Prefer source example periods for matching relative questions.",
        "Use only fields advertised for the chosen metric. Unused fields must be absent/null, including records; records is true only for record inspection. Apply a requested segment/owner/region as filters, not as a grouping substitute. A total for one segment needs its filter and no groupBy unless a breakdown is requested.",
        ...(options.catalog
          ? [
              "After analyzing, use compose with the exact resultId, role, columns[].key and grouping returned by analyze. Choose only from that result's compatibleComponents list. Do not invent column names from metric names or column labels. Prefer line for series, bar for ranked, heatmap for matrix, table for records, metric for scalar. Line/bar charts use x=returned grouping and y=the compatible numeric column key. Heatmaps use x=returned axes.x, y=returned axes.y, value=returned axes.value. Scalar/table views have no x, y or value. Empty columns mean no chart axes exist: use a scalar component, including for a forecast. Titles must be short metric labels WITHOUT digits or dates; periods are displayed separately. Never abbreviate or corrupt a requested period to bypass the title rule. Set scenario=true for forecasts. Unused properties are absent/null. Refine accepted card IDs to replace them; new IDs add cards.",
            ]
          : []),
        `Source descriptor: ${JSON.stringify(descriptor)}`,
        ...(options.catalog ? [`Enabled catalog: ${JSON.stringify(agentCatalog(catalog))}`] : []),
        `Accepted workspace context: ${JSON.stringify((requestContext?.has("analysis-session") ? sessionFrom(requestContext).accepted : undefined) ?? { revision: 0, components: [] })}`,
        ...(requestContext?.has("analysis-session") && sessionFrom(requestContext).correctionTarget
          ? [
              "This request corrects the selected view. Compose exactly one component using the correction target's existing ID, even when changing renderer. Preserve every other accepted view.",
              `Correction target: ${JSON.stringify(sessionFrom(requestContext).correctionTarget)}`,
            ]
          : []),
      ].join("\n"),
    tools: { analyze, ...(options.catalog ? { compose: compose() } : {}) },
    ...(options.memory ? { memory: options.memory } : {}),
    defaultOptions: ({ requestContext }) => ({
      maxSteps: LIMITS.steps,
      toolCallConcurrency: 1,
      modelSettings: {
        maxOutputTokens: LIMITS.responseTokens,
        maxRetries: 0,
        timeout: { totalMs: LIMITS.analysisMs },
      },
      onFinish: ({ finishReason, usage }) => {
        const session = sessionFrom(requestContext);
        session.telemetry?.record({
          type: "provider-usage",
          requestId: session.question.requestId,
          workspaceId: session.question.workspaceId,
          traceId: session.traceId,
          model:
            typeof model === "string"
              ? model
              : "modelId" in model
                ? model.modelId
                : "configured-model",
          ...(typeof usage.inputTokens === "number" ? { inputTokens: usage.inputTokens } : {}),
          ...(typeof usage.outputTokens === "number" ? { outputTokens: usage.outputTokens } : {}),
        });
        if (finishReason === "length" || finishReason === "tool-calls")
          session.failure = new SourceError(
            "budget-exceeded",
            "The model exhausted its response or step budget. Ask a smaller question.",
          );
        else if (
          options.catalog &&
          !session.failure &&
          !session.composition &&
          session.results.length &&
          session.results.every((result) => hasAvailableData(result.data, session.descriptor))
        )
          session.failure = new SourceError(
            "invalid-composition",
            "No validated UI composition was selected. Ask for a supported view and retry.",
          );
      },
      prepareStep: () => {
        const session = sessionFrom(requestContext);
        session.controller.signal.throwIfAborted();
        if (++session.steps > LIMITS.steps) {
          session.failure = new SourceError(
            "budget-exceeded",
            "The analysis reached its model/tool step limit.",
          );
          throw session.failure;
        }
        if (
          options.catalog &&
          !session.composition &&
          session.results.length &&
          session.results.every((result) => hasAvailableData(result.data, session.descriptor))
        )
          return {
            toolChoice: "required" as const,
            tools: {
              analyze,
              compose: compose(compositionInputSchema(session.results, catalog)),
            },
          };
        return {};
      },
    }),
  });
}
