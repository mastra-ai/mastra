import type {
  GoodsReceipt,
  PostingReceipt,
  PostingRequest,
  PriorInvoice,
  PurchaseOrder,
  VendorScreeningResult,
  VendorRecord,
} from "../invoice/schema.ts";

export type VendorLookup = { name: string; taxId?: string | null };

export interface AccountingProvider {
  id: string;
  findVendors(input: VendorLookup): Promise<VendorRecord[]>;
  findPurchaseOrders(poNumber: string): Promise<PurchaseOrder[]>;
  findReceipts?(purchaseOrderId: string): Promise<GoodsReceipt[]>;
  listBills?(): Promise<PriorInvoice[]>;
  screenVendor?(vendor: VendorRecord): Promise<VendorScreeningResult>;
  postBill?(input: PostingRequest): Promise<PostingReceipt>;
}

export interface InvoiceHistory {
  findPotentialDuplicates(input: {
    vendorId: string;
    invoiceNumber: string;
    currency: string;
    totalMinor: number;
  }): Promise<PriorInvoice[]>;
  seed(invoices: PriorInvoice[]): Promise<void>;
  save(invoice: PriorInvoice): Promise<void>;
}

export class ProviderUnavailableError extends Error {
  constructor(providerId: string, operation: string, options?: { cause?: unknown }) {
    super(`${providerId} unavailable during ${operation}`, options);
    this.name = "ProviderUnavailableError";
  }
}
