# Advanced configuration and architecture

This guide covers the template's internal workflows, security controls, provider adapters, validation rules, testing commands, and production considerations. For the Studio-first experience, start with the [main README](../README.md).

A Mastra template that keeps document reading probabilistic and financial decisions deterministic.

The complete workflow is:

`read invoice → normalize money → validate vendor → match PO/receipts → detect duplicates → apply policy → approve when required → post`

The model reads the document; deterministic workflow steps own every financial control, approval gate, and write. Only `auto_post` or an authenticated human approval can reach the posting adapter.

## Developer verification and workflow debugging

Requires Node.js 22.13 or newer.

These commands are optional development checks; they are not required before using the Studio agent:

```bash
npm run typecheck
npm test
npm run build
npm run phase2:run
```

`INVOICE_READER` defaults to `fixture`, which runs two canned local cases: one straight-through result and one suspended run that resumes with a fixture review. It needs no model API key. `fixtures:score` scores the raw canned extraction before any human correction, then reports field-level fidelity, a mean, and failing case IDs.

The workflow snapshot is persisted through Mastra's configured LibSQL storage at `MASTRA_DB_URL`. Without that variable, the template uses `<project>/data/mastra.db` regardless of the launch directory and creates the directory/database with owner-only permissions. The final workflow output includes `snapshot.rawDocumentRef` and `snapshot.extractedResult`; full workflow state is retained by Mastra for both completed and suspended runs.

Snapshots contain financial data, including invoice lines, vendor tax IDs, and any available bank-detail fingerprints. Set a retention period that matches your accounting and privacy requirements. For the default local database, stop Mastra and delete `data/mastra.db` when the retained runs are no longer needed. For a remote `MASTRA_DB_URL`, apply the database provider's row-retention, backup-expiry, and deletion controls; removing the local file does not delete remote snapshots.

Open the URL printed by `mastra dev`, select `apInvoiceWorkflow`, and start it with:

```json
{
  "id": "clean-invoice",
  "mimeType": "application/pdf",
  "source": "PDF",
  "sha256": "fixture-clean"
}
```

The workflow uses local fixtures by default, so this path needs no model or accounting-system credentials. Select `invoiceReaderWorkflow` to inspect Phase 1 alone. The intermediate decision workflow is internal; it is not registered as a directly startable Studio/API workflow. The execution workflow is registered only so approval snapshots can be resumed, and it accepts assessments signed by the deterministic decision workflow. Use the chat intake agent or `apInvoiceWorkflow` for the complete trusted-document path. Set a random, server-only `AP_ASSESSMENT_SIGNING_KEY` of at least 32 characters whenever the server is authenticated, remotely bound, deployed, or connected to a non-fixture provider (for example, generate one with `openssl rand -hex 32`). It must be independent of `MASTRA_AUTH_TOKEN`, which Studio/API users may know. Only the credential-free, non-production fixture demo bound to loopback may use the built-in development signing key.

The non-production fixture demo opens Studio without a login and assigns a fixed local reviewer so the approval flow works immediately. `MASTRA_HOST=127.0.0.1` binds that demo to loopback, and the credential-free reviewer is disabled for any non-loopback bind address. Set both `MASTRA_AUTH_TOKEN` and `MASTRA_AUTH_USER_ID` to enable `SimpleAuth`; production, non-fixture providers, and remotely bound servers deny API requests without them. Before exposing the server with `MASTRA_HOST=0.0.0.0`, configure authentication. A deployed template should replace `SimpleAuth` with its JWT/SSO provider.

## Phase 1: trusted reader

`INVOICE_READER=fixture` returns canned extractions for deterministic local and CI tests. `INVOICE_READER=vision` sends a real PDF/image to the configured multimodal model:

```bash
INVOICE_READER=vision
INVOICE_READER_MODEL=openai/gpt-5.6-sol
OPENAI_API_KEY=...
INVOICE_ROOT=./assets
npm run invoice:run -- assets/sample-invoice.png
```

