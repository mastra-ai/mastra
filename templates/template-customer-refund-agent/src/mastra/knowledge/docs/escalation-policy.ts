import type { PolicyDocument } from "../types.ts";

export const escalationPolicy: PolicyDocument = {
  title: "Escalation Policy",
  source: "escalation-policy",
  text: `# Escalation Policy

Escalate a case to a human specialist (do not attempt to resolve it solely with a drafted response) when any of the following are true:

- The requested refund or credit amount exceeds $1,000.
- The customer has already been refunded or credited for the same order/billing period.
- The customer's message expresses anger, threatens a chargeback, or threatens to post publicly about the company.
- The case involves a legal, safety, or security concern (e.g. data breach, injury, fraud).
- Triage classified the case with low confidence (below 0.5) or explicitly flagged \`requiresHumanReview\`.
- A refund was recommended but declined by the approving support agent - do not silently drop the case; escalate with the rejection reason attached.

When escalating, still send the customer an acknowledgement that a specialist will follow up - never leave a case silent.`,
};
