import type { PolicyDocument } from "../types.ts";

export const subscriptionCancellationPolicy: PolicyDocument = {
  title: "Subscription Cancellation Policy",
  source: "subscription-cancellation-policy",
  text: `# Subscription Cancellation Policy

- Customers can cancel a subscription at any time. Cancellation takes effect at the end of the current billing period unless the customer explicitly asks for an immediate cancellation with a prorated refund.
- If a customer explicitly says they do not want a refund and only want to cancel, do not offer or recommend one - honor the customer's stated intent.
- Prorated refunds for an immediate cancellation are calculated as the unused portion of the current billing period, and count as a standard refund subject to the general refund policy (human approval required, capped at the original charge).
- A customer who already received a refund or credit for the current billing period is not eligible for a second refund in the same period - check refund history before recommending one.`,
};