The vision reader accepts PDF, PNG, and JPEG files inside `INVOICE_ROOT`, checks file size before reading, verifies magic bytes and checksum, then sends those exact bytes as a multimodal file part. Use a provider/model that supports the document MIME type. The reader never returns ERP IDs, and document source metadata comes from the trusted input rather than the model.

Phase 1 checks dates, currencies, required fields, and printed-amount arithmetic. Model confidence is retained for monitoring and extraction-error routing, but never decides whether financial data is valid.

The reader workflow suspends when deterministic integrity checks fail: canonical date, ISO-4217 currency, required values, currency-aware printed-amount arithmetic, or subtotal/line reconciliation. Extended line totals and invoice totals must use the currency's minor-unit precision; unit prices may retain legitimate sub-minor precision and are checked through rounded line reconciliation. The AP decision workflow also routes to `verify_extraction` when overall confidence is low, a required field confidence is low, or a required confidence entry is missing. Line confidence may be reported as an aggregate `lines` entry or as indexed paths such as `lines[0].qty`; single-line legacy inputs with flat line-field names are also accepted. Confidence can request human verification, but it can never make an invoice postable.

### Review and resume

Resume the primary `apInvoiceWorkflow` with corrected data, and supply the reviewer identity through Mastra `RequestContext`. Because it has one suspended path, omit `step` so Mastra resumes the nested reader correctly:

```ts
await run.resume({
  resumeData: { extracted: correctedInvoice },
  requestContext, // reviewerId is populated here by trusted auth middleware
});
```

For the standalone `invoiceReaderWorkflow`, `step: 'verify-invoice'` is also valid. If more suspension points are added later, pass the nested path returned in the run's `suspended` array.

The server middleware deletes any caller-provided `reviewerId` and replaces it from the trusted reviewer identity. Outside the explicitly local fixture demo, a viewer or unauthenticated caller cannot authorize a resume. Direct, in-process workflow calls must similarly construct request context only from their trusted authentication layer.

Provider lookups happen after review, so corrected vendor names and PO numbers are always matched against the selected accounting system.

## Phase 2: deterministic controls

The Phase 1/2 boundary converts every amount to currency-aware integer minor units (`USD 10.50 → 1050`, `JPY 10 → 10`, `BHD 10.500 → 10500`). Printed `vendorName` and `poNumber` are preserved and resolved only through the selected provider.

Currency validation uses the pinned `currency-codes` table plus reviewed current-code overrides from ISO 4217 amendments. Withdrawn codes remain accepted so historical invoices can still be processed; new or changed codes must be added with their official SIX amendment and a regression test when the pinned table is updated.

Every step emits stable reason codes, explicit capability adaptations, and per-port source provenance. Provider outages become `unknown_retry`; genuine misses become review outcomes. Low or incomplete extraction confidence causes `verify_extraction` before financial posting.

## Accounting providers

Select one globally at Mastra startup:

```bash
ACCOUNTING_PROVIDER=fixture
```

| Provider         | Vendors | POs | Receipts | Bill seed | Posting | Bank details | Status | Sanctions |
| ---------------- | ------- | --- | -------- | --------- | ------- | ------------ | ------ | --------- |
| `fixture`        | yes     | yes | yes      | yes       | yes     | yes          | full   | yes       |
| `quickbooks`     | yes     | yes | no       | yes       | no      | no           | binary | no        |
| `quickbooks-mcp` | yes     | yes | no       | yes       | opt-in  | no           | binary | no        |

Invalid providers and missing required capabilities fail during startup. A disabled capability means its port is absent—it never silently returns an empty result.

### QuickBooks sandbox

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

Keep `MASTRA_AUTH_TOKEN` available for Studio or API authentication. `SANCTIONS_SCREENING=fixture` is an explicit demo-only fallback. Replace it with a real standalone `SanctionsScreener` in production. Without a provider sanctions port or an explicitly configured fallback, startup fails.

