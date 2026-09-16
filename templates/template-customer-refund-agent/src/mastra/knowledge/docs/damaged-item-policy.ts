import type { PolicyDocument } from "../types.ts";

export const damagedItemPolicy: PolicyDocument = {
  title: "Damaged or Defective Item Policy",
  source: "damaged-item-policy",
  text: `# Damaged or Defective Item Policy

- If a customer reports an item arrived damaged or defective, offer either a **full refund** or a **free replacement** - let the customer choose if they haven't already stated a preference.
- Do not require the customer to ship the damaged item back before a refund is issued; ask them to send a photo if possible, but don't block the refund on it.
- Damaged-item refunds apply to the full order amount, since the product was not usable as delivered.
- If the same customer has reported more than one damaged item in the last 90 days, flag the case for escalation instead of approving automatically - this may indicate abuse or a supplier quality issue worth investigating.`,
};
