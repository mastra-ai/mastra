# Evaluate qualification behavior

Use the frozen synthetic profiles in `tests/fixtures/qualification/profiles.v1.json` and separate expected decisions in `expected.v1.json`. The set contains 24 identity cases and 96 attribute decisions, including ambiguous companies, unsupported and conflicting facts, employee boundaries, inferred workforce, Nurture and hard exclusions. The original v1 labels and profiles are approved for controlled functional verification and remain byte-frozen. Freeze any new dataset and its SHA-256 digests before approving its measurement. Changing an expected answer after observing a failure creates a new dataset version requiring review.

The functional proof runs the shipped qualification service, provenance validation, fact consolidation and scoring with controlled extraction and verification. It checks seven dimensions: identity, attribute extraction, classification, hard-exclusion detection, repeatable scores, valid evidence references, and unsupported claims. Controlled output does not measure GPT-6 Luna accuracy. In particular, its provider deliberately withholds or rejects facts in cases whose literal excerpts still contain the fact. The unsupported-workforce and missing-intent summaries therefore cannot establish semantic support against those excerpts. Preserve pending/unmet summary results; do not manufacture a manual approval to make this set pass. Real model behavior requires the separate faithful dataset below.

## Collect observations

From the template directory, run the controlled collector after approving the frozen labels:

```sh
npx tsx scripts/collect-evaluation.ts --controlled --output /tmp/qualification-controlled-v1
```

The destination must be new. Each completed case is saved immediately in `observations.json`; summaries, facts and source passages are preserved in `summary-review-material.json`. Temporary databases are removed after shutdown. The collector calls the actual shipped pipeline and never reads the expected outcome to construct an observation. Its controlled provider and synthetic data live under `tests/`.

## Propose a real-model measurement

The separate `model-profiles.v1.json` contains literal source passages and submitted inquiries. Its `model-expected.v1.json` uses label schema version 2. These new files require their own human approval; original v1 expectations and controlled-provider behavior are unchanged. The provider receives the new profiles only, never expected values or hidden interpretation flags. Search returns the frozen passages; extraction and verification use the production prompts and default GPT-6 Luna through the shipped qualification service. The evaluation-specific configuration only orders the existing four targets and disables retries; scoring is unchanged.

There are 24 deterministic identity decisions: 20 domain cases with 60 firmographic model opportunities and 20 deterministic submitted-intent decisions, plus two email-only and two unresolved CRM cases with 16 deterministic missing attributes and no model research. These are labeled populations, not observed call counts. Reports distinguish collected cases, reserved requests and confirmed transport attempts. The model set covers boundaries, hard exclusions, old intent, observed workforce ranges, inference, conflicting current sources, absent workforce and irrelevant account/office/calendar material. Only four explicitly labeled absent/irrelevant attributes permit either `missing` or `unsupported` with a null value. Conflicts and accepted facts retain exact expectations; accepting an unsupported fact always fails.

The following commands are proposed for a separately approved run. First create an external draft manifest, without sending a request:

```sh
npx tsx scripts/collect-evaluation.ts --plan-model \
  --profiles tests/fixtures/qualification/model-profiles.v1.json \
  --labels tests/fixtures/qualification/model-expected.v1.json \
  --approval /tmp/qualification-model-approval.json \
  --output /tmp/qualification-model-v1
```

The version 2 manifest binds raw profile/label digests, source revision and source-file digest, prompts, configuration, exact case IDs, artifact paths, model, token and currency caps, and conservative tariff assumptions. New execution rejects version 1 manifests; preserve them with their historical journals and outcomes. Generate and review a fresh version 2 manifest for a new collection. Review this concrete manifest before recording `approved: true`, `approvedBy` and `approvedAt`; an environment flag alone cannot authorize collection. Keep the execution ID and journal path. Lowering a cap is allowed; raising a cap or changing bound source/data requires a fresh review.

```sh
node --env-file=.env --import tsx scripts/collect-evaluation.ts --live-model \
  --profiles tests/fixtures/qualification/model-profiles.v1.json \
  --labels tests/fixtures/qualification/model-expected.v1.json \
  --approval /tmp/qualification-model-approval.json \
  --output /tmp/qualification-model-v1
```

The collector consumes the approval into an exclusive, fsynced external journal before any model request. It refuses reuse even after failure or deletion of the observation directory; there is no automatic resume or paid retry. Preserve the consumed journal. A new attempt needs a newly reviewed execution, including the prior run's partial usage. Source, profile and label bytes are checked before consumption and before every request. A change stops the collection.

