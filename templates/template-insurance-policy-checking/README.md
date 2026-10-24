# Insurance Policy Checking

Insurance proposals, contracts and issued policies can disagree on coverage, limits and exclusions. This Mastra template brings those documents into a single review, linking each finding to its source and keeping agreed changes separate from unresolved questions. Brokers can review a PDF draft, record their decisions and approve a final report with a proposed correction request when needed.

## Why we built this

Checking an issued policy against the agreed terms means more than spotting different wording. Brokers need to trace each difference to the original documents, account for accepted changes and decide what needs correction. This template keeps that evidence and review history together so the broker can make and explain the final decision.

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
   - Select **Policy Checking**, attach a textual proposal and policy through **Add attachment → Add a local file**, and send a message. The saved response identifies the case and sources needed for clarification.

## Try it out

Optionally run `npm run prepare:use-cases` in your terminal to generate sample PDFs in `.runtime/use-cases`. In the **Policy Checking** conversation in **Mastra Studio**:

- Attach a proposal and an issued policy, then send `/status` to see their source IDs and the current case revision.
- Send `/evidence SOURCE_ID 2` to inspect the saved text from physical page 2.
- Follow the [usage guide](./docs/usage.md) to declare document roles with `/clarify`, compare them with `/compare` and download the draft with `/report`.
- Read the draft and send `/review` with the exact report version to record your decision. Confirmed actionable discrepancies in agreed-term checking produce a proposed correction request for manual delivery.

## Customization

Set the model and processing budget in `.env`, for example `POLICY_EXTRACTION_MODEL=gpt-6.1-sol` and `POLICY_PROCESSING_BUDGET='<budget JSON>'`.
Copy the budget example from [.env.example](./.env.example), adjust its limits and token prices, then restart Studio.

## About Mastra templates

This is an official Mastra template. Official templates live in the [Mastra monorepo](https://github.com/mastra-ai/mastra) and are synchronized to standalone repositories.

[Want to contribute?](./CONTRIBUTING.md)
