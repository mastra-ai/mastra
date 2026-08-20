# Live QuickBooks Sandbox Invoice Test Pack

This checklist is only needed when testing the optional QuickBooks integration. The default Studio demo uses local fixtures and does not require QuickBooks credentials.

Create one PDF per case below and upload it to **Accounts Payable Agent** in Mastra Studio.

## Before testing

- Use a fresh `Invoice #` every time unless the case intentionally tests a duplicate.
- Current approval threshold is **USD 1,000.00**. It triggers only when the total is greater than USD 1,000.00.
- For a real Bill write, set `QBO_MCP_ENABLE_POSTING=true` and configure the required QBO account IDs. Otherwise the workflow will validate and route, but will not create a Bill.
- The QBO adapter compares invoice `SKU` to QuickBooks' **internal Item ID**, not its visible Item name. The current sandbox IDs used below are `5`, `11`, `16`, and `17`.
- The live QBO MCP has no goods-receipt tool, so all otherwise-valid QBO invoices visibly complete as a **two-way** match.

## Existing sandbox data

| PO     | Vendor                               | Currency | Lines                                                                                                                                              |  Total |
| ------ | ------------------------------------ | -------- | -------------------------------------------------------------------------------------------------------------------------------------------------- | -----: |
| `1002` | Tim Philip Masonry                   | USD      | SKU `5`, Rock Fountain, 1 × 125.00                                                                                                                 | 125.00 |
| `1003` | Hicks Hardware                       | USD      | SKU `5`, Rock Fountain, 1 × 125.00; SKU `16`, Sprinkler Heads, 15 × 0.75; SKU `17`, Sprinkler Pipes, 25 × 2.50; SKU `11`, Fountain Pump, 3 × 10.00 | 228.75 |
| `1004` | Norton Lumber and Building Materials | USD      | SKU `11`, Fountain Pump, 8 × 10.00; SKU `5`, Rock Fountain, 1 × 125.00                                                                             | 205.00 |

## Base PDF layout

Use this simple layout for every clean PDF. Change only the highlighted values for a case.

```text
INVOICE
Invoice #: <INVOICE_NUMBER>
Invoice Date: <YYYY-MM-DD>

Vendor: <VENDOR_NAME>
PO Number: <PO_NUMBER>
Currency: <CURRENCY>

SKU | Description | Qty | Unit price | Line total
<SKU> | <DESCRIPTION> | <QTY> | <UNIT_PRICE> | <LINE_TOTAL>

Subtotal: <SUBTOTAL>
Tax: <TAX>
Total: <TOTAL>
```

## Invoice PDFs to create

### 1. Happy path / posting

```text
Invoice #: AP-HP-001
Invoice Date: 2026-08-14
Vendor: Tim Philip Masonry
PO Number: 1002
Currency: USD
SKU | Description | Qty | Unit price | Line total
5 | Rock Fountain | 1 | 125.00 | 125.00
Subtotal: 125.00
Tax: 0.00
Total: 125.00
```

Expected: valid vendor, two-way PO match, no duplicate, `auto_post`; when posting is enabled, a linked QBO Bill is created.

### 2. Approval gate

First create QBO PO `AP-9000` for **Tim Philip Masonry**: SKU `5`, Rock Fountain, quantity `72`, rate `125.00`, total `9,000.00`.

```text
Invoice #: AP-APR-001
Invoice Date: 2026-08-14
Vendor: Tim Philip Masonry
PO Number: AP-9000
Currency: USD
SKU | Description | Qty | Unit price | Line total
5 | Rock Fountain | 72 | 125.00 | 9000.00
Subtotal: 9000.00
Tax: 0.00
Total: 9000.00
```

Expected: `approval_required`; approve to post, reject to finish without a QBO Bill.

### 3. Poor scan / odd layout

Use the same financial data as case 1, but make a visibly degraded scan: skewed, low resolution, partly obscured labels, or unusual table columns.

