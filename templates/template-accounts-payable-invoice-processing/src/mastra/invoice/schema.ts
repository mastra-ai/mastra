import { z } from 'zod';
import Decimal from 'decimal.js';
import { isCanonicalCurrency, minorUnitDigits } from './currency.ts';

const RequiredTextSchema = z.string().refine(value => value.trim().length > 0, 'Must not be blank');
const InvoiceDateSchema = z
  .string()
  .refine(
    value =>
      /^\d{4}-\d{2}-\d{2}$/.test(value) &&
      !Number.isNaN(Date.parse(`${value}T00:00:00Z`)) &&
      new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value,
    'invoiceDate must be yyyy-mm-dd',
  );
const CurrencySchema = z
  .string()
  .refine(isCanonicalCurrency, 'currency must be a canonical uppercase ISO 4217 code')
  .refine(value => minorUnitDigits(value) !== null, 'currency must define ISO 4217 minor units');

const hasMinorUnitPrecision = (value: number, digits: number) => new Decimal(value).decimalPlaces() <= digits;
// Unit prices may be sub-minor-unit rates; posted extended amounts must obey the currency scale.
const reconciles = (parts: Array<number | Decimal>, total: number, digits: number) => {
  const sum = parts.reduce<Decimal>((value, part) => value.plus(part), new Decimal(0)),
    expected = new Decimal(total);
  return sum
    .toDecimalPlaces(digits, Decimal.ROUND_HALF_UP)
    .equals(expected.toDecimalPlaces(digits, Decimal.ROUND_HALF_UP));
};

const LineItemSchema = z.object({
  sku: z.string().nullable(),
  description: RequiredTextSchema,
  qty: z.number().finite(),
  unitPrice: z.number().finite(),
  lineTotal: z.number().finite().nullable(),
});
const FieldConfidenceSchema = z.object({
  field: z.string(),
  confidence: z.number().min(0).max(1),
});
export const ExtractedInvoiceSchema = z
  .object({
    invoiceNumber: RequiredTextSchema,
    vendorName: RequiredTextSchema,
    vendorTaxId: z.string().nullable(),
    poNumber: z.string().nullable(),
    invoiceDate: InvoiceDateSchema,
    currency: CurrencySchema,
    subtotal: z.number().finite().nullable(),
    tax: z.number().finite().nullable(),
    total: z.number().finite(),
    lines: z.array(LineItemSchema),
    confidence: z.array(FieldConfidenceSchema),
    overallConfidence: z.number().min(0).max(1),
    source: z.enum(['PDF', 'image']).default('PDF'),
  })
  .superRefine((invoice, context) => {
    const issues: string[] = [];
    const digits = minorUnitDigits(invoice.currency);
    const lineAmounts: Array<number | Decimal> = invoice.lines.map(
      line => line.lineTotal ?? new Decimal(line.qty).mul(line.unitPrice),
    );
    const subtotalBasis =
      invoice.subtotal ??
      (lineAmounts.length ? lineAmounts.reduce<Decimal>((sum, value) => sum.plus(value), new Decimal(0)) : null);

    if (digits !== null) {
      for (const [field, value] of [
        ['subtotal', invoice.subtotal],
        ['tax', invoice.tax],
        ['total', invoice.total],
      ] as const)
        if (value !== null && !hasMinorUnitPrecision(value, digits))
          issues.push(`${field} exceeds ${invoice.currency} minor-unit precision`);

      if (subtotalBasis === null) issues.push('total cannot be reconciled from printed amounts');
      else if (!reconciles([subtotalBasis, invoice.tax ?? 0], invoice.total, digits))
        issues.push('subtotal + tax does not equal total');

      invoice.lines.forEach((line, index) => {
        if (line.lineTotal === null) return;
        if (!hasMinorUnitPrecision(line.lineTotal, digits))
          issues.push(`lines.${index}.lineTotal exceeds ${invoice.currency} minor-unit precision`);
        if (!reconciles([new Decimal(line.qty).mul(line.unitPrice)], line.lineTotal, digits))
          issues.push(`lines.${index} does not reconcile`);
      });
      if (invoice.subtotal !== null && lineAmounts.length && !reconciles(lineAmounts, invoice.subtotal, digits))
        issues.push('line totals do not equal subtotal');
    }

    for (const message of issues) context.addIssue({ code: 'custom', message });
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
  source: z.enum(['PDF', 'image']).optional(),
});
export type InvoiceDraft = z.infer<typeof InvoiceDraftSchema>;

const DocumentRefSchema = z.object({
  id: z.string(),
  mimeType: z.enum(['application/pdf', 'image/png', 'image/jpeg']),
  source: z.enum(['PDF', 'image']).default('PDF'),
});

const MoneySchema = z.number().int().safe();
export const DecisionReasonSchema = z.object({
  code: z.string(),
  message: z.string(),
  evidence: z.record(z.string(), z.unknown()).optional(),
});
const StepDecisionSchema = z.object({
  step: z.string(),
  outcome: z.enum(['pass', 'review', 'blocked', 'unknown_retry', 'verify_extraction']),
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
  invoiceNumber: RequiredTextSchema,
  vendorName: RequiredTextSchema,
  vendorTaxId: z.string().nullable(),
  poNumber: z.string().nullable(),
  invoiceDate: InvoiceDateSchema,
  currency: CurrencySchema,
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
  status: z.enum(['approved', 'inactive', 'on_hold', 'blocked']),
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
  currency: CurrencySchema,
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
  invoiceDate: InvoiceDateSchema,
  currency: CurrencySchema,
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
  disposition: z.enum(['auto_post', 'approval_required', 'review', 'blocked', 'retry', 'verify_extraction']),
  policy: PolicyConfigSchema,
});
export type FinalAssessment = z.infer<typeof FinalAssessmentSchema>;

const ApprovalEvidenceSchema = z
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
    invoice: NormalizedInvoiceSchema,
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
const PostingReceiptSchema = z.object({
  status: z.enum(['posted', 'already_posted']),
  providerId: z.string().min(1),
  externalBillId: z.string().min(1),
  postedAt: z.string().datetime(),
  idempotencyKey: z.string().regex(/^ap-[a-f0-9]{64}$/),
});
export type PostingReceipt = z.infer<typeof PostingReceiptSchema>;
export const InvoiceResultSchema = FinalAssessmentSchema.extend({
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
export type InvoiceResult = z.infer<typeof InvoiceResultSchema>;
