import { registerApiRoute } from "@mastra/core/server";
import { caseStore } from "../lib/case-store";
import { bindingsForCase } from "../providers/contracts";
import { intercomDevelopmentConfig } from "../providers/intercom/config";
import {
  isCustomerConversationEvent,
  isAdminClosedConversationEvent,
  MAX_INTERCOM_WEBHOOK_BYTES,
  verifyIntercomWebhook,
} from "../providers/intercom/webhook";
import { providerRegistry } from "../providers/registry";
import { StripeProviderRegistry } from "../providers/stripe/registry";
import { stripeSandboxConfig } from "../providers/stripe/config";
import {
  MAX_STRIPE_WEBHOOK_BYTES,
  verifyStripeWebhook,
} from "../providers/stripe/webhook";
import { errorResponseSchema, inboundSupportResponseSchema } from "./contracts";

/** Public by transport necessity only. It verifies raw signed requests before
 * parse. A verified Intercom ping is acknowledged without creating a local
 * identity or workflow run; bound customer notifications alone reach ingest. */
export const intercomWebhookRoute = registerApiRoute(
  "/support/webhooks/intercom",
  {
    method: "POST",
    handler: async (c) => {
      const config = intercomDevelopmentConfig();
      if (!config)
        return c.json(
          errorResponseSchema.parse({ error: "Intercom is not enabled." }),
          404,
        );
      if (!c.req.raw)
        return c.json(
          errorResponseSchema.parse({
            error: "Webhook transport unavailable.",
          }),
          500,
        );
      const contentLength = c.req.raw.headers.get("content-length");
      const declaredLength =
        contentLength === null ? undefined : Number(contentLength);
      if (
        declaredLength !== undefined &&
        Number.isFinite(declaredLength) &&
        (declaredLength <= 0 || declaredLength > MAX_INTERCOM_WEBHOOK_BYTES)
      )
        return c.json(
          errorResponseSchema.parse({ error: "Invalid Intercom webhook." }),
          413,
        );
      let raw: Uint8Array;
      try {
        raw = await readWebhookBody(c.req.raw, MAX_INTERCOM_WEBHOOK_BYTES);
      } catch (error) {
        return c.json(
          errorResponseSchema.parse({ error: "Invalid Intercom webhook." }),
          error instanceof WebhookTooLargeError ? 413 : 400,
        );
      }
      let event;
      try {
        event = verifyIntercomWebhook(raw, c.req.raw.headers, config);
      } catch {
        return c.json(
          errorResponseSchema.parse({ error: "Invalid Intercom webhook." }),
          401,
        );
      }
      // Intercom's setup ping has no conversation ID. It is still authenticated,
      // account-scoped, and fresh at this point, but must never create a binding
      // or trigger workflow/remote effects.
      if (event.kind === "ping")
        return c.json({ accepted: true, ignored: true });
      if (isAdminClosedConversationEvent(event)) {
        const receipt = await caseStore.recordIntercomCloseIntent({
          tenantId: event.binding.tenantId,
          providerAccountId: event.binding.providerAccountId,
          eventId: event.id,
          externalConversationId: event.binding.externalConversationId,
        });
        // The worker, not the webhook handler, obtains a fresh Conversation
        // state. The signed payload is never used as close authority.
        return c.json({ accepted: true, duplicate: !receipt.accepted });
      }
      // Admin replies/notes and all non-customer events are acknowledged but
      // cannot feed a self-generated reply loop.
      if (!isCustomerConversationEvent(event))
        return c.json({ accepted: true, ignored: true });
      const mastra = c.get("mastra");
      const run = await mastra
        .getWorkflow("ingestSupportCaseWorkflow")
        .createRun();
      try {
        const result = await run.start({
          inputData: {
            payload: event,
            verifiedProvider: { kind: "intercom", event },
          },
          requestContext: c.get("requestContext"),
        });
        if (result.status !== "success") throw new Error("inbound failed");
        return c.json(
          inboundSupportResponseSchema.parse({
            caseId: result.result.caseId,
            workflowRunId: result.result.workflowRunId,
            status: "processing",
          }),
        );
      } catch {
        // Return retryable status only after verification.  The event ID is
        // durably deduplicated by the same transaction as case acceptance.
        return c.json(
          errorResponseSchema.parse({ error: "Intercom ingestion failed." }),
          503,
        );
      }
    },
  },
);

/** Stripe events reconcile an already-approved durable attempt. They cannot
 * create a command, choose an account, or turn an unrelated valid event into
 * a financial effect. A fresh GET is the arbiter for reordered events. */
