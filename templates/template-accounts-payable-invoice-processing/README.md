# Accounts Payable Invoice Processing

Turn an invoice into a verified AP decision from one Mastra Studio message. The agent reads a PDF, PNG, or JPEG, checks the extracted fields against accounting data, and either posts the bill, asks for approval, or returns the reasons it needs review.

## Why we built this

Real invoices are inconsistent, and production AP work spans several systems. We built this template to show an agent that coordinates multiple tools, handles that mess, and keeps vendor validation, matching, duplicate detection, approvals, and posting deterministic.

## Prerequisites

- **[OpenAI API key](https://platform.openai.com/api-keys)**: set `OPENAI_API_KEY` with access and available credit for the configured document-reading model. `INVOICE_READER_MODEL` optionally overrides the default `openai/gpt-5.6-sol`; choose a model that accepts PDF and image attachments.
- **[Intuit developer account](https://developer.intuit.com/)**: create an app with QuickBooks Online accounting access and a dedicated sandbox company. Use its Development keys and register `http://localhost:8000/callback` as a redirect URI.
- **[QuickBooks Online MCP server](https://github.com/intuit/quickbooks-online-mcp-server)**: install, build, and authenticate this external server before starting the template. Its writable credential file needs `QUICKBOOKS_CLIENT_ID`, `QUICKBOOKS_CLIENT_SECRET`, `QUICKBOOKS_ENVIRONMENT=sandbox`, and `QUICKBOOKS_REDIRECT_URI=http://localhost:8000/callback`. OAuth adds `QUICKBOOKS_REALM_ID` and `QUICKBOOKS_REFRESH_TOKEN`. Follow the server's [authentication instructions](https://github.com/intuit/quickbooks-online-mcp-server#authentication); Intuit's [OAuth Playground](https://developer.intuit.com/app/developer/qbo/docs/develop/authentication-and-authorization/oauth-2.0-playground) is an additional reference.
- Set `ACCOUNTING_PROVIDER=quickbooks-mcp`, `QBO_MCP_SERVER_PATH` to the absolute compiled MCP entrypoint (`dist/index.js`), and `QBO_MCP_TOKEN_STORE_PATH` to the absolute writable credential file. Keep both credentials and the server installation in an ignored directory such as `.local`.
- Prepare an active sandbox vendor, an item, and a purchase order. Your invoice must name that vendor and PO and match their currency, quantities, unit prices, and totals. Obtain internal account IDs from your sandbox, rather than using account names.
- Posting starts disabled with `QBO_MCP_ENABLE_POSTING=false`. To create bills in the sandbox, set it to `true`, set `QBO_MCP_SINGLE_WRITER=true`, run one posting instance, and set `QBO_MCP_EXPENSE_ACCOUNT_ID`. An invoice with tax also requires `QBO_MCP_TAX_ACCOUNT_ID`. `QBO_MCP_AP_ACCOUNT_ID` optionally selects accounts payable; `QBO_MCP_POSTING_LOCK_DIR` optionally isolates local posting locks.
- QuickBooks does not supply vendor screening through this adapter. The default `AP_ALLOW_UNSCREENED_VENDORS=false` routes invoices to review. Set it to `true` only for sandbox demonstrations; each bypass appears in the decision evidence. Add screening before using this workflow for real invoices.
- Review the policy defaults in the [environment example](https://github.com/mastra-ai/mastra/blob/main/templates/template-accounts-payable-invoice-processing/.env.example): `AP_APPROVAL_THRESHOLD_MINOR=100000`, `AP_AMOUNT_TOLERANCE_MINOR=1`, and `AP_LOW_CONFIDENCE_THRESHOLD=0.8`. `MASTRA_DB_URL` optionally selects an isolated LibSQL database; the default is a local file under `data`.

## Quickstart 🚀

1. **Create the project**
   - Run `npx create-mastra@latest --template accounts-payable-invoice-processing`, choose `accounts-payable-invoice-processing` as the project directory when prompted, then run `cd accounts-payable-invoice-processing`.
   - Run `npm install` to install the dependencies. Keep the generated `package-lock.json` locally; subsequent clean installs can use `npm ci`.
2. **Add your configuration**
   - Run `cp .env.example .env` and fill in the values described in [Prerequisites](https://github.com/mastra-ai/mastra/blob/main/templates/template-accounts-payable-invoice-processing/README.md#prerequisites).
3. **Prepare and authenticate the MCP server**
   - Run `mkdir -p .local`, then `git clone https://github.com/intuit/quickbooks-online-mcp-server.git .local/quickbooks-online-mcp-server`.
   - Run `npm --prefix .local/quickbooks-online-mcp-server install` and `npm --prefix .local/quickbooks-online-mcp-server run build`.
   - Copy the MCP server's `.env.example` to its `.env`, fill in its Development credentials, sandbox environment and redirect URI, then run `npm --prefix .local/quickbooks-online-mcp-server run auth` and authorize the dedicated sandbox company.
   - In the template's `.env`, set the two absolute MCP paths described in Prerequisites. The token store may be the MCP server's `.env`; it must remain writable because refresh tokens rotate. The template starts the MCP automatically over stdio.
4. **Start the dev server**
   - Run `npm run dev` and open [Mastra Studio](http://localhost:4111).
   - Select **Accounts Payable Agent**, attach an invoice matching the sandbox vendor and PO, and send `Process the attached invoice.` The response includes the workflow `runId`, its decision, and reasons. With the defaults, expect review because screening is unavailable. With the sandbox bypass enabled and posting disabled, an otherwise valid invoice returns `posting_unavailable` without creating a Bill.

## Try it out

- Enable sandbox posting as described in Prerequisites, then submit a matching invoice at or below the approval threshold. Look for `posted` and inspect the Bill under **Expenses & bills → Bills** in QuickBooks.
- Submit a matching invoice above the threshold. It pauses with `approval_required`. Review the evidence, then send `Approve invoice run <runId>. Comment: Reviewed in Studio.` using the returned `runId`. Only that explicit decision resumes posting.
- Suspend a different invoice, then send `Reject invoice run <runId>. Comment: Amount needs correction.` Check that it returns `rejected` and no Bill is created.
- Reattach an invoice already posted. Duplicate detection routes it to review. Restart the application and repeat to check against the Bills loaded from QuickBooks.
- Try an inactive vendor, a mismatched PO, or missing extraction confidence. Inspect the returned reasons and verify that no Bill was created. Human approval does not override these blocked or review decisions.

## Customization

- Open the project in your coding agent and describe a change, for example: “Add our vendor-screening service and show its reference in the decision evidence. Explore the code and propose a plan before making changes.”
- Adjust approval and tolerance settings through the [environment file](https://github.com/mastra-ai/mastra/blob/main/templates/template-accounts-payable-invoice-processing/.env.example), or implement another accounting provider through the [provider interface](https://github.com/mastra-ai/mastra/blob/main/templates/template-accounts-payable-invoice-processing/src/mastra/accounting/types.ts).

## Accounting providers

The workflow depends on the provider-neutral `AccountingProvider` interface. QuickBooks MCP is the included adapter, selected with `ACCOUNTING_PROVIDER=quickbooks-mcp`. To use NetSuite or another system, implement that interface and register its factory in the [provider loader](https://github.com/mastra-ai/mastra/blob/main/templates/template-accounts-payable-invoice-processing/src/mastra/accounting/providers.ts).

The QuickBooks adapter performs two-way invoice/PO matching. It does not implement receipts or vendor screening. Providers that implement `findReceipts` can use the workflow's three-way matching; providers should implement `screenVendor` before handling real invoices. When screening is unavailable, the workflow routes the invoice to review unless the explicit sandbox-only bypass is enabled.

Posting uses the MCP's `create-bill` tool. It requires reconciled lines, the configured expense account, and a separate expense line for tax using the configured tax account. It includes the PO reference, the actual PO line IDs, and an idempotency marker. Before posting, it rereads the PO; changed accounting data requires reassessment. Local locks and `QBO_MCP_SINGLE_WRITER` assume one posting replica sharing its lock directory; they do not provide coordination across independent hosts. Reconcile an interrupted posting before removing a stale lock.

## Policy

Monetary settings use integer minor units: `100000` represents USD 1,000 for a USD invoice. Only totals strictly above `AP_APPROVAL_THRESHOLD_MINOR` require approval. `AP_AMOUNT_TOLERANCE_MINOR` controls PO amount differences; `AP_LOW_CONFIDENCE_THRESHOLD` controls extraction review. Missing confidence, inconsistent dates or totals, unavailable providers, potential duplicates, inactive vendors, and missing or mismatched POs prevent automatic posting.

Approval and rejection resume the persisted workflow by `runId`; conversation memory is not approval. The included reviewer label is `mastra-studio`. Add your application's authentication and reviewer identity before exposing approval actions outside a trusted local Studio session.

Run `npm run check` for formatting, lint, TypeScript, local tests, and build. See the [contribution guide](https://github.com/mastra-ai/mastra/blob/main/templates/template-accounts-payable-invoice-processing/CONTRIBUTING.md) for separate live sandbox tests and the [verification record](https://github.com/mastra-ai/mastra/blob/main/templates/template-accounts-payable-invoice-processing/VERIFICATION.md) for the checks actually completed.

## About Mastra templates

This is an official Mastra template. Official templates live in the [Mastra monorepo](https://github.com/mastra-ai/mastra) and are synchronized to standalone repositories.

[Want to contribute?](https://github.com/mastra-ai/mastra/blob/main/templates/template-accounts-payable-invoice-processing/CONTRIBUTING.md)
