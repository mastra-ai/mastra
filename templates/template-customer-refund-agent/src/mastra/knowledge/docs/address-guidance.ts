import type { PolicyDocument } from "../types.ts";

export const addressGuidance: PolicyDocument = {
  title: "Address guidance",
  source: "address-guidance",
  text: `# Address guidance

- Support can explain how an address may affect a future purchase, but it does not change a delivery or billing address in this template.
- Ask the customer to use the authenticated support channel for account-specific guidance. Do not request a full address in an open conversation.
- For an order already in fulfillment, escalate to the relevant fulfillment process rather than promising an address change.`,
};