Maximum scope is 24 sequential cases, 20 researched cases, six extract/verify requests and 12000 reserved output tokens per researched case, 120 requests and 240000 reserved output tokens overall, 180 seconds per case and 65 minutes overall. Request bodies are limited to 131072 UTF-8 bytes and only the fixed model's Responses POST is allowed, with redirects rejected. The strict payload admits exactly two text-only instruction/user messages, the bound stage instruction, low reasoning effort, streaming, disabled storage and structured JSON output. Additional routing, service-tier, conversation, media, tool and unknown payload fields are rejected. Hosted search, page GET, CRM operations, tools and retries are forbidden. A request reservation and run/case reference are persisted before transport; each completed case saves observations, summaries and review templates. Missing, unknown, excess or mismatched usage, transport/HTTP failure, changed bindings and journal failure stop subsequent calls. Interrupted or failed calls retain unknown usage as null, alongside known subtotals and all byte/token/currency reservations. Reservations are never refunded, even when reported usage is lower or transport fails. No model request or new gold-set evaluation is implied by preparing this source.

The proposed currency ceiling is USD5 (5000000000 nanoUSD). Each request reserves `(UTF-8 body bytes + 4096) × 275 + requested output tokens × 1100` nanoUSD before transport, using integer arithmetic. Full-size requests and the aggregate output cap give a theoretical maximum `120 × (131072 + 4096) × 275 + 240000 × 1100 = 4724544000` nanoUSD, or USD4.724544. Lowering the currency ceiling can stop the collection early; the guard refuses a request before dispatch if its full reservation exceeds the remaining ceiling.

