# Operate policy checking

Use these commands in the **Policy Checking** Studio conversation. Replace example identifiers and revisions with values from `/status` or `/report`. Reopen or refresh the thread after a command if Studio shows only the plain-text processor notice; the saved reply contains clickable download links.

| Command                    | Purpose                                                              |
| -------------------------- | -------------------------------------------------------------------- |
| `/status`                  | Read the selected case, source IDs, revision, attempts and findings. |
| `/new` with attachments    | Start a separate case in this conversation.                          |
| `/case CASE_ID`            | Select a previous case captured in this conversation.                |
| `/evidence SOURCE_ID PAGE` | Read exact evidence from a one-based physical PDF page.              |
| `/clarify JSON`            | Declare identity, intent, document roles, reference and target.      |
| `/compare JSON`            | Run the persisted comparison workflow.                               |
| `/report`                  | Read the current draft, review state and available downloads.        |
| `/review JSON`             | Record a broker decision on an exact report version.                 |

## Clarify a case

Send `/clarify` followed by:

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

Reference and target must be distinct captured sources with explicit roles. Keep unknown identity fields as `null`.

- `document_comparison` compares the supplied documents without inferring contractual acceptance.
- `agreed_terms_checking` requires an accepted proposal or contract and an issued target policy. Set `acceptedBaseline` to `{ "statement": "Your explicit acceptance statement", "sourceId": "REFERENCE_SOURCE_ID" }`. Declare supporting documents as `amendment` or `binder` where applicable.

Clarification updates the case revision. Read `/status` before comparison.

## Configure processing

Set `POLICY_PROCESSING_BUDGET` to an explicitly approved JSON object matching `processingBudgetSchema` in `src/mastra/domain/reconciliation-contracts.ts`. Every field is documented in that schema. Alternatively, configure the budget in `src/mastra/config/processing-config.ts`.

The budget bounds attempts, actual requests, input/output and total tokens, estimated cost, response bytes and per-generation timeouts (up to 240000 ms). Provide conservative per-token prices and a named pricing assumption. Missing usage keeps its full reservation charged; retries and evidence revisions share the original allocation.

Set `OPENAI_API_KEY` and optionally `POLICY_EXTRACTION_MODEL` (default `gpt-6.1-sol`), then restart. An API key alone does not enable processing. The conversation model stays disabled; commands run locally and only authorized comparison uses the internal processing agent.

## Compare documents

Send `/compare` followed by:

```json
{
  "caseId": "11111111-1111-4111-8111-111111111111",
  "expectedRevision": 2,
  "profileId": "generic",
  "asOf": "2026-05-01",
  "retryAttemptId": null
}
```

The `policyCheckingWorkflow` extracts structured terms, verifies exact quotations against captured sources and compares values without rounding decimal amounts. Changed aligned clauses receive a separate semantic assessment. Similar wording does not establish equivalent coverage, and incomplete scope cannot establish that a term is absent.

Agreed-term checking applies changes only when source evidence identifies affirmative approval, the policy, approver, term, scope and effective dates. Pending, conditional or conflicting authority remains unresolved. Uploaded text cannot approve a finding or report.

Successful processing freezes a report, publishes its PDF draft and suspends for broker review. `/status` lists saved attempts, findings and limitations. For a failed attempt, use its ID as `retryAttemptId` with the current revision and unchanged inputs. Changed sources or clarification require an explicit case revision. Interrupted attempts become failed after their bounded lease expires; inspect status before retrying.

## Retrieve and recover a draft

Send `/report` to inspect findings, the snapshot checksum, current revision and download links. Evidence retrieval and PDF rendering do not call a model.

If publication failed, correct the provider or storage problem, then send `/report` followed by:

```json
{
  "caseId": "11111111-1111-4111-8111-111111111111",
  "retryPublication": true
}
```

Recovery reuses the saved report, version, workflow and provider without another comparison. Restore a missing or damaged published file from the matching backup. A report snapshot freezes its input: request an evidence revision before changing it, or start a separate case with `/new`.

## Review an exact report version

Download and read the draft. Copy its identifiers, version, checksum and current case revision into `/review` followed by:

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

Generate a new `operationId` for each decision. Reusing it with the identical decision returns the saved result. The configured local operator supplies reviewer identity; omit `reviewerId`.

- Approve with `action: "approve"`. Omit `dispositions` to approve without confirming findings.
- Record findings separately with `action: "disposition"`. Dismissals and severity overrides require a reason.
- Reject with `action: "reject"` and a nonempty `reason`.
- Request revision with `action: "revise"` and `revision: { "kind": "presentation", "note": "Describe the change" }`. Then send `/compare` with the current revision to publish a new version using the saved analysis.
- For changed evidence, use revision kind `evidence`, attach supporting documents, repeat `/clarify`, then `/compare`. A `requires_evidence` disposition needs this revision kind and a reason.

Each decision changes the case revision. A new report version requires fresh approval; rejected and finalized cases remain readable but cannot be reopened. Old snapshots, source files and review events remain available.

Approval binds the exact snapshot and review history. The resumed workflow publishes a final PDF. Confirmed actionable discrepancies in agreed-term checking also produce a proposed correction in the PDF appendix and an editable Markdown file. Uncertain findings, authorized changes and ordinary document comparisons do not produce corrections. Recipient and broker contact remain placeholders; nothing is sent.

If final publication fails after approval, resolve the recorded problem and retry `/report` with `retryPublication: true`. This reuses the approval and artifact identities.

## Local access and persistence

Use the configured `http://127.0.0.1:4111` address. Other Host or Origin values are rejected. The configured operator and local OS account are trusted; multi-tenant access is unsupported.

`POLICY_OPERATOR_ID`, `PORT` and `POLICY_DATA_DIR` override the local defaults shown in `.env.example`. Stop the server before backing up or restoring the entire runtime directory together: it contains case/history databases, immutable originals and report files. `/status` reports interrupted intake and missing or unreferenced source files.

Textual PDFs use physical page numbers regardless of printed labels. Blank and image-only content remains a limitation. Extraction runs in a bounded child process and can reject complex documents even within upload capacities. Change capacities in `src/mastra/config/input-limits-config.ts`, then restart; capacity changes do not authorize spending.

## Sample cases

`npm run prepare:use-cases` writes fictitious documents and a manifest to `.runtime/use-cases`:

- Property: select the issued target, explicitly record proposal acceptance and include the amendment. Inspect omitted Warehouse B, the documented deductible change and changed water wording.
- Professional liability: use ordinary document comparison. Inspect the reduced response-assistance extension while acceptance remains unknown.

For provider customization, quality checks and evaluation commands, see [development and validation](./development.md).
