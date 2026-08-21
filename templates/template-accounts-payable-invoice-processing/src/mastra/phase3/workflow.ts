import { createHash } from 'node:crypto';
import { createStep, createWorkflow } from '@mastra/core/workflows';
import { z } from 'zod';
import { ReviewerContextSchema } from '../schemas/invoice.ts';
import { activePhase2Runtime } from '../phase2/composition.ts';
import { verifyAssessment } from '../phase2/assessment-integrity.ts';
import {
  DecisionReasonSchema,
  FinalAssessmentSchema,
  Phase3ResultSchema,
  PostingRequestSchema,
  type ApprovalEvidence,
  type FinalAssessment,
  type Phase3Result,
} from '../phase2/schemas.ts';

const approvalResumeSchema = z.object({
  approved: z.boolean(),
  comment: z.string().trim().max(1000).optional(),
});
export const ApprovalRequestSchema = z.object({
  invoiceNumber: z.string(),
  vendorName: z.string(),
  currency: z.string(),
  totalMinor: z.number().int().safe(),
  disposition: z.literal('approval_required'),
  reasons: z.array(z.string()),
  reasonDetails: z.array(DecisionReasonSchema),
  reviewTypes: z.array(z.string()),
  signals: z.array(z.string()),
  adaptations: z.array(z.string()),
  invoiceDigest: z.string().regex(/^[a-f0-9]{64}$/),
});
const digest = (assessment: FinalAssessment) =>
  createHash('sha256')
    .update(
      JSON.stringify({
        invoice: assessment.invoice,
        decisions: assessment.decisions,
        disposition: assessment.disposition,
        policy: assessment.policy,
      }),
    )
    .digest('hex');
const evidence = (assessment: FinalAssessment, values: Partial<ApprovalEvidence>): ApprovalEvidence => ({
  status: 'not_requested',
  reviewerId: null,
  decidedAt: null,
  invoiceDigest: digest(assessment),
  comment: null,
  ...values,
});
const result = (
  assessment: FinalAssessment,
  approval: ApprovalEvidence,
  executionStatus: Phase3Result['executionStatus'],
): Phase3Result => ({
  ...assessment,
  executionStatus,
  approval,
  posting: null,
  postingError: null,
});

const approve = createStep({
  id: 'approve-invoice',
  inputSchema: FinalAssessmentSchema,
  outputSchema: Phase3ResultSchema,
  suspendSchema: ApprovalRequestSchema,
  resumeSchema: approvalResumeSchema,
  requestContextSchema: ReviewerContextSchema,
  execute: async ({ inputData, resumeData, requestContext, suspend }) => {
    if (!verifyAssessment(inputData)) throw new Error('Assessment provenance is invalid');
    if (inputData.disposition === 'auto_post')
      return result(
        inputData,
        evidence(inputData, { status: 'not_required', decidedAt: new Date().toISOString() }),
        'ready_to_post',
      );
    if (inputData.disposition !== 'approval_required')
      return result(inputData, evidence(inputData, {}), 'not_postable');
    if (!resumeData)
      return await suspend({
        invoiceNumber: inputData.invoice.invoiceNumber,
        vendorName: inputData.invoice.vendorName,
        currency: inputData.invoice.currency,
        totalMinor: inputData.invoice.totalMinor,
        disposition: 'approval_required',
        reasons: inputData.decisions.flatMap(decision => decision.reasons.map(reason => reason.code)),
        reasonDetails: inputData.decisions.flatMap(decision => decision.reasons),
        reviewTypes: inputData.decisions.flatMap(decision => (decision.reviewType ? [decision.reviewType] : [])),
        signals: inputData.decisions.flatMap(decision => decision.signals),
        adaptations: inputData.decisions.flatMap(decision => decision.adaptations.map(adaptation => adaptation.code)),
        invoiceDigest: digest(inputData),
      });
    const reviewerId = requestContext.get('reviewerId');
    if (!reviewerId) throw new Error('reviewerId must come from authenticated request context when resuming approval');
    const approval = evidence(inputData, {
      status: resumeData.approved ? 'approved' : 'rejected',
      reviewerId,
      decidedAt: new Date().toISOString(),
      comment: resumeData.comment ?? null,
    });
    return result(inputData, approval, resumeData.approved ? 'ready_to_post' : 'rejected');
  },
});

const post = createStep({
  id: 'post-approved-invoice',
  inputSchema: Phase3ResultSchema,
  outputSchema: Phase3ResultSchema,
  execute: async ({ inputData }) => {
    if (inputData.executionStatus !== 'ready_to_post') return inputData;
    const adapter = activePhase2Runtime.provider.posting;
    if (!adapter)
      return {
        ...inputData,
        executionStatus: 'posting_unavailable' as const,
        postingError: `Provider ${activePhase2Runtime.provider.id} does not support posting`,
      };
    if (!inputData.vendor)
      return {
        ...inputData,
        executionStatus: 'posting_failed' as const,
        postingError: 'Validated vendor is missing',
      };
    try {
      const request = PostingRequestSchema.parse({
        idempotencyKey: `ap-${inputData.approval.invoiceDigest}`,
        invoice: inputData.invoice,
        vendor: inputData.vendor,
        purchaseOrder: inputData.purchaseOrder,
        approval: inputData.approval,
      });
      const posting = await adapter.postBill(request);
      await activePhase2Runtime.history.save({
        id: posting.externalBillId,
        vendorId: inputData.vendor.id,
        invoiceNumber: inputData.invoice.invoiceNumber,
        invoiceDate: inputData.invoice.invoiceDate,
        currency: inputData.invoice.currency,
        totalMinor: inputData.invoice.totalMinor,
        channel: null,
      });
      return { ...inputData, executionStatus: 'posted' as const, posting, postingError: null };
    } catch (error) {
      return {
        ...inputData,
        executionStatus: 'posting_failed' as const,
        postingError: error instanceof Error ? error.message : 'Unknown posting failure',
      };
    }
  },
});

export const apExecutionWorkflow = createWorkflow({
  id: 'ap-execution-workflow',
  inputSchema: FinalAssessmentSchema,
  outputSchema: Phase3ResultSchema,
  requestContextSchema: ReviewerContextSchema,
  options: { shouldPersistSnapshot: () => true },
})
  .then(approve)
  .then(post)
  .commit();