The conservative rates are USD0.275 input and USD1.10 output per million tokens, including maximum cache-write, Fast2× and regional1.1× assumptions from the [model pricing](https://developers.openai.com/api/docs/models/gpt-6-luna) and [pricing guide](https://developers.openai.com/api/docs/pricing), retrieved 2026-10-19. The text-only body bound plus framing stays below the long-context threshold. Recheck tariffs and token-bound assumptions before execution. These are explicit reservation assumptions, not an authenticated account spending limit or guaranteed invoice. The journal records per-request and cumulative currency reservations; provenance retains the ceiling, reserved sum, observed usage and terminal failure.

This measures curated synthetic extraction and verification, not production performance, live-source discovery quality or the unresolved F4 acceptance limitation.

## Prepare a bounded verifier diagnostic

`scripts/verifier-diagnostic.ts` is a separate verifier-only experiment. Its six frozen examples in `verifier-diagnostic.v2.json` are newly derived inputs, not exact replays: historical raw verifier requests were not retained. The fixed order is c07 employee 19, c08 employee 501, c10 physical-goods `other`, c02 employee 20, c03 employee 500, and c01 B2B SaaS. Each contains one candidate, literal source passages and a complete frozen round context. All six candidates are expected to be factually supported, including the three outside the ICP. The four employee candidates carry `asOf: "2026-10-18T00:00:00Z"`, matching their explicit quoted date. The two business-model claims have no effective date in their own quoted passages and retain null, even though the containing pages have publication dates and separate dated employee claims. Collection, page publication and assessment dates are not copied into a fact date. The diagnostic fixture schema checks this controlled English date-prefix convention, calendar validity and the assessment-time bound; it is not a general production date parser.

The original `verifier-diagnostic.v1.json` remains unchanged historical evidence. The runner accepts revision 2 for new plans; preserve old manifests, journals, results and their original unmet expectations. Revised fixtures require fresh source/input bindings and paid authorization. Three repetitions per case measure support stability and disagreement with reviewed support expectations on this selected sample. They do not measure false positives, full qualification quality, an independent holdout, or summary support. Unsupported/quote-mismatch controls remain separate mocked regressions.

Prepare an external unapproved manifest without credentials or network access:

```sh
npx tsx scripts/verifier-diagnostic.ts --plan \
  --fixtures tests/fixtures/qualification/verifier-diagnostic.v2.json \
  --approval /path/to/external/verifier-diagnostic-approval.json \
  --output /path/to/external/verifier-diagnostic-results
```

Review the exact source/configuration, fixture, native wire-schema, semantic-input and case-order digests before recording approval and human attribution. `verifier-wire-schema.v1.json` freezes the installed SDK's public schema representation, checked against the actual serializer through mocked transport. The guard requires the exact bound input and instructions, schema, fixed model, low reasoning effort and Responses POST; extra instruction, message, tool, service-tier or context fields are rejected. A different dependency/schema representation must be reviewed before execution.

Only after a separate paid-scope approval:

```sh
node --env-file=.env --import tsx scripts/verifier-diagnostic.ts --live \
  --fixtures tests/fixtures/qualification/verifier-diagnostic.v2.json \
  --approval /path/to/external/verifier-diagnostic-approval.json \
  --output /path/to/external/verifier-diagnostic-results
```

The fixed envelope is six cases × three ordered slots: at most 18 verification requests, 1000 output tokens per request, 18000 reserved output tokens total, 32768 UTF-8 body bytes per request and 589824 aggregate bytes, within ten minutes. There is no extraction, search, page GET, CRM operation, tool use, redirect or retry. It uses `OpenAIEvidenceProvider.verify` and the current captured criteria and verification semantics. The experiment uses the shipped factual-verification input: category definitions remain available while ICP eligibility thresholds, accepted-category lists, points and routing are omitted. Extraction and deterministic scoring retain the captured policy. This is the production verifier contract, not an experiment-only prompt.

The proposed currency reservation is USD0.25. The maximum planned reservation is USD0.2022768, treating each complete request-body byte as an input token plus 4096 framing tokens, with USD0.275 input and USD1.10 output per million tokens. Those conservative rates include the published maximum cache-write rate, Fast2× and regional1.1× assumptions from the [model pricing](https://developers.openai.com/api/docs/models/gpt-6-luna) and [pricing guide](https://developers.openai.com/api/docs/pricing), retrieved 2026-10-19. This is an explicit tariff/token-bound assumption, not an authenticated account spending limit or guaranteed invoice. Recheck pricing and framing assumptions before authorization. Observed usage above the reservation stops subsequent requests and remains visible.

An exclusive external journal consumes approval before any transport. Each slot/run reference and byte/token/currency reservation is fsynced before dispatch. Unknown usage remains null with retained reservations; unknown/excess usage, journal failure, changed inputs/source or exhausted limits stop subsequent calls. Results and partial accounting are saved incrementally; cleanup restores fetch and removes only the experiment's temporary database. Keep the consumed journal even after failure or observation-directory cleanup. There is no automatic resume or repeat; a later attempt requires a fresh concrete approval. Model-reported reason codes remain self-reported evidence, not recovered internal reasoning. Preparing this experiment authorizes no paid call or deployment and does not supersede any failed full-dataset result.

## Review summaries and report results

Copy `summary-reviews.template.json` to a new review file. A human reviewer reads every summary against its facts, passages, inference uncertainty and original deterministic classification. Fill in `reviewer`, list every unsupported decisive claim and set `allUnsupportedClaimsFlagged` only when the summary itself clearly flags each unsupported claim as unresolved. A valid source ID alone does not establish semantic support. Preserve the generated `summaryDigest`; a changed summary requires a fresh review.

```sh
npm run eval -- \
  --labels tests/fixtures/qualification/expected.v1.json \
  --observations /tmp/qualification-controlled-v1/observations.json \
  --reviews /tmp/qualification-controlled-v1/summary-reviews.json \
  --output /tmp/qualification-controlled-v1/report.json
```

For a later approved model collection, use the same comparison command with `model-expected.v1.json` and its corresponding model observation/review paths. Human summary review remains required for the new set.

The report includes label/profile/observation digests, dataset provenance, mode, model, policy, captured configuration and prompt digests, every per-case failure, and each numerator and denominator. Identity and extraction targets are 95%; deterministic classification, exclusion recall, score consistency and valid references target 100%. Exclusion recall counts labeled hard exclusions, not the unrelated non-exclusion cases. Unexpected exclusions are failures. Unsupported fact acceptance fails the overall result regardless of extraction accuracy. Missing observations, missing summary reviews, stale summary digests and empty measurement denominators cannot establish quality. The command returns nonzero when targets are unmet and still saves the report.

Run the cohesive local proof with `npm test -- tests/integration/quality.test.ts`. Its summary-review assertions deliberately verify that an unreviewed collection reports failures. A passing functional test demonstrates honest reporting and controlled behavior; it does not establish the semantic quality of unreviewed generated summaries.

## Verify a fresh local installation

The separate first-run proof copies only product source/configuration and the shipped fixture JSON into an isolated directory. It runs the documented `npm install`, build and start path with only the OpenAI credential, chooses an unused loopback port, submits one real company domain and inspects its sourced assessment and readable output. At least one accepted firmographic fact must have evidence references; an accepted empty buying-intent list cannot satisfy this check. It checks replay and the persisted search/page/token caps. A Needs review outcome uses an explicitly simulated local operator Nurture decision; it does not prove a real SDR decision or automatic Nurture. Unresolved company identity cannot be overridden by the proof.

After separately approving one real research cycle and installation:

```sh
FIRST_RUN_APPROVED=yes FIRST_RUN_DOMAIN=attio.com \
FIRST_RUN_EVIDENCE_FILE=/tmp/qualification-first-run-evidence.json \
node --env-file=.env node_modules/vitest/vitest.mjs run --config vitest.first-run.config.ts
```

The evidence path must be external to the template and unused. The proof retains assessment, usage limits, observed budget and local decision evidence there, including resolved fresh-copy dependency versions, numeric setup/build/start failure evidence and partial accepted-run/usage evidence on failure; temporary credentials/databases are removed. It never selects an Attio driver. Existing servers and operational data are not reused or stopped. The single cycle permits four searches, four GETs, 12000 aggregate output tokens and 180 seconds of research. Installation and build have separate timeouts. Missing credentials or failed research fails the test without a skip or automatic paid retry.

Customization prompt:

> Extend this template's curated evaluation for [policy or evidence change]. Inspect the existing seven dimensions and controlled provider first. Add independent input profiles and hand-reviewed expected labels before measuring. Freeze digests, retain every failure, require human summary support review and keep real-model collection separately bounded. Preserve missing-data semantics and never describe fixture success as model or production accuracy.
