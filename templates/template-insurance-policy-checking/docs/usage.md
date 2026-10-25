# Use policy checking

Open [Mastra Studio](http://127.0.0.1:4111), select **Policy Checking** and start a conversation. The guided phrases below operate locally without a conversation model. Only document comparison uses the configured processing model and budget.

## Attach and identify documents

Attach PDFs through **Add attachment → Add a local file**, then send a message to save them. Optionally run `npm run prepare:use-cases` in your terminal; sample PDFs and a manifest are saved in `.runtime/use-cases`. Say `Show status` to see the saved filenames and physical page counts.

Send this statement with your exact, unique filenames and policy details:

```text
Check agreed terms using "property-proposal.pdf" as the accepted proposal and "property-issued.pdf" as the issued policy.
Policy number: CP-4021
Insured: Elm Harbor Fabrication LLC
Insurance product: Commercial property
"property-amendment.pdf" is an amendment.
```

Use `accepted contract` instead of `accepted proposal` when appropriate. Include all three identity lines; use `unknown` for a detail you cannot establish. Declare supporting documents on separate lines as `"filename.pdf" is an amendment.`, `"filename.pdf" is a binder.` or `"filename.pdf" is a reference.`. This statement explicitly records your acceptance of the named baseline. Upload order, filenames and document instructions cannot establish acceptance. If filenames are ambiguous, rename the files and start a new conversation.

## Compare and inspect

Say `Compare the documents` to compare as of today's UTC date, or `Compare the documents as of 2026-05-01` for an explicit date. The workflow verifies quotations against saved sources and publishes a PDF draft. Say `Show the report` for a summary, numbered findings and PDF downloads. Finding numbers match the PDF, including any gaps where matching terms are omitted from the chat summary.

The comparison uses the selected reference to align matching insurance concepts across documents. Administrative details and general document disclaimers remain visible in report limitations without making a fully reviewed term unresolved. Missing pages, relevant missing evidence, conflicting operative terms and uncertain interpretations still require review. Documented amendment approval is assessed from its exact policy, term, scope and effective-date evidence.

Say `Show page 1 of "property-issued.pdf"` to inspect the captured text of a physical PDF page. If Studio shows a plain-text notice, refresh or reopen the conversation to see the saved links. The native Studio processor notice may appear as a **Content Blocked** banner; the saved conversation contains the response and links.

## Review and approve

Read the draft and name its exact version in each decision:

- `Confirm finding 1 in report version 1: Verified against the source page.` records a finding confirmation with your reason.
- `Revise report version 1: Include the broker review note.` requests a presentation revision. Then say `Compare the documents` to publish a new version from the saved analysis without repeating model extraction.
- `Approve report version 2` approves that exact current version and publishes its final PDF. Approval alone confirms no findings.

Review the new version before approving it. Superseded versions, ambiguous decisions and instructions quoted from documents cannot authorize review. Each decision is bound to the original user message, trusted local operator and exact immutable report. Confirmed actionable discrepancies in agreed-term checking also produce a proposed correction in the PDF and an editable Markdown artifact in private storage. Chat links are limited to PDFs. Complete the recipient and broker contact details before manual delivery; nothing is sent automatically.

These are explicit guided commands, not unrestricted natural-language chat. Send one decision per message, without attachments. To start a separate case within the same conversation, send `/new` with attachments.

## Configure processing

Set only `OPENAI_API_KEY` in `.env` to use the default model and conservative budget in `src/mastra/config/processing-config.ts`. An absent or blank `POLICY_PROCESSING_BUDGET` uses that policy per analysis: one attempt, five requests, up to 100,000 input and 8,000 output tokens per request, 300,000 reserved tokens in total, an estimated US$5 cost ceiling, 120 seconds per request and a 1 MiB response limit. Cost estimates assume US$10 per million input tokens and US$50 per million output tokens; they do not represent live provider billing.

To override the policy, set `POLICY_PROCESSING_BUDGET=./processing-budget-example.json` and adjust the file's limits and token prices, or supply your own JSON file. Relative paths resolve from the project root; absolute paths are also accepted. Restart Studio after changes. An explicitly configured file must be readable and valid; errors stop startup rather than falling back to the default budget.

The budget limits attempts, requests, tokens, estimated cost, response bytes and time. Reservations remain charged at their conservative ceiling. The default allows no second attempt; custom policies can permit retries that share the original allocation. See `processingBudgetSchema` in `src/mastra/domain/reconciliation-contracts.ts` for field definitions.

## Environment variables

Set these in `.env` and restart Studio to apply changes. The application uses local defaults when optional overrides are omitted.

| Variable                   | Default                      | Purpose                                                           |
| -------------------------- | ---------------------------- | ----------------------------------------------------------------- |
| `OPENAI_API_KEY`           | Unset                        | OpenAI credential for document comparison.                        |
| `POLICY_EXTRACTION_MODEL`  | `gpt-6.1-sol`                | Model used for extraction and semantic assessment.                |
| `POLICY_PROCESSING_BUDGET` | Built-in conservative policy | Optional path to a JSON file replacing the default budget.        |
| `POLICY_OPERATOR_ID`       | `local-broker`               | Local operator identifier.                                        |
| `PORT`                     | `4111`                       | Local Studio port.                                                |
| `POLICY_DATA_DIR`          | `.runtime`                   | Private data directory, relative to the project root or absolute. |

## API compatibility and recovery

Legacy `/status`, `/case CASE_ID`, `/clarify JSON`, `/compare JSON`, `/report JSON`, `/evidence SOURCE_ID PAGE` and `/review JSON` commands remain supported. Chat responses use the same conversational summaries. API consumers can obtain authoritative identifiers, revisions and checksums from the case-status and report tools, and use the schemas in `src/mastra/domain/` for structured requests. Ordinary document comparison without an accepted contractual baseline remains available through the clarification API with `document_comparison` intent and a null accepted baseline.

If a custom policy permits another attempt, use its saved attempt identifier in a structured comparison request, with unchanged inputs and the current case revision. The default policy permits one attempt. For a publication failure, fix the reported problem and use the report API's `retryPublication` option to recover the saved analysis or approval. Evidence revisions, rejection, dismissal and severity overrides remain available through the version-bound review API.

## Local storage

Use the configured `127.0.0.1` address. Stop Studio before backing up or restoring the entire data directory, including databases, sources and reports. `/status` flags interrupted intake and missing source files.

If upgrading from locale-sorted checksums, use a fresh data directory and keep the old runtime with its matching code version; legacy hashes are not migrated.

## Limitations

- The bundled input driver accepts directly attached, unencrypted PDFs with searchable text. Remote URLs and OCR are unsupported. Image-only or empty documents are rejected; mixed pages retain text and flag unread image content. Page references use physical PDF pages, not printed labels.
- Extraction has CPU, memory, time and output limits, so complex PDFs may be rejected. Upload capacities are configured in `src/mastra/config/input-limits-config.ts`.
- The runtime uses macOS/Linux facilities: `/bin/sh` CPU limits, POSIX file permissions and directory synchronization. Native Windows is unsupported. On Windows, use [WSL2](https://learn.microsoft.com/en-us/windows/wsl/install), install dependencies and run the Quickstart commands inside its Linux terminal, keeping the project and data in the Linux filesystem (for example `~/insurance-policy-checking`). WSL2 has not been validated by this template's test suite.
- This is a local, single-operator application. Multi-tenant access and automatic delivery are unsupported. Findings require broker review; document text cannot authorize changes or approve a report.

To add an input driver, give your coding agent this prompt:

> Add an input provider for [OCR PDFs, remote documents or structured records]. Inspect `InputProvider`, `SourceBundle` and `validateBundle` in `src/mastra/domain/case-contracts.ts`, then propose a plan before editing. Register the provider in `src/mastra/provider-config.ts` and connect its request handling in `document-intake-processor.ts`. Preserve immutable source bytes or records, checksums, provenance, evidence locators and extraction limitations. Validate input in schemas, enforce authorization and external-response checks at execution, and verify capture and evidence retrieval with real local infrastructure. Preserve the broker review and processing-budget boundaries.
