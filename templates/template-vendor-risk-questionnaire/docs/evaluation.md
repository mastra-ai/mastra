# Evaluation and metrics

Use tests to check behavior before changing the template. Use run metrics to understand what happened to one questionnaire. An **evaluation** compares answers with expected results; a **metric** measures an outcome, such as the number of supported answers or provider calls.

Run these commands from the template directory after `npm install`.

## Offline tests

Offline tests use controlled providers and need no API key.

1. Run the unit, integration, security and semantic checks:

   ```bash
   npm run test -- --no-file-parallelism
   ```

2. To run only semantic evaluations, use:

   ```bash
   npm run test -- tests/evals
   ```

3. Check the test summary. A failed assertion identifies behavior to investigate before trying a live model.

Semantic evaluations check whether answers have the right meaning and evidence. They run the public drafting workflow through `@mastra/evals/vitest`. Expected answers, also called gold labels, are kept out of application prompts.

The tests include correct answers, wrong answers and all-unknown answers. Returning `unknown` for everything must not pass. Integration tests also cover the fictional 24-question demo's negative facts, conflicting records, restricted sources and exact citation locations.

For formatting, typechecking and builds, see [development checks](local-operation.md#development-checks).

## Read the semantic scores

For example, if a draft makes ten factual claims and evidence supports nine, its groundedness is `9 / 10 = 0.90`. If it omits a required fact, it can still have high groundedness but lower completeness.

| Metric                      | What it asks                                                                                  |
| --------------------------- | --------------------------------------------------------------------------------------------- |
| Groundedness                | What fraction of accepted factual claims have evidence?                                       |
| Completeness                | What fraction of the required reference facts did the answer cover?                           |
| Unsupported-claim detection | Did the checks catch unsupported claims, and were their flags correct?                        |
| Escalation accuracy         | Were the right questions sent for additional review?                                          |
| Factual consistency         | Do answers to equivalent questions agree?                                                     |
| Attribution                 | Does each citation support the claim attached to it?                                          |
| Useful-answer recall        | What fraction of answerable questions received correct, complete, supported eligible answers? |
| False escalation            | What fraction of answerable questions were sent for extra review unnecessarily?               |

For detection and escalation, **recall** measures how many expected cases were caught. **Precision** measures how many flagged cases were correct. Critical unsupported claims are measured separately.

Targets are defined in `tests/support/evaluation.ts`:

| Metric                                                                                | Target          |
| ------------------------------------------------------------------------------------- | --------------- |
| Groundedness, completeness, escalation accuracy, consistency and useful-answer recall | At least `0.90` |
| Attribution                                                                           | At least `0.95` |
| Critical unsupported-claim recall                                                     | `1.00`          |
| False escalation                                                                      | At most `0.10`  |
| Accepted critical unsupported claims and forbidden disclosures                        | Zero            |

A missing required denominator produces a failing `null`, not a perfect score. Adapt expected answers and quality targets to your use case. Offline results test application behavior; they do not establish live model quality.

## Optional live evaluation

Live evaluation makes paid provider calls using generated fictional data. It runs separately from ordinary tests and stops after its first failed test.

### 1. Prepare the API key and policy

Set `OPENAI_API_KEY` in `.env`. Create a complete policy JSON file, such as `.runtime/evaluation-policy.json`.

If you already prepared the demo, copy the profile's policy as a starting point. This command refuses to overwrite an existing file:

```bash
node --input-type=module <<'JS'
import { readFile, writeFile } from 'node:fs/promises';
import { executionPolicySchema } from './src/mastra/contracts/execution-policy.ts';

const profile = JSON.parse(await readFile('.runtime/profile.json', 'utf8'));
const policy = executionPolicySchema.parse(profile.policy);
await writeFile('.runtime/evaluation-policy.json', JSON.stringify(policy, null, 2) + '\n', { flag: 'wx' });
console.log('Created .runtime/evaluation-policy.json; review its model, limits and rates.');
JS
```

Open that file and choose your model, budget, call limit, time limits and price estimates. This file contains the policy object itself, without a surrounding `policy` property. See [execution policy](drafting.md#execution-policy) for field meanings.

The questionnaire, independent judge and guard run each get their own policy limits. They do not share one campaign budget, and the configured amount is not a provider billing cap.

### 2. Validate the file

This command checks the policy shape without making provider calls:

```bash
node --input-type=module -e 'import { readFile } from "node:fs/promises"; import { executionPolicySchema } from "./src/mastra/contracts/execution-policy.ts"; executionPolicySchema.parse(JSON.parse(await readFile(".runtime/evaluation-policy.json", "utf8"))); console.log("Evaluation policy is valid.");'
```

### 3. Run the evaluation

```bash
VRQ_EVAL_POLICY="$PWD/.runtime/evaluation-policy.json" npm run eval:live
```

Missing policy or API key fails before provider calls. Each invocation makes fresh requests.

### 4. Inspect the reports

Look in the new `.runtime/evaluations/live-*` directory:

| Report          | What it checks                                                                                 |
| --------------- | ---------------------------------------------------------------------------------------------- |
| `semantic.json` | Answers produced through actual retrieval and drafting, assessed by an independent model judge |
| `guards.json`   | Malicious-instruction detection and false positives on benign security questions               |

Reports retain available results even when assertions fail. A failure early in the suite may prevent a later report from being created. Each report records its policy and measurements; the run directory retains local evaluation results. The guard test's small benign sample reports rates without a numeric pass threshold. Protocol errors, incomplete runs and failed detector checks remain failures.

These local records contain fictional source and output text. They are separate from sanitized telemetry. A small test set and an LLM judge do not establish universal safety or calibrated confidence scores.

### Ask a coding LLM to prepare a live policy

<details>
<summary>Show optional prompt</summary>

```text
Create .runtime/evaluation-policy.json for this template's live evaluation.
Read src/mastra/contracts/execution-policy.ts, tests/live and
vitest.live.config.ts. Use .runtime/profile.json only as a starting point.

Ask me for the model, budget, call limit, elapsed-time limit, and input/output
prices with their date. Explain that questionnaire, judge and guard runs
have separate limits rather than one shared campaign cap.

Write a complete policy object, not a profile or a policy wrapper. Preserve
all required fields and validate with executionPolicySchema without calling
the provider. Show the file, chosen limits and command to run eval:live.
Do not run live evaluation or invent provider prices.
```

</details>

## Inspect a questionnaire's metrics

1. Open **Review metrics** in the web UI to inspect a questionnaire, or copy its run ID for the terminal command below.
2. From the template directory, read that run's metrics:

   ```bash
   npm run review -- metrics --run-id review-1
   ```

3. Inspect answer outcomes, evidence coverage, usage and timings. Replace `review-1` with your actual ID.

The report includes routing, supported answers, corrections, gaps, failures, exports, provider usage and active/review/wall time. Business events persist across restarts without counting the same transition twice. Physical provider retries remain separate usage records.

Supported-answer rate is released supported answers divided by all questions. For example, eight supported releases out of ten questions gives `0.80`. It remains `null` until final approval. Correction rate counts distinct questions with factual corrections divided by reviewed questions. Evidence coverage uses the actual reviewed claims and citations.

Missing usage and incomplete timing remain `null`; observed subtotals may still be available. In the web UI, unavailable values appear as `—`. Read units literally: `Ms` means milliseconds, USD means estimated dollars, and ratios are fractions rather than percentages.

## Inspect traces and storage problems

In Studio, open **Observability → Traces** for execution traces. Use questionnaire metrics for totals specific to a run.

| Data                                                       | Local location                     |
| ---------------------------------------------------------- | ---------------------------------- |
| Workflow state, approvals, domain events and usage records | `.runtime/vrq.db`                  |
| Native traces                                              | `.runtime/vrq.db.telemetry.duckdb` |
| Live evaluation reports                                    | `.runtime/evaluations/live-*`      |

Native traces use pseudonymous correlation identifiers, fixed span types and selected numeric metadata. Prompts, excerpts, tool payloads, raw errors and paths are excluded. No remote exporter is configured.

If telemetry fails, CLI output and `/vrq/telemetry-status` report `degraded_incomplete`; saved business results remain valid. A failure in required operational storage stops new calls and preserves committed results. If the stop itself cannot be saved, the diagnostic is `STORAGE_FAILURE_UNPERSISTED`.

A failed final snapshot save can leave native history marked `running` even when application work failed. Do not use that old status to replay model work automatically. Errors swallowed inside an adapter cannot be reported by the template. Follow [recovery instructions](review.md#local-process-ownership) before changing stored state.
