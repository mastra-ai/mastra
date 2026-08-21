# QuickBooks sandbox testing

This checklist is only for the optional QuickBooks integration. The default Studio demo uses the included fixtures and needs no QuickBooks account.

## Configure a sandbox

For read-only vendor, PO, and bill-history access:

```bash
export MASTRA_AUTH_TOKEN="$(openssl rand -hex 32)"
export MASTRA_AUTH_USER_ID=quickbooks-reviewer
export AP_ASSESSMENT_SIGNING_KEY="$(openssl rand -hex 32)"
export ACCOUNTING_PROVIDER=quickbooks
export QBO_REALM_ID=your-sandbox-company-id
export QBO_ACCESS_TOKEN=your-oauth-access-token
export QBO_BASE_URL=https://sandbox-quickbooks.api.intuit.com
export SANCTIONS_SCREENING=fixture
npm run dev
```

Keep `MASTRA_AUTH_TOKEN` available for Studio or API authentication. The fixture sanctions screener is for demos only. Bind a real `SanctionsScreener` before using production data.

To test Bill creation through Intuit's MCP server, complete the [MCP setup](./advanced.md#intuit-quickbooks-mcp-server). Posting remains disabled until you explicitly enable it and supply QuickBooks account IDs.

## Prepare test data

In your QuickBooks sandbox, choose or create:

- an active vendor;
- a purchase order for that vendor;
- at least one item-based expense line on the PO.

Use QuickBooks' internal item ID as the invoice SKU. The connector intentionally performs a two-way match because this QuickBooks integration does not provide goods receipts.

Create a PDF or image with values from your sandbox:

```text
INVOICE
Invoice #: <UNIQUE_INVOICE_NUMBER>
Invoice Date: <YYYY-MM-DD>

Vendor: <EXACT_VENDOR_DISPLAY_NAME>
PO Number: <EXACT_PO_NUMBER>
Currency: <PO_CURRENCY>

SKU | Description | Qty | Unit price | Line total
<QBO_ITEM_ID> | <DESCRIPTION> | <QTY> | <UNIT_PRICE> | <LINE_TOTAL>

Subtotal: <SUBTOTAL>
Tax: <TAX>
Total: <TOTAL>
```

Attach it to **Accounts Payable Agent** in Studio and say:

> Process the attached invoice.

A matching invoice below the approval threshold should report a valid vendor, a two-way PO match, no duplicate, and `auto_post`. It creates a QuickBooks Bill only when MCP posting is enabled; otherwise it reports that posting is unavailable.

## Approval test

Create a matching PO and invoice whose total is greater than the configured `approvalThresholdMinor` (USD 1,000 in the fixture policy). The first message should return `approval_required` and a run ID. Reply once with:

```text
Approve invoice run <RUN_ID>. Comment: Approved in sandbox testing.
```

Approval resumes the existing run. Rejection ends it without creating a Bill.

## Control checks

Use a fresh invoice number for each test unless testing duplicates.

| Test                  | Change                                               | Expected result                                             |
| --------------------- | ---------------------------------------------------- | ----------------------------------------------------------- |
| Unknown vendor        | Use a display name absent from the sandbox           | `VENDOR_NOT_FOUND`; no post                                 |
| Missing PO            | Omit the PO number                                   | `PO_NUMBER_MISSING`; no post                                |
| Price variance        | Change a unit price and reconcile the printed totals | `review_price_variance`; no post                            |
| Quantity variance     | Change a quantity and reconcile the printed totals   | `review_quantity_variance`; no post                         |
| Currency mismatch     | Use a currency different from the PO                 | `review_currency_mismatch`; no post                         |
| Duplicate             | Process the same invoice number twice                | `POSSIBLE_DUPLICATE`; no second Bill                        |
| Invalid authorization | Revoke or invalidate the sandbox token               | retryable integration failure, not a false not-found result |

## Verify a posted Bill

In QuickBooks, open **Expenses & bills → Bills** and search for the supplier invoice number (`DocNumber`). Verify the vendor, total, expense account, and linked purchase order. Bills are accounts-payable transactions and do not appear under sales invoices.

The posting adapter also searches before creating a Bill and refuses a conflicting existing invoice number. See [advanced configuration](./advanced.md#intuit-quickbooks-mcp-server) for its idempotency and single-writer safeguards.
