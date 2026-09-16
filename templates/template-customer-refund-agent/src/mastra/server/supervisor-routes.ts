import { registerApiRoute } from "@mastra/core/server";
import { resourceIdForOwner, threadIdForCase } from "../domain/support-case";
import {
  budgetedLanguageModel,
  createValidationBudgetExecution,
  validationBudgetRequestContextKey,
} from "../lib/eval-budget";
import { caseStore } from "../lib/case-store";
import { withTrustedCaseReadScope } from "../lib/trusted-run-scope";
import { bindingsForCase } from "../providers/contracts";
import { canAccessCase, hasRole } from "./auth";
import {
  errorResponseSchema,
  supervisorExecutionRequestSchema,
  supervisorExecutionResponseSchema,
} from "./contracts";
import { requirePrincipal } from "./route-context";

function correlationIdFromError(
  error: unknown,
  seen = new Set<object>(),
): string | undefined {
  if (!error || typeof error !== "object") return undefined;
  if (seen.has(error)) return undefined;
  seen.add(error);
  const value = error as Record<string, unknown>;
  for (const key of ["traceId", "trace_id"])
    if (typeof value[key] === "string") return value[key];
  // Mastra and transport wrappers preserve the native failure as a cause or
  // contextual record. Follow only those structured diagnostic links; never
  // scrape message text, which could contain customer content.
  for (const key of ["cause", "context", "details", "error"])
    if (value[key]) {
      const traceId = correlationIdFromError(value[key], seen);
      if (traceId) return traceId;
    }
  return undefined;
}

