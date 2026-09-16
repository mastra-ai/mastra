import type { PolicyDocument } from "../types.ts";

export const duplicateChargePolicy: PolicyDocument = {
  title: "Duplicate Charge Policy",
  source: "duplicate-charge-policy",
  text: `# Duplicate Charge Policy

Duplicate charges happen when a payment retries due to a network error, or when a customer accidentally submits an order twice.

- If a customer's order or subscription shows more than one charge for the same billing period, the duplicate charge is eligible for a **full refund of the extra charge only**. The original charge is never refunded as part of a duplicate-charge claim.
- Always confirm the charge count on the order/subscription record before recommending a refund - do not take the customer's word for the number of charges without checking.
- Duplicate-charge refunds do not require the customer to return anything, since no extra product/service was fulfilled.
- These refunds are considered clear-cut and eligible for standard approval (not automatic execution - a human must still approve every refund).`,
};
