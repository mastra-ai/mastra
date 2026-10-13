# Questionnaire formats and field mapping

A **mapping** tells the template where to read questions and where to write approved answers. For example: “Column B contains questions; column C receives answers.” It does not choose answers or assign evidence files to questions.

Start with a regular XLSX table or DOCX table. Use the walkthrough below for a first file, then use explicit mapping for layouts such as separate YES and NO columns.

## Prepare a questionnaire

| Input   | Supported structure                                            | Output                   |
| ------- | -------------------------------------------------------------- | ------------------------ |
| `.xlsx` | Ordinary worksheet tables, with one question per row           | An answered `.xlsx` copy |
| `.docx` | Regular tables in the document body, with one question per row | An answered `.docx` copy |
| `.docx` | Paragraph blocks in the identified format below                | An answered `.docx` copy |

Use editable text and ordinary cells. A table needs a question field and destinations for the approved answer. Question IDs are optional; supplied IDs must be unique, and absent IDs are generated from source locations. A domain column is optional. The interpretation agent selects the domain using the question and configured scope.

The default limits are 10 MiB per questionnaire, 100 questions and 4,000 characters per question. PDF questionnaires, `.xls`, CSV questionnaires and arbitrary Word prose are not supported. Evidence files have a separate format contract described below.

## Create your first questionnaire

1. Create a spreadsheet with one sheet and these exact headers in row 1:

   | Reference | Inquiry                                                      | Buyer response |
   | --------- | ------------------------------------------------------------ | -------------- |
   | Q1        | Does your access policy require multi-factor authentication? |                |
   | Q2        | How often are backups tested?                                |                |

2. Leave the answer cells empty. Keep each question on its own row, without merged cells.
3. Save the file as `questionnaire.xlsx`.
4. Upload it using the steps below. These headers are recognized automatically.
5. After review and approval, open `answered.xlsx`. Column C contains the approved answers, with unknown or withheld answers clearly marked. The original file remains unchanged.

For Word, create a regular table in the document body with the same headers and save it as `.docx`. The output is an answered DOCX file. For a supplied sample, run `npm run demo` from the template directory and use `.runtime/demo/questionnaire.xlsx` or `.runtime/demo/questionnaire.docx`.

## Upload and map in the frontend

1. Start the application as described in the [web UI guide](ui.md).
2. In **Upload**, select the questionnaire and select **Submit**.
3. Open the uploaded file under **Questionnaires**. If the system recognizes its table headers, it proceeds automatically. Otherwise, answer the mapping prompts shown in the questionnaire detail panel.
4. For each nonempty sheet or document region, choose `map` for questions or `exclude` for non-question content. Supply the first and last question rows, then the column index for each requested field. Leave optional fields blank when absent.
5. Explain exclusions for header rows, titles and other non-question rows. Confirm replacement of any prefilled answer destinations by entering `REPLACE` when prompted.
6. Review drafts and citations, submit the review, and approve the complete answer set. **Download** becomes available when export finishes.

### Convert visible rows and columns to indices

The prompts count from zero. In the two-question example above:

| What you see in the spreadsheet | Value to enter  |
| ------------------------------- | --------------- |
| Column A: Reference             | `0`             |
| Column B: Inquiry               | `1`             |
| Column C: Buyer response        | `2`             |
| Row 1: Header                   | Exclude row `0` |
| Row 2: First question           | Start row `1`   |
| Row 3: Last question            | End row `2`     |

Both row bounds are included. With ten questions in visible rows 2–11, enter start `1` and end `10`. DOCX table rows and cells also count from zero.

Every nonempty candidate row must be selected or explicitly excluded exactly once. Map each question region once. Selected sheets and DOCX body regions retain source order, including hidden worksheet content when explicitly mapped. The frontend displays text prompts; keep the original file open to identify the correct columns and rows.

