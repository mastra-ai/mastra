import { registerApiRoute } from "@mastra/core/server";
import { computeMonitoringSummary } from "../lib/monitoring";
import {
  intercomBinding,
  intercomDevelopmentConfig,
} from "../providers/intercom/config";
import {
  errorResponseSchema,
  monitoringSummarySchema,
  reindexRequestSchema,
  reindexResponseSchema,
  supportOpenApiDocument,
} from "./contracts";
import { requireRole } from "./route-context";

export const supportOpenApiRoute = registerApiRoute("/support/openapi.json", {
  method: "GET",
  handler: async (c) => c.json(supportOpenApiDocument),
});

/**
 * GET /support/monitoring/summary
 *
 * Aggregates the metrics called out in this template's brief: containment rate, escalation
 * rate, refund approvals, customer feedback, token cost, and slow/failing tools. The funnel,
 * refund, and feedback numbers come straight from the case store; token usage and tool
 * latency/reliability are derived from the spans Mastra already records for every agent and
 * tool call, read via the observability storage domain (see `src/mastra/lib/monitoring.ts`).
 */
export const supportMonitoringSummaryRoute = registerApiRoute(
  "/support/monitoring/summary",
  {
    method: "GET",
    handler: async (c) => {
      const current = requireRole(c, "admin");
      if (current instanceof Response) return current;
      const mastra = c.get("mastra");
      const summary = await computeMonitoringSummary(mastra, current.tenantId);
      return c.json(monitoringSummarySchema.parse(summary));
    },
  },
);

export const supportKnowledgeReindexRoute = registerApiRoute(
  "/support/knowledge/reindex",
  {
    method: "POST",
    handler: async (c) => {
      const current = requireRole(c, "admin");
      if (current instanceof Response) return current;
      const reindexInput = reindexRequestSchema.safeParse(
        await c.req.json().catch(() => ({})),
      );
      if (!reindexInput.success)
        return c.json(
          errorResponseSchema.parse({ error: "Invalid reindex request." }),
          400,
        );
      const mastra = c.get("mastra");
      const workflow = mastra.getWorkflow("indexSupportKnowledgeWorkflow");
      const run = await workflow.createRun();
      const intercom = intercomDevelopmentConfig();
      const binding =
        intercom?.knowledgeEnabled && intercom.tenantId === current.tenantId
          ? intercomBinding(intercom, `reindex:${current.id}`)
          : {
              tenantId: current.tenantId,
              providerKind: "local" as const,
              providerAccountId: "local-demo",
              externalConversationId: `reindex:${current.id}`,
            };
      const result = await run.start({
        inputData: {
          binding,
          ...(reindexInput.data.validation
            ? { validation: reindexInput.data.validation }
            : {}),
        },
        requestContext: c.get("requestContext"),
      });
      if (result.status !== "success") {
        return c.json(
          errorResponseSchema.parse({ error: "Indexing failed." }),
          500,
        );
      }
      return c.json(reindexResponseSchema.parse(result.result));
    },
  },
);
