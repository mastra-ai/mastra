import { registerApiRoute } from "@mastra/core/server";
import { caseStore, isRetentionTombstone } from "../lib/case-store";
import { canAccessCase, hasRole } from "./auth";
import {
  errorResponseSchema,
  inboundSupportResponseSchema,
  mockEmailPayloadSchema,
} from "./contracts";
import { requirePrincipal } from "./route-context";

/**
 * POST /support/inbound
 *
 * The single inbound endpoint accepts the built-in mock email payload. External support adapters
 * are deliberately absent from this Phase 001 baseline; a configured unsupported source returns
 * a clear diagnostic from the workflow rather than falling back to mock.
 */
export const supportInboundRoute = registerApiRoute("/support/inbound", {
  method: "POST",
  handler: async (c) => {
    const actor = requirePrincipal(c);
    if (actor instanceof Response) return actor;
    const rawBody = await c.req.text();

    let rawPayload: unknown;
    try {
      rawPayload = JSON.parse(rawBody);
    } catch {
      return c.json(
        errorResponseSchema.parse({ error: "Invalid JSON body." }),
        400,
      );
    }
    const payloadResult = mockEmailPayloadSchema.safeParse(rawPayload);
    if (!payloadResult.success) {
      return c.json(
        errorResponseSchema.parse({ error: "Invalid mock inbound payload." }),
        400,
      );
    }
    const isCustomer = hasRole(actor, "customer");
    if (!isCustomer && !hasRole(actor, "support-agent"))
      return c.json(
        errorResponseSchema.parse({ error: "Insufficient authority." }),
        403,
      );
    // The only built-in inbound adapter is the local-demo support account.
    // Reject a signed identity from another tenant before it can allocate a
    // workflow run or ask the normalizer to interpret its payload.
    if (actor.tenantId !== "local-demo")
      return c.json(
        errorResponseSchema.parse({ error: "Case access denied." }),
        403,
      );
    // A customer may create only their own conversation.  The body email is
    // normalized input, never a claim of another customer's identity.
    if (
      isCustomer &&
      payloadResult.data.from.toLowerCase() !== actor.email.toLowerCase()
    )
      return c.json(
        errorResponseSchema.parse({ error: "Case access denied." }),
        403,
      );
    const conversationId =
      typeof payloadResult.data.conversationId === "string"
        ? payloadResult.data.conversationId
        : undefined;
    if (conversationId) {
      const existing = await caseStore.findConversation(
        actor.tenantId,
        conversationId,
      );
      if (existing && !canAccessCase(actor, existing))
        return c.json(
          errorResponseSchema.parse({ error: "Case access denied." }),
          403,
        );
      if (existing && isRetentionTombstone(existing))
        return c.json(
          errorResponseSchema.parse({
            error: "This expired support case cannot accept new content.",
          }),
          410,
        );
    }

    const mastra = c.get("mastra");
    const ingestWorkflow = mastra.getWorkflow("ingestSupportCaseWorkflow");
    const run = await ingestWorkflow.createRun();

    let result;
    try {
      result = await run.start({
        inputData: {
          payload: payloadResult.data,
          ingress: {
            id: actor.id,
            email: actor.email,
            tenantId: actor.tenantId,
            roles: actor.roles,
          },
        },
        requestContext: c.get("requestContext"),
      });
    } catch (error) {
      return c.json(
        errorResponseSchema.parse({
          error: error instanceof Error ? error.message : String(error),
        }),
        400,
      );
    }

    if (result.status !== "success") {
      return c.json(
        errorResponseSchema.parse({ error: "Ingestion failed." }),
        500,
      );
    }

    return c.json(
      inboundSupportResponseSchema.parse({
        caseId: result.result.caseId,
        workflowRunId: result.result.workflowRunId,
        status: "processing",
      }),
    );
  },
});
