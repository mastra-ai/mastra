# Insurance Policy Checking

Compare insurance proposals, contracts and issued policies in Mastra Studio. Findings retain exact source evidence, documented changes and unresolved questions. A broker reviews an immutable PDF draft before approving a final report and, when applicable, an editable correction request.

## Why we built this

A selected reference does not prove that its terms were accepted. Policy checking needs explicit document roles, verified evidence and a record of the broker's decisions.

## Prerequisites

- **[OpenAI API key](https://platform.openai.com/api-keys)**: set `OPENAI_API_KEY` for document comparison. Local intake, evidence retrieval and report review do not require model calls.
- An explicitly approved processing budget: set `POLICY_PROCESSING_BUDGET` as described in the [operating guide](./docs/usage.md#configure-processing). Paid processing is disabled by default.
- Textual PDF documents. Encrypted PDFs, remote URLs and OCR are unsupported.

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

- Run `npm run prepare:use-cases` to generate sample PDFs and a manifest in `.runtime/use-cases`.
- Send `/status`, then `/evidence SOURCE_ID 2` to inspect physical page 2 of a saved source.
- Follow the [operating guide](./docs/usage.md) to clarify document roles, run `/compare` and retrieve the PDF with `/report`.
- Review an exact report version with `/review`. Only explicitly confirmed actionable discrepancies in agreed-term checking produce a correction request. Delivery is a separate manual action.

## Customization

- Ask your coding agent: “Explore the provider contracts and propose a plan for adding a structured-record input provider.” Registrations live in `src/mastra/provider-config.ts`.
- Change upload capacities or insurance profiles in `src/mastra/config/`. See [development and validation](./docs/development.md) for file conventions, provider contracts and checks.

## About Mastra templates

This is an official Mastra template. Official templates live in the [Mastra monorepo](https://github.com/mastra-ai/mastra) and are synchronized to standalone repositories.

[Want to contribute?](./CONTRIBUTING.md)
