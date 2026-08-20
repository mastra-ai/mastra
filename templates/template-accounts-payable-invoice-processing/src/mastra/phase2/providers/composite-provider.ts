import {
  ReferenceCrosswalkError,
  type GoodsReceiptRepository,
  type PostingAdapter,
  type PurchaseOrderRepository,
} from '../ports.ts';
import { assertProvider, sourceId, type AccountingProvider, type CompositeIdentityConfig } from './types.ts';

export interface CompositeProviderConfig {
  id: string;
  displayName: string;
  vendors?: AccountingProvider;
  purchaseOrders?: AccountingProvider;
  goodsReceipts?: AccountingProvider;
  sanctions?: AccountingProvider;
  billHistory?: AccountingProvider;
  posting?: AccountingProvider;
  identity?: CompositeIdentityConfig;
}
const shared = (from: string, to: string, config?: CompositeIdentityConfig) =>
  from === to && (!config?.sharedReferenceNamespace || config.sharedReferenceNamespace === from);
class CrosswalkPurchaseOrderRepository implements PurchaseOrderRepository {
  constructor(
    private readonly delegate: PurchaseOrderRepository,
    private readonly from: string,
    private readonly to: string,
    private readonly config: CompositeIdentityConfig,
  ) {}
  async findByNumber(poNumber: string) {
    return Promise.all(
      (await this.delegate.findByNumber(poNumber)).map(async po => {
        const mapped = await this.config.crosswalk?.mapVendorId?.({
          id: po.vendorId,
          fromNamespace: this.from,
          toNamespace: this.to,
        });
        if (!mapped) throw new ReferenceCrosswalkError('vendor', po.vendorId);
        return { ...po, vendorId: mapped };
      }),
    );
  }
}
class CrosswalkReceiptRepository implements GoodsReceiptRepository {
  constructor(
    private readonly delegate: GoodsReceiptRepository,
    private readonly from: string,
    private readonly to: string,
    private readonly config: CompositeIdentityConfig,
  ) {}
  async findByPurchaseOrderId(id: string) {
    const mapped = await this.config.crosswalk?.mapPurchaseOrderId?.({
      id,
      fromNamespace: this.from,
      toNamespace: this.to,
    });
    if (!mapped) throw new ReferenceCrosswalkError('purchaseOrder', id);
    return (await this.delegate.findByPurchaseOrderId(mapped)).map(receipt => ({
      ...receipt,
      purchaseOrderId: id,
    }));
  }
}
class CrosswalkPostingAdapter implements PostingAdapter {
  constructor(
    private readonly delegate: PostingAdapter,
    private readonly vendorNamespaces?: [string, string],
    private readonly poNamespaces?: [string, string],
    private readonly config?: CompositeIdentityConfig,
  ) {}
  async postBill(input: Parameters<PostingAdapter['postBill']>[0]) {
    const vendorId = this.vendorNamespaces
      ? await this.config?.crosswalk?.mapVendorId?.({
          id: input.vendor.id,
          fromNamespace: this.vendorNamespaces[0],
          toNamespace: this.vendorNamespaces[1],
        })
      : input.vendor.id;
    const poId =
      input.purchaseOrder && this.poNamespaces
        ? await this.config?.crosswalk?.mapPurchaseOrderId?.({
            id: input.purchaseOrder.id,
            fromNamespace: this.poNamespaces[0],
            toNamespace: this.poNamespaces[1],
          })
        : input.purchaseOrder?.id;
    if (!vendorId) throw new ReferenceCrosswalkError('vendor', input.vendor.id);
    if (input.purchaseOrder && !poId) throw new ReferenceCrosswalkError('purchaseOrder', input.purchaseOrder.id);
    return this.delegate.postBill({
      ...input,
      vendor: { ...input.vendor, id: vendorId },
      purchaseOrder: input.purchaseOrder ? { ...input.purchaseOrder, id: poId!, vendorId } : null,
    });
  }
}
export function makeCompositeProvider(config: CompositeProviderConfig): AccountingProvider {
  const vendor = config.vendors,
    po = config.purchaseOrders,
    receipt = config.goodsReceipts,
    sanctions = config.sanctions,
    history = config.billHistory,
    postingSource = config.posting;
  let purchaseOrders = po?.purchaseOrders,
    goodsReceipts = receipt?.goodsReceipts,
    billHistorySeed = history?.billHistorySeed,
    posting = postingSource?.posting;
  if (vendor && po && vendor.id !== po.id) {
    const from = po.identityNamespaces?.purchaseOrderVendorIds,
      to = vendor.identityNamespaces?.vendors;
    if (!from || !to) throw new Error('Composite vendor/PO sources must declare identity namespaces');
    if (!shared(from, to, config.identity) && !config.identity?.crosswalk?.mapVendorId)
      throw new Error('Composite vendor/PO sources require a shared namespace or vendor ID crosswalk');
    if (!shared(from, to, config.identity) && purchaseOrders)
      purchaseOrders = new CrosswalkPurchaseOrderRepository(purchaseOrders, from, to, config.identity!);
  }
  if (po && receipt && po.id !== receipt.id) {
    const from = po.identityNamespaces?.purchaseOrders,
      to = receipt.identityNamespaces?.goodsReceipts;
    if (!from || !to) throw new Error('Composite PO/receipt sources must declare identity namespaces');
    if (!shared(from, to, config.identity) && !config.identity?.crosswalk?.mapPurchaseOrderId)
      throw new Error('Composite PO/receipt sources require a shared namespace or purchase-order ID crosswalk');
    if (!shared(from, to, config.identity) && goodsReceipts)
      goodsReceipts = new CrosswalkReceiptRepository(goodsReceipts, from, to, config.identity!);
  }
  if (vendor && history && vendor.id !== history.id) {
    const from = history.identityNamespaces?.billHistoryVendorIds,
      to = vendor.identityNamespaces?.vendors;
    if (!from || !to) throw new Error('Composite vendor/history sources must declare identity namespaces');
    if (!shared(from, to, config.identity) && !config.identity?.crosswalk?.mapVendorId)
      throw new Error('Composite vendor/history sources require a shared namespace or vendor ID crosswalk');
    if (!shared(from, to, config.identity) && billHistorySeed) {
      const seed = billHistorySeed;
      billHistorySeed = async () =>
        Promise.all(
          (await seed()).map(async invoice => {
            const mapped = await config.identity!.crosswalk!.mapVendorId!({
              id: invoice.vendorId,
              fromNamespace: from,
              toNamespace: to,
            });
            if (!mapped) throw new ReferenceCrosswalkError('vendor', invoice.vendorId);
            return { ...invoice, vendorId: mapped };
          }),
        );
    }
  }
  if (posting) {
    const vendorFrom = vendor?.identityNamespaces?.vendors,
      vendorTo = postingSource?.identityNamespaces?.postingVendorIds;
    const poFrom = po?.identityNamespaces?.purchaseOrders,
      poTo = postingSource?.identityNamespaces?.postingPurchaseOrders;
    if (!vendorFrom || !vendorTo) throw new Error('Composite vendor/posting sources must declare identity namespaces');
    if (po && (!poFrom || !poTo)) throw new Error('Composite PO/posting sources must declare identity namespaces');
    const vendorPair = shared(vendorFrom, vendorTo, config.identity)
      ? undefined
      : ([vendorFrom, vendorTo] as [string, string]);
    const poPair = po && !shared(poFrom!, poTo!, config.identity) ? ([poFrom!, poTo!] as [string, string]) : undefined;
    if (vendorPair && !config.identity?.crosswalk?.mapVendorId)
      throw new Error('Composite vendor/posting sources require a shared namespace or vendor ID crosswalk');
    if (poPair && !config.identity?.crosswalk?.mapPurchaseOrderId)
      throw new Error('Composite PO/posting sources require a shared namespace or purchase-order ID crosswalk');
    if (vendorPair || poPair) posting = new CrosswalkPostingAdapter(posting, vendorPair, poPair, config.identity);
  }
  return assertProvider({
    id: config.id,
    displayName: config.displayName,
    capabilities: {
      vendors: Boolean(vendor?.vendors),
      vendorBankDetails: vendor?.capabilities.vendorBankDetails ?? false,
      vendorStatusRichness: vendor?.capabilities.vendorStatusRichness ?? 'none',
      purchaseOrders: Boolean(purchaseOrders),
      goodsReceipts: Boolean(goodsReceipts),
      sanctions: Boolean(sanctions?.sanctions),
      billHistory: Boolean(billHistorySeed),
      invoiceChannel: history?.capabilities.invoiceChannel ?? false,
      posting: Boolean(posting),
    },
    vendors: vendor?.vendors,
    purchaseOrders,
    goodsReceipts,
    sanctions: sanctions?.sanctions,
    billHistorySeed,
    posting,
    sources: {
      ...(vendor && { vendors: sourceId(vendor, 'vendors') }),
      ...(po && { purchaseOrders: sourceId(po, 'purchaseOrders') }),
      ...(receipt && { goodsReceipts: sourceId(receipt, 'goodsReceipts') }),
      ...(sanctions && { sanctions: sourceId(sanctions, 'sanctions') }),
      ...(history && { billHistory: sourceId(history, 'billHistory') }),
      ...(postingSource && { posting: sourceId(postingSource, 'posting') }),
    },
    identityNamespaces: {
      vendors: vendor?.identityNamespaces?.vendors,
      purchaseOrders: po?.identityNamespaces?.purchaseOrders,
      purchaseOrderVendorIds: vendor?.identityNamespaces?.vendors,
      goodsReceipts: po?.identityNamespaces?.purchaseOrders,
      billHistoryVendorIds: vendor?.identityNamespaces?.vendors,
      postingVendorIds: vendor?.identityNamespaces?.vendors,
      postingPurchaseOrders: po?.identityNamespaces?.purchaseOrders,
    },
  });
}
