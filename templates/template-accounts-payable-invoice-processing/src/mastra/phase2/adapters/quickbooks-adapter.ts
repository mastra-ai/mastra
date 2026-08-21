import { toMinorUnits } from '../money.ts';
import {
  ProviderUnavailableError,
  type PurchaseOrderRepository,
  type VendorLookup,
  type VendorRepository,
} from '../ports.ts';
import { PriorInvoiceSchema, PurchaseOrderSchema, VendorRecordSchema, type PriorInvoice } from '../schemas.ts';

type Ref = { value?: string; name?: string };
type QboLine = {
  Amount?: number;
  Description?: string;
  ItemBasedExpenseLineDetail?: { ItemRef?: Ref; Qty?: number; UnitPrice?: number };
};
export type QboVendor = {
  Id?: string;
  DisplayName?: string;
  Active?: boolean;
  TaxIdentifier?: string;
};
export type QboPurchaseOrder = {
  Id?: string;
  DocNumber?: string;
  VendorRef?: Ref;
  CurrencyRef?: Ref;
  TotalAmt?: number;
  Line?: QboLine[];
};
export type QboBill = {
  Id?: string;
  DocNumber?: string;
  VendorRef?: Ref;
  CurrencyRef?: Ref;
  TotalAmt?: number;
  TxnDate?: string;
  PrivateNote?: string;
};
export interface QboClient {
  query<T>(entity: string, query: string): Promise<T[]>;
}
export class QboUnavailableError extends ProviderUnavailableError {
  constructor(operation: string, options?: { cause?: unknown; retryable?: boolean }) {
    super('quickbooks', operation, options);
    this.name = 'QboUnavailableError';
  }
}
const quote = (value: string) => value.replaceAll('\\', '\\\\').replaceAll("'", "\\'");
const identity = (value: string) => value.replace(/[^a-z0-9]/gi, '').toLowerCase();
const required = (value: string | undefined, field: string) => {
  if (!value) throw new Error(`QuickBooks ${field} missing`);
  return value;
};
export const mapQboVendor = (row: QboVendor) =>
  VendorRecordSchema.parse({
    id: required(row.Id, 'Vendor.Id'),
    name: required(row.DisplayName, 'Vendor.DisplayName'),
    taxId: row.TaxIdentifier ?? null,
    status: row.Active === false ? 'inactive' : 'approved',
    bankDetailsFingerprint: null,
  });
export const mapQboPurchaseOrder = (row: QboPurchaseOrder) => {
  const currency = row.CurrencyRef?.value ?? 'USD';
  return PurchaseOrderSchema.parse({
    id: required(row.Id, 'PurchaseOrder.Id'),
    poNumber: required(row.DocNumber, 'PurchaseOrder.DocNumber'),
    vendorId: required(row.VendorRef?.value, 'PurchaseOrder.VendorRef'),
    currency,
    totalMinor: toMinorUnits(row.TotalAmt ?? 0, currency),
    lines: (row.Line ?? [])
      .filter(line => line.ItemBasedExpenseLineDetail)
      .map(line => {
        const detail = line.ItemBasedExpenseLineDetail!,
          qty = detail.Qty ?? 0,
          amount = line.Amount ?? 0;
        return {
          sku: detail.ItemRef?.value ?? null,
          description: line.Description ?? detail.ItemRef?.name ?? '',
          qty,
          unitPriceMinor: toMinorUnits(detail.UnitPrice ?? (qty ? amount / qty : 0), currency),
          lineTotalMinor: toMinorUnits(amount, currency),
        };
      }),
  });
};
export const mapQboBill = (row: QboBill) => {
  const currency = row.CurrencyRef?.value ?? 'USD';
  return PriorInvoiceSchema.parse({
    id: required(row.Id, 'Bill.Id'),
    vendorId: required(row.VendorRef?.value, 'Bill.VendorRef'),
    invoiceNumber: row.DocNumber?.trim() || null,
    invoiceDate: required(row.TxnDate, 'Bill.TxnDate'),
    currency,
    totalMinor: toMinorUnits(row.TotalAmt ?? 0, currency),
    channel: null,
  });
};

export class HttpQboClient implements QboClient {
  constructor(
    private readonly realmId: string,
    private readonly accessToken: string,
    private readonly baseUrl = 'https://sandbox-quickbooks.api.intuit.com',
    private readonly timeoutMs = 30_000,
  ) {
    if (!Number.isSafeInteger(timeoutMs) || timeoutMs < 1)
      throw new Error('QuickBooks request timeout must be a positive integer');
  }
  async query<T>(entity: string, query: string): Promise<T[]> {
    try {
      const response = await fetch(
        `${this.baseUrl}/v3/company/${this.realmId}/query?query=${encodeURIComponent(query)}&minorversion=75`,
        {
          headers: { Authorization: `Bearer ${this.accessToken}`, Accept: 'application/json' },
          signal: AbortSignal.timeout(this.timeoutMs),
        },
      );
      if (!response.ok) {
        const retryable = response.status === 408 || response.status === 429 || response.status >= 500;
        throw new QboUnavailableError(`query ${entity} returned HTTP ${response.status}`, { retryable });
      }
      const body = (await response.json()) as { QueryResponse?: Record<string, T[]> };
      return body.QueryResponse?.[entity] ?? [];
    } catch (error) {
      if (error instanceof ProviderUnavailableError) throw error;
      throw new QboUnavailableError(`query ${entity}`, { cause: error });
    }
  }
}
export class QuickBooksAdapter implements VendorRepository, PurchaseOrderRepository {
  constructor(
    private readonly client: QboClient,
    private readonly billPageSize = 1000,
    private readonly billPageLimit = 100,
  ) {
    if (!Number.isInteger(billPageSize) || billPageSize < 1 || billPageSize > 1000)
      throw new Error('QuickBooks bill page size must be an integer from 1 to 1000');
    if (!Number.isInteger(billPageLimit) || billPageLimit < 1)
      throw new Error('QuickBooks bill page limit must be a positive integer');
  }
  async find(input: VendorLookup) {
    const rows = await this.client.query<QboVendor>(
      'Vendor',
      `select * from Vendor where DisplayName = '${quote(input.name)}'`,
    );
    const vendors = rows.map(mapQboVendor);
    const taxId = input.taxId;
    if (!taxId) return vendors;
    const taxMatches = vendors.filter(vendor => vendor.taxId && identity(vendor.taxId) === identity(taxId));
    return taxMatches.length ? taxMatches : vendors;
  }
  async findByNumber(poNumber: string) {
    const rows = await this.client.query<QboPurchaseOrder>(
      'PurchaseOrder',
      `select * from PurchaseOrder where DocNumber = '${quote(poNumber)}'`,
    );
    return rows.map(mapQboPurchaseOrder);
  }
  async billHistorySeed(): Promise<PriorInvoice[]> {
    const rows: QboBill[] = [];
    for (let pageNumber = 0; pageNumber < this.billPageLimit; pageNumber++) {
      const start = pageNumber * this.billPageSize + 1;
      const page = await this.client.query<QboBill>(
        'Bill',
        `select * from Bill startposition ${start} maxresults ${this.billPageSize}`,
      );
      rows.push(...page);
      if (page.length < this.billPageSize) return rows.map(mapQboBill);
    }
    throw new QboUnavailableError('bill history result window exhausted', { retryable: false });
  }
}
