import type { PolicyDocument } from "../types.ts";

export const refundPolicy: PolicyDocument = {
  title: "General Refund Policy",
  source: "refund-policy",
  text: `# General Refund Policy

We want customers to feel confident buying from us. Refunds are approved case-by-case, but the following guidelines apply:

- Customers may request a full refund within **30 days** of the purchase date if they are not satisfied with a product or service.
- Refunds are issued to the original payment method within 5-10 business days of approval.
- A refund can never exceed the amount originally charged for the order.
- Partial refunds (e.g. goodwill credits) are allowed when a full refund isn't warranted but the customer experienced a real inconvenience.
- All refunds over $1,000 require escalation to a senior support lead - do not approve these directly, no matter how clear-cut the case seems.
- Every refund must reference a specific order ID and reason. Never issue a refund "just to close the ticket."`,
};
