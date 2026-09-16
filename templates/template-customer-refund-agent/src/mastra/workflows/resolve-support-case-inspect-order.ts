import { createStep } from "@mastra/core/workflows";
import {
  orderLookupSchema,
  refundHistorySchema,
  subscriptionLookupSchema,
} from "../domain/support-case";
import { caseStore } from "../lib/case-store";
import { traceOperationalPort } from "../lib/operational-spans";
import { withTrustedCommerceScope } from "../lib/trusted-run-scope";
import {
  ensureProviderFixtures,
  resolveConfiguredBinding,
} from "../providers/registry";
import { bindingsForPersistedCase } from "../runtime/provider-bindings";
import {
  getActiveCaseOrThrow,
  resolveSupportCaseInputSchema,
} from "./resolve-support-case-context";

export const inspectOrderStep = createStep({
  id: "inspect-order",
  description:
    "Looks up the customer's order, subscription, and prior refunds.",
  inputSchema: resolveSupportCaseInputSchema,
  outputSchema: resolveSupportCaseInputSchema,
  execute: async ({ inputData, mastra, requestContext, tracingContext }) => {
    const { supportCase, ownerId } = await getActiveCaseOrThrow(
      inputData.caseId,
      inputData.turnId,
    );
    const bindings = bindingsForPersistedCase(supportCase);
    if (!mastra)
      throw new Error(
        "The resolve workflow must run through a registered Mastra instance.",
      );
    const orderTool = mastra.getTool("lookupOrderTool");
    const subscriptionTool = mastra.getTool("lookupSubscriptionTool");
    const refundHistoryTool = mastra.getTool("lookupCustomerRefundHistoryTool");
    if (
      !orderTool.execute ||
      !subscriptionTool.execute ||
      !refundHistoryTool.execute
    ) {
      throw new Error(
        "A registered commerce lookup tool has no execute function.",
      );
    }
    // Fixture setup is an operational workflow concern. Read tools stay pure
    // so a supervisor investigation cannot seed commerce state.
    await ensureProviderFixtures(resolveConfiguredBinding(bindings.commerce));
    const executeOrder = orderTool.execute;
    const executeSubscription = subscriptionTool.execute;
    const executeRefundHistory = refundHistoryTool.execute;

    return withTrustedCommerceScope(
      {
        caseId: supportCase.id,
        ownerId,
        tenantId: bindings.commerce.tenantId,
      },
      async () => {
        const orderLookup = orderLookupSchema.parse(
          await traceOperationalPort({
            mastra,
            tracingContext,
            kind: "tool",
            operation: "tool.lookup_order",
            run: () =>
              executeOrder(
                {
                  customerEmail: supportCase.customer.email,
                  binding: resolveConfiguredBinding(bindings.commerce),
                },
                { mastra, requestContext, tracingContext },
              ),
          }),
        );

        const subscriptionLookup = subscriptionLookupSchema.parse(
          await traceOperationalPort({
            mastra,
            tracingContext,
            kind: "tool",
            operation: "tool.lookup_subscription",
            run: () =>
              executeSubscription(
                {
                  customerEmail: supportCase.customer.email,
                  binding: resolveConfiguredBinding(bindings.commerce),
                },
                { mastra, requestContext, tracingContext },
              ),
          }),
        );

        if (
          bindings.commerce.providerKind === "stripe" &&
          orderLookup.found &&
          subscriptionLookup.found &&
          supportCase.triage?.intent !== "cancellation"
        )
          throw new Error(
            "Stripe refund target is ambiguous between Checkout and a subscription invoice.",
          );

        // A renewal's paid Invoice/InvoicePayment is a distinct immutable
        // refund target. Never silently fall back to an initial Checkout.
        const refundTargetId =
          orderLookup.order?.orderId ??
          subscriptionLookup.subscription?.refundOrderId;
        const refundHistory = refundTargetId
          ? refundHistorySchema.parse(
              await traceOperationalPort({
                mastra,
                tracingContext,
                kind: "tool",
                operation: "tool.lookup_customer_refund_history",
                run: () =>
                  executeRefundHistory(
                    {
                      orderId: refundTargetId,
                      binding: resolveConfiguredBinding(bindings.commerce),
                    },
                    { mastra, requestContext, tracingContext },
                  ),
              }),
            )
          : { refunds: [] };

        await caseStore.update(supportCase.id, {
          orderLookup,
          subscriptionLookup,
          refundHistory,
        });
        return { caseId: supportCase.id, turnId: inputData.turnId };
      },
    );
  },
});
