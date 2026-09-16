/**
 * A refund approval is not a renewal of the policy evidence that supported
 * the command.  Keep this error distinct from an uncertain provider failure:
 * callers must durably escalate it rather than retrying a now-unsafe effect.
 */
export const REFUND_POLICY_EVIDENCE_ERROR = "REFUND_POLICY_EVIDENCE_INVALID";

export function refundPolicyEvidenceError(reason: string) {
  return new Error(`${REFUND_POLICY_EVIDENCE_ERROR}: ${reason}`);
}

export function isRefundPolicyEvidenceError(error: unknown) {
  return String(error).includes(REFUND_POLICY_EVIDENCE_ERROR);
}