QuickBooks has no goods-receipt port here, so matching visibly degrades to two-way and emits `GOODS_RECEIPTS_UNAVAILABLE`. It also emits `VENDOR_BANK_DETAILS_UNAVAILABLE`, `VENDOR_STATUS_BINARY`, and the `payment_details_unverifiable` signal where applicable.

### Intuit QuickBooks MCP server

The `quickbooks-mcp` provider is audited against Intuit's local stdio server at commit `c351dc011d9cb14b211857457085f7994d8b1e15`. The server is not published at the package name in its `package.json`, so clone, pin, build, and authenticate it separately:

```bash
git clone https://github.com/intuit/quickbooks-online-mcp-server.git
cd quickbooks-online-mcp-server
git checkout c351dc011d9cb14b211857457085f7994d8b1e15
npm ci
npm run build
npm run auth
```

Then configure this template with absolute paths:

```bash
export MASTRA_AUTH_TOKEN="$(openssl rand -hex 32)"
export MASTRA_AUTH_USER_ID=quickbooks-reviewer
export AP_ASSESSMENT_SIGNING_KEY="$(openssl rand -hex 32)"
export ACCOUNTING_PROVIDER=quickbooks-mcp
export QBO_MCP_SERVER_PATH=/absolute/path/quickbooks-online-mcp-server/dist/index.js
export QBO_MCP_TOKEN_STORE_PATH=/absolute/path/quickbooks-online-mcp-server/.env
export SANCTIONS_SCREENING=fixture
npm run qbo-mcp:verify
npm run dev
```

The adapter converts MCP text/JSON into canonical Zod-validated records. Intuit's MCP PO search cannot filter by printed PO number, so it filters a bounded result window and reports a non-retryable integration failure instead of a false not-found when that window is exhausted.

Posting is disabled unless it is explicitly enabled with QuickBooks internal account IDs:

```bash
export QBO_MCP_ENABLE_POSTING=true
export QBO_MCP_SINGLE_WRITER=true
export QBO_MCP_EXPENSE_ACCOUNT_ID=your-expense-account-id
export QBO_MCP_TAX_ACCOUNT_ID=your-tax-account-id # required for invoices containing tax
export QBO_MCP_AP_ACCOUNT_ID=your-ap-account-id    # optional
npm run qbo-mcp:verify
```

The workflow—not the model—calls only `create-bill`; the MCP client allowlist denies every other mutation. Before creating a bill it searches by invoice number and either returns `already_posted` for an exact match or stops on a conflict. A shared local lock keyed globally by normalized invoice number serializes that complete search/create conflict domain across processes on one host, including distinct workflow digests and independently configured MCP clients. This scope is deliberately conservative so an incorrect realm label cannot split the lock. Posting requires the explicit `QBO_MCP_SINGLE_WRITER=true` deployment contract: run exactly one posting replica, and point every process on that replica at the same `QBO_MCP_POSTING_LOCK_DIR`. A lock left by a crashed writer fails closed for reconciliation. Multiple posting hosts are unsupported without replacing this guard with a distributed idempotency store. Intuit's current MCP tool does not expose QuickBooks' `requestid` parameter, so this is safe retry handling rather than a claim of database-level exactly-once delivery. Pin and re-audit the upstream server before changing its commit.

### Phase 3 approval and posting

`auto_post` proceeds directly. `approval_required` suspends with the invoice digest, amount, and reason codes. Resume with a decision; the server derives reviewer identity from the authenticated session and overwrites request context before the workflow runs:

```ts
await run.resume({
  resumeData: { approved: true, comment: 'Reviewed against contract' },
  requestContext, // trusted middleware supplies reviewerId
});
```

A rejection finishes without writing. Review, blocked, retry, and extraction-verification outcomes are never postable. The final result records `executionStatus`, immutable approval evidence, and the external bill receipt or a visible posting error.