Expected: `verify_extraction` when the reader reports low overall confidence, low confidence for a required field, or omits a required confidence entry. This is a human extraction check, not a vendor, PO, or duplicate error.

### 4. Missing required field

```text
INVOICE
Vendor: Tim Philip Masonry
PO Number: 1002
Currency: USD
Total: 125.00
```

Omit both invoice number and date.

Expected: extraction verification suspension; it must not invent values.

### 5. Unknown vendor

```text
Invoice #: AP-UNK-001
Invoice Date: 2026-08-14
Vendor: Not A Sandbox Vendor LLC
PO Number: 1002
Currency: USD
SKU | Description | Qty | Unit price | Line total
5 | Rock Fountain | 1 | 125.00 | 125.00
Subtotal: 125.00
Tax: 0.00
Total: 125.00
```

Expected: review with `VENDOR_NOT_FOUND`; no post.

### 6. Inactive vendor

Create a new vendor `AP Inactive Vendor`, create a matching PO `AP-INACTIVE-PO`, then mark the vendor inactive in QBO.

```text
Invoice #: AP-INACTIVE-001
Invoice Date: 2026-08-14
Vendor: AP Inactive Vendor
PO Number: AP-INACTIVE-PO
Currency: USD
SKU | Description | Qty | Unit price | Line total
5 | Rock Fountain | 1 | 125.00 | 125.00
Subtotal: 125.00
Tax: 0.00
Total: 125.00
```

Expected: `blocked` with `VENDOR_NOT_APPROVED`.

### 7. Ambiguous vendor

Not directly reproducible in standard QBO with this adapter: vendor search is exact `DisplayName` matching, and QBO normally prevents duplicate display names. Keep as a future provider/conformance test.

### 8. Different remit-to/bank details

Use case 1 and add this printed footer:

```text
Remit payment to: New Bank Account 999999
```

Expected: QBO has no canonical bank-detail source, so the decision includes `payment_details_unverifiable`. The current extraction schema does not compare the printed bank details.

### 9. Price variance

```text
Invoice #: AP-PRICE-001
Invoice Date: 2026-08-14
Vendor: Tim Philip Masonry
PO Number: 1002
Currency: USD
SKU | Description | Qty | Unit price | Line total
5 | Rock Fountain | 1 | 124.00 | 124.00
Subtotal: 124.00
Tax: 0.00
Total: 124.00
```

Expected: review `PO_MISMATCH`, evidence includes `lines.0.unitPrice` and total mismatch. The current code uses one generic PO-mismatch review type rather than `review_price_variance`.

### 10. Quantity variance

```text
Invoice #: AP-QTY-001
Invoice Date: 2026-08-14
Vendor: Tim Philip Masonry
PO Number: 1002
Currency: USD
SKU | Description | Qty | Unit price | Line total
5 | Rock Fountain | 2 | 125.00 | 250.00
Subtotal: 250.00
Tax: 0.00
Total: 250.00
```

Expected: review `PO_MISMATCH`, evidence includes `lines.0.qty` and total mismatch.

### 11. Missing PO

```text
Invoice #: AP-NOPO-001
Invoice Date: 2026-08-14
Vendor: Tim Philip Masonry
Currency: USD
SKU | Description | Qty | Unit price | Line total
5 | Rock Fountain | 1 | 125.00 | 125.00
Subtotal: 125.00
Tax: 0.00
Total: 125.00
```

Expected: review `PO_NUMBER_MISSING`.

### 12. PO line mismatch

```text
Invoice #: AP-LINE-001
Invoice Date: 2026-08-14
Vendor: Tim Philip Masonry
PO Number: 1002
Currency: USD
SKU | Description | Qty | Unit price | Line total
999 | Unordered Service | 1 | 125.00 | 125.00
Subtotal: 125.00
Tax: 0.00
Total: 125.00
```

Expected: review `PO_MISMATCH`, evidence includes `lines.0.missing`.

