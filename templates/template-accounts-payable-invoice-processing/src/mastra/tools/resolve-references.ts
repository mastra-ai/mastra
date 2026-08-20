import type { ExtractedInvoice } from '../schemas/invoice.ts';

const vendors: Record<string, string> = {
  'acme supplies': 'vendor_acme',
  'northwind trading': 'vendor_northwind',
};
const purchaseOrders: Record<string, string> = { 'PO-1001': 'po_1001', 'PO-2002': 'po_2002' };
export const resolveReferences = (invoice: ExtractedInvoice) => ({
  vendorId: vendors[invoice.vendorName.trim().toLowerCase()] ?? null,
  poId: invoice.poNumber ? (purchaseOrders[invoice.poNumber.trim().toUpperCase()] ?? null) : null,
});
