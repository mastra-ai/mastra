import type { SupportCase } from "./support-case";

export const safeEscalationResponse =
  "Thanks for your patience. A support specialist needs to review the available information and will follow up shortly.";

/**
 * A customer response is assembled from the current case projection and its
 * selected published evidence.  It deliberately does not render model prose:
 * a draft cannot claim an unconfirmed refund through a paraphrase.
 */
export function renderGroundedSupportResponse(
  supportCase: SupportCase,
  selectedPolicyExcerpts: Array<{ source: string; excerpt: string }>,
) {
  const parts = selectedPolicyExcerpts.flatMap((selected) => {
    const evidence = supportCase.policyMatches?.find(
      (match) =>
        match.source === selected.source || match.title === selected.source,
    );
    return evidence
      ? [`The published ${evidence.title} says: “${selected.excerpt}”`]
      : [];
  });

  const order = supportCase.orderLookup?.order;
  if (order && order.status !== "refunded")
    parts.push(
      `Your order ${order.orderId} is currently recorded as ${order.status}.`,
    );

  const subscription = supportCase.subscriptionLookup?.subscription;
  if (subscription)
    parts.push(
      `Your ${subscription.plan} subscription is currently recorded as ${subscription.status}.`,
    );

  if (parts.length === 0) return safeEscalationResponse;
  return parts.join(" ");
}
