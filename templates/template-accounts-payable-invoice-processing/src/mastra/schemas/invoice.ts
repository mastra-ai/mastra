import { z } from 'zod';

export const LineItemSchema = z.object({
  sku: z.string().nullable(),
  description: z.string(),
  qty: z.number().finite(),
  unitPrice: z.number().finite(),
  lineTotal: z.number().finite().nullable(),
});
export const FieldConfidenceSchema = z.object({
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
  source: z.enum(['PDF', 'image', 'EDI']).default('PDF'),
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
  source: z.enum(['PDF', 'image', 'EDI']).optional(),
});
export type InvoiceDraft = z.infer<typeof InvoiceDraftSchema>;

export const DocumentRefSchema = z.object({
  id: z.string(),
  mimeType: z.string(),
  source: z.enum(['PDF', 'image', 'EDI']).default('PDF'),
  localPath: z.string().optional(),
  sha256: z.string().optional(),
});
export type DocumentRef = z.infer<typeof DocumentRefSchema>;

export const ExtractionChecksSchema = z.object({
  passed: z.boolean(),
  issues: z.array(z.string()),
});
export const HumanVerificationSchema = z.object({ extracted: ExtractedInvoiceSchema });
export const ReviewerContextSchema = z.object({ reviewerId: z.string().trim().min(1).optional() });
export type ReviewerContext = z.infer<typeof ReviewerContextSchema>;
