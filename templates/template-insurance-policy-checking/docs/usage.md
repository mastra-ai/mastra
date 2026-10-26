# Check an insurance policy

Compare an issued policy with the proposal or contract you accepted, review the differences, and approve a final report. Each finding includes evidence from the documents so you can check it before making a decision.

Complete the [Quickstart](https://github.com/mastra-ai/mastra/blob/main/templates/template-insurance-policy-checking/README.md#quickstart-), then open [Mastra Studio](http://127.0.0.1:4111), select **Policy Checking**, and start a conversation.

Use the command wording shown below, replacing filenames, policy details, and report numbers as needed. The conversation recognizes specific commands; it doesn't interpret arbitrary requests. Uploading documents, viewing evidence, and reviewing reports run locally. Only document comparison calls the configured model.

## Attach your documents

For a first run, use the three fictional PDFs in `assets/demo`:

- `01-accepted-proposal.pdf`: The original proposal accepted by the insured.
- `02-issued-policy.pdf`: The issued policy to check against that proposal.
- `03-approved-amendment.pdf`: A documented change to the agreed deductible.

In Studio, select **Add attachment → Add a local file**, attach all three files, and send a message to save them. Then send `Show status` to check that all three filenames appear.

You can also use your own unencrypted PDFs with selectable text. Give each file a unique name. If two saved documents have the same name, rename them and upload them in a new conversation.

## Identify the agreed terms

After uploading the sample files, send this entire message:

```text
Check agreed terms using "01-accepted-proposal.pdf" as the accepted proposal and "02-issued-policy.pdf" as the issued policy.
Policy number: CP-4021
Insured: Elm Harbor Fabrication LLC
Insurance product: Commercial property
"03-approved-amendment.pdf" is an amendment.
```

The response confirms that your document choices and policy details have been saved. Naming an **accepted proposal** tells the application which terms you agreed to. A filename, upload order, or statement inside a PDF doesn't replace that instruction.

For your own documents:

- Replace the filenames and policy details, keeping the command wording, quotation marks, and final periods.
- Use `accepted contract` instead of `accepted proposal` when the agreed terms come from a contract.
- Include all three policy-detail lines. Enter `unknown` for any value you can't confirm, such as `Policy number: unknown`.
- Omit the amendment line if you don't have one. Identify other supporting files on separate lines using `"filename.pdf" is an amendment.`, `"filename.pdf" is a binder.`, or `"filename.pdf" is a reference.`

## Compare the documents

For the sample case, send:

```text
Compare the documents as of 2026-05-01
```

The date sets when the terms and any approved changes are assessed. To use today's UTC date instead, send `Compare the documents`.

The application compares the terms, checks quoted evidence against the saved documents, and prepares a PDF draft. Send `Show the report` to see its version, a summary, and a download link.

The sample documents give you three useful comparisons to inspect:

| Term                             | Accepted proposal | Issued policy | What to check                                                         |
| -------------------------------- | ----------------- | ------------- | --------------------------------------------------------------------- |
| Building limit                   | USD 2,500,000     | USD 2,500,000 | The amounts match.                                                    |
| Business personal property limit | USD 500,000       | USD 350,000   | The policy has a lower limit, and the amendment doesn't authorize it. |
| Deductible                       | USD 2,500         | USD 5,000     | The amendment approves this change, effective April 1, 2026.          |

Use these differences to review the result, rather than assuming a particular finding number or exact model response. An approved change should be assessed against its policy, term, scope, and effective date. Missing evidence or unclear wording may still need your review.

Download the PDF for the complete findings and source citations. The chat highlights up to three findings and leaves out matching terms. Its finding numbers refer to the PDF, so they may have gaps or appear out of order.

To inspect the saved text from a source page, send:

```text
Show page 1 of "02-issued-policy.pdf"
```

Page numbers count from the first page of the PDF, regardless of the page labels printed in the document. Administrative notes and general disclaimers may appear under report limitations without making an otherwise reviewed term unresolved.

## Review and approve the report

Read the draft before recording a decision. Every review command must name the current report version. Send each command as a separate message without attachments.

### Confirm a finding

Use the number shown in your report and explain what you checked. For example, if finding 1 in version 1 is the lower business personal property limit:

```text
Confirm finding 1 in report version 1: The policy lists USD 350000, but the accepted proposal lists USD 500000. The amendment changes only the deductible.
```

This records your confirmation of that finding. It doesn't approve the report. Repeat the command with the relevant numbers and reasons for other findings you want to confirm.

### Add a review note

To add a note to the report, send a revision request such as:

```text
Revise report version 1: Ask the insurer to restore the business personal property limit to USD 500000.
```

Then send `Compare the documents` to generate the revised draft. This reuses the saved analysis and adds your note; it doesn't run model extraction again or change the underlying findings. The longer form, `Revise report version 1 and add a short note on the first page: your note`, is also supported.

Send `Show the report` and review the new version. After requesting a revision, you can't approve the old version.

### Approve the current version

If the revised draft is version 2 and you're ready to approve it, send:

```text
Approve report version 2
```

If you didn't request a revision, use the version of the original draft instead. Approval applies only to the named version and doesn't confirm individual findings.

After successful publication, the response includes a link to the final PDF. Confirmed discrepancies that require action also produce a proposed correction request in the PDF and an editable Markdown file in private storage. Studio provides PDF download links only. Review the correction request and fill in the recipient and broker contact details before sending it yourself; the application doesn't send it.

To start another case in the same conversation, attach the new documents and send `/new`. Identify those documents before comparing them.

## Generate more sample documents

Run `npm run prepare:use-cases` from the project directory to generate additional property and professional-liability examples in `.runtime/use-cases`. The command also writes `manifest.json`, which lists their paths, roles, and differences to investigate. It doesn't call a model.

These files are separate from the three PDFs in `assets/demo`. For the generated property example, use the files in `.runtime/use-cases/property` and replace the filenames in the identification message with `property-proposal.pdf`, `property-issued.pdf`, and `property-amendment.pdf`. The policy details remain the same. The professional-liability example uses general document comparison through the API described below, without declaring an accepted proposal or contract.

## Configure processing

Set `OPENAI_API_KEY` in `.env` to use the default model and budget. No budget file is required. The defaults in `src/mastra/config/processing-config.ts` apply to each analysis:

| Limit                     | Default     |
| ------------------------- | ----------- |
| Attempts                  | 1           |
| Model requests            | 5           |
| Input tokens per request  | 100,000     |
| Output tokens per request | 8,000       |
| Total reserved tokens     | 300,000     |
| Estimated cost            | US$5        |
| Timeout per request       | 120 seconds |
| Response size             | 1 MiB       |

The cost limit uses configured estimates of US$10 per million input tokens and US$50 per million output tokens. These are budgeting assumptions, not live provider prices or a billing guarantee. Requests count against the budget at their reserved limits, even if actual usage is lower.

To customize the budget, set this in `.env`:

```dotenv
POLICY_PROCESSING_BUDGET=./processing-budget-example.json
```

Edit the limits and token prices in [processing-budget-example.json](https://github.com/mastra-ai/mastra/blob/main/templates/template-insurance-policy-checking/processing-budget-example.json), then restart Studio. The file replaces the entire default budget. Relative paths start at the project root; absolute paths also work. An unreadable or invalid file prevents startup. Leaving the variable unset or blank uses the defaults.

The default budget allows one attempt. A custom budget can allow retries, but they share the original analysis budget. See `processingBudgetSchema` in `src/mastra/domain/reconciliation-contracts.ts` for the fields and validation rules.

## Environment variables

Set these in `.env` and restart Studio after changes. Only `OPENAI_API_KEY` is required for document comparison.

| Variable                   | Default         | Purpose                                                           |
| -------------------------- | --------------- | ----------------------------------------------------------------- |
| `OPENAI_API_KEY`           | Unset           | OpenAI API key for document comparison.                           |
| `POLICY_EXTRACTION_MODEL`  | `gpt-6.1-sol`   | OpenAI model used to extract and compare terms.                   |
| `POLICY_PROCESSING_BUDGET` | Built-in budget | Path to a JSON file that replaces the default budget.             |
| `POLICY_OPERATOR_ID`       | `local-broker`  | Identifier recorded for the local operator.                       |
| `PORT`                     | `4111`          | Port used by Studio.                                              |
| `POLICY_DATA_DIR`          | `.runtime`      | Private data directory, relative to the project root or absolute. |

## Advanced commands and recovery

The earlier slash commands remain supported: `/status`, `/case CASE_ID`, `/clarify JSON`, `/compare JSON`, `/report JSON`, `/evidence SOURCE_ID PAGE`, and `/review JSON`. Replace the uppercase placeholders with actual values. For JSON requests, use the schemas in `src/mastra/domain/`; the case-status and report tools provide the current identifiers, revisions, and checksums.

Through the clarification API, you can compare documents without declaring contractual acceptance. Set the intent to `document_comparison` and the accepted baseline to `null`. The review API also supports evidence revisions, rejection, dismissal, and severity overrides.

If a custom budget permits a retry, pass the saved attempt identifier as `retryAttemptId` in a structured comparison request. Keep the inputs unchanged and use the current case revision. Sending the ordinary comparison command doesn't supply this retry identifier.

If a report fails to publish, resolve the reported storage or publication problem, then use the report API's `retryPublication` option to publish from the saved analysis or approval. When approval is already saved, don't approve again to recover a missing file.

A revision or rejection closes the workflow for that report; a new draft waits for review in a new workflow. If an interruption occurs after the decision is saved but before the workflow closes, `Show the report` also attempts to finish that step. Completing a workflow doesn't approve a report: approval still requires your explicit command for the current version.

Review decisions are recorded against the original user message, local operator, and exact report version. Instructions inside uploaded documents can't authorize a decision, and an older version can't be approved after it has been replaced.

## Back up local data

Access Studio through the configured `127.0.0.1` address. Stop Studio before backing up or restoring the entire data directory, including databases, source documents, and reports. Use `Show status` or `/status` to check for interrupted uploads or missing source files.

If you have data from an earlier version that used locale-sorted checksums, start with a fresh data directory. Keep the old data with the code version that created it; legacy hashes aren't migrated.

## Limitations

- The bundled input driver accepts directly attached, unencrypted PDFs with searchable text. Remote URLs and optical character recognition (OCR) aren't supported. Image-only or empty documents are rejected. On pages containing both text and images, the application captures the text and flags image content it couldn't read.
- PDF extraction has CPU, memory, time, and output limits, so complex files may be rejected. Upload limits are configured in `src/mastra/config/input-limits-config.ts`.
- The application runs locally for one operator. It doesn't support multiple tenants or automatic delivery. A broker must review the findings before relying on the report.
- Native Windows isn't supported because the runtime depends on macOS/Linux shell and filesystem features. On Windows, use [WSL2](https://learn.microsoft.com/en-us/windows/wsl/install), install dependencies, and run the Quickstart commands in its Linux terminal. Keep the project and data in the Linux filesystem, for example `~/insurance-policy-checking`. WSL2 hasn't been validated by this template's test suite.

To extend document intake, give your coding agent this prompt:

> Add an input provider for [OCR PDFs, remote documents, or structured records]. Inspect `InputProvider`, `SourceBundle`, and `validateBundle` in `src/mastra/domain/case-contracts.ts`, then propose a plan before editing. Register the provider in `src/mastra/provider-config.ts` and connect it in `document-intake-processor.ts`. Preserve the original source bytes or records, checksums, provenance, evidence locators, and extraction limitations. Put deterministic input constraints in schemas and check authorization and external responses during execution. Verify document capture and evidence retrieval with real local infrastructure. Keep broker approval and processing-budget checks in place.
