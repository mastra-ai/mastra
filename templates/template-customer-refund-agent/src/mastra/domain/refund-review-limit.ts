import type { Money } from "../providers/contracts";
import { legacyAmountToMoney } from "../lib/money";

/**
 * Refunds at or below this customer-facing major-unit amount may enter the
 * normal human-approval flow. It is a review limit, never auto-approval.
 */
export const STANDARD_REFUND_REVIEW_LIMIT = 1000;

export function standardRefundReviewLimitMinor(currency: string) {
  return legacyAmountToMoney(STANDARD_REFUND_REVIEW_LIMIT, currency).minor;
}

export function exceedsStandardRefundReviewLimit(amount: Money) {
  return amount.minor > standardRefundReviewLimitMinor(amount.currency);
}
