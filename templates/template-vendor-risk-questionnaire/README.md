# Vendor Risk Questionnaires

Complete XLSX or DOCX vendor questionnaires using approved organizational evidence. Draft cited answers in parallel, resolve escalations, explicitly approve the exact answer set, and export consistent XLSX, PDF, CSV, JSON and Markdown artifacts. Local persistent review preserves successful drafts across restarts and keeps unknown or withheld answers visible.

## Why we built this

Vendor questionnaires vary in structure, and supporting documents have different approval and disclosure rules. Reliable review needs complete question intake, traceable evidence and visible gaps. A supported negative or partial answer is more useful than an unsupported positive claim.

## Prerequisites

- An XLSX or DOCX questionnaire and an operator-confirmed mapping of its fields and regions. An originally authored fictional Northstar Tasks demo is included.
- Local XLSX, PDF, CSV, JSON or Markdown evidence and a trusted manifest recording approval, scope, validity, hashes, LLM transfer permission and disclosure policy.
- **[OpenAI API key](https://platform.openai.com/api-keys)**: set `OPENAI_API_KEY` in `.env` for `openai/gpt-6.1-sol` through Responses, medium reasoning and Standard processing. The account must have access to this model. Intake, development startup, status, recovery and unchanged export do not call the provider. Drafting and checks on new review text do.

## Quickstart 🚀

1. **Set up the project**
   - From `templates/template-vendor-risk-questionnaire` in the Mastra checkout, run `npm run setup` to install dependencies and create `.env`. Fill in the key described under Prerequisites.
2. **Start Studio**
   - Run `npm run dev`. It prepares fictional demo files and `.runtime/profile.json` only when absent and preserves custom configuration and existing state. Open [Mastra Studio](http://localhost:4111), select **vendor-risk-intake**, and supply the [demo intake input](docs/review.md#studio-intake).
   - The workflow pauses for mapping confirmation. Inspect the candidate, then resume with your confirmed mapping and `confirm: true`. It persists canonical questions and eligible evidence without provider calls.
3. **Draft and review**
   - Select **vendor-risk-questionnaire** using the persisted intake run ID, evidence root and manifest path. It pauses once after bounded drafting and consistency checks.
   - Follow the [local review walkthrough](docs/review.md) to resolve every question, submit a decision and explicitly approve the final set. Restarting Studio preserves drafts and the review checkpoint.
4. **Export the approved set**
   - Run `npm run review -- resume --run-id review-1`. The parent resumes from review and publishes six files covering all five formats under `.runtime/exports/review-1/revision-<revision>`.
   - Unknown or withheld answers remain visible and mark the bundle `delivered_with_gaps`.

## Try it out

- Import your own DOCX questionnaire with an explicit mapping. Unsupported or unaccounted content fails with diagnostics; prefilled answers remain untrusted.
- Review the fictional demo's missing evidence, conflicting controls and restricted sources. Release supported answers or retain explicit unknown/withheld gaps with safe reasons.
- Restart Studio at the review checkpoint, inspect the existing run and resume it after approval. Successful answers are preserved without redrafting.
- Change a source or disclosure policy after review. Approval becomes invalid and a fresh run is required.
- Preview cleanup with `npm run review -- cleanup-preview --run-id review-1`. Nothing is deleted until you supply the exact preview digest and explicit confirmation.

## Customization

- Open the project in your coding agent and describe the outcome: “Map our questionnaire fields and configure approved evidence scope. Explore the code and propose a plan before making changes.”
- Configure `.runtime/profile.json` once with your absolute evidence root/manifest path, organization/product/environment/domains and finite execution policy. The manifest retains approval, validity, source hashes, transfer and disclosure rules. The agent selects matching eligible excerpts by question topic using BM25 search; it cannot choose new paths or approve sources. You can also add a versioned questionnaire adapter with strict validators and locator resolution. See [intake](docs/intake.md), [drafting](docs/drafting.md) and [review and exports](docs/review.md).

## Agents and artifacts

Studio lists **Question interpretation**, **Evidence answer**, **Independent support verifier** and **Answer factual consistency**. The questionnaire workflow selects these registered instances for each phase. Direct prompts or forged request-context fields fail before provider execution; only the backend binds a persisted run, question, policy and eligible evidence tools. These agents do not approve answers.

One typed catalog in `src/mastra/contracts/artifact.ts` defines six files across five formats, with MIME types and content roles. Exports include questionnaire/evidence sheets in XLSX, separate questionnaire/evidence CSV files, and complete JSON, Markdown and PDF documents. Publication reads their semantic content back against the approved set, verifies hashes and publishes the complete revision atomically.

## Operating boundaries

Studio binds to loopback and trusts the local OS operator. Runtime snapshots, supporting text and review audit stay in `.runtime/vrq.db` until explicit cleanup; the template does not encrypt them. Evidence tools expose bounded read/search only. Restricted content cannot be released through ordinary approval. Factual corrections require eligible citations and new native security and semantic support checks within the original run budget.

The tested stable `mastra@latest` distribution is 1.33.0. Its chat upload UI rejects XLSX/DOCX binary attachments. Use local file paths in the Studio intake workflow and the local review command described above. Upload-based guided chat and native chat approval remain deferred.

The USD 5 default is a dated application estimate, not a provider billing cap. The finite call/token/time limits can leave gaps or prevent further review checks. Detection and semantic verification remain fallible; live model access, answer quality and detector false positives have not been measured. Unsupported PDF glyphs fail diagnostically.

## About Mastra templates

This is an official Mastra template in the [Mastra monorepo](https://github.com/mastra-ai/mastra). It demonstrates a controlled questionnaire workflow with human approval and local storage.

[Want to contribute?](https://github.com/mastra-ai/mastra/blob/main/CONTRIBUTING.md)