The frontend and `npm run respond -- /absolute/path/questionnaire.xlsx` use the same mapping prompts. They request `question`, `id`, `type`, `options`, `instructions`, `response`, `explanation` and `evidence`. They do not expose separate `yes`, `no` or `not_applicable` targets, region-level answer constraints, or a JSON mapping upload. Those require explicit mapping through Studio or the intake API in code.

## Automatic header recognition

Automatic mapping recognizes the following exact, case-sensitive headers in any column order. Every header in the first parsed row of a question table must be recognized and unique, and `Inquiry` must be present. All nonempty regions must match a supported structure for automatic mapping to proceed.

| Header           | Mapping field  | Purpose                                              |
| ---------------- | -------------- | ---------------------------------------------------- |
| `Reference`      | `id`           | Original question ID                                 |
| `Inquiry`        | `question`     | Question text                                        |
| `Guidance`       | `instructions` | Instructions and scope for the question              |
| `Buyer response` | `response`     | Destination for the answer                           |
| `Explanation`    | `explanation`  | Destination for qualifications, reasons and gaps     |
| `Evidence`       | `evidence`     | Destination for approved citation references         |
| `Response kind`  | `type`         | Explicit answer type                                 |
| `Allowed values` | `options`      | Explicit choice values separated by a pipe character |
| `Domain`         | `section`      | Source section label                                 |

For example, `Reference | Inquiry | Buyer response` supports free-text answers with automatic mapping. `Reference | Inquiry | Guidance | Buyer response | Explanation | Evidence` adds instructions and separate output fields. Leave output cells empty unless they contain values you intend to review and replace.

A header such as `Question`, `Question ID`, `YES`, `NO` or `NOTES` is not an automatic alias. The document can still use those labels with explicit field mapping. Unknown or repeated headers request operator mapping; the system does not ask a model to guess their meaning.

Without a mapped type or region-level `answerType`, questions use `free_text`. Mapping answer columns does not infer a boolean answer type. `boolean` and `single_choice` require explicit allowed options. If a type or options column is present, its values must satisfy these rules.

## Example: Question ID, Question, YES, NO, NOTES

This layout is supported by the backend with explicit mapping:

| Question ID | Question                                           | YES | NO  | NOTES |
| ----------- | -------------------------------------------------- | --- | --- | ----- |
| Q1          | Is workforce multi-factor authentication required? |     |     |       |
| Q2          | Do you hold a current SOC 2 Type II report?        |     |     |       |

The mapping depends on whether you want marks in `YES` and `NO` or an answer written in `NOTES`.

### Use the current frontend with answers in NOTES

The file can be uploaded without changing its columns if `NOTES` is the destination for the complete free-text answer. For each question region, answer the field prompts as follows:

| Prompt field   | Column index |
| -------------- | ------------ |
| `question`     | `1`          |
| `id`           | `0`          |
| `type`         | Leave blank  |
| `options`      | Leave blank  |
| `instructions` | Leave blank  |
| `response`     | `4`          |
| `explanation`  | Leave blank  |
| `evidence`     | Leave blank  |

For the two-question table above:

1. Choose `map` for the question region.
2. Enter first question row `1` and last question row `2`.
3. Enter the field values in the table above.
4. Exclude row `0` with the reason `Questionnaire header row.`
5. Confirm any prefilled replacements only after inspecting them.

Map `NOTES` only as `response`; a column cannot serve two mapping fields. Answers, qualifications and gap reasons are written together in `NOTES`. `YES` and `NO` remain untouched, including any existing contents. Start with those cells empty to avoid retaining stale marks.

If you prefer a file that maps automatically, use `Reference | Inquiry | Buyer response`, with the IDs, questions and blank response cells in those columns. Remove unused `YES` and `NO` columns from that prepared copy. A separate `Evidence` column is optional; citations remain available during review even without a citation destination in the exported file.

### Preserve YES and NO as separate answer destinations

Use Studio or a code integration to supply an explicit mapping. No additional columns are required for this example:

