import type { ExtractedInvoice, UnsignedInvoiceWorkflowInput } from '../../src/mastra/invoice/schema.ts';

export function invoiceInput(overrides: Partial<ExtractedInvoice> = {}): UnsignedInvoiceWorkflowInput {
  return {
    rawDocumentRef: { id: 'fixture-invoice', mimeType: 'image/jpeg', source: 'image' },
    extractedResult: {
      invoiceNumber: 'AP-TEST-1001',
      vendorName: 'AP Sandbox Vendor',
      vendorTaxId: null,
      poNumber: 'AP-PO-1001',
      invoiceDate: '2026-10-26',
      currency: 'USD',
      subtotal: 100,
      tax: 0,
      total: 100,
      lines: [{ sku: 'item-1', description: 'Pens', qty: 10, unitPrice: 10, lineTotal: 100 }],
      confidence: [
        'invoiceNumber',
        'vendorName',
        'poNumber',
        'invoiceDate',
        'currency',
        'subtotal',
        'tax',
        'total',
        'lines[0].sku',
        'lines[0].description',
        'lines[0].qty',
        'lines[0].unitPrice',
        'lines[0].lineTotal',
      ].map(field => ({ field, confidence: 0.99 })),
      overallConfidence: 0.99,
      source: 'image',
      ...overrides,
    },
  };
}
