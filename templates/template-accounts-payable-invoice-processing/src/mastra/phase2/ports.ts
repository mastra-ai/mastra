import type {
  GoodsReceipt,
  PolicyConfig,
  PostingReceipt,
  PostingRequest,
  PriorInvoice,
  PurchaseOrder,
  SanctionsResult,
  VendorRecord,
} from './schemas.ts';

export type VendorLookup = { name: string; taxId?: string | null };
export interface VendorRepository {
  find(input: VendorLookup): Promise<VendorRecord[]>;
}
export interface PurchaseOrderRepository {
  findByNumber(poNumber: string): Promise<PurchaseOrder[]>;
}
export interface GoodsReceiptRepository {
  findByPurchaseOrderId(purchaseOrderId: string): Promise<GoodsReceipt[]>;
}
export interface InvoiceHistoryRepository {
  findPotentialDuplicates(input: {
    vendorId: string;
    invoiceNumber: string;
    currency: string;
    totalMinor: number;
  }): Promise<PriorInvoice[]>;
  seed(invoices: PriorInvoice[]): Promise<void>;
  save(invoice: PriorInvoice): Promise<void>;
}
export interface SanctionsScreener {
  screen(vendor: VendorRecord): Promise<SanctionsResult>;
}
export interface PolicyProvider {
  getPolicy(): Promise<PolicyConfig>;
}
export interface VendorStatusRestrictionSource {
  getRestriction(input: { providerId: string; vendorId: string }): Promise<'on_hold' | 'blocked' | null>;
}
export interface ReferenceCrosswalk {
  mapVendorId?(input: { id: string; fromNamespace: string; toNamespace: string }): Promise<string | null>;
  mapPurchaseOrderId?(input: { id: string; fromNamespace: string; toNamespace: string }): Promise<string | null>;
}
export interface PostingAdapter {
  postBill(input: PostingRequest): Promise<PostingReceipt>;
}

export class ReferenceCrosswalkError extends Error {
  constructor(
    readonly entity: 'vendor' | 'purchaseOrder',
    readonly id: string,
  ) {
    super(`No ${entity} crosswalk for ${id}`);
    this.name = 'ReferenceCrosswalkError';
  }
}

export class ProviderUnavailableError extends Error {
  readonly retryable = true;
  constructor(
    readonly providerId: string,
    readonly operation: string,
    options?: { cause?: unknown },
  ) {
    super(`${providerId} unavailable during ${operation}`, options);
    this.name = 'ProviderUnavailableError';
  }
}
export class PostingConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PostingConflictError';
  }
}
