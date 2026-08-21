import type { GoodsReceiptRepository, PurchaseOrderRepository, VendorLookup, VendorRepository } from './ports.ts';
import { ProviderUnavailableError } from './ports.ts';
import {
  GoodsReceiptSchema,
  PostingReceiptSchema,
  PriorInvoiceSchema,
  PurchaseOrderSchema,
  SanctionsResultSchema,
  VendorRecordSchema,
  type PostingRequest,
} from './schemas.ts';
import { assertProvider, type AccountingProvider } from './providers/types.ts';

export interface FaultingVendorCase {
  repository: VendorRepository;
  lookup: VendorLookup;
}
export interface FaultingPurchaseOrderCase {
  repository: PurchaseOrderRepository;
  poNumber: string;
}
export interface FaultingGoodsReceiptCase {
  repository: GoodsReceiptRepository;
  purchaseOrderId: string;
}
export interface ProviderConformanceCases {
  vendors?: { found: VendorLookup; missing: VendorLookup; transportFailure?: FaultingVendorCase };
  purchaseOrders?: { found: string; missing: string; transportFailure?: FaultingPurchaseOrderCase };
  goodsReceipts?: { found: string; missing: string; transportFailure?: FaultingGoodsReceiptCase };
  posting?: PostingRequest;
}
export interface ConformanceReport {
  providerId: string;
  checks: string[];
}

const check = (condition: unknown, message: string) => {
  if (!condition) throw new Error(message);
};
async function expectUnavailable(run: () => Promise<unknown>, label: string) {
  try {
    await run();
  } catch (error) {
    check(error instanceof ProviderUnavailableError, `${label} must throw ProviderUnavailableError`);
    return;
  }
  throw new Error(`${label} must fail instead of returning an empty result`);
}
export async function runProviderConformance(
  provider: AccountingProvider,
  cases: ProviderConformanceCases,
  options: { allowPosting?: boolean } = {},
): Promise<ConformanceReport> {
  assertProvider(provider);
  const checks: string[] = [];
  const absent = (capability: boolean, port: unknown, name: string) => {
    check(capability === Boolean(port), `${name} capability and port disagree`);
    if (!capability) checks.push(`${name}: absent as declared`);
  };
  absent(provider.capabilities.vendors, provider.vendors, 'vendors');
  absent(provider.capabilities.purchaseOrders, provider.purchaseOrders, 'purchaseOrders');
  absent(provider.capabilities.goodsReceipts, provider.goodsReceipts, 'goodsReceipts');
  absent(provider.capabilities.sanctions, provider.sanctions, 'sanctions');
  absent(provider.capabilities.billHistory, provider.billHistorySeed, 'billHistory');
  absent(provider.capabilities.posting, provider.posting, 'posting');

  if (provider.vendors) {
    check(cases.vendors, 'Vendor conformance cases are required');
    const found = await provider.vendors.find(cases.vendors!.found);
    check(found.length > 0, 'Known vendor was not found');
    found.forEach(value => VendorRecordSchema.parse(value));
    check((await provider.vendors.find(cases.vendors!.missing)).length === 0, 'Missing vendor must return []');
    if (cases.vendors!.transportFailure)
      await expectUnavailable(
        () => cases.vendors!.transportFailure!.repository.find(cases.vendors!.transportFailure!.lookup),
        'Vendor transport failure',
      );
    checks.push('vendors: canonical found, miss, and failure behavior');
  }
  if (provider.purchaseOrders) {
    check(cases.purchaseOrders, 'Purchase-order conformance cases are required');
    const found = await provider.purchaseOrders.findByNumber(cases.purchaseOrders!.found);
    check(found.length > 0, 'Known purchase order was not found');
    found.forEach(value => PurchaseOrderSchema.parse(value));
    check(
      (await provider.purchaseOrders.findByNumber(cases.purchaseOrders!.missing)).length === 0,
      'Missing purchase order must return []',
    );
    if (cases.purchaseOrders!.transportFailure)
      await expectUnavailable(
        () =>
          cases.purchaseOrders!.transportFailure!.repository.findByNumber(
            cases.purchaseOrders!.transportFailure!.poNumber,
          ),
        'Purchase-order transport failure',
      );
    checks.push('purchaseOrders: canonical found, miss, and failure behavior');
  }
  if (provider.goodsReceipts) {
    check(cases.goodsReceipts, 'Goods-receipt conformance cases are required');
    const found = await provider.goodsReceipts.findByPurchaseOrderId(cases.goodsReceipts!.found);
    check(found.length > 0, 'Known goods receipt was not found');
    found.forEach(value => GoodsReceiptSchema.parse(value));
    check(
      (await provider.goodsReceipts.findByPurchaseOrderId(cases.goodsReceipts!.missing)).length === 0,
      'Missing goods receipt must return []',
    );
    if (cases.goodsReceipts!.transportFailure)
      await expectUnavailable(
        () =>
          cases.goodsReceipts!.transportFailure!.repository.findByPurchaseOrderId(
            cases.goodsReceipts!.transportFailure!.purchaseOrderId,
          ),
        'Goods-receipt transport failure',
      );
    checks.push('goodsReceipts: canonical found, miss, and failure behavior');
  }
  if (provider.sanctions) {
    check(cases.vendors, 'Vendor cases are required to test sanctions');
    const [vendor] = (await provider.vendors?.find(cases.vendors!.found)) ?? [];
    check(vendor, 'Known vendor is required to test sanctions');
    SanctionsResultSchema.parse(await provider.sanctions.screen(vendor!));
    checks.push('sanctions: canonical result');
  }
  if (provider.billHistorySeed) {
    const history = await provider.billHistorySeed();
    history.forEach(value => PriorInvoiceSchema.parse(value));
    checks.push('billHistory: canonical seed');
  }
  if (provider.posting) {
    if (!options.allowPosting) checks.push('posting: skipped; explicit allowPosting opt-in required');
    else {
      check(cases.posting, 'Posting conformance case is required');
      const first = PostingReceiptSchema.parse(await provider.posting.postBill(cases.posting!)),
        second = PostingReceiptSchema.parse(await provider.posting.postBill(cases.posting!));
      check(
        first.idempotencyKey === second.idempotencyKey && second.status === 'already_posted',
        'Posting must be idempotent',
      );
      checks.push('posting: canonical and idempotent receipt');
    }
  }
  return { providerId: provider.id, checks };
}