### 13. Currency mismatch

```text
Invoice #: AP-FX-001
Invoice Date: 2026-08-14
Vendor: Tim Philip Masonry
PO Number: 1002
Currency: EUR
SKU | Description | Qty | Unit price | Line total
5 | Rock Fountain | 1 | 125.00 | 125.00
Subtotal: 125.00
Tax: 0.00
Total: 125.00
```

Expected **today**: `PO_MISMATCH` with `currency` evidence. FX conversion/matching is not implemented, so this does not meet the proposed “match via FX” expectation.

### 14. No QBO receipts

Reuse case 1.

Expected: successful **two-way** match plus `GOODS_RECEIPTS_UNAVAILABLE`; not a three-way receipt match.

### 15. Duplicate invoice number

Run case 1 with posting enabled, then upload the exact same PDF again.

Expected: duplicate review before a second Bill can be posted.

### 16. Same invoice through a different channel

Use case 15.

Expected: same invoice number is caught as a duplicate. Channel identity itself is not modeled by the QBO provider, so this is not a separate channel-specific test yet.

### 17. Recurring invoice guard

Use a fresh invoice number and a date more than seven days after the earlier comparable invoice.

```text
Invoice #: AP-RECUR-001
Invoice Date: 2026-08-14
Vendor: Tim Philip Masonry
PO Number: 1002
Currency: USD
SKU | Description | Qty | Unit price | Line total
5 | Rock Fountain | 1 | 125.00 | 125.00
Subtotal: 125.00
Tax: 0.00
Total: 125.00
```

Expected: not a duplicate merely because its amount matches a prior invoice outside the seven-day duplicate window.

### 18. Threshold structuring

Not implemented as a cross-invoice anomaly rule. Create two valid invoices at `999.00` only after adding matching QBO POs, but treat this as a future test until structuring detection is added.

### 19. Segregation of duties

Not implemented. The current workflow authenticates the approver but does not capture/request a requester identity to compare against the approver.

### 20. Multi-defect precedence

```text
Invoice #: AP-MULTI-001
Invoice Date: 2026-08-14
Vendor: Not A Sandbox Vendor LLC
PO Number: AP-9000
Currency: USD
SKU | Description | Qty | Unit price | Line total
5 | Rock Fountain | 72 | 125.00 | 9000.00
Subtotal: 9000.00
Tax: 0.00
Total: 9000.00
```

Expected today: vendor review is returned first; downstream PO/approval findings are not bundled because the workflow stops further business checks after a failed vendor decision.

### 21. Posted Bill correctness

Use case 1 or 2 after approval, with posting enabled. In QBO verify the created Bill has the selected vendor, correct total, and linked Purchase Order.

### 22. Posting idempotency

Use case 1 twice with the exact same invoice number after the first has posted.

Expected: no second Bill. At the full-workflow level it is routed as a duplicate before posting; the posting adapter also recognizes an exact prior workflow-created Bill if invoked again.

### 23. Expired/revoked QBO authorization

Do not use a fake invoice. Revoke the sandbox authorization or make the MCP token invalid, then upload case 1.

Expected: lookup failures route as retryable/unknown rather than a false vendor or PO decision. If failure occurs only during the final write, the execution result is `posting_failed` with the integration error.

## Cases intentionally not represented by a PDF alone

| Case       | Required sandbox/config action                                                |
| ---------- | ----------------------------------------------------------------------------- |
| 2          | Create PO `AP-9000` first.                                                    |
| 6          | Create and deactivate a test vendor and matching PO.                          |
| 7          | QBO/provider limitation; exact duplicate names are not a reliable live setup. |
| 15, 16, 22 | First create a Bill via the first upload.                                     |
| 18         | Needs a new structuring-anomaly feature.                                      |
| 19         | Needs requester identity plus segregation-of-duties feature.                  |
| 23         | Revoke/invalidates OAuth/MCP token.                                           |
