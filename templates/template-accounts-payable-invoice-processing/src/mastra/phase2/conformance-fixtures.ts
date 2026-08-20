import type { ProviderConformanceCases } from './conformance.ts';
import { ProviderUnavailableError } from './ports.ts';

export const fixtureConformanceCases = {
  vendors: {
    found: { name: 'Acme Supplies', taxId: 'US-12-3456789' },
    missing: { name: 'Missing Vendor' },
    transportFailure: {
      lookup: { name: 'Acme Supplies' },
      repository: {
        find: async () => {
          throw new ProviderUnavailableError('faulting-fixture', 'find vendor');
        },
      },
    },
  },
  purchaseOrders: {
    found: 'PO-1001',
    missing: 'PO-MISSING',
    transportFailure: {
      poNumber: 'PO-1001',
      repository: {
        findByNumber: async () => {
          throw new ProviderUnavailableError('faulting-fixture', 'find purchase order');
        },
      },
    },
  },
  goodsReceipts: {
    found: 'po_1001',
    missing: 'po_missing',
    transportFailure: {
      purchaseOrderId: 'po_1001',
      repository: {
        findByPurchaseOrderId: async () => {
          throw new ProviderUnavailableError('faulting-fixture', 'find receipt');
        },
      },
    },
  },
  posting: {
    idempotencyKey: `ap-${'0'.repeat(64)}`,
    invoice: {
      document: { id: 'conformance', mimeType: 'application/pdf', source: 'PDF' },
      invoiceNumber: 'CONFORMANCE-1',
      vendorName: 'Acme Supplies',
      vendorTaxId: 'US-12-3456789',
      poNumber: 'PO-1001',
      invoiceDate: '2026-08-13',
      currency: 'USD',
      subtotalMinor: 10_000,
      taxMinor: 800,
      totalMinor: 10_800,
      lines: [
        {
          sku: 'PEN-01',
          description: 'Blue pens',
          qty: 10,
          unitPriceMinor: 1000,
          lineTotalMinor: 10_000,
        },
      ],
      confidence: [],
      overallConfidence: 1,
      fixtureHints: { vendorId: null, poId: null },
    },
    vendor: {
      id: 'vendor_acme',
      name: 'Acme Supplies',
      taxId: 'US-12-3456789',
      status: 'approved',
      bankDetailsFingerprint: 'bank-acme-v1',
    },
    purchaseOrder: {
      id: 'po_1001',
      poNumber: 'PO-1001',
      vendorId: 'vendor_acme',
      currency: 'USD',
      totalMinor: 10_800,
      lines: [
        {
          sku: 'PEN-01',
          description: 'Blue pens',
          qty: 10,
          unitPriceMinor: 1000,
          lineTotalMinor: 10_000,
        },
      ],
    },
    approval: {
      status: 'not_required',
      reviewerId: null,
      decidedAt: '2026-08-13T00:00:00.000Z',
      invoiceDigest: '0'.repeat(64),
      comment: null,
    },
  },
} satisfies ProviderConformanceCases;
