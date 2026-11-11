import type { InvoiceRuntime } from '../../accounting/providers.ts';
import { FinalAssessmentSchema, type AssessmentState } from '../schema.ts';
import { decide } from './decision.ts';

const exceptionDisposition = {
  blocked: 'blocked',
  unknown_retry: 'retry',
  verify_extraction: 'verify_extraction',
  review: 'review',
} as const;

export function makePolicyRouting(runtime: InvoiceRuntime) {
  return async (state: AssessmentState) => {
    const exception = (Object.keys(exceptionDisposition) as Array<keyof typeof exceptionDisposition>).find(outcome =>
      state.decisions.some(decision => decision.outcome === outcome),
    );
    const disposition = exception
      ? exceptionDisposition[exception]
      : state.invoice.document.requiresHumanReview || state.invoice.totalMinor > runtime.policy.approvalThresholdMinor
        ? 'approval_required'
        : 'auto_post';

    if (disposition === 'approval_required')
      decide(state, {
        step: 'policy',
        outcome: 'pass',
        reasons: [
          ...(state.invoice.document.requiresHumanReview
            ? [
                {
                  code: 'DOCUMENT_REVIEW_REQUIRED',
                  message: 'Review the original invoice and extracted fields; the attachment reference is unverified',
                },
              ]
            : []),
          ...(state.invoice.totalMinor > runtime.policy.approvalThresholdMinor
            ? [
                {
                  code: 'APPROVAL_THRESHOLD_EXCEEDED',
                  message: 'Invoice total exceeds the configured approval threshold',
                  evidence: {
                    totalMinor: state.invoice.totalMinor,
                    approvalThresholdMinor: runtime.policy.approvalThresholdMinor,
                  },
                },
              ]
            : []),
        ],
      });

    return FinalAssessmentSchema.parse({ ...state, disposition, policy: runtime.policy });
  };
}
