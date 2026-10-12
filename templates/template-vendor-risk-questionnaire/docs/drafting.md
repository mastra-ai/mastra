# Grounded draft processing

Drafting consumes a persisted questionnaire intake and approved evidence snapshot. Before model work, the backend checks source bytes, validity, transfer permission and snapshot identity against the trusted manifest. Original wording and response constraints remain authoritative.

## Start and inspect

Run `npm run respond -- /absolute/path/to/questionnaire.xlsx` (or `.docx`) for intake, drafting and review. Resume with `npm run respond -- --resume <run-id>`. The command retains completed results and usage reservations across interruptions.

`npm run review -- status --run-id <run-id>` inspects a persisted review once drafting reaches that checkpoint. Changed sources or policy require a new run. See `docs/review.md` for administration and recovery.

## Mastra Studio

Run `npm run dev`, open [Mastra Studio](http://localhost:4111), and select **vendor-risk-drafts** after completing intake:

```json
{
  "runId": "review-1",
  "evidenceRoot": "/path/to/evidence",
  "manifestPath": "/path/to/manifest.json"
}
```

Output contains original-order drafts and review reasons. `awaiting_review` means drafts are ready for human review. The **vendor-risk-questionnaire** parent adds the persistent review checkpoint and approved export.

## Interpretation and retrieval

Interpretation uses immutable question and instruction spans. Model choices reference exact source text; trusted code reconstructs order and subparts. Missing, repeated, stale or foreign identities fail validation. Domain, product, environment and time qualifiers remain separate applicability dimensions. Ambiguous qualifiers require review. Repeated instructions appear once in the prompt registry while each question retains its source binding.

The backend uses a run-scoped Mastra Workspace BM25 index. It searches the selected source span and a lexical query derived from all immutable subparts, with up to three hits each. The second query removes common instruction words and configured organization/product names, with limited plural normalization. Results are deduplicated by excerpt identity. Negative facts, conflicting records and source qualifications remain distinct. Retrieval is lexical and can miss relevant paraphrases or contradictions.

Raw text, locators and hashes remain citation authority. A separate context projection carries exact JSON paths, branch/ancestor qualifications and table row/column relationships. Contextual sibling values cannot be cited through another field's raw anchor. The complete enriched excerpt must fit its 4,000-byte context limit; an oversized candidate produces `SOURCE_UNAVAILABLE` without truncation. Canonical intake, other questions and original citation validation remain available.

## Screening and answering

Questions and each selected excerpt pass local secret/PII checks. Native injection and PII detectors screen the complete interpretation catalogue and assembled answer context before transfer. The answer context includes question metadata, instructions, applicability and all selected excerpts. Detector errors fail closed. Screening assembled content remains fallible, including when malicious text is mixed with benign material.

The answer agent receives one structured request with no tools. Unexpected tool calls are rejected. The full provider input, including native schema/system overhead, must fit the configured envelope. Snapshot bytes are checked again after screening. Drafts pass native detectors and an independent support verifier before becoming eligible for review. Consistency checks compare equivalent questions without replacing their drafts.

Citations must match eligible source versions, hashes, locators and literal excerpts. Policy evidence proves policy, not operational execution. Unsupported claims, missing evidence, incompatible responses, restricted disclosures and ambiguous applicability require review. Unknown answers remain explicit. The routes are `draft_eligible`, `review_required` and `security_review_required`; none grants final release.

Successful siblings remain persisted when a question fails. Global authentication, model compatibility, storage or configured run-limit failures stop new work. Diagnostics retain only bounded categories, hashed correlations and counts; raw validation messages and rejected outputs are excluded from telemetry. See [evaluation and metrics](evaluation.md).

## Execution policy

Choose budget, call count and elapsed-time limits for your use case. Supply the complete validated policy through the Studio workflow's `policy` field or `.runtime/profile.json` for the respond command. `VRQ_MODEL` in `.env` overrides the profile model for new runs and sets the default when Studio input omits `policy`. An explicit Studio policy and saved runs retain their model. Restart Studio after changing `.env`. Defaults are examples, not a recommended spend allowance. Every detector, interpretation, answer, verification and retry call contributes to usage; the default 100 calls can leave gaps in the 24-question demo.

`budgetUsd`, `maxPhysicalCalls` and `maxRunElapsedMs` accept user-selected positive finite values. `rates` accepts an ISO date and nonnegative input/output prices per million tokens. Update the example rates for your chosen model and provider account; `VRQ_MODEL` does not update prices automatically. Concurrency, per-call input/output size, retries and detector attempts retain bounded validation to protect local execution.

Usage reconciles once per physical call. Missing or malformed usage retains a conservative reservation; reasoning is included in output usage. Estimated cost is not a provider billing cap. A persisted run retains its original policy through review; use a new run to change it.

## Extend a phase

Agent definitions live under `src/mastra/agents`; workflow steps and runtime composition live under `src/mastra/workflows/vendor-risk-drafts`. Use `generatePhase(agent, options, context, prompt, schema)` for business phases. It binds backend authority, validates the response before exposing it to native consumers, and calls Mastra `Agent.generate` with strict structured output, one step, no tools and no additional native retries. Direct Studio agent prompts or forged request context cannot authorize provider execution.

Keep schema refinements in the supplied schema. `compatibleResponseSchema(question)` enforces the original length and choice constraints for both generated drafts and reviewer corrections. Citation eligibility, current source bytes and reviewer authority remain execution checks.

The provider boundary retains stream completion checks, duplicate JSON-key rejection, sanitized diagnostics and physical-attempt accounting. It accepts the installed router's flat and nested usage formats; malformed or absent usage stays uncertain. Application retries remain in this boundary so every physical attempt is recorded. Native injection and PII processors keep their own strict detector behavior and share the payload attempt limit.
