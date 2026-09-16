import type { PolicyDocument } from "../types.ts";

export const serviceProblemCreditPolicy: PolicyDocument = {
  title: "Service Problem Credit Policy",
  source: "service-problem-credit-policy",
  text: `# Service Problem Credit Policy

- For a verified service problem on one active monthly subscription, support may propose one credit equal to that subscription's single monthly charge.
- A proposed credit requires authenticated human approval before any billing balance change.
- The credit is placed on the customer's billing balance for a future finalized invoice. It is not a refund of a previous payment and is not proof that any invoice has already been paid.
- Annual plans, multiple subscription items, inactive or cancelling subscriptions, ambiguous currency, prior compensation, or an amount different from one monthly charge require specialist review.`,
};