export const supportCaseSupervisorRoute = registerApiRoute(
  "/support/cases/:caseId/supervisor",
  {
    method: "POST",
    handler: async (c) => {
      const current = requirePrincipal(c);
      if (current instanceof Response) return current;
      if (!hasRole(current, "support-agent") && !hasRole(current, "admin"))
        return c.json(
          errorResponseSchema.parse({ error: "Insufficient authority." }),
          403,
        );
      const supportCase = await caseStore.get(c.req.param("caseId"));
      if (!supportCase) return c.json({ error: "Case not found." }, 404);
      if (!canAccessCase(current, supportCase))
        return c.json(
          errorResponseSchema.parse({ error: "Case access denied." }),
          403,
        );
      let input: unknown;
      try {
        input = await c.req.json();
      } catch {
        return c.json(
          errorResponseSchema.parse({ error: "Invalid supervisor request." }),
          400,
        );
      }
      const parsed = supervisorExecutionRequestSchema.safeParse(input);
      if (!parsed.success)
        return c.json(
          errorResponseSchema.parse({ error: "Invalid supervisor request." }),
          400,
        );
      const ownerId = supportCase.metadata.ownerId;
      if (typeof ownerId !== "string" || !ownerId)
        return c.json(
          errorResponseSchema.parse({ error: "Case has no verified owner." }),
          409,
        );
      const binding = bindingsForCase(supportCase).support;
      const validation = parsed.data.validation
        ? createValidationBudgetExecution(parsed.data.validation.mode)
        : undefined;
      const requestContext = c.get("requestContext");
      if (validation)
        requestContext.setRaw(validationBudgetRequestContextKey, validation);
      const supervisor = c.get("mastra").getAgent("supportSupervisorAgent");
      // Supplying the native run ID lets us retain a trustworthy association
      // even when a generation fails before Mastra can return a trace ID.
      const supervisorRunId = `supervisor_${crypto.randomUUID()}`;
      const supervisorThreadId = threadIdForCase(
        supportCase.id,
        binding.tenantId,
      );
      const model = validation
        ? budgetedLanguageModel(
            (await supervisor.getModel({ requestContext })) as never,
            validation,
          )
        : undefined;
      // Mastra's final aggregate omits failed tool calls after the model
      // recovers with a text response. Capture the supported native iteration
      // result so the authenticated staff response reports both successful
      // evidence and a denied read without fabricating either outcome.
      const observedToolResults: Array<{
        name: string;
        result: unknown;
        error?: Error;
      }> = [];
      let validationError: Error | undefined;
      let result: Awaited<ReturnType<typeof supervisor.generate>> | undefined;
      let generationError: Error | undefined;
      try {
        result = await withTrustedCaseReadScope(
          { caseId: supportCase.id, ownerId, tenantId: binding.tenantId },
          () =>
            c
              .get("mastra")
              .getAgent("supportSupervisorAgent")
              .generate(
                [
                  {
                    role: "user",
                    content: `Investigate this existing support case read-only. Case subject: ${supportCase.subject}. Customer: ${supportCase.customer.email}. Request: ${parsed.data.message}`,
                  },
                ],
                {
                  memory: {
                    thread: supervisorThreadId,
                    resource: resourceIdForOwner(ownerId, binding.tenantId),
                  },
                  runId: supervisorRunId,
                  requestContext,
                  ...(model
                    ? {
                        model,
                      }
                    : {}),
                  delegation: {
                    ...(model
                      ? {
                          onDelegationStart: () => ({
                            proceed: false,
                            rejectionReason:
                              "Budgeted supervisor validation does not permit delegated model calls.",
                          }),
                        }
                      : {}),
                    // Native delegation preserves each specialist's actual tool
                    // outcomes here. Expose those read-only observations beside
                    // the parent delegation result so staff and acceptance tests
                    // can distinguish a completed delegation from one that
                    // merely returned prose without exercising its evidence.
                    onDelegationComplete: ({ primitiveId, result }) => {
                      observedToolResults.push(
                        ...(result.subAgentToolResults ?? []).map((entry) => ({
                          name: `${primitiveId}.${entry.toolName}`,
                          result: entry.result,
                        })),
                      );
                    },
                  },
                  onIterationComplete: ({ toolResults }) => {
                    observedToolResults.push(...toolResults);
                  },
                },
              ),
        );
      } catch (error) {
        generationError =
          error instanceof Error ? error : new Error(String(error));
        validationError = generationError;
      }
      if (!result) {
        await caseStore.recordSupervisorExecution({
          tenantId: binding.tenantId,
          caseId: supportCase.id,
          threadId: supervisorThreadId,
          actorId: current.id,
          runId: supervisorRunId,
          traceId: correlationIdFromError(generationError),
          state: "failed",
        });
        if (!validation) throw generationError;
        return c.json(
          errorResponseSchema.parse({
            error: `Validation budget blocked: ${validationError?.message ?? "unknown error"}`,
          }),
          422,
        );
      }
      // Wait for the native aggregate before persisting correlation or sending
      // the HTTP response. This closes the generation's span/export path;
      // retaining a trace ID before its native execution settles would make a
      // durable association point at a transient, undiscoverable trace.
      const responseText = await result.text;
      await caseStore.recordSupervisorExecution({
        tenantId: binding.tenantId,
        caseId: supportCase.id,
        threadId: supervisorThreadId,
        actorId: current.id,
        runId: supervisorRunId,
        traceId: result.traceId,
        state: "completed",
      });
      // The run remains durably visible as partial telemetry, but never claim
      // a trace ID we did not receive from the native runtime.
      if (!result.traceId)
        return c.json(
          errorResponseSchema.parse({
            error:
              "Supervisor completed without an observable trace correlation.",
          }),
          503,
        );
      const toolResults = observedToolResults.map((entry) => ({
        toolName: entry.name,
        result: entry.error ? { error: entry.error.message } : entry.result,
        // Registered read tools and delegated specialist tools have object
        // output schemas. Mastra materializes a thrown tool error as its
        // message string in the native hook rather than setting `error`.
        isError: Boolean(entry.error) || typeof entry.result === "string",
      }));
      return c.json(
        supervisorExecutionResponseSchema.parse({
          text: responseText,
          traceId: result.traceId,
          toolNames: toolResults.map((entry) => entry.toolName),
          toolResults,
        }),
      );
    },
  },
);
