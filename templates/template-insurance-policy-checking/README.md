# Insurance Policy Checking

A starting point for a production insurance policy-checking application. Capture proposals, contracts and issued policies in Mastra Studio, then compare typed terms and clauses with verified source evidence. Persisted comparisons preserve uncertainty, documented amendments and the distinction between a selected reference and accepted terms. Review an immutable PDF draft, record version-specific broker decisions, and retrieve the approved final report with a correction request draft when confirmed discrepancies require one.

## Why we built this

Policy checking needs a traceable account of what differs and why. Immutable originals, explicit reference choices and scoped amendment evidence keep document observations separate from contractual assumptions.

## Prerequisites

- **[OpenAI API key](https://platform.openai.com/api-keys)**: add your key as `OPENAI_API_KEY` in `.env`.

## Quickstart 🚀

1. **Create the project**
   - Run `npx create-mastra@latest insurance-policy-checking --template insurance-policy-checking`.
   - Run `cd insurance-policy-checking`, then `npm install`.
2. **Add your API key**
   - Run `cp .env.example .env` and fill in the key.
3. **Start Studio**
   - Run `npm run dev` and open [Mastra Studio](http://127.0.0.1:4111).
   - Select **Policy Checking**, attach a textual proposal and issued policy via **Add attachment → Add a local file**, and send a message. The processor notice identifies the saved case and sources and requests clarification.

Paid model dispatch remains disabled until explicit processing budgets are approved and configured. An API key alone does not enable it. Intake, review and report retrieval work without model calls.

## Try it out

- Send `/status` to see the selected case, source IDs and missing clarification.
- Send `/evidence SOURCE_ID 2` to read physical PDF page 2, using a saved source ID.
- Attach documents with `/new` to start another case in the same conversation. Use [`/clarify` and the operating guide](./docs/usage.md) to declare document roles and reference choices.
- After clarification and budget configuration, send [`/compare`](./docs/usage.md#compare-documents) to run **policyCheckingWorkflow**. Send `/report` for the immutable PDF draft and its evidence.
- Use [`/review`](./docs/usage.md#review-an-exact-report-version) to confirm or dismiss named findings, request a revision, reject, or approve an exact published version. Approval alone confirms no finding; finalization preserves unresolved evidence and never sends corrections.

## Customization

Ask your coding agent to explore `src/mastra/providers.ts` and propose a plan for adding a structured-record input provider.

## About Mastra templates

This is an official Mastra template. Official templates live in the [Mastra monorepo](https://github.com/mastra-ai/mastra) and are synchronized to standalone repositories.

[Want to contribute?](./CONTRIBUTING.md)
