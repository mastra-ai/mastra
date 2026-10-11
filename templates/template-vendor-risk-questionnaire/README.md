# Vendor Risk Questionnaire Intake

Prepare vendor risk questionnaires for evidence-based review. Import XLSX or DOCX files into a validated question set that preserves wording, IDs, answer constraints and original locations. Search approved organizational evidence through a separate, read-only snapshot and persist both inputs locally.

## Why we built this

Vendor questionnaires vary in structure, and supporting documents have different approval and disclosure rules. Reliable review starts with complete question intake and traceable, eligible evidence.

## Prerequisites

- An XLSX or DOCX questionnaire and an operator-confirmed mapping of its fields and regions.
- For evidence search, local XLSX, PDF, CSV, JSON or Markdown files and a trusted manifest recording approval, scope, validity, hashes, LLM transfer permission and disclosure policy.
- Current intake runs locally without an API key. `OPENAI_API_KEY` in `.env.example` is reserved for later answer processing.

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

## Try it out

- Import your DOCX questionnaire using its own inspected mapping and source hash.
- Change a source after inspection: its stale mapping is rejected. Unaccounted content and unsupported layouts also fail with diagnostics.
- Search evidence with different approval, validity or disclosure metadata. Prefilled questionnaire responses remain untrusted.
- For an optional first-run sample, `npm run demo` creates an originally authored fictional corpus under `.runtime/demo`.

## Customization

- Open the project in your coding agent and describe your change: “Map our questionnaire fields and configure evidence scope. Explore the code and propose a plan before making changes.”
- Supply your own questionnaires, manifests and evidence. Production intake has no dependency on demonstration data.
- Configure parser limits or register a trusted versioned questionnaire adapter with strict validators and original locator resolution. See [profiles, limits and evidence boundaries](docs/intake.md).

## Current scope

Intake and evidence preparation are implemented. Answer drafting, approval and exports remain future work. `npm run dev` opens Mastra Studio with storage composition; intake currently uses the CLI above.

Runtime state is stored under `.runtime`. The local OS operator is trusted; cleanup is explicit. Evidence tools expose bounded read/search only. Eligibility and locator validation preserve traceability; they do not prove an answer or authorize disclosure.

## About Mastra templates

This example follows the official Mastra template format and lives in the Mastra monorepo. It uses Mastra Workspace, tools and local storage.

[Want to contribute?](https://github.com/mastra-ai/mastra/blob/main/CONTRIBUTING.md)