| Source column | Index | Mapping field |
| ------------- | ----- | ------------- |
| `Question ID` | `0`   | `id`          |
| `Question`    | `1`   | `question`    |
| `YES`         | `2`   | `yes`         |
| `NO`          | `3`   | `no`          |
| `NOTES`       | `4`   | `explanation` |

Set the region's `answerType` to `boolean` and provide allowed options. The following JSON supplies the `regions` and `exclusions` portions of a mapping for the worksheet above, with one header and two question rows. This is a partial mapping; the Studio steps below add the required source and version fields:

```json
{
  "regions": [
    {
      "regionId": "sheet:0",
      "startRow": 1,
      "endRow": 2,
      "fields": {
        "id": 0,
        "question": 1,
        "yes": 2,
        "no": 3,
        "explanation": 4
      },
      "answerType": "boolean",
      "answerConstraints": {
        "options": [
          { "value": "yes", "label": "Yes" },
          { "value": "no", "label": "No" },
          { "value": "partial", "label": "Partial" },
          { "value": "not_applicable", "label": "Not applicable" }
        ]
      }
    }
  ],
  "exclusions": [
    {
      "regionId": "sheet:0",
      "startRow": 0,
      "endRow": 0,
      "reason": "Questionnaire header row."
    }
  ]
}
```

Use the region ID and row bounds reported for your actual file. For a DOCX body table, use its inspected table ID, such as `table:0`, with the same field indices and `docx.table.v1` profile.

On export, an approved `yes` marks `YES` with `X`; an approved `no` marks `NO` with `X`. The other mapped choice cells are blank. Qualifications go into `NOTES`. Partial and not-applicable answers leave both marks blank and carry their explanation in `NOTES`; an optional `not_applicable` target can mark a separate N/A cell. Unknown and withheld decisions also leave both marks blank, with their status and reason in `NOTES`. These outcomes must not be forced into a yes or no answer.

The frontend's current prompts cannot construct this separate-choice mapping. Supporting it directly in the upload flow requires exposing the `yes`, `no` and optional `not_applicable` fields, plus the answer type and allowed options. Renaming the two headers alone does not enable that behavior.

## Submit an explicit mapping through Studio

Use Studio for mappings the web prompts cannot express, such as separate YES and NO destinations. Start with empty answer cells for this walkthrough.

