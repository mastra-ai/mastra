import { createQuickBooksMcpToolClient, type McpToolClient } from '../adapters/mcp-tool-client.ts';
import { QuickBooksMcpAdapter, type QuickBooksMcpPostingConfig } from '../adapters/quickbooks-mcp-adapter.ts';
import { assertProvider, type AccountingProvider } from './types.ts';

export function resolveQuickBooksMcpConfiguration(): {
  postingEnabled: boolean;
  postingConfig?: QuickBooksMcpPostingConfig;
} {
  const postingValue = process.env.QBO_MCP_ENABLE_POSTING?.trim().toLowerCase();
  if (postingValue && !['true', 'false'].includes(postingValue))
    throw new Error('QBO_MCP_ENABLE_POSTING must be true or false');
  const postingEnabled = postingValue === 'true',
    expenseAccountId = process.env.QBO_MCP_EXPENSE_ACCOUNT_ID?.trim();
  if (postingEnabled && !expenseAccountId)
    throw new Error('QBO_MCP_EXPENSE_ACCOUNT_ID is required when QuickBooks MCP posting is enabled');
  if (postingEnabled && process.env.QBO_MCP_SINGLE_WRITER?.trim().toLowerCase() !== 'true')
    throw new Error('QBO_MCP_SINGLE_WRITER=true is required when QuickBooks MCP posting is enabled');
  return {
    postingEnabled,
    postingConfig: postingEnabled
      ? {
          expenseAccountId: expenseAccountId!,
          taxAccountId: process.env.QBO_MCP_TAX_ACCOUNT_ID?.trim(),
          apAccountId: process.env.QBO_MCP_AP_ACCOUNT_ID?.trim(),
          lockDirectory: process.env.QBO_MCP_POSTING_LOCK_DIR?.trim(),
        }
      : undefined,
  };
}

export function makeQuickBooksMcpProvider(client?: McpToolClient): AccountingProvider {
  const { postingEnabled, postingConfig } = resolveQuickBooksMcpConfiguration();
  const resolvedClient = client ?? createQuickBooksMcpToolClient({ enablePosting: postingEnabled });
  const adapter = new QuickBooksMcpAdapter(resolvedClient, 1000, postingConfig);
  return assertProvider({
    id: 'quickbooks-mcp',
    displayName: 'QuickBooks Online MCP',
    capabilities: {
      vendors: true,
      vendorBankDetails: false,
      vendorStatusRichness: 'binary',
      purchaseOrders: true,
      goodsReceipts: false,
      billHistory: true,
      sanctions: false,
      invoiceChannel: false,
      posting: postingEnabled,
    },
    vendors: adapter,
    purchaseOrders: adapter,
    billHistorySeed: () => adapter.billHistorySeed(),
    posting: postingEnabled ? adapter : undefined,
    identityNamespaces: {
      vendors: 'quickbooks',
      purchaseOrders: 'quickbooks',
      purchaseOrderVendorIds: 'quickbooks',
      billHistoryVendorIds: 'quickbooks',
      postingVendorIds: 'quickbooks',
      postingPurchaseOrders: 'quickbooks',
    },
  });
}