export const stripeWebhookRoute = registerApiRoute("/support/webhooks/stripe", {
  method: "POST",
  handler: async (c) => {
    const config = stripeSandboxConfig();
    if (!config)
      return c.json(
        errorResponseSchema.parse({ error: "Stripe is not enabled." }),
        404,
      );
    if (!c.req.raw)
      return c.json(
        errorResponseSchema.parse({ error: "Webhook transport unavailable." }),
        500,
      );
    const contentLength = c.req.raw.headers.get("content-length");
    const length = contentLength === null ? undefined : Number(contentLength);
    if (
      length !== undefined &&
      Number.isFinite(length) &&
      (length <= 0 || length > MAX_STRIPE_WEBHOOK_BYTES)
    )
      return c.json(
        errorResponseSchema.parse({ error: "Invalid Stripe webhook." }),
        413,
      );
    let raw: Uint8Array;
    try {
      raw = await readWebhookBody(c.req.raw, MAX_STRIPE_WEBHOOK_BYTES);
    } catch {
      return c.json(
        errorResponseSchema.parse({ error: "Invalid Stripe webhook." }),
        400,
      );
    }
    let event;
    try {
      event = verifyStripeWebhook(raw, c.req.raw.headers, config);
    } catch {
      return c.json(
        errorResponseSchema.parse({ error: "Invalid Stripe webhook." }),
        401,
      );
    }
    if (
      !["refund.created", "refund.updated", "refund.failed"].includes(
        event.type,
      )
    )
      return c.json({ accepted: true, ignored: true });
    const object = event.data.object;
    const refundId = typeof object.id === "string" ? object.id : undefined;
    if (!refundId) return c.json({ accepted: true, ignored: true });
    const claim = await caseStore.claimStripeWebhookEvent(event.id);
    if (claim.state === "completed")
      return c.json({ accepted: true, duplicate: true });
    if (claim.state === "in-progress")
      return c.json(
        errorResponseSchema.parse({
          error: "Stripe reconciliation is active.",
        }),
        503,
      );
    try {
      const attempt = await caseStore.stripeRefundAttemptByRefundId(refundId);
      if (
        !attempt ||
        attempt.tenantId !== config.tenantId ||
        attempt.providerAccountId !== config.accountId
      ) {
        if (
          !(await caseStore.completeStripeWebhookEvent(
            event.id,
            claim.leaseToken,
          ))
        )
          throw new Error("Stripe webhook receipt completion was lost.");
        return c.json({ accepted: true, ignored: true });
      }
      const supportCase = await caseStore.get(attempt.caseId);
      if (!supportCase) {
        if (
          !(await caseStore.completeStripeWebhookEvent(
            event.id,
            claim.leaseToken,
          ))
        )
          throw new Error("Stripe webhook receipt completion was lost.");
        return c.json({ accepted: true, ignored: true });
      }
      const binding = bindingsForCase(supportCase).transactions;
      const registry = providerRegistry(binding);
      if (!(registry instanceof StripeProviderRegistry))
        throw new Error("Stripe attempt is not routed to Stripe.");
      const command = attempt.command as { orderId?: string } | undefined;
      if (!command?.orderId)
        throw new Error("Stripe attempt command is missing its order id.");
      const effect = await registry.reconcileRefund(binding, {
        refundId,
        orderId: command.orderId,
        idempotencyKey: attempt.idempotencyKey,
      });
      // This event's freshly retrieved provider state is authoritative for its
      // immutable attempt. Do not hand it to a global due/limit poll, which
      // could skip this row after a prior success scheduled its next audit.
      if (effect.status === "pending" || effect.status === "unknown")
        await caseStore.updateStripeRefundAttempt(attempt.idempotencyKey, {
          status: effect.status === "unknown" ? "unknown" : "pending",
          refundId: effect.refundId,
          providerStatus: effect.providerStatus ?? effect.status,
          nextAttemptAt: new Date(Date.now() + 30_000).toISOString(),
        });
      else
        await caseStore.finalizeStripeRefundReconciliation({
          idempotencyKey: attempt.idempotencyKey,
          status: effect.status === "succeeded" ? "succeeded" : "failed",
          refundId: effect.refundId,
          providerStatus: effect.providerStatus ?? effect.status ?? "unknown",
          effect,
        });
      if (
        !(await caseStore.completeStripeWebhookEvent(
          event.id,
          claim.leaseToken,
        ))
      )
        throw new Error("Stripe webhook receipt completion was lost.");
    } catch {
      // Signed provider delivery remains retryable when the local reconciliation
      // boundary is unavailable. Do not retain raw provider error detail; a
      // later signed delivery can claim the recoverable failed receipt.
      await caseStore.failStripeWebhookEvent(event.id, claim.leaseToken);
      return c.json(
        errorResponseSchema.parse({ error: "Stripe reconciliation failed." }),
        503,
      );
    }
    return c.json({ accepted: true });
  },
});

class WebhookTooLargeError extends Error {}
/** Content-Length is only an early reject. This stream boundary limits chunked
 * and malformed requests before any raw body is retained for HMAC validation. */
export async function readWebhookBody(request: Request, maxBytes: number) {
  if (!request.body) throw new Error("Webhook body is unavailable.");
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const next = await reader.read();
      if (next.done) break;
      size += next.value.byteLength;
      if (size > maxBytes) {
        await reader.cancel().catch(() => undefined);
        throw new WebhookTooLargeError();
      }
      chunks.push(next.value);
    }
  } catch (error) {
    if (error instanceof WebhookTooLargeError) throw error;
    throw new Error("Webhook body could not be read.");
  } finally {
    reader.releaseLock();
  }
  const raw = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    raw.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return raw;
}