1. Configure the [local evidence profile](local-operation.md#configure-your-organizations-evidence), then run `npm run dev:mastra` from the template directory.
2. Open [Mastra Studio](http://127.0.0.1:4111) and select **vendor-risk-intake**.
3. Supply `runId`, `sourcePath`, `sourceId`, `questionnaireId` and `title` as shown in the [Studio input example](review.md#studio-intake-and-review). Use an absolute questionnaire path available to the server.
4. Run the workflow. It pauses at **confirm-input-mapping** and returns an inspection: the document's source hash, adapter version, regions, candidate mappings and diagnostics.
5. Build the complete mapping. If a candidate is suitable, copy it and check every region and exclusion. Otherwise, use the fields below.
6. Resume the paused step with a JSON object containing your complete `mapping` and `confirm: true`.
7. Check that intake succeeds. Pass its output to **vendor-risk-questionnaire** for drafting, review and export.

The mapping needs these top-level fields:

| Field                          | Where to get it                                                                       |
| ------------------------------ | ------------------------------------------------------------------------------------- |
| `contractVersion`              | `1`                                                                                   |
| `sourceSha256`                 | Copy the exact hash from inspection                                                   |
| `adapterKey`, `adapterVersion` | Copy from inspection                                                                  |
| `profile`                      | `xlsx.table.v1`, `docx.table.v1` or `docx.blocks.v1`, matching the document structure |
| `profileVersion`               | `1`                                                                                   |
| `regions`                      | Question regions with row bounds and field indices                                    |
| `exclusions`                   | Other nonempty rows or regions, each with a reason                                    |

The source hash is a fingerprint of the inspected file. If the file changes, inspect it again rather than reusing the old mapping. Studio requires confirmation even when one candidate exists. The configured evidence profile supplies evidence paths, scope and policy unless you provide a complete explicit evidence configuration.

### Ask a coding LLM to generate the resume JSON

<details>
<summary>Show optional prompt</summary>

The full mapping depends on the actual file, so a fixed JSON example cannot supply its hash or region IDs. Give this prompt to a coding LLM with access to the project and your inspected questionnaire:

```text
Create .runtime/intake-resume.json for this vendor-risk-questionnaire input:
[absolute questionnaire path]

Use this exact inspection returned by confirm-input-mapping:
[paste inspection JSON, or give the path to a saved inspection file]

Read src/mastra/contracts/mapping.ts, src/mastra/contracts/inspection.ts,
src/mastra/contracts/question.ts and docs/intake.md.
I want: [free-text answers in NOTES, or X marks in YES/NO with reasons in NOTES].

Copy sourceSha256, adapterKey and adapterVersion from the inspection.
Choose the supported profile for the actual document. Use zero-based row
and column indices with inclusive row bounds. Map each question region
once and cover every nonempty candidate row exactly once, either as a
question or an explicit exclusion. Ask me about ambiguous regions or
exclusions; do not guess. Keep field columns distinct.

For separate YES/NO cells, use answerType boolean, explicit allowed options,
and an explanation destination. Preserve partial, not_applicable, unknown
and withheld outcomes without forcing them to yes or no. Do not consent to
replace prefilled values on my behalf; identify them for review.

Write { "mapping": <complete mapping>, "confirm": true } only when the
mapping is complete. Validate mapping with mappingSchema, then show a
human-readable table of rows, columns and exclusions for me to check.
Explain that schema validation alone does not verify the source binding or
full row coverage. Do not resume the workflow or approve questionnaire answers.
```

After checking the file, paste its contents into the paused step's resume input. This confirms the input mapping, not the answers or their export.

</details>

In code, `IntakeCoordinator.inspect` and `IntakeCoordinator.import` provide the same inspection and normalization behavior. The browser multipart endpoint accepts a file and uses interactive prompts; it does not accept this mapping JSON.

## Field and answer constraints

Each mapping associates a field role with a column index. Field indices within a region must be distinct. The complete table mapping contract supports:

| Fields                                | Meaning                                                            |
| ------------------------------------- | ------------------------------------------------------------------ |
| `question`, `id`                      | Question text and optional original ID                             |
| `section`, `instructions`             | Source context supplied with a question                            |
| `type`, `options`                     | Answer type and allowed choices from source columns                |
| `required`, `maxChars`                | Source requirements: literal `true`/`false` and a positive integer |
| `response`, `explanation`, `evidence` | Destinations for the answer, qualifications and citations          |
| `yes`, `no`, `not_applicable`         | Destinations for `X` marks on approved choice answers              |

Supported answer types are `free_text`, `boolean` and `single_choice`. A source options cell uses ordered `|`-separated values, for example `yes|no|partial|not_applicable`. Explicit region mappings can instead supply `answerType` and `answerConstraints`, including options with separate values and labels. Free-text questions cannot carry choice options. Boolean options must include positive and negative values; additional allowed outcomes can be supplied.

Completion requires either a `response` destination or the combination of `yes`, `no` and `explanation`. Choice-constrained questions also require an `explanation` destination for qualifications and gaps. Free-text answers can use a combined `response` destination. The exporter writes into mapped cells or paragraph spans; it does not add missing answer columns. Layouts with only question text therefore need answer cells or spans before they can complete the full workflow.

## Word paragraph blocks

A `docx.blocks.v1` question is one paragraph containing the following labels and line breaks:

```text
ID: Q1
Question: Describe workforce access controls.
Response:
```

The response is written after `Response:`. Each selected paragraph region uses row `0` and question column `0`; answer constraints can be supplied in its explicit mapping. Non-question paragraphs, headers and footers require explicit exclusions. For documents with tabular questions, use the table profile instead. Arbitrary prose boundaries are not inferred.

## Validation before drafting

Intake preserves question text, IDs, order and source locations. Before calling a model, it checks that the exact mapped destinations can receive answers. The mapping is tied to the inspected source hash and adapter/profile versions.

Changing column widths in Excel is supported. Export preserves those widths and recognized Excel theme, style and revision metadata. Shared-string cells are screened using their displayed text. Numeric formatting fields and revision identifiers are validated in their specific XML locations; text, comments and other attributes still receive content screening. Unknown extensions and embedded content remain unsupported.

Prefilled answers are untrusted input, not evidence. The frontend and terminal ask for `REPLACE` for each nonempty destination. A formula-backed answer cell cannot be completed even with that consent. A custom integration must record consent tied to the exact source and destination.

If intake or export reports an unsupported layout, prepare a corrected copy and upload it as a new run:

| Problem                                                 | How to prepare the copy                                       |
| ------------------------------------------------------- | ------------------------------------------------------------- |
| Merged question rows or answer cells                    | Use one ordinary row per question and separate writable cells |
| Formulas in question fields or answer targets           | Use literal question text and empty answer cells              |
| Missing answer destinations                             | Add a response column, or YES/NO plus an explanation column   |
| Nested or irregular Word tables, text boxes or controls | Move questions into regular body tables                       |
| Protected or fixed layouts that prevent writing         | Provide an editable layout that can hold the full response    |

Tracked changes, embedded objects, encrypted packages and remote relationships also produce diagnostics. Parsing has time, memory and expansion limits; an incomplete parse does not count as a successful partial intake. Ordinary text, tabs, line breaks and supported hyphens retain their literal representation.

## Evidence and local state

Questionnaire formats and evidence formats differ. Evidence accepts local XLSX, PDF, CSV, JSON and Markdown files. Configure them through the [evidence profile and manifest](local-operation.md#configure-your-organizations-evidence).

Each run creates a saved snapshot of eligible evidence and a Mastra Workspace keyword index. The filesystem is read-only and contained within the configured area. There is no external URL retrieval or sandbox. The backend searches and reads evidence; agents have no filesystem or retrieval tools. See [retrieval details](drafting.md#retrieval-details-and-limitations).

A citation's **locator** identifies a position in the original evidence:

| Evidence format | Locator             |
| --------------- | ------------------- |
| XLSX            | Sheet and cell      |
| PDF             | Page and text block |
| CSV             | Record and column   |
| JSON            | JSON pointer        |
| Markdown        | Heading and line    |

PDF order follows the extractor's structure and may differ from visual reading order. Scanned pages, forms, annotations, attachments and JavaScript actions are rejected.

For code integrations, `validateSnapshotSources` rechecks source hashes and policy, `resolveEvidenceLocator` reads an original source location, and `validateEvidenceCitation` checks the version, hash, eligibility, locator and exact supporting excerpt. These checks establish the source of a quote; they do not prove that it supports a claim. Drafting and review add detectors, independent support verification and human release approval.

Intake makes no model calls. Runtime storage and cleanup are described in [local operation](local-operation.md#inspect-a-run-and-its-storage).

## Add a format in code

Supporting a new questionnaire format requires both reading it and writing approved answers back to the correct locations.

1. Implement `FormatParser` in `src/mastra/parsers`.
2. Register its supported modes and lazy loader in `catalog.ts`.
3. Add questionnaire field mapping in the input adapter. For evidence, preserve exact original-source locators.
4. For questionnaire completion, build a plan tied to the source, write literal values within supported limits, and read the result back to verify the approved answers exactly.
5. Add focused tests for parsing, mapping and completion. XLSX intake and export share `coordinates.ts`.

Offline fixture generators live in `tests/fixtures`. Use [development checks](local-operation.md#development-checks) for validation. Additional customer export formats are outside the current contract.
