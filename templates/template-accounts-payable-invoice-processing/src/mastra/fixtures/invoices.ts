import type { DocumentRef, ExtractedInvoice, InvoiceDraft } from '../schemas/invoice.ts';

const confidence = (value: number) =>
  ['invoiceNumber', 'vendorName', 'poNumber', 'invoiceDate', 'currency', 'subtotal', 'tax', 'total', 'lines'].map(
    field => ({ field, confidence: value }),
  );

const clean: ExtractedInvoice = {
  invoiceNumber: 'ACME-1042',
  vendorName: 'Acme Supplies',
  vendorTaxId: 'US-12-3456789',
  poNumber: 'PO-1001',
  invoiceDate: '2026-08-01',
  currency: 'USD',
  subtotal: 100,
  tax: 8,
  total: 108,
  lines: [{ sku: 'PEN-01', description: 'Blue pens', qty: 10, unitPrice: 10, lineTotal: 100 }],
  confidence: confidence(0.99),
  overallConfidence: 0.99,
  source: 'PDF',
};
const reviewed: ExtractedInvoice = {
  invoiceNumber: 'NW-2048',
  vendorName: 'Northwind Trading',
  vendorTaxId: null,
  poNumber: 'PO-2002',
  invoiceDate: '2026-08-02',
  currency: 'EUR',
  subtotal: 50,
  tax: 10,
  total: 60,
  lines: [{ sku: null, description: 'Freight', qty: 1, unitPrice: 50, lineTotal: 50 }],
  confidence: confidence(0.08),
  overallConfidence: 0.08,
  source: 'image',
};
export type InvoiceFixture = {
  document: DocumentRef;
  draft: InvoiceDraft;
  groundTruth: ExtractedInvoice;
  requiresReview: boolean;
  minimumFidelity: number;
};
export const invoiceFixtures: InvoiceFixture[] = [
  {
    document: {
      id: 'clean-invoice',
      mimeType: 'application/pdf',
      source: 'PDF',
      sha256: 'fixture-clean',
    },
    draft: clean,
    groundTruth: clean,
    requiresReview: false,
    minimumFidelity: 1,
  },
  {
    document: {
      id: 'hard-invoice',
      mimeType: 'image/png',
      source: 'image',
      sha256: 'fixture-hard',
    },
    draft: { ...reviewed, vendorName: null },
    groundTruth: reviewed,
    requiresReview: true,
    minimumFidelity: 0.9375,
  },
];
