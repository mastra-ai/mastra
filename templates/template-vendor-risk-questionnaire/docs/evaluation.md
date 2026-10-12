# Evaluation and metrics

## Offline tests

Run `npm run test -- --no-file-parallelism` for unit, integration, security and semantic checks. All use controlled providers and require no API key. Run `npm run test -- tests/evals` to select only semantic evaluations. Formatting, typechecking and bundling use `npm run format:check`, `npm run typecheck` and `npm run build`.

Semantic evaluations exercise the public drafting workflow with official `@mastra/evals/vitest` integration. Gold labels stay separate from application prompts. Correct, wrong-answer and all-unknown controls verify that an evaluation cannot pass by withholding every answer. Integration tests also cover the fictional 24-question demo's original evidence, negative facts, conflicting records, restricted sources and exact citation bindings.

## Semantic metrics

The six dimensions are groundedness, completeness, unsupported-claim detection, escalation accuracy, factual consistency and attribution. Useful-answer recall and false escalation additionally measure whether supported answers reach review successfully.

- Groundedness: supported material claims / accepted material claims.
- Completeness: covered gold facts / required gold facts.
- Unsupported detection: recall and precision for labeled unsupported cases, with critical cases reported separately.
- Escalation: accuracy, recall and precision against labeled review needs.
- Consistency: agreement across equivalent fact sets.
- Attribution: citations independently judged to support their bound claims.
- Useful-answer recall: correct, complete, supported eligible answers / eligible questions.
- False escalation: eligible questions unnecessarily escalated / eligible questions.

Targets live in `tests/support/evaluation.ts`: groundedness, completeness, escalation accuracy, consistency and useful-answer recall at least 0.90; attribution at least 0.95; critical unsupported recall 1.00; false escalation at most 0.10. Accepted critical claims and forbidden disclosures must be zero. Missing required denominators remain failing `null` values. Adjust quality targets and gold labels for your own use case.

## Optional live evaluation

Live tests are separate from ordinary discovery and send only generated fictional data. Set `OPENAI_API_KEY` in `.env`, create an execution-policy JSON using the fields in `src/mastra/contracts/execution-policy.ts`, then run:

```text
VRQ_EVAL_POLICY=/absolute/path/to/policy.json npm run eval:live
```

Choose your own budget, call limits, timing and pricing estimates before running. Policy limits apply independently to the questionnaire, independent judge and guard run; they are not a shared campaign cap or a provider billing limit. Missing policy or API key fails before provider calls. The suite stops after its first failed test.

The semantic test uses the actual snapshot retrieval and structured-answer workflow, followed by an independent model judge. The guard test measures malicious instruction detection and false positives on benign security questions. Its small benign sample reports rates without a numeric pass threshold. Application protocol errors, incomplete runs and failed detector checks remain failures.

Each invocation makes fresh requests and stores results, judgments, policy, usage and metrics in a new directory under ignored `.runtime/evaluations/live-*`. Reports are named `semantic.json` and `guards.json`; failed assertions retain available results. These local records contain fictional source/output content and are separate from sanitized telemetry. A small corpus and an LLM judge do not establish universal safety or calibrated probabilities. Offline results do not establish live model quality.

## Local operational metrics

`npm run review -- metrics --run-id <run-id>` reports routing, supported answers, corrections, evidence coverage, gaps, failures, usage, exports and active/review/wall time. Domain events are persisted with their business transitions and deduplicated across restart, review and export. Physical retries remain separate usage records. Missing usage and incomplete timing remain `null`, with observed subtotals available.

Supported-answer rate is supported released answers / total questions and remains `null` until final approval. Correction rate counts distinct materially corrected questions / reviewed questions. Evidence coverage uses actual reviewed claims and citations.

Studio exposes native traces under **Observability → Traces**; questionnaire-specific aggregates remain available through `review metrics`. Native traces contain pseudonymous correlations, fixed span types and allowlisted numeric metadata. Prompts, excerpts, tool payloads, raw errors and paths are excluded. No remote exporter is configured. Local traces use `.runtime/vrq.db.telemetry.duckdb`; required workflow state, approvals, domain events and consumption records use LibSQL at `.runtime/vrq.db`.

Telemetry adapter/exporter failures report `degraded_incomplete` in CLI output and Studio's `/vrq/telemetry-status` endpoint. Persisted business results remain valid. Required operational storage failures stop new calls and preserve committed results; an unpersistable stop reports `STORAGE_FAILURE_UNPERSISTED`. A failed terminal save can leave the last native snapshot marked `running`; it does not authorize automatic replay. Internally swallowed adapter errors cannot be reported by the template.

Only one mutating process may own the database. See [review and exports](review.md) and the README for writer recovery and explicit cleanup.
