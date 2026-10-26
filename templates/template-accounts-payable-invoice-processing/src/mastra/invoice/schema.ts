import { z } from "zod";

const LineItemSchema = z.object({
  sku: z.string().nullable(),
  description: z.string(),
  qty: z.number().finite(),
  unitPrice: z.number().finite(),
  lineTotal: z.number().finite().nullable(),
});
const FieldConfidenceSchema = z.object({
  field: z.string(),
  confidence: z.number().min(0).max(1),
});
export const ExtractedInvoiceSchema = z.object({
  invoiceNumber: z.string(),
  vendorName: z.string(),
  vendorTaxId: z.string().nullable(),
  poNumber: z.string().nullable(),
  invoiceDate: z.string(),
  currency: z.string(),
  subtotal: z.number().finite().nullable(),
  tax: z.number().finite().nullable(),
  total: z.number().finite(),
  lines: z.array(LineItemSchema),
  confidence: z.array(FieldConfidenceSchema),
  overallConfidence: z.number().min(0).max(1),
  source: z.enum(["PDF", "image"]).default("PDF"),
});
export type ExtractedInvoice = z.infer<typeof ExtractedInvoiceSchema>;

const DraftLineItemSchema = z.object({
  sku: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
  qty: z.number().nullable().optional(),
  unitPrice: z.number().nullable().optional(),
  lineTotal: z.number().nullable().optional(),
});
export const InvoiceDraftSchema = z.object({
  invoiceNumber: z.string().nullable().optional(),
  vendorName: z.string().nullable().optional(),
  vendorTaxId: z.string().nullable().optional(),
  poNumber: z.string().nullable().optional(),
  invoiceDate: z.string().nullable().optional(),
  currency: z.string().nullable().optional(),
  subtotal: z.number().nullable().optional(),
  tax: z.number().nullable().optional(),
  total: z.number().nullable().optional(),
  lines: z.array(DraftLineItemSchema).optional(),
  confidence: z.array(FieldConfidenceSchema).default([]),
  overallConfidence: z.number().min(0).max(1).nullable().optional(),
  source: z.enum(["PDF", "image"]).optional(),
});
export type InvoiceDraft = z.infer<typeof InvoiceDraftSchema>;

const DocumentRefSchema = z.object({
  id: z.string(),
  mimeType: z.enum(["application/pdf", "image/png", "image/jpeg"]),
  source: z.enum(["PDF", "image"]).default("PDF"),
});

const MoneySchema = z.number().int().safe();
export const DecisionReasonSchema = z.object({
  code: z.string(),
  message: z.string(),
  evidence: z.record(z.unknown()).optional(),
});
const StepDecisionSchema = z.object({
  step: z.string(),
  outcome: z.enum(["pass", "review", "blocked", "unknown_retry", "verify_extraction"]),
  reasons: z.array(DecisionReasonSchema),
});
export type StepDecision = z.infer<typeof StepDecisionSchema>;

const NormalizedLineSchema = z.object({
  sku: z.string().nullable(),
  description: z.string(),
  qty: z.number(),
  unitPriceMinor: MoneySchema,
  lineTotalMinor: MoneySchema.nullable(),
});
export const NormalizedInvoiceSchema = z.object({
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
  lines: z.array(NormalizedLineSchema),
  confidence: z.array(FieldConfidenceSchema),
  overallConfidence: z.number().min(0).max(1),
});
export type NormalizedInvoice = z.infer<typeof NormalizedInvoiceSchema>;

