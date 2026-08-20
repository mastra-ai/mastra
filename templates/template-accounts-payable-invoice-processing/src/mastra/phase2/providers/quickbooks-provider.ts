import { HttpQboClient, QuickBooksAdapter, type QboClient } from '../adapters/quickbooks-adapter.ts';
import { assertProvider, type AccountingProvider } from './types.ts';

export function makeQuickBooksProvider(client?: QboClient, billPageSize?: number): AccountingProvider {
  const resolved =
    client ??
    (() => {
      const realmId = process.env.QBO_REALM_ID,
        accessToken = process.env.QBO_ACCESS_TOKEN;
      if (!realmId || !accessToken) throw new Error('QuickBooks requires QBO_REALM_ID and QBO_ACCESS_TOKEN');
      return new HttpQboClient(realmId, accessToken, process.env.QBO_BASE_URL);
    })();
  const adapter = new QuickBooksAdapter(resolved, billPageSize);
  return assertProvider({
    id: 'quickbooks',
    displayName: 'QuickBooks Online',
    capabilities: {
      vendors: true,
      vendorBankDetails: false,
      vendorStatusRichness: 'binary',
      purchaseOrders: true,
      goodsReceipts: false,
      billHistory: true,
      sanctions: false,
      invoiceChannel: false,
      posting: false,
    },
    vendors: adapter,
    purchaseOrders: adapter,
    billHistorySeed: () => adapter.billHistorySeed(),
    identityNamespaces: {
      vendors: 'quickbooks',
      purchaseOrders: 'quickbooks',
      purchaseOrderVendorIds: 'quickbooks',
      billHistoryVendorIds: 'quickbooks',
    },
  });
}
