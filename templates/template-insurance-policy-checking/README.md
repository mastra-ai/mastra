# Insurance Policy Checking

Insurance proposals, contracts and issued policies can disagree on coverage, limits and exclusions. This Mastra template brings those documents into a single review, linking each finding to its source and keeping agreed changes separate from unresolved questions. Brokers can review a PDF draft, record their decisions and approve a final report with a proposed correction request when needed.

## Why we built this

Checking an issued policy against the agreed terms means more than spotting different wording. Brokers need to trace each difference to the original documents, account for accepted changes and decide what needs correction. This template keeps that evidence and review history together so the broker can make and explain the final decision.

## Demo

<video controls width="640" height="360" src="https://res.cloudinary.com/mastra-assets/video/upload/v1793040444/insurance_policy_checking_cjqfpt.mp4"></video>

## Prerequisites

- **[OpenAI API key](https://platform.openai.com/api-keys)**: set `OPENAI_API_KEY` for document comparison. Local intake, evidence retrieval and report review do not require model calls.

## Quickstart 🚀

1. **Create the project**
   - Run `npx create-mastra@latest insurance-policy-checking --template insurance-policy-checking`.
   - Run `cd insurance-policy-checking`, then `npm install`.
2. **Configure the environment**
   - Run `cp .env.example .env` and supply the values described under Prerequisites.
3. **Start Studio**
   - Run `npm run dev` and open [Mastra Studio](http://127.0.0.1:4111).
   - Select **Policy Checking**, attach a textual proposal and policy through **Add attachment → Add a local file**, and send a message. The saved response lists filenames and guides you through the next step.

## Try it out

Optionally run `npm run prepare:use-cases` in your terminal to generate sample PDFs in `.runtime/use-cases`. In the **Policy Checking** conversation in **Mastra Studio**:

- Attach a proposal and an issued policy, then say `Show status` to see their filenames and physical page counts.
- Say `Show page 2 of "property-issued.pdf"` to inspect saved source text.
- Follow the [usage guide](https://github.com/mastra-ai/mastra/blob/main/templates/template-insurance-policy-checking/docs/usage.md) to identify your accepted baseline and issued policy by filename, then say `Compare the documents` and `Show the report`.
- Read the draft, record finding decisions and approve its exact version with `Approve report version 1`. Confirmed actionable discrepancies in agreed-term checking produce a proposed correction request for manual delivery.

## Customization

Override the model with `POLICY_EXTRACTION_MODEL=gpt-6.1-sol` or the built-in budget with `POLICY_PROCESSING_BUDGET=./processing-budget-example.json` in `.env`.
Adjust limits and token prices in [processing-budget-example.json](./processing-budget-example.json), then restart Studio; both overrides are optional.

## About Mastra templates

This is an official Mastra template. Official templates live in the [Mastra monorepo](https://github.com/mastra-ai/mastra) and are synchronized to standalone repositories.

[Want to contribute?](./CONTRIBUTING.md)
