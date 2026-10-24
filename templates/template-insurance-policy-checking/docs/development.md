# Develop and validate the template

## Code organization

Production modules use `name-type.ts`: `policy-checking-agent.ts`, `policy-checking-workflow.ts`, `case-service.ts`, `case-repository.ts`, `insurance-config.ts` and `reconciliation-contracts.ts`. Keep the Mastra entry point `src/mastra/index.ts`, tool configuration names (`vitest.config.ts`, `playwright.config.ts`) and runner suffixes (`*.test.ts`, `*.studio.test.ts`).

- `domain/`: schemas, domain types, evidence verification and comparison rules. Schema fields use `.describe()` and explicit TypeScript contract fields use JSDoc.
- `services/`: coordinate capture, comparison, publication and review.
- `storage/`: persist case state and immutable artifacts.
- `providers/`: adapt input capture and stage-specific output.
- `agents/`, `processors/`, `tools/` and `workflows/`: expose these operations through Mastra.

Put deterministic input constraints in schemas. Keep authorization, existence, persisted-state conflicts and external-response verification at execution boundaries.

## Profiles and providers

Register company or product profiles in `src/mastra/config/insurance-config.ts`. Each has an ID, version, categories, terminology and declarative `required` or `review` rules. Increment the version when rules change. Profile observations remain separate from contractual evidence.

Register adapters and defaults in `src/mastra/provider-config.ts`:

| Category           | Contract                                      | Responsibility                                                                                              |
| ------------------ | --------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| `input`            | `InputProvider` in `domain/case-contracts.ts` | Validate requests and capture immutable sources with provenance and physical-page or record/field evidence. |
| `draftOutput`      | `OutputProvider<'draftOutput'>`               | Materialize an immutable draft without approval.                                                            |
| `reportOutput`     | `OutputProvider<'reportOutput'>`              | Materialize the exact approved report snapshot.                                                             |
| `correctionOutput` | `OutputProvider<'correctionOutput'>`          | Materialize the applicable proposed correction from confirmed findings.                                     |

Output requests are defined in `domain/output-contracts.ts`. Providers return descriptors and implement `retrieve` for their bytes. Publication verifies snapshot/approval bindings and checksums, saves a durable private copy and then exposes a download. Provider selections are frozen with saved work. The bundled adapters use local PDFs and Markdown; add external destinations through these interfaces.

## Checks

Run from the template directory:

| Command                       | Validation                                                    |
| ----------------------------- | ------------------------------------------------------------- |
| `npm run typecheck`           | Strict TypeScript, including scripts and tests.               |
| `npm run format:check`        | Source and documentation formatting.                          |
| `npm test`                    | Unit and integration suites, including controlled evaluation. |
| `npm run test:reconciliation` | Comparison, evidence and processing-budget boundaries.        |
| `npm run test:reports`        | Immutable publication, downloads and PDF layout.              |
| `npm run test:review`         | Broker decisions, revisions and approved publication.         |
| `npm run test:studio`         | Installed Studio journeys through Playwright.                 |
| `npm run build`               | Mastra production build.                                      |

Run unit/integration checks before Studio tests. Tests use real local files, databases, workflows and controlled HTTP model responses. They need permission to open loopback sockets and do not require paid provider calls. `npm run format` applies formatting.

## Evaluation

`npm run test:evaluation` checks twelve labeled cases and saves `.runtime/evaluation/controlled.json`. Results include per-metric denominators, failed or unknown cases and false-positive/negative counts. A zero denominator is unavailable. Controlled responses validate the application boundaries; they do not measure live model accuracy.

A separately authorized live run uses:

```bash
npm run evaluate:live -- --config /absolute/path/approved.json --output /absolute/path/results
```

The configuration contract is `configurationSchema` in `scripts/live-evaluation-runner.ts`. Supply explicit operator authorization, frozen dataset/source/target hashes, per-case budgets and aggregate ceilings. The output location must match the approved configuration. Source changes invalidate the approved source identity.

Reservations are durable across restarts and remain charged after failed calls or missing usage. Reusing an allocation is rejected. Dispatch stops on the first incomplete case, with pending cases retained as unknown. Acceptance requires complete scheduled coverage, all numerical targets and zero false authorization or unauthorized finalization.

Operational logs contain allowlisted identifiers, outcomes, timings and bounded usage estimates. Source text, identities, review prose and raw provider errors stay in protected case records. `costMicros: null` means actual billing cost is unavailable; `estimatedCostMicros` uses the configured pricing assumption.
