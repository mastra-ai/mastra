# Use policy checking

Open [Mastra Studio](http://127.0.0.1:4111), select **Policy Checking** and start a conversation. Send all `/commands` below in that conversation. Replace example IDs, revisions and checksums with values from `/status` or `/report`.

## Attach and identify documents

Attach PDFs through **Add attachment → Add a local file**, then send a message to save them. Optionally generate sample documents first with `npm run prepare:use-cases` in your terminal; files and a manifest are saved in `.runtime/use-cases`.

| Studio command             | Purpose                                                     |
| -------------------------- | ----------------------------------------------------------- |
| `/status`                  | Show the case, source IDs, revision, attempts and findings. |
| `/new` with attachments    | Start a separate case in this conversation.                 |
| `/case CASE_ID`            | Select a previous case from this conversation.              |
| `/evidence SOURCE_ID PAGE` | Read captured text from a one-based physical PDF page.      |

Send `/clarify` followed by this JSON, using the IDs from `/status`:

```json
{
  "caseId": "11111111-1111-4111-8111-111111111111",
  "expectedRevision": 1,
  "identity": {
    "policyNumber": null,
    "insuredName": "Elm Harbor Fabrication LLC",
    "insuranceProduct": "Commercial property"
  },
  "intent": "document_comparison",
  "referenceId": "22222222-2222-4222-8222-222222222222",
  "targetId": "33333333-3333-4333-8333-333333333333",
  "roles": [
    { "sourceId": "22222222-2222-4222-8222-222222222222", "role": "proposal" },
    { "sourceId": "33333333-3333-4333-8333-333333333333", "role": "issued_policy" }
  ],
  "acceptedBaseline": null
}
```

Keep unknown identity fields as `null`. `document_comparison` compares documents without assuming acceptance. For agreed terms, use `intent: "agreed_terms_checking"` and `acceptedBaseline: { "statement": "Your explicit acceptance statement", "sourceId": "REFERENCE_SOURCE_ID" }`. The reference must be an accepted proposal or contract, and the target an issued policy. Declare supporting sources as `amendment` or `binder` where applicable.

## Configure processing

In `.env`, set `OPENAI_API_KEY` and uncomment the `POLICY_PROCESSING_BUDGET` example from [.env.example](../.env.example), adjusting limits and token prices before use. Optionally set `POLICY_EXTRACTION_MODEL`, then restart Studio. Comparison is disabled until a budget is set; intake, evidence and report retrieval run locally.

The budget limits attempts, requests, tokens, estimated cost, response bytes and time. Retries share the allocation; missing usage retains the full reservation. See `processingBudgetSchema` in `src/mastra/domain/reconciliation-contracts.ts` for field definitions.

## Compare and read the draft

Read `/status` for the revision after clarification. Send `/compare` followed by:

```json
{
  "caseId": "11111111-1111-4111-8111-111111111111",
  "expectedRevision": 2,
  "profileId": "generic",
  "asOf": "2026-05-01",
  "retryAttemptId": null
}
```

The workflow extracts terms, verifies quotations against saved sources, compares values and publishes a PDF draft. Send `/report` for findings and download links. If Studio shows only a plain-text notice, refresh or reopen the conversation to see the saved links.

For a failed comparison, use its attempt ID as `retryAttemptId` with unchanged inputs and the current revision. For a publication failure, fix the reported problem and send `/report {"caseId":"CASE_ID","retryPublication":true}` to reuse the saved analysis or approval.

## Review and approve

Read the draft, then send `/review` followed by the exact report identifiers and current case revision:

```json
{
  "operationId": "44444444-4444-4444-8444-444444444444",
  "caseId": "11111111-1111-4111-8111-111111111111",
  "reportId": "55555555-5555-4555-8555-555555555555",
  "version": 1,
  "snapshotHash": "COPY_THE_64_CHARACTER_CHECKSUM_FROM_REPORT",
  "expectedRevision": 5,
  "expectedState": "AWAITING_REVIEW",
  "action": "approve",
  "dispositions": [
    {
      "findingId": "66666666-6666-4666-8666-666666666666",
      "disposition": "confirmed",
      "reason": null,
      "severityOverride": null
    }
  ]
}
```

Use a new UUID for each `operationId`; repeating the same ID and decision returns the saved result. Reviewer identity comes from the configured local operator.

- `approve` publishes the final PDF. Omit `dispositions` to approve without confirming findings.
- `disposition` records finding decisions separately. Dismissals and severity overrides need a reason.
- `reject` requires a nonempty `reason` and closes the case.
- `revise` requires `revision: { "kind": "presentation", "note": "Describe the change" }`. Send `/compare` with the updated revision to create a new draft from saved analysis. For changed sources, use kind `evidence`, attach the documents and repeat `/clarify` before `/compare`.

Each decision changes the case revision. Each new report version needs fresh approval. Confirmed actionable discrepancies in agreed-term checking also produce a proposed correction in the PDF and an editable Markdown file. Complete the recipient and broker contact details before manual delivery.

## Local storage

Use the configured `127.0.0.1` address. `POLICY_OPERATOR_ID`, `PORT` and `POLICY_DATA_DIR` override local defaults. Stop Studio before backing up or restoring the entire data directory, including databases, sources and reports. `/status` flags interrupted intake and missing source files.

If upgrading from locale-sorted checksums, use a fresh data directory and keep the old runtime with its matching code version; legacy hashes are not migrated.

## Limitations

- The bundled input driver accepts directly attached, unencrypted PDFs with searchable text. Remote URLs and OCR are unsupported. Image-only or empty documents are rejected; mixed pages retain text and flag unread image content. Page references use physical PDF pages, not printed labels.
- Extraction has CPU, memory, time and output limits, so complex PDFs may be rejected. Upload capacities are configured in `src/mastra/config/input-limits-config.ts`.
- The runtime uses macOS/Linux facilities: `/bin/sh` CPU limits, POSIX file permissions and directory synchronization. Native Windows is unsupported. On Windows, use [WSL2](https://learn.microsoft.com/en-us/windows/wsl/install), install dependencies and run the Quickstart commands inside its Linux terminal, keeping the project and data in the Linux filesystem (for example `~/insurance-policy-checking`). WSL2 has not been validated by this template's test suite.
- This is a local, single-operator application. Multi-tenant access and automatic delivery are unsupported. Findings require broker review; document text cannot authorize changes or approve a report.

To add an input driver, give your coding agent this prompt:

> Add an input provider for [OCR PDFs, remote documents or structured records]. Inspect `InputProvider`, `SourceBundle` and `validateBundle` in `src/mastra/domain/case-contracts.ts`, then propose a plan before editing. Register the provider in `src/mastra/provider-config.ts` and connect its request handling in `document-intake-processor.ts`. Preserve immutable source bytes or records, checksums, provenance, evidence locators and extraction limitations. Validate input in schemas, enforce authorization and external-response checks at execution, and verify capture and evidence retrieval with real local infrastructure. Preserve the broker review and processing-budget boundaries.
