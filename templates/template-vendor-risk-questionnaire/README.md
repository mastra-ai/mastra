# Vendor Risk Questionnaires

Prepare cited draft answers to vendor risk questionnaires. Import XLSX or DOCX questions, retrieve approved organizational evidence, and process questions in parallel with bounded model calls. Persist qualified answers, supporting citations and explicit review reasons locally. Every draft still requires human release.

## Why we built this

Vendor questionnaires vary in structure, and supporting documents have different approval and disclosure rules. Reliable review starts with complete question intake, traceable evidence and visible gaps in support. A supported negative or partial answer is more useful than an unsupported positive claim.

## Prerequisites

- An XLSX or DOCX questionnaire and an operator-confirmed mapping of its fields and regions.
- For evidence search, local XLSX, PDF, CSV, JSON or Markdown files and a trusted manifest recording approval, scope, validity, hashes, LLM transfer permission and disclosure policy.
- **[OpenAI API key](https://platform.openai.com/api-keys)**: set `OPENAI_API_KEY` in `.env` for `openai/gpt-6.1-sol` through the Responses API, with medium reasoning and Standard processing. The account must have access to this model. Intake and evidence preparation do not call the provider.

## Quickstart 🚀

1. **Set up the project**
   - From `templates/template-vendor-risk-questionnaire` in the Mastra checkout, run `npm run setup` to install dependencies and create `.env`.
2. **Inspect your questionnaire**
   - Run `npm run intake -- inspect --source /path/to/questionnaire.xlsx --source-id questionnaire-source`.
   - Review the regions and diagnostics. A recognized profile writes one candidate mapping to `.runtime/mappings/<sourceSha256>.json`; other supported layouts require an explicit mapping. See [input mappings](docs/intake.md).
3. **Confirm and import**
   - Run `npm run intake -- import --source /path/to/questionnaire.xlsx --source-id questionnaire-source --mapping /path/to/confirmed-mapping.json --run-id review-1 --questionnaire-id questionnaire-1 --organization-id organization-1 --title "Vendor review"`.
   - Successful intake reports `received` and accounted coverage, after persisting canonical questions, the confirmed mapping and original bytes in local LibSQL.
4. **Search eligible evidence**
   - Run `npm run intake -- evidence --manifest /path/to/manifest.json --root /path/to/evidence --run-id review-1 --organization-id organization-1 --product product-1 --environment production --domains access,data --query "access controls"`.
   - Results include eligible excerpts with original locators and metadata explaining denied sources. Manifest fields follow the [evidence contract](src/mastra/contracts/evidence-manifest.ts).
5. **Draft answers**
   - Run `npm run draft -- start --run-id review-1 --manifest /path/to/manifest.json --root /path/to/evidence`.
   - Run `npm run draft -- status --run-id review-1` to inspect persisted routing reasons and usage. Read [draft processing](docs/drafting.md) for the Studio workflow and the restricted local supporting record.

## Try it out

- Import your DOCX questionnaire using its own inspected mapping and source hash.
- Change a source after inspection: its stale mapping is rejected. Unaccounted content and unsupported layouts also fail with diagnostics.
- Search evidence with different approval, validity or disclosure metadata. Prefilled questionnaire responses remain untrusted.
- For an optional first-run sample, `npm run demo` creates an originally authored fictional corpus under `.runtime/demo`.
- Draft questions with missing evidence or restricted sources. Expect explicit review reasons and no automatic release. The default finite call limit may leave gaps in a larger batch.

## Customization

- Open the project in your coding agent and describe your change: “Map our questionnaire fields and configure evidence scope. Explore the code and propose a plan before making changes.”
- Supply your own questionnaires, manifests and evidence. Production intake has no dependency on demonstration data.
- Configure parser limits or register a trusted versioned questionnaire adapter with strict validators and original locator resolution. See [profiles, limits and evidence boundaries](docs/intake.md).

## Current scope

Intake, evidence preparation and grounded draft processing are implemented. Final approval and exports are not implemented. `npm run dev` opens Mastra Studio; select **vendor-risk-drafts** and supply an existing intake run ID, evidence root and manifest path as described in [draft processing](docs/drafting.md). Intake uses the CLI above.

Runtime state is stored under `.runtime`. The local OS operator is trusted; cleanup is explicit. Evidence tools expose bounded read/search only. Eligibility and locator validation preserve traceability; semantic support, confidence and model-based detection remain fallible. The USD 5 run envelope uses a dated application estimate and is not a provider billing cap. Provider access and live answer quality have not been measured.

## About Mastra templates

This example follows the official Mastra template format and lives in the Mastra monorepo. It uses Mastra Workspace, tools and local storage.

[Want to contribute?](https://github.com/mastra-ai/mastra/blob/main/CONTRIBUTING.md)
