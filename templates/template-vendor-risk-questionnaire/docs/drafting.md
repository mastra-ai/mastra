# Grounded draft processing

Draft processing consumes a previously persisted questionnaire intake and evidence snapshot. It preserves original wording and response constraints. The local OS operator supplies the evidence root and the same trusted manifest used for intake. Original evidence bytes, validity, transfer permissions and snapshot identity are checked again before model work.

## Start and inspect

Set `OPENAI_API_KEY` in `.env`, then run:

```text
npm run draft -- start --run-id review-1 --manifest /path/to/manifest.json --root /path/to/evidence
npm run draft -- status --run-id review-1
```

The first command persists processing identity, input/evidence digests and the execution policy before any provider request. Its summary reports the actual processing state and safe stop reason; a failed processing run exits unsuccessfully even when the workflow engine completed. The second reopens local state without model calls. Its summary contains safe question IDs, routing reasons, attempts and usage. Supporting answer text and source excerpts stay in the restricted local `.runtime/vrq.db` record; they are not printed to general CLI logs. Runtime data is not encrypted by this template.

A processing identity can be started once. A duplicate start is rejected, including concurrent starts. A changed source or policy requires a newly identified intake/evidence run. Opening status does not retry a failed call or spend additional tokens. Interrupted processing retains durable reservations and completed results; automatic restarting is disabled. Use the parent questionnaire workflow for persistent review and approved export, as described in [review and exports](review.md).

## Mastra Studio

Run `npm run dev`, open [Mastra Studio](http://localhost:4111), and select **vendor-risk-drafts**. Supply this input using paths on the local machine:

```json
{
  "runId": "review-1",
  "evidenceRoot": "/path/to/evidence",
  "manifestPath": "/path/to/manifest.json"
}
```

The run must already have intake and approved evidence persisted through the intake CLI. Output contains original-order draft results and review reasons. `awaiting_review` means drafts are ready for human review, not approved for disclosure. The separate **vendor-risk-intake** workflow confirms an explicitly mapped local source, and `npm run dev` prepares absent demonstration data. See [review and exports](review.md).

Agent factories and prompts live under `src/mastra/agents`. The workflow composer is `src/mastra/workflows/vendor-risk-drafts.ts`; its steps, contracts and per-instance runtime live in the adjacent `vendor-risk-drafts` folder. Evidence tool builders live under `src/mastra/tools`. The lightweight Mastra index registers the guarded workflow; agent factories require a run-bound model configuration and are not registered as standalone Studio agents.

## Grounding and review reasons

Questions pass local secrets/PII checks and strict native prompt-injection/PII detectors before classification. Classification uses one pass when inputs fit, otherwise bounded batches. Each nested question workflow has a fresh trusted context and at most three drafting turns. Only run-scoped evidence search/read tools are available. Every tool argument, retrieved excerpt and serialized tool response is screened before subsequent model consumption. Drafts are screened before a fresh support-verification call.

Citations must bind to excerpts actually returned to that question, eligible source metadata, immutable hashes, original locators and matching supporting text. Each material claim references citations. Policy evidence does not by itself prove operational execution, certification or contractual guarantees. These checks preserve provenance; semantic support still depends on fallible model judgment.

Supported `yes`, `no`, `partial`, `not_applicable` and `free_text` drafts retain qualifications and constraints. Missing evidence becomes `unknown` with no factual assertion. Missing subparts, conflict, unsupported claims or commitments, invalid attribution, non-shareable disclosure, incompatible source response choices, ambiguous scope and low confidence produce explicit reasons. Equivalent-answer inconsistencies flag every affected answer while preserving its text; comparisons distinguish domain, product, environment and time qualifiers.

Equivalent answers in the same scope and time undergo bounded structured factual comparisons, including facts inside `free_text`, `yes` and `partial` answers. Harmless paraphrases do not by themselves imply conflict. Comparison guards and verifier calls consume the same run limits; a failed or uncompleted comparison adds explicit review reasons while retaining completed drafts. Security-blocked comparison content is discarded. Unrelated successful siblings remain persisted.

The routes are `draft_eligible`, `review_required` and `security_review_required`. Eligibility is a candidate drafting result and never grants final release. Security-blocked payloads are discarded from draft results and recorded using safe IDs/codes. Completed siblings remain persisted when another question fails. Global authentication, model/API compatibility, storage, run time or budget failures stop new work and preserve available results with explicit gaps.

## Execution policy and usage

The default model is `openai/gpt-6.1-sol`, explicitly routed through Responses with medium reasoning and Standard processing. There is no fallback. Offline tests use controlled provider streams through the production Agents, processors, tools, workflows and local persistence. Provider account access and live semantic quality require separate live verification.

Defaults are concurrency four, an estimated USD 5 run envelope, 100 physical calls, 30 minutes per run, 60 seconds per request/stream, 8,000 input tokens and 4,000 output tokens including reasoning per call. Drafting allows three turns and support verification one call per question. Each equivalent answer pair allows one separate consistency comparison turn. Transient provider failures allow at most two additional attempts. Detector invocations share a six-attempt payload bound; the wrapper adds no detector retry layer. All native/internal calls, consistency guards/comparisons and failed physical attempts reserve against the same durable run authority before transfer. The total token envelope is finite through the physical-call cap multiplied by per-call limits.

Input and streamed output use conservative UTF-8 byte bounds before replay, and observed provider tokens are checked too. The wrapper buffers responses, validates requested JSON schemas, and removes raw reasoning, request/response metadata, warnings and provider errors before native processor consumption. Detector exceptions and timeouts fail closed. Local regex filtering is incomplete; semantic PII detection can itself transfer remaining payload content to the provider. Neither a detector pass nor a confidence score grants source, tool or release authority.

Reservations use Standard rates recorded on 2026-10-10: USD 2 per million input tokens and USD 10 per million output tokens. Observed usage reconciles each physical reservation once, including reasoning in total output. Missing, malformed or failed-call usage conservatively retains the reservation. Reservations left in progress after interruption also retain their cost estimate. This envelope is an application estimate, not a guaranteed provider billing cap; provider project spend controls remain separate. Rates require refresh before release.

The 100-call default can exhaust a larger questionnaire, including the 24-question fictional demo, because detector, classification, tool, draft and verification calls all count. Remaining questions retain explicit budget gaps. To configure a separately identified run, copy the complete validated policy from `src/mastra/contracts/execution-policy.ts` into a JSON file and pass `--policy /path/to/policy.json`, or supply `policy` in Studio. Limits stay finite and provider/model configuration remains explicit. Increasing limits can increase estimated spend.
