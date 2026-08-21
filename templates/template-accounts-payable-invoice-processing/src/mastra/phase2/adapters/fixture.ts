import type {
  GoodsReceiptRepository,
  InvoiceHistoryRepository,
  PolicyProvider,
  PostingAdapter,
  PurchaseOrderRepository,
  SanctionsScreener,
  VendorLookup,
  VendorRepository,
  VendorStatusRestrictionSource,
} from '../ports.ts';
import {
  PostingReceiptSchema,
  PostingRequestSchema,
  type GoodsReceipt,
  type PolicyConfig,
  type PostingReceipt,
  type PriorInvoice,
  type PurchaseOrder,
  type VendorRecord,
} from '../schemas.ts';

export const fixtureDb: {
  vendors: VendorRecord[];
  purchaseOrders: PurchaseOrder[];
  receipts: GoodsReceipt[];
  priorInvoices: PriorInvoice[];
  policy: PolicyConfig;
} = {
  vendors: [
    {
      id: 'vendor_acme',
      name: 'Acme Supplies',
      taxId: 'US-12-3456789',
      status: 'approved',
      bankDetailsFingerprint: 'bank-acme-v1',
    },
    {
      id: 'vendor_northwind',
      name: 'Northwind Trading',
      taxId: null,
      status: 'approved',
      bankDetailsFingerprint: 'bank-northwind-v1',
    },
  ],
  purchaseOrders: [
    {
      id: 'po_1001',
      poNumber: 'PO-1001',
      vendorId: 'vendor_acme',
      currency: 'USD',
      totalMinor: 10800,
      lines: [
        {
          sku: 'PEN-01',
          description: 'Blue pens',
          qty: 10,
          unitPriceMinor: 1000,
          lineTotalMinor: 10000,
        },
      ],
    },
    {
      id: 'po_2002',
      poNumber: 'PO-2002',
      vendorId: 'vendor_northwind',
      currency: 'EUR',
      totalMinor: 6000,
      lines: [{ sku: null, description: 'Freight', qty: 1, unitPriceMinor: 5000, lineTotalMinor: 5000 }],
    },
  ],
  receipts: [
    {
      id: 'receipt_1001',
      purchaseOrderId: 'po_1001',
      receivedAt: '2026-07-30',
      lines: [{ sku: 'PEN-01', qty: 10 }],
    },
    {
      id: 'receipt_2002',
      purchaseOrderId: 'po_2002',
      receivedAt: '2026-08-01',
      lines: [{ sku: null, qty: 1 }],
    },
  ],
  priorInvoices: [
    {
      id: 'prior_1',
      vendorId: 'vendor_acme',
      invoiceNumber: 'ACME-0999',
      invoiceDate: '2026-07-01',
      currency: 'USD',
      totalMinor: 10800,
      channel: 'email',
    },
  ],
  policy: { approvalThresholdMinor: 100_000, amountToleranceMinor: 1, lowConfidenceThreshold: 0.8 },
};
const norm = (value: string) => value.trim().toLowerCase();
export class FixtureVendorRepository implements VendorRepository {
  async find(input: VendorLookup) {
    return fixtureDb.vendors.filter(
      v => norm(v.name) === norm(input.name) || Boolean(input.taxId && v.taxId === input.taxId),
    );
  }
}
export class FixturePurchaseOrderRepository implements PurchaseOrderRepository {
  async findByNumber(poNumber: string) {
    return fixtureDb.purchaseOrders.filter(po => po.poNumber === poNumber);
  }
}
export class FixtureGoodsReceiptRepository implements GoodsReceiptRepository {
  async findByPurchaseOrderId(id: string) {
    return fixtureDb.receipts.filter(receipt => receipt.purchaseOrderId === id);
  }
}
export class InMemoryInvoiceHistoryRepository implements InvoiceHistoryRepository {
  private readonly invoices = new Map<string, PriorInvoice>();
  async findPotentialDuplicates(input: {
    vendorId: string;
    invoiceNumber: string;
    currency: string;
    totalMinor: number;
  }) {
    return [...this.invoices.values()].filter(
      i =>
        i.vendorId === input.vendorId &&
        ((i.invoiceNumber !== null && norm(i.invoiceNumber) === norm(input.invoiceNumber)) ||
          (i.currency === input.currency && i.totalMinor === input.totalMinor)),
    );
  }
  async seed(invoices: PriorInvoice[]) {
    for (const invoice of invoices) this.invoices.set(invoice.id, invoice);
  }
  async save(invoice: PriorInvoice) {
    this.invoices.set(invoice.id, invoice);
  }
}
export class FixtureSanctionsScreener implements SanctionsScreener {
  async screen(vendor: VendorRecord) {
    return { matched: norm(vendor.name).includes('sanctioned'), list: null, reference: null };
  }
}
export class FixturePolicyProvider implements PolicyProvider {
  async getPolicy() {
    return fixtureDb.policy;
  }
}
export class FixtureStatusRestrictionSource implements VendorStatusRestrictionSource {
  async getRestriction() {
    return null as 'on_hold' | 'blocked' | null;
  }
}
export class FixturePostingAdapter implements PostingAdapter {
  private readonly receipts = new Map<string, PostingReceipt>();
  async postBill(input: Parameters<PostingAdapter['postBill']>[0]) {
    const request = PostingRequestSchema.parse(input);
    const prior = this.receipts.get(request.idempotencyKey);
    if (prior) return { ...prior, status: 'already_posted' as const };
    const receipt = PostingReceiptSchema.parse({
      status: 'posted',
      providerId: 'fixture',
      externalBillId: `fixture-${request.idempotencyKey.slice(0, 16)}`,
      postedAt: new Date().toISOString(),
      idempotencyKey: request.idempotencyKey,
    });
    this.receipts.set(request.idempotencyKey, receipt);
    return receipt;
  }
}