export const VendorRecordSchema = z.object({
  id: z.string(),
  name: z.string(),
  taxId: z.string().nullable(),
  status: z.enum(["approved", "inactive", "on_hold", "blocked"]),
});
export type VendorRecord = z.infer<typeof VendorRecordSchema>;
const PurchaseOrderLineSchema = z.object({
  sku: z.string().nullable(),
  description: z.string().nullable().optional(),
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
export type GoodsReceipt = {
  id: string;
  purchaseOrderId: string;
  lines: Array<{ sku: string | null; qty: number }>;
};
export const PriorInvoiceSchema = z.object({
  id: z.string(),
  vendorId: z.string(),
  invoiceNumber: z.string().nullable(),
  invoiceDate: z.string(),
  currency: z.string(),
  totalMinor: MoneySchema,
});
export type PriorInvoice = z.infer<typeof PriorInvoiceSchema>;
export type VendorScreeningResult = {
  matched: boolean;
  list: string | null;
  reference: string | null;
};
const PolicyConfigSchema = z.object({
  approvalThresholdMinor: MoneySchema,
  amountToleranceMinor: MoneySchema,
  lowConfidenceThreshold: z.number().min(0).max(1),
  allowUnscreenedVendors: z.boolean(),
});
export type PolicyConfig = z.infer<typeof PolicyConfigSchema>;

export const UnsignedInvoiceWorkflowInputSchema = z.object({
  rawDocumentRef: DocumentRefSchema,
  extractedResult: ExtractedInvoiceSchema,
});
export type UnsignedInvoiceWorkflowInput = z.infer<typeof UnsignedInvoiceWorkflowInputSchema>;
export const InvoiceWorkflowInputSchema = UnsignedInvoiceWorkflowInputSchema.extend({
  submissionSignature: z.string().regex(/^[a-f0-9]{64}$/),
});
export type InvoiceWorkflowInput = z.infer<typeof InvoiceWorkflowInputSchema>;
const AssessmentStateSchema = z.object({
  invoice: NormalizedInvoiceSchema,
  vendor: VendorRecordSchema.nullable(),
  purchaseOrder: PurchaseOrderSchema.nullable(),
  decisions: z.array(StepDecisionSchema),
});
export type AssessmentState = z.infer<typeof AssessmentStateSchema>;
export const FinalAssessmentSchema = AssessmentStateSchema.extend({
  disposition: z.enum([
    "auto_post",
    "approval_required",
    "review",
    "blocked",
    "retry",
    "verify_extraction",
  ]),
  policy: PolicyConfigSchema,
});
export type FinalAssessment = z.infer<typeof FinalAssessmentSchema>;

const ApprovalEvidenceSchema = z
  .object({
    status: z.enum(["not_requested", "not_required", "approved", "rejected"]),
    reviewerId: z.string().trim().min(1).nullable(),
    decidedAt: z.string().datetime().nullable(),
    invoiceDigest: z.string().regex(/^[a-f0-9]{64}$/),
    comment: z.string().max(1000).nullable(),
  })
  .superRefine((value, context) => {
    if (["approved", "rejected"].includes(value.status) && (!value.reviewerId || !value.decidedAt))
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Human decisions require reviewerId and decidedAt",
      });
  });
export type ApprovalEvidence = z.infer<typeof ApprovalEvidenceSchema>;
export const PostingRequestSchema = z
  .object({
    idempotencyKey: z.string().regex(/^ap-[a-f0-9]{64}$/),
    invoice: NormalizedInvoiceSchema,
    vendor: VendorRecordSchema,
    purchaseOrder: PurchaseOrderSchema.nullable(),
    approval: ApprovalEvidenceSchema,
  })
  .superRefine((value, context) => {
    if (!["approved", "not_required"].includes(value.approval.status))
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Posting requires approval or an explicit not-required decision",
      });
    if (value.idempotencyKey !== `ap-${value.approval.invoiceDigest}`)
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Idempotency key must bind to the approved invoice digest",
      });
  });
export type PostingRequest = z.infer<typeof PostingRequestSchema>;
const PostingReceiptSchema = z.object({
  status: z.enum(["posted", "already_posted"]),
  providerId: z.string().min(1),
  externalBillId: z.string().min(1),
  postedAt: z.string().datetime(),
  idempotencyKey: z.string().regex(/^ap-[a-f0-9]{64}$/),
});
export type PostingReceipt = z.infer<typeof PostingReceiptSchema>;
export const InvoiceResultSchema = FinalAssessmentSchema.extend({
  executionStatus: z.enum([
    "not_postable",
    "ready_to_post",
    "rejected",
    "posting_unavailable",
    "posting_failed",
    "posted",
  ]),
  approval: ApprovalEvidenceSchema,
  posting: PostingReceiptSchema.nullable(),
  postingError: z.string().nullable(),
});
export type InvoiceResult = z.infer<typeof InvoiceResultSchema>;
