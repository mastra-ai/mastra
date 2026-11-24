# Local operation and development

Use the terminal to answer a questionnaire, configure your organization's evidence, or inspect a saved run. A **run** is one attempt to process and review a questionnaire. Its ID lets you return to the saved work.

Run the commands on this page from the template directory. For the browser walkthrough, see the [web UI guide](ui.md).

## Answer the sample questionnaire

1. Install the backend and web dependencies:

   ```bash
   npm install
   ```

2. Create your local environment file, then open `.env` and set `OPENAI_API_KEY`. Keep an existing `.env` if you have already configured it.

   ```bash
   cp .env.example .env
   ```

3. Generate the fictional questionnaires, evidence and profile:

   ```bash
   npm run demo
   ```

   This command makes no model calls and preserves existing configuration and data. If it reports incomplete or unsafe demo data, resolve that diagnostic before continuing.

4. Stop `npm run dev` with `Ctrl+C` if it is running, then start the questionnaire:

   ```bash
   npm run respond -- "$PWD/.runtime/demo/questionnaire.xlsx"
   ```

   To try Word, replace `questionnaire.xlsx` with `questionnaire.docx`. Processing uses your API key and the limits in `.runtime/profile.json`.

   `respond` runs Mastra directly; it does not need the web server. Only one process can write to the local database at a time. If it reports `DATABASE_WRITER_OWNED`, stop the other server or terminal writer before retrying. For a lock left after a crash, follow [local process ownership](review.md#local-process-ownership).

5. The sample has automatically recognized headers and empty answer destinations. For other layouts, follow any field-mapping prompts. If an answer destination already contains text, inspect it and type `REPLACE` to authorize replacement; this confirmation is case-insensitive. For each answer, read the draft and citations, then choose `release`, `correct`, `unknown` or `withheld`. See [review choices](review.md#choose-what-to-share) for examples.
6. Read the complete revised answer set and type `APPROVE` when ready to share it.

The command returns the path to one `answered.xlsx` or `answered.docx` under `.runtime/exports`. Open it and check the answers and qualifications, including answers marked unknown or withheld.

### Sample fields

The XLSX and DOCX samples contain 24 questions and these six columns:

| Header           | Purpose                                                |
| ---------------- | ------------------------------------------------------ |
| `Reference`      | Original question ID                                   |
| `Inquiry`        | Question text                                          |
| `Guidance`       | Instructions and scope for the answer                  |
| `Buyer response` | Empty destination for the approved answer              |
| `Explanation`    | Empty destination for qualifications, reasons and gaps |
| `Evidence`       | Empty destination for approved citation references     |

The sample questions use `free_text`, and the interpretation agent selects a domain within the configured evidence scope. Custom questionnaires can include `Response kind`, `Allowed values` and `Domain` to specify answer types, choices and source section labels. Configure the organization's scope separately in the evidence profile.

Custom questionnaires can use fewer columns. For example, `Reference | Inquiry | Buyer response` supports free-text answers. Explicit choice answers require an explanation destination for qualifications and gaps. See [automatic header recognition](intake.md#automatic-header-recognition) and the [field-mapping walkthrough](intake.md#upload-and-map-in-the-frontend) for supported fields and constraints.

After editing a questionnaire, start a new run or upload the edited file. Resuming a browser upload uses the original saved bytes; changing the file on disk does not update that run.

## Resume terminal work

Copy the run ID printed by the command. For example, if it printed `review-1`, resume with:

```bash
npm run respond -- --resume review-1
```

Terminal cancellation leaves approval pending and saves completed work. Resuming keeps the original model, limits and usage. This differs from **Cancel execution** in the web UI, which ends that run and requires a new upload. See [review and recovery](review.md) if a crash leaves a writer lock or an operation claim.

## Configure your organization's evidence

The questionnaire contains the customer's questions. **Evidence** is the material your organization has approved for answering them, such as a policy or operational record. These are separate inputs.

Three parts work together:

| Part                    | What it contains                                                                           |
| ----------------------- | ------------------------------------------------------------------------------------------ |
| Evidence directory      | Local XLSX, PDF, CSV, JSON or Markdown source files                                        |
| Manifest JSON           | A list of source files, their versions, approval details and sharing rules                 |
| `.runtime/profile.json` | Absolute paths to that directory and manifest, the organization scope and execution limits |

DOCX is supported for questionnaires, but not evidence. Scanned PDFs and OCR are not supported.

1. Run the demo first to see a working configuration. Open `.runtime/profile.json` and the manifest at its `manifestPath`.
2. Prepare a separate directory with your actual evidence. For example, `evidence/access-policy.md` might contain an existing, approved access policy. Don't reuse fictional demo claims for your organization.
3. Create a manifest for those files. Each entry needs a file hash, version, scope, validity dates and approval metadata. A SHA-256 hash is a fingerprint of the exact file bytes; editing the file changes it.
4. Update the profile to point to your evidence and manifest. The profile's organization, product, environment and domains must match the sources you want to use.
5. Check the configuration locally with the command below, then start a new questionnaire run.

From the template directory, this check parses the profile and manifest, checks the configured paths and organization, and makes no model calls:

```bash
node --input-type=module -e 'import { loadEvidenceProfile } from "./src/mastra/runtime/profile.ts"; await loadEvidenceProfile(); console.log("Profile configuration is valid.");'
```

This is a configuration check. Intake still checks source hashes, eligibility and supported file contents when it creates the run's evidence snapshot, a saved copy of the evidence selected for that run.

An eligible source must be approved, currently valid, allowed for LLM use and within the configured scope. The disclosure rule separately controls what can be shared with the customer. See [review and approval](review.md#source-sharing-rules).

### Ask a coding LLM to prepare the configuration

<details>
<summary>Show optional prompt</summary>

Use this prompt with a coding LLM that can read the project and the files you authorize it to inspect. Replace the bracketed values first. The model must get approval and disclosure facts from you; it cannot infer them from a document's wording.

```text
Configure local evidence for this vendor-risk-questionnaire template.

My evidence directory: [absolute path]
Organization ID: [organization]
Product: [product]
Environment: [environment]
Domains: [domains]
Manifest destination: [absolute path outside the customer export directory]

Read docs/local-operation.md and these contracts before editing:
- src/mastra/contracts/profile.ts
- src/mastra/contracts/evidence-manifest.ts
- src/mastra/contracts/evidence-snapshot.ts
- src/mastra/contracts/execution-policy.ts
- src/mastra/runtime/profile.ts

Use the existing demo profile and manifest only as structure examples.
Create a manifest for the actual files and update .runtime/profile.json.
Compute SHA-256 hashes from the files. Use relativePath values relative to
my evidence directory and absolute paths in the profile. Keep all required
policy fields and ask me for model, budget, call/time limits and pricing
estimates if I haven't supplied them.

Ask me for each source's version, scope, kind, validity dates, approval
state, approver, approval date, permission to send to an LLM, and disclosure
rule. Never invent approval metadata, organization facts or permission.
Explain shareable, review_required and restricted before asking me to choose.
Preserve existing configuration until you have the required information.

Validate the generated JSON with the repository schemas and run the local
profile check. List any unresolved source or eligibility checks. Show the
changed files and the command to start a new questionnaire. Do not start
model calls, approve answers or export documents.
```

</details>

## Inspect a run and its storage

Use the actual run ID in place of `review-1`:

```bash
npm run review -- status --run-id review-1
npm run review -- metrics --run-id review-1
```

`status` shows the review record once drafting reaches that checkpoint. `metrics` shows processing, review and usage measurements. Both can read while the server is running.

Stop the dev server before running terminal commands that change a run. Only one process may write the local database at a time.

Local files live under ignored `.runtime`. They include the LibSQL database, original questionnaire bytes, evidence snapshots, review records and exports. The template trusts the local OS operator and provides no automatic cleanup, encryption-at-rest guarantee, remote backup or multi-user authorization system. [Explicit cleanup](review.md#explicit-cleanup) removes a selected run.

Changing evidence or its policy invalidates an existing approval and requires a new run. `VRQ_MODEL` overrides the profile model for new runs; resumed runs retain their saved model. [Execution limits](drafting.md#execution-policy) may leave unanswered questions and are not a provider billing cap.

The default profile allows 1,000 provider calls (`policy.maxPhysicalCalls`), USD 5 in estimated cost (`policy.budgetUsd`) and 30 minutes (`policy.maxRunElapsedMs`). Detector, interpretation, drafting, verification, retry and review calls share these limits. To configure different limits, edit the policy in `.runtime/profile.json` and start a new run. See [finishing an exhausted run](review.md#finish-when-the-budget-is-exhausted) for the `unknown` and `withheld` review path.

## Open Mastra Studio

1. Run `npm run dev:mastra`.
2. Open [Mastra Studio](http://127.0.0.1:4111).
3. Select a workflow, or open **Observability → Traces** to inspect execution.

For document intake in Studio, select **vendor-risk-intake** and supply a local document path in `sourcePath`, preferably an absolute path. The **vendor-risk-questionnaire** workflow consumes saved intake and evidence for a run; it does not accept a file upload or questionnaire columns as input. Follow the [Studio intake and review steps](review.md#studio-intake-and-review). Use the [web interface](ui.md) for file uploads. `npm run dev` starts both interfaces together.

For production, follow the [production setup](ui.md#production). It requires `NODE_ENV=production` and `MASTRA_STUDIO_TOKEN`. The web server also requires `MASTRA_STUDIO_TOKEN` during development; see [local sign-in and shared limits](ui.md#run-locally).

## Development checks

From the template directory, run:

```bash
npm run test -- --no-file-parallelism
npm run typecheck
npm run format:check
npm run check --prefix demo_ui
npm run build --prefix demo_ui
npm run build
```

Stop the dev server before building Mastra. Ordinary tests use controlled providers and need no API key. [Live evaluation](evaluation.md#optional-live-evaluation) is a separate, optional command that makes provider calls.
