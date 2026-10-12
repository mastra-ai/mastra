# Vendor Risk Questionnaires

Answer an XLSX or DOCX vendor questionnaire from approved organizational evidence and return one answered copy in its original format. Review cited drafts, correct supported answers, keep unknown or withheld gaps visible, and explicitly approve the complete set. Local persistence lets you resume interrupted work.

## Why we built this

Vendor questionnaires vary in structure, and supporting documents have different approval and disclosure rules. Reliable review needs complete question intake, traceable evidence and visible gaps. A supported negative or partial answer is more useful than an unsupported positive claim.

## Prerequisites

- A supported XLSX table or DOCX table/identified-block questionnaire with writable response destinations. An originally authored fictional Northstar Tasks demo is included.
- Local XLSX, PDF, CSV, JSON or Markdown evidence and a trusted manifest recording approval, scope, validity, hashes, LLM transfer permission and disclosure policy.
- **[OpenAI API key](https://platform.openai.com/api-keys)**: set `OPENAI_API_KEY` in `.env` for `openai/gpt-6.1-sol` through Responses, medium reasoning and Standard processing. The account must have access to this model. Intake, development startup, status, recovery and unchanged export do not call the provider. Drafting and checks on new review text do.

## Quickstart 🚀

1. **Set up the local project**
   - From `templates/template-vendor-risk-questionnaire` in the Mastra checkout, run `npm run setup`. It installs dependencies and copies `.env.example` to `.env` when absent.
   - Fill in the key described under Prerequisites. This local template has not been published as a scaffold distribution.
2. **Prepare the example evidence**
   - Run `npm run demo` to create the originally authored fictional Northstar Tasks use case. It also creates the absent trusted `.runtime/profile.json` without replacing existing data.
   - For your own organization, configure the profile and approved evidence manifest described below.
3. **Answer and review the document**
   - Run `npm run respond -- /absolute/path/to/questionnaire.xlsx` or use `.docx`.
   - Known verified table layouts proceed automatically. Other supported tables receive targeted field/region prompts. Confirm each prefilled replacement, review every answer and citation, and make supported corrections or retain explicit gaps.
   - The complete revised set appears again. Type `APPROVE` to approve exactly that set. The command returns one `answered.xlsx` or `answered.docx` path under `.runtime/exports/<run-id>/revision-<revision>` and a compact quality summary.
4. **Resume when needed**
   - Use the printed run ID with `npm run respond -- --resume <run-id>`. Cancellation or EOF keeps approval pending. Previously completed drafts and review choices remain persisted.
   - Studio is optional for inspecting **vendor-risk-questionnaire** and its registered agents. The [operator guide](docs/review.md) covers recovery and administration.

## Try it out

- Respond to your own DOCX questionnaire and follow the supported mapping prompts. Unsupported or unaccounted content fails with diagnostics; prefilled answers remain untrusted.
- Review the fictional demo's missing evidence, conflicting controls and restricted sources. Release supported answers or retain explicit unknown/withheld gaps with safe reasons.
- Cancel after reviewing a question, then resume with the printed run ID. Successful answers are preserved without redrafting.
- Change a source or disclosure policy after review. Approval becomes invalid and a fresh run is required.
- Preview cleanup with `npm run review -- cleanup-preview --run-id review-1`. Nothing is deleted until you supply the exact preview digest and explicit confirmation.

## Customization

- Open the project in your coding agent and describe the outcome: “Map our questionnaire fields and configure approved evidence scope. Explore the code and propose a plan before making changes.”
- Configure `.runtime/profile.json` once with your absolute evidence root/manifest path, organization/product/environment/domains and finite execution policy. The manifest retains approval, validity, source hashes, transfer and disclosure rules. The backend retrieves eligible excerpts with up to two source-bound BM25 queries, then supplies their complete deduplicated context to a tool-free answer agent. It cannot choose new paths or approve sources. You can also add a versioned questionnaire adapter with strict validators and locator resolution. See [intake](docs/intake.md), [drafting](docs/drafting.md) and [review and exports](docs/review.md).

## Agents and artifacts

Start with `src/mastra/workflows/vendor-risk-questionnaire.ts` to follow intake results through drafting, review suspension and export. Edit prompts in `agents/`; their shared `generatePhase` runtime binds backend authority and calls Mastra with one strict structured response. Questionnaire response constraints live in `contracts/answer.ts` and apply to both drafts and human corrections. Document completion contracts and bounded writers live in `completion/`; input extensions start in the parser catalog.

Studio lists **Question interpretation**, **Evidence answer**, **Independent support verifier** and **Answer factual consistency**. The questionnaire workflow selects these registered instances for each phase. Direct prompts or forged request-context fields fail before provider execution; only the backend binds a persisted run, question and policy. These agents do not approve answers.

Deterministic code writes approved answers into exact mapped cells or response spans. It preserves untouched package entries byte for byte and unrelated XML properties, reads the written answers back, and stages one file for atomic publication. Source, mapping, approval, projection and output hashes stay in the local audit. Historical five-format bundles remain readable and cannot be converted or regenerated through the new command.

## Operating boundaries

Studio binds to loopback and trusts the local OS operator. Runtime snapshots, supporting text and review audit stay in `.runtime/vrq.db` until explicit cleanup; the template does not encrypt them. Snapshot access exposes bounded local read/search; answer generation exposes no tools. Restricted content cannot be released through ordinary approval. Factual corrections require eligible citations and new native security and semantic support checks within the original run budget.

One mutating process owns the local database at a time. Stop Studio before CLI submit, resume, export or cleanup commands. Status and metrics use query-only connections and remain available while Studio owns the writer lease. A crash leaves `.runtime/vrq.db.writer/owner.json`; inspect its token and run `npm run recover:writer -- --token <token>` only after the recorded process has exited. The command refuses a live owner or changed token.

Persistence has three boundaries: `database.ts` composes native storage and shares repository connections; `client.ts` drains admitted work and stops dispatch after a storage fault; `ownership.ts` excludes a second writer process. Separate workflow and application connections allow a native snapshot failure to be recorded without discarding committed answers. Keep these boundaries when adapting local shutdown or recovery.

The tested stable `mastra@latest` distribution is 1.33.0. Its chat upload UI rejects XLSX/DOCX binary attachments. Use local file paths in the Studio intake workflow and the local respond command described above. Binary chat upload, guided chat approval, a custom UI and external evidence connectors remain deferred.

Choose your budget, call/time limits and pricing estimates in the execution policy. The included defaults are examples, not a provider billing cap. The finite call/token/time limits can leave gaps or prevent further review checks. Detection and semantic verification remain fallible; live model access, answer quality and detector false positives require an explicit live evaluation; no live result is claimed by the included fixtures. Protected, overlapping, ambiguous or fixed response layouts fail before drafting where detectable. Uninspectable package payloads or protected retained original content block publication. Long answers are never truncated or hidden by changing source layout.

## Evaluation and local metrics

Run the ordinary unit, integration and security suites without provider access. The offline evaluation uses the public workflow with controlled provider streams, validated gold labels and eight official Mastra scorers. Optional live evaluations use your execution policy and record fresh results and usage. See [evaluation and metrics](docs/evaluation.md) for commands and metric definitions.

`npm run review -- metrics --run-id review-1` reports durable domain counts, first routing, corrections, evidence coverage, usage and lifecycle times. Missing usage and historical timing remain `null`. Native traces use the local DuckDB observability domain, pseudonymous correlations and allowlisted numeric metadata. Telemetry failures are reported as `degraded_incomplete`; they preserve already persisted business results. Required workflow snapshots, approvals, exports and usage accounting still fail closed. Restricted review state remains available to the operator through `review status`.

## About Mastra templates

This is an official Mastra template in the [Mastra monorepo](https://github.com/mastra-ai/mastra). It demonstrates a controlled questionnaire workflow with human approval and local storage.

[Want to contribute?](https://github.com/mastra-ai/mastra/blob/main/CONTRIBUTING.md)
