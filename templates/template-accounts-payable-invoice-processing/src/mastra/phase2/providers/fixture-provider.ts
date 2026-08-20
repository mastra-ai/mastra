import {
  FixtureGoodsReceiptRepository,
  FixturePostingAdapter,
  FixturePurchaseOrderRepository,
  FixtureSanctionsScreener,
  FixtureVendorRepository,
  fixtureDb,
} from '../adapters/fixture.ts';
import { assertProvider, type AccountingProvider } from './types.ts';

export const fixtureProvider: AccountingProvider = assertProvider({
  id: 'fixture',
  displayName: 'Fixture accounting data',
  capabilities: {
    vendors: true,
    vendorBankDetails: true,
    vendorStatusRichness: 'full',
    purchaseOrders: true,
    goodsReceipts: true,
    billHistory: true,
    sanctions: true,
    invoiceChannel: true,
    posting: true,
  },
  vendors: new FixtureVendorRepository(),
  purchaseOrders: new FixturePurchaseOrderRepository(),
  goodsReceipts: new FixtureGoodsReceiptRepository(),
  sanctions: new FixtureSanctionsScreener(),
  billHistorySeed: async () => structuredClone(fixtureDb.priorInvoices),
  posting: new FixturePostingAdapter(),
  identityNamespaces: {
    vendors: 'fixture',
    purchaseOrders: 'fixture',
    purchaseOrderVendorIds: 'fixture',
    goodsReceipts: 'fixture',
    billHistoryVendorIds: 'fixture',
    postingVendorIds: 'fixture',
    postingPurchaseOrders: 'fixture',
  },
});
