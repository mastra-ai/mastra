import { z } from 'zod';
import { DocumentRefSchema, ExtractedInvoiceSchema, FieldConfidenceSchema } from '../schemas/invoice.ts';

export const MoneySchema = z.number().int().safe();
export const DecisionReasonSchema = z.object({
  code: z.string(),
  message: z.string(),
  evidence: z.record(z.unknown()).optional(),
});
export const AdaptationSchema = z.enum([
  'GOODS_RECEIPTS_UNAVAILABLE',
  'VENDOR_BANK_DETAILS_UNAVAILABLE',
  'SANCTIONS_SOURCE_FALLBACK',
  'VENDOR_STATUS_BINARY',
  'BILL_HISTORY_SEED_UNAVAILABLE',
  'INVOICE_CHANNEL_UNAVAILABLE',
]);
export const StepDecisionSchema = z.object({
  step: z.string(),
  outcome: z.enum(['pass', 'review', 'blocked', 'unknown_retry', 'verify_extraction']),
  reviewType: z.string().nullable(),
  reasons: z.array(DecisionReasonSchema),
  signals: z.array(z.string()).default([]),
  adaptations: z.array(z.object({ code: AdaptationSchema, providerId: z.string() })).default([]),
  sources: z.record(z.string()).default({}),
});
export type StepDecision = z.infer<typeof StepDecisionSchema>;

export const Phase2LineSchema = z.object({
  sku: z.string().nullable(),
  description: z.string(),
  qty: z.number(),
  unitPriceMinor: MoneySchema,
  lineTotalMinor: MoneySchema.nullable(),
});
export const Phase2InvoiceSchema = z.object({
  document: DocumentRefSchema,
  invoiceNumber: z.string(),
  vendorName: z.string(),
  vendorTaxId: z.string().nullable(),
  poNumber: z.string().nullable(),
  invoiceDate: z.string(),
  currency: z.string(),
  subtotalMinor: MoneySchema.nullable(),
  taxMinor: MoneySchema.nullable(),
  totalMinor: MoneySchema,
  lines: z.array(Phase2LineSchema),
  confidence: z.array(FieldConfidenceSchema),
  overallConfidence: z.number().min(0).max(1),
});
export type Phase2Invoice = z.infer<typeof Phase2InvoiceSchema>;

export const VendorRecordSchema = z.object({
  id: z.string(),
  name: z.string(),
  taxId: z.string().nullable(),
  status: z.enum(['approved', 'inactive', 'on_hold', 'blocked']),
  bankDetailsFingerprint: z.string().nullable(),
});
export type VendorRecord = z.infer<typeof VendorRecordSchema>;
export const PurchaseOrderLineSchema = z.object({
  sku: z.string().nullable(),
  description: z.string(),
  qty: z.number(),
  unitPriceMinor: MoneySchema,
  lineTotalMinor: MoneySchema,
});
export const PurchaseOrderSchema = z.object({
  id: z.string(),
  poNumber: z.string(),
  vendorId: z.string(),
  currency: z.string(),
  totalMinor: MoneySchema,
  lines: z.array(PurchaseOrderLineSchema),
});
export type PurchaseOrder = z.infer<typeof PurchaseOrderSchema>;
export const GoodsReceiptSchema = z.object({
  id: z.string(),
  purchaseOrderId: z.string(),
  receivedAt: z.string(),
  lines: z.array(z.object({ sku: z.string().nullable(), qty: z.number() })),
});
export type GoodsReceipt = z.infer<typeof GoodsReceiptSchema>;
export const PriorInvoiceSchema = z.object({
  id: z.string(),
  vendorId: z.string(),
  invoiceNumber: z.string().nullable(),
  invoiceDate: z.string(),
  currency: z.string(),
  totalMinor: MoneySchema,
  channel: z.string().nullable(),
});
export type PriorInvoice = z.infer<typeof PriorInvoiceSchema>;
export const SanctionsResultSchema = z.object({
  matched: z.boolean(),
  list: z.string().nullable(),
  reference: z.string().nullable(),
});
export type SanctionsResult = z.infer<typeof SanctionsResultSchema>;
export const PolicyConfigSchema = z.object({
  approvalThresholdMinor: MoneySchema,
  amountToleranceMinor: MoneySchema,
  lowConfidenceThreshold: z.number().min(0).max(1),
});
export type PolicyConfig = z.infer<typeof PolicyConfigSchema>;