#### Approving from Mastra Studio

When an invoice is over the policy threshold, the chat intake agent returns `approval required` and a run ID. Approval is performed in Mastra, not in QuickBooks. Because the starter chat agent does not retain prior message context, put the approval decision and run ID in **one message**:

```text
Approve invoice run <RUN_ID>. Comment: Approved for AP test.
```

For a rejection, use `Reject invoice run <RUN_ID>. Comment: <reason>.` The authenticated reviewer identity is captured with the decision. On approval, the workflow resumes and posts the Bill; on rejection, it ends without creating one.

To verify a successful post in the QuickBooks sandbox, open **Expenses & bills → Bills** and search by the supplier invoice number (`DocNumber`). In older navigation, open **Expenses → Vendors → <vendor> → Transactions**. Bills are AP transactions and will not appear under **Sales → Invoices**.

### Compose multiple systems

`makeCompositeProvider` assigns each port independently. For example, QuickBooks can supply vendors, POs, and bill history while a receiving system supplies goods receipts. When embedded vendor IDs or PO IDs differ between systems, construction requires the corresponding executable `ReferenceCrosswalk`; otherwise it refuses to start. Decisions record both source IDs.

```ts
const provider = makeCompositeProvider({
  id: 'qbo-receiving',
  displayName: 'QuickBooks + receiving',
  vendors: quickbooksProvider,
  purchaseOrders: quickbooksProvider,
  goodsReceipts: receivingProvider,
  sanctions: sanctionsProvider,
  billHistory: quickbooksProvider,
  identity: { crosswalk },
});
```

## Provider conformance

```bash
npm run providers:conformance
```

The reusable kit verifies canonical Zod outputs, declared-port invariants, genuine not-found behavior, and the distinction between an empty result and a retryable `ProviderUnavailableError`. CI runs it against fixtures. Supply sandbox-specific known/missing cases and a faulting test transport to run it against a live adapter. Posting conformance is skipped unless the caller explicitly passes `{ allowPosting: true }`; only enable that option for an isolated fixture or sandbox where creating a Bill is intended.

To add an accounting system:

1. Implement only the repository ports it can genuinely support.
2. Map raw records to the canonical schemas in the adapter.
3. Declare exact capabilities and identity namespaces.
4. Register a lazy factory.
5. Pass the conformance kit before selecting it.

Pipeline steps never consume raw accounting-system objects or read environment variables.

## Results and storage

Mastra persists workflow state and snapshots through `LibSQLStore` at `MASTRA_DB_URL`. Without that variable it uses the owner-only `<project>/data/mastra.db`. Final output contains the normalized invoice, resolved canonical records, decisions, adaptations, sources, policy, disposition, approval evidence, and posting receipt. Apply the snapshot retention and deletion guidance above to this data. The fixture invoice-history and posting adapters are intentionally in-memory; a production deployment should bind pipeline history to its durable database.

Chat intake returns the deterministic disposition, review types, every reason code with its message/evidence, capability adaptations, and posting status. It also appends one lifecycle event per run state to `<project>/data/ap-kpis.ndjson` (override with `AP_KPI_LOG_PATH`). KPI persistence is best-effort and cannot change a financial workflow result. Generate the current aggregate at any time with:

```bash
npm run kpis:report
```

The report groups events by run ID, uses only the latest financial state for run and exception counts, measures approval time only from a pending event to an explicit successful approval or rejection, and excludes human-approved posts from straight-through processing. A failed resume does not alter approval state or timing, but remains counted once as an integration failure for that run even after a later successful retry. The report includes straight-through rate, exception categories, pending approvals, approval time, integration failures, and posted count. Processing cost remains in Mastra Studio Observability, where model token and cost data are correlated with traces; the local report points there rather than estimating cost.

Useful commands:

```bash
npm run fixtures:run
npm run fixtures:score
npm run providers:conformance
npm run phase2:run
npm test
```
