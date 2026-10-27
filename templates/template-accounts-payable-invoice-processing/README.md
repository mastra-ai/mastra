# Accounts Payable Invoice Processing

Turn an invoice into an AP review decision from Mastra Studio. The agent reads a PDF, PNG, or JPEG, checks the extracted fields against accounting data, and asks for approval before posting or returns the reasons it needs review.

## Why we built this

Real invoices are inconsistent, and production AP work spans several systems. We built this template to show an agent that coordinates multiple tools, handles that mess, and keeps vendor validation, matching, duplicate detection, approvals, and posting deterministic.

## Prerequisites

- **[OpenAI API key](https://platform.openai.com/api-keys)**: set `OPENAI_API_KEY` with access and available credit for the configured document-reading model. `INVOICE_READER_MODEL` optionally overrides the default `openai/gpt-5.6-sol`; choose a model that accepts PDF and image attachments.
- **[Intuit developer account](https://developer.intuit.com/)**: create an app with QuickBooks Online accounting access and a dedicated sandbox company. Use its Development keys and register `http://localhost:8000/callback` as a redirect URI.
- **[QuickBooks Online MCP server](https://github.com/intuit/quickbooks-online-mcp-server)**: its credential file needs `QUICKBOOKS_CLIENT_ID`, `QUICKBOOKS_CLIENT_SECRET`, `QUICKBOOKS_ENVIRONMENT=sandbox`, and `QUICKBOOKS_REDIRECT_URI=http://localhost:8000/callback`. OAuth adds `QUICKBOOKS_REALM_ID` and `QUICKBOOKS_REFRESH_TOKEN`. Follow the server's [authentication instructions](https://github.com/intuit/quickbooks-online-mcp-server#authentication); Intuit's [OAuth Playground](https://developer.intuit.com/app/developer/qbo/docs/develop/authentication-and-authorization/oauth-2.0-playground) is an additional reference.
- Set `ACCOUNTING_PROVIDER=quickbooks-mcp`, `QBO_MCP_SERVER_PATH` to the absolute compiled MCP entrypoint (`dist/index.js`), and `QBO_MCP_TOKEN_STORE_PATH` to the absolute credential file. Keep it writable because refresh tokens rotate, and keep credentials and the server installation in an ignored directory such as `.local`.
- Prepare an active sandbox vendor, an item, and a purchase order. Your invoice must name that vendor and PO and match their currency, quantities, unit prices, and totals. Obtain internal account IDs from your sandbox, rather than using account names.
- Posting starts disabled with `QBO_MCP_ENABLE_POSTING=false`. To create bills in the sandbox, set it to `true`, set `QBO_MCP_SINGLE_WRITER=true`, run one posting instance, and set `QBO_MCP_EXPENSE_ACCOUNT_ID`. An invoice with tax also requires `QBO_MCP_TAX_ACCOUNT_ID`. `QBO_MCP_AP_ACCOUNT_ID` optionally selects accounts payable; `QBO_MCP_POSTING_LOCK_DIR` optionally isolates local posting locks.
- QuickBooks does not supply vendor screening through this adapter. The default `AP_ALLOW_UNSCREENED_VENDORS=false` routes invoices to review. Set it to `true` only for sandbox demonstrations; each bypass appears in the decision evidence. Add screening before using this workflow for real invoices.
- Review the policy defaults in the [environment example](https://github.com/mastra-ai/mastra/blob/main/templates/template-accounts-payable-invoice-processing/.env.example): `AP_APPROVAL_THRESHOLD_MINOR=100000`, `AP_AMOUNT_TOLERANCE_MINOR=1`, and `AP_LOW_CONFIDENCE_THRESHOLD=0.8`. `MASTRA_DB_URL` optionally selects an isolated LibSQL database; the default is a local file under `data`.

## Quickstart 🚀

1. **Create the project**
   - Run `npx create-mastra@latest --template accounts-payable-invoice-processing`, choose `accounts-payable-invoice-processing` as the project directory when prompted, then run `cd accounts-payable-invoice-processing`.
   - Run `npm install` to install the dependencies.
2. **Add your configuration**
   - Run `cp .env.example .env` and fill in the values described in [Prerequisites](https://github.com/mastra-ai/mastra/blob/main/templates/template-accounts-payable-invoice-processing/README.md#prerequisites).
3. **Prepare and authenticate the MCP server**
   - Run `mkdir -p .local`, then `git clone https://github.com/intuit/quickbooks-online-mcp-server.git .local/quickbooks-online-mcp-server`.
   - Run `npm --prefix .local/quickbooks-online-mcp-server install` and `npm --prefix .local/quickbooks-online-mcp-server run build`.
   - Copy the MCP server's `.env.example` to its `.env`, fill in its Development credentials, sandbox environment and redirect URI, then run `npm --prefix .local/quickbooks-online-mcp-server run auth` and authorize the dedicated sandbox company.
   - Use the MCP server's `.env` as the token store and set the two absolute MCP paths in the template's `.env`. The template starts the MCP automatically over stdio.
4. **Start the dev server**
   - Run `npm run dev` and open [Mastra Studio](http://localhost:4111).
   - Select **Accounts Payable Agent**, attach an invoice matching the sandbox vendor and PO, and send `Process the attached invoice.` Expect a decision and reasons, with the workflow `runId`. The default configuration routes the invoice to review because screening is unavailable.

## Try it out

- Enable the sandbox screening bypass while keeping posting disabled, then submit a matching invoice at or below the approval threshold. Expect `approval_required`. Approve using its run ID and expect `posting_unavailable` without a Bill. Enable posting as described in Prerequisites, resubmit, and approve the new run; look for `posted` under **Expenses & bills → Bills** in QuickBooks.
- Submit a matching invoice above the threshold. It pauses with `approval_required`. Review the original attachment and the returned invoice identity, amount, `runId`, and `invoiceDigest`, then use the approval endpoint below. Only a decision sent through the authenticated human approval endpoint resumes posting.
- Suspend a different invoice, then send `approved: false` with its `runId` and `invoiceDigest` through the human approval endpoint Check that it returns `rejected` and no Bill is created.
- Reattach an invoice already posted. Duplicate detection routes it to review. Restart the application and repeat to check against the Bills loaded from QuickBooks.
- Try an inactive vendor, a mismatched PO, or missing extraction confidence. Inspect the returned reasons and verify that no Bill was created. Human approval does not override these blocked or review decisions.

## Customization

- Open the project in your coding agent and describe a change, for example: “Add our vendor-screening service and show its reference in the decision evidence. Explore the code and propose a plan before making changes.”
- Adjust approval and tolerance settings through the [environment file](https://github.com/mastra-ai/mastra/blob/main/templates/template-accounts-payable-invoice-processing/.env.example), or connect another accounting system as described in [Accounting providers](https://github.com/mastra-ai/mastra/blob/main/templates/template-accounts-payable-invoice-processing/README.md#accounting-providers).

## Accounting providers

To use NetSuite or another accounting system, implement the [AccountingProvider interface](https://github.com/mastra-ai/mastra/blob/main/templates/template-accounts-payable-invoice-processing/src/mastra/accounting/types.ts) and register its factory in the [provider loader](https://github.com/mastra-ai/mastra/blob/main/templates/template-accounts-payable-invoice-processing/src/mastra/accounting/providers.ts).

The included QuickBooks adapter performs two-way invoice/PO matching; it implements neither receipts nor vendor screening. Other providers can supply `findReceipts` and `screenVendor` for these checks.

Posting uses the MCP's `create-bill` tool with the configured expense accounts, a separate tax expense line, PO and line references, and an idempotency marker. It rereads the PO before posting; changed accounting data requires reassessment. Posting locks coordinate processes sharing one local directory. Reconcile an interrupted posting before removing a stale lock.

## Policy

Monetary settings use integer minor units: `100000` represents USD 1,000 for a USD invoice. Every invoice submitted by the agent requires human approval: its document reference and extracted fields do not prove attachment provenance. Review the original attachment before approving. Trusted server integrations may explicitly set `rawDocumentRef.requiresHumanReview=false` only after applying their own document verification; the agent tool cannot set this flag. For those integrations, totals strictly above `AP_APPROVAL_THRESHOLD_MINOR` still require approval. `AP_AMOUNT_TOLERANCE_MINOR` controls PO amount differences; `AP_LOW_CONFIDENCE_THRESHOLD` controls extraction review. Missing confidence, inconsistent dates or totals, unavailable providers, potential duplicates, inactive vendors, and missing or mismatched POs prevent automatic posting.

The invoice-reading agent has no approval tool. Invoice text and chat messages cannot authorize posting. Human approval is separate from agent access and is bound to the authenticated reviewer's configured identity, the workflow run ID, and the reviewed invoice digest.

### Human approval and production authentication

Set `AP_API_TOKEN` and `AP_APPROVAL_TOKEN` to distinct random secrets of at least 32 characters, and set `AP_APPROVER_ID` to the human reviewer's identity. Generate each secret separately with `node -e "console.log(require('node:crypto').randomBytes(32).toString('base64url'))"`. Keep the approver secret outside invoice text, agent prompts, tools, and reader clients. Serve production traffic over HTTPS.

With `NODE_ENV=production`, startup requires all three settings and configures Mastra `SimpleAuth` for the server. The reader token authenticates API/Studio access; it cannot approve invoices. Missing authentication configuration prevents production startup. In local development, agent access can remain unauthenticated when tokens are absent, but the human approval endpoint stays disabled.

After inspecting the original invoice, send the returned `runId` and `invoiceDigest` from a human-controlled client:

```bash
curl -X POST "http://localhost:4111/invoice-approvals/$RUN_ID" \
  -H "Authorization: Bearer $AP_APPROVAL_TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"approved":true,"invoiceDigest":"<digest returned with the approval request>","comment":"Reviewed original invoice"}'
```

Use `approved: false` to reject. The endpoint rejects reader credentials, stale digests, completed runs, and caller-supplied reviewer identities. The workflow also rejects unsigned or forged decisions sent through generic resume APIs. Successful decisions record `AP_APPROVER_ID` and the server timestamp; the proof is valid for one run and digest for five minutes.

## About Mastra templates

This is an official Mastra template. Official templates live in the [Mastra monorepo](https://github.com/mastra-ai/mastra) and are synchronized to standalone repositories.

[Want to contribute?](https://github.com/mastra-ai/mastra/blob/main/templates/template-accounts-payable-invoice-processing/CONTRIBUTING.md)

Purchase-order search uses the official MCP date filters to inspect all result windows and detects duplicate PO numbers across them. A date with 1,000 or more POs cannot be exhausted through the current MCP search interface; processing returns a retry reason instead of accepting an incomplete match. The adapter rechecks an approved PO by ID with `get_purchase_order` immediately before posting.