export const Phase1WorkflowOutputSchema = z
  .object({
    rawDocumentRef: DocumentRefSchema,
    extractedResult: ExtractedInvoiceSchema,
  })
  .passthrough();
export type Phase1WorkflowOutput = z.infer<typeof Phase1WorkflowOutputSchema>;
export const AssessmentStateSchema = z.object({
  invoice: Phase2InvoiceSchema,
  vendor: VendorRecordSchema.nullable(),
  purchaseOrder: PurchaseOrderSchema.nullable(),
  receipts: z.array(GoodsReceiptSchema),
  decisions: z.array(StepDecisionSchema),
  matchMode: z.enum(['two_way', 'three_way']).nullable(),
  duplicateIds: z.array(z.string()),
});
export type AssessmentState = z.infer<typeof AssessmentStateSchema>;
export const UnsignedFinalAssessmentSchema = AssessmentStateSchema.extend({
  disposition: z.enum(['auto_post', 'approval_required', 'review', 'blocked', 'retry', 'verify_extraction']),
  policy: PolicyConfigSchema,
});
export const FinalAssessmentSchema = UnsignedFinalAssessmentSchema.extend({
  assessmentSignature: z.string().regex(/^[a-f0-9]{64}$/),
});
export type FinalAssessment = z.infer<typeof FinalAssessmentSchema>;

export const ApprovalEvidenceSchema = z
  .object({
    status: z.enum(['not_requested', 'not_required', 'approved', 'rejected']),
    reviewerId: z.string().trim().min(1).nullable(),
    decidedAt: z.string().datetime().nullable(),
    invoiceDigest: z.string().regex(/^[a-f0-9]{64}$/),
    comment: z.string().max(1000).nullable(),
  })
  .superRefine((value, context) => {
    if (['approved', 'rejected'].includes(value.status) && (!value.reviewerId || !value.decidedAt))
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Human decisions require reviewerId and decidedAt',
      });
  });
export type ApprovalEvidence = z.infer<typeof ApprovalEvidenceSchema>;
export const PostingRequestSchema = z
  .object({
    idempotencyKey: z.string().regex(/^ap-[a-f0-9]{64}$/),
    invoice: Phase2InvoiceSchema,
    vendor: VendorRecordSchema,
    purchaseOrder: PurchaseOrderSchema.nullable(),
    approval: ApprovalEvidenceSchema,
  })
  .superRefine((value, context) => {
    if (!['approved', 'not_required'].includes(value.approval.status))
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Posting requires approval or an explicit not-required decision',
      });
    if (value.idempotencyKey !== `ap-${value.approval.invoiceDigest}`)
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Idempotency key must bind to the approved invoice digest',
      });
  });
export type PostingRequest = z.infer<typeof PostingRequestSchema>;
export const PostingReceiptSchema = z.object({
  status: z.enum(['posted', 'already_posted']),
  providerId: z.string().min(1),
  externalBillId: z.string().min(1),
  postedAt: z.string().datetime(),
  idempotencyKey: z.string().regex(/^ap-[a-f0-9]{64}$/),
});
export type PostingReceipt = z.infer<typeof PostingReceiptSchema>;
export const Phase3ResultSchema = FinalAssessmentSchema.extend({
  executionStatus: z.enum([
    'not_postable',
    'ready_to_post',
    'rejected',
    'posting_unavailable',
    'posting_failed',
    'posted',
  ]),
  approval: ApprovalEvidenceSchema,
  posting: PostingReceiptSchema.nullable(),
  postingError: z.string().nullable(),
});
export type Phase3Result = z.infer<typeof Phase3ResultSchema>;
