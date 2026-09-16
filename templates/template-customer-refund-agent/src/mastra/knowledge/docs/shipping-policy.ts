import type { PolicyDocument } from "../types.ts";

export const shippingPolicy: PolicyDocument = {
  title: "Shipping & Order Status Policy",
  source: "shipping-policy",
  text: `# Shipping & Order Status Policy

- Standard shipping takes 5-7 business days from the order placement date. Expedited shipping takes 2-3 business days.
- If a customer asks for order status and the order is still \`processing\` after more than 7 business days, apologize for the delay and offer a shipping update; this is not a refund situation on its own.
- If an order has been \`processing\` for more than 14 business days with no shipment, treat it as a fulfillment failure - offer the customer a choice of a full refund or continued shipping with a discount on their next order, and escalate to fulfillment for investigation.
- Do not promise a specific delivery date beyond the shipping windows above.`,
};
