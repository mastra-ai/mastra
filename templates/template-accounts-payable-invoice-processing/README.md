# Accounts Payable Invoice Processing

Turn an invoice into a verified AP decision from one Mastra Studio message. The agent reads the document, checks it against accounting data, and either posts the bill or asks for approval.

## Why we built this

Real invoices are inconsistent, and production AP work spans several systems. We built this template to show an agent that coordinates multiple tools, handles that mess, and keeps vendor validation, matching, duplicate detection, approvals, and posting deterministic.

## Features

- Processes PDF, PNG, and JPEG invoices in Studio
- Validates vendors and performs two- or three-way PO matching
- Detects duplicates and routes exceptions for review
- Pauses high-value invoices for explicit approval
- Keeps accounting access behind a provider interface and includes a QuickBooks connector

## Quickstart

```bash
npx create-mastra@latest --template accounts-payable-invoice-processing
cd accounts-payable-invoice-processing
cp .env.example .env
# Configure OpenAI and an accounting provider in .env
npm run dev
```

Open [localhost:4111](http://localhost:4111), select **Accounts Payable Agent**, attach an invoice that matches data in your accounting sandbox, and say:

> Process the attached invoice.

To approve a suspended invoice, reply with its run ID:

```text
Approve invoice run <RUN_ID>. Comment: Reviewed in Studio.
```

## Accounting providers

The workflow depends on the provider-neutral `AccountingProvider` interface. QuickBooks MCP is the included adapter, selected with `ACCOUNTING_PROVIDER=quickbooks-mcp`. To use NetSuite or another accounting system, implement that interface and add its factory to the provider loader; the invoice controls and workflow do not need to change.

Production providers should also implement `screenVendor`. If screening is unavailable, the workflow fails closed by routing the invoice to review instead of posting it. A sandbox can explicitly set `AP_ALLOW_UNSCREENED_VENDORS=true`; this bypass is recorded in the vendor decision and should remain `false` in production.

For a QuickBooks sandbox demo, authenticate Intuit's [QuickBooks Online MCP server](https://github.com/intuit/quickbooks-online-mcp-server), then provide its built entry point, token store, and QuickBooks account IDs. Use a unique invoice number that matches an active sandbox vendor and PO. To test posting without a screening integration, acknowledge the sandbox-only bypass above. Posted bills appear under **Expenses & bills → Bills**.

## Policy

Configure approval threshold, amount tolerance, and extraction-confidence threshold with the `AP_*` variables documented in `.env.example`. Monetary settings use integer minor units: `100000` represents USD 1,000 for a USD invoice.
