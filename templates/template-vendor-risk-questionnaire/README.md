# Vendor Risk Questionnaires

Answer an XLSX or DOCX vendor questionnaire using approved organizational evidence. Review cited drafts, correct supported answers, keep unknown or withheld gaps visible, and approve one answered copy in the original format. Local persistence lets you resume interrupted work.

## Why we built this

Vendor questionnaires vary in structure, and supporting documents have different approval and disclosure rules. Reliable review needs complete question intake, traceable evidence and visible gaps. A supported negative or partial answer is more useful than an unsupported positive claim.

## Prerequisites

- **[OpenAI API key](https://platform.openai.com/api-keys)**: set `OPENAI_API_KEY` in `.env`. The default model is `openai/gpt-6.1-sol`; optionally set `VRQ_MODEL=openai/gpt-5-mini`. Use a model supporting Responses, structured output and medium reasoning.
- An XLSX or DOCX questionnaire with writable response fields. A fictional Northstar Tasks demo is included.
- For your own organization, local XLSX, PDF, CSV, JSON or Markdown evidence and a trusted manifest specifying source approval, scope and disclosure rules.

## Quickstart 🚀

1. **Install dependencies**
   - From `templates/template-vendor-risk-questionnaire` in the Mastra checkout, run `npm install --workspaces=false`. This template is not yet available through the scaffold command.
2. **Configure your API key**
   - Copy `.env.example` to `.env` and fill in the key described above. `VRQ_MODEL` overrides the profile model for new runs; resumed runs keep their saved model.
3. **Prepare the demo**
   - Run `npm run demo` to create fictional evidence, questionnaires and `.runtime/profile.json`. Existing configuration and demo data are preserved.
4. **Answer a questionnaire**
   - Run `npm run respond -- "$PWD/.runtime/demo/questionnaire.xlsx"` in an interactive terminal. For your own document, supply its absolute XLSX or DOCX path.
   - Follow any mapping prompts, review each answer and citation, and choose supported corrections or explicit gaps. Inspect the complete revised set and type `APPROVE`.
   - The command returns one `answered.xlsx` or `answered.docx` under `.runtime/exports`.
5. **Resume interrupted work**
   - Run `npm run respond -- --resume <run-id>` using the printed run ID. Cancellation leaves approval pending and preserves completed work.

## Try it out

- Use `.runtime/demo/questionnaire.docx` to try the same flow with a Word document.
- Review the demo's conflicting controls, missing evidence and restricted sources. Release supported answers or retain visible gaps.
- Cancel during review, then resume using the run ID to continue from saved choices.

## Customization

- Open the project in your coding agent: “Map our questionnaire fields and configure approved evidence scope. Explore the code and propose a plan before making changes.”
- Configure `.runtime/profile.json` with your evidence paths, organization scope and execution policy. Choose call, time and spending limits; the defaults can leave gaps in the demo and are not a provider billing cap.
- See `docs/intake.md` for supported formats and mappings, `docs/drafting.md` for retrieval and agent behavior, `docs/review.md` for administration and recovery, and `docs/evaluation.md` for tests and metrics.

## Local operation

`npm run dev` opens Mastra Studio at http://localhost:4111 for workflow and trace inspection. Run `npm run demo` first if you want sample data. Document input uses local paths; the tested Studio upload UI does not accept XLSX/DOCX chat attachments.

Stop Studio before using commands that change a run. Only one process may write the local database at a time. `npm run review -- status --run-id <run-id>` and `npm run review -- metrics --run-id <run-id>` remain available for inspection. Recovery and explicit cleanup are described in `docs/review.md`.

The local OS operator is trusted. Evidence snapshots and review records remain in `.runtime` without encryption or automatic cleanup. Unsupported layouts and unsafe retained content block publication. Changed evidence invalidates approval; start a new run.

## Development

Run `npm run test -- --no-file-parallelism`, `npm run typecheck`, `npm run format:check` and `npm run build`. Ordinary tests use controlled providers without an API key. Live evaluation is optional and requires an explicit execution policy; see `docs/evaluation.md`.

## About Mastra templates

This template lives in the [Mastra monorepo](https://github.com/mastra-ai/mastra) and demonstrates a questionnaire workflow with human approval and local storage.

[Want to contribute?](https://github.com/mastra-ai/mastra/blob/main/CONTRIBUTING.md)
