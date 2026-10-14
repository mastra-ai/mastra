# Evidence retrieval and drafting

The template reads each question, finds relevant approved evidence, and drafts an answer with citations. A citation points back to the exact source text. You still review and approve the answers before export.

Complete [local setup](local-operation.md) or start the [web demo](ui.md) first. For your own evidence, configure the [evidence profile and manifest](local-operation.md#configure-your-organizations-evidence).

## Follow one question through drafting

Suppose the questionnaire asks: “Does your access policy require multi-factor authentication?”

1. **Read the question.** The interpretation phase identifies the subject and any product, environment or time limits. It keeps the original wording and instructions.
2. **Find evidence.** The backend searches the run's approved evidence snapshot for relevant passages.
3. **Check the input.** Local checks and model-based detectors screen questions and evidence for secrets, personal information and malicious instructions.
4. **Draft an answer.** The answer agent receives the question and selected passages. It has no tools or direct filesystem access.
5. **Verify support.** The template checks citation locations and excerpts. A separate verifier checks whether the evidence supports the claims. Consistency checks compare equivalent questions.
6. **Send the result to review.** You inspect the draft, its sources and any reported limitations.

For example, a policy saying “Employees must use MFA” can support a claim about the policy. It does not prove that every employee account currently has MFA enabled. That operational claim needs operational evidence. If support is missing, the answer stays unknown or needs review.

## Start and inspect a run

1. From the template directory, run:

   ```bash
   npm run respond -- "$PWD/.runtime/demo/questionnaire.xlsx"
   ```

2. Save the printed run ID. Once drafting reaches review, inspect it from another terminal. Replace `review-1` with that ID:

   ```bash
   npm run review -- status --run-id review-1
   ```

3. Continue reviewing in the original terminal. After an interruption, use:

   ```bash
   npm run respond -- --resume review-1
   ```

Completed results and recorded usage remain saved. A failure for one question does not erase completed answers for other questions. Authentication, model compatibility, storage and run-limit failures stop new work.

### Use Studio to inspect only drafting

After [completing intake](intake.md#submit-an-explicit-mapping-through-studio), open **vendor-risk-drafts** in [Mastra Studio](http://127.0.0.1:4111). Use the run ID and evidence paths from intake:

```json
{
  "runId": "review-1",
  "evidenceRoot": "/absolute/path/to/evidence",
  "manifestPath": "/absolute/path/to/manifest.json"
}
```

Replace both paths before running. Results retain the original question order. `awaiting_review` means drafting has reached review. For the full review and export flow, run the **vendor-risk-questionnaire** parent workflow instead of running the draft child separately.

## Understand review reasons

| Route                      | Meaning                                                                | Your next action                                                |
| -------------------------- | ---------------------------------------------------------------------- | --------------------------------------------------------------- |
| `draft_eligible`           | The draft passed the checks needed for review                          | Read its claims and citations before releasing it               |
| `review_required`          | Evidence, applicability, response format or disclosure needs attention | Resolve the issue, correct the draft, or choose an explicit gap |
| `security_review_required` | Security checks blocked normal release                                 | Inspect the reason; a blocked answer cannot be released         |

None of these routes grants final approval. Missing evidence, conflicting records and unclear scope remain visible. [Review and approval](review.md) explains the available choices.

## Execution policy

The execution policy sets the model and limits for one run, including its later review checks. Configure it before starting work.

1. Open `.runtime/profile.json` and find `policy`.
2. Choose your spending estimate, maximum provider calls and maximum elapsed time. Keep the other required policy fields.
3. Check the model and its input/output price estimates. Changing `VRQ_MODEL` does not update prices automatically.
4. Validate the profile with the [local configuration check](local-operation.md#configure-your-organizations-evidence).
5. Start a new run. Saved runs keep their original policy and usage.

The template's defaults are examples, not recommended spending allowances:

| Field              | Example default | What it limits                                                 |
| ------------------ | --------------- | -------------------------------------------------------------- |
| `budgetUsd`        | `5`             | Estimated cost calculated from configured token prices         |
| `maxPhysicalCalls` | `1000`          | Provider calls, including detectors, retries and review checks |
| `maxRunElapsedMs`  | `1800000`       | Elapsed time: 30 minutes                                       |
| `concurrency`      | `4`             | Concurrent work                                                |
| `callTimeoutMs`    | `60000`         | Time allowed for an individual call                            |
| `maxInputTokens`   | `8000`          | Per-call input, including schema and system overhead           |
| `maxOutputTokens`  | `4000`          | Per-call output allowance                                      |

Existing profiles retain their own values. For example, to use a 10-minute elapsed limit for future runs, change only `policy.maxRunElapsedMs` to `600000`. Do not replace the complete policy with a one-field object.

`budgetUsd`, `maxPhysicalCalls` and `maxRunElapsedMs` must be positive; call counts and millisecond limits are integers. `rates` needs an ISO date and nonnegative input/output prices per million tokens. Other limits and thresholds have bounded ranges in `src/mastra/contracts/execution-policy.ts`.

Input and output buffers have separate byte guards of four times their respective token limits, including serialized schema and prompt overhead on input. These guards bound memory; they are not exact token counts. Provider-reported usage enforces the per-call token limits at completion. An oversized call fails its question or screening boundary without stopping unrelated questions.

Every physical provider attempt counts. Missing or malformed usage keeps a conservative reservation, and reasoning tokens count toward output usage. These estimates are not a provider billing cap. Reaching a limit may leave gaps, including in the sample questionnaire.

The elapsed-time allowance covers drafting and automated review checks. It pauses while the questionnaire waits for a human decision and resumes when review validation starts. Failed review attempts still consume processing time; retries preserve the remaining time, cost and call allowance. An interrupted active operation conservatively counts elapsed time until its claim is recovered. Older runs awaiting review use their saved drafting completion time to exclude the human wait.

For new terminal and web runs, `.env`'s `VRQ_MODEL` overrides the profile model. In Studio it sets the default when input omits `policy`; an explicit Studio policy keeps its own model. Restart the server after changing `.env`. Changing any saved run's policy requires a new run, not resetting its usage.

### Ask a coding LLM to change the policy

<details>
<summary>Show optional prompt</summary>

```text
Update the execution policy for future vendor-risk-questionnaire runs.

Model: [supported OpenAI model ID]
Estimated budget in USD: [amount]
Maximum physical provider calls: [count]
Maximum elapsed time in minutes: [minutes]
Input/output prices per million tokens and their date: [values]

Read src/mastra/contracts/execution-policy.ts, src/mastra/runtime/profile.ts,
and my .runtime/profile.json. Preserve all required fields and unrelated
profile settings. Convert minutes to milliseconds. Validate against
executionPolicySchema and run the local profile configuration check.
Do not invent prices. If values are missing, ask me for them.

Explain whether VRQ_MODEL overrides the model I selected. Show the final
configuration and validation result. Do not modify saved run policies,
reset usage, start model calls or approve answers.
```

</details>

## Retrieval details and limitations

The backend uses Mastra Workspace BM25, a keyword-based search over the run's eligible evidence. It searches the original question span and a second query derived from its subparts, taking up to three hits from each. The second query removes common instruction words and configured organization/product names and applies limited plural normalization. Duplicate excerpts are removed.

Keyword search can miss paraphrases or contradictions. Search scores rank results; they are not probabilities that an answer is correct. Negative facts and conflicting records remain separate evidence.

Each excerpt keeps its raw text, location and source hash. Additional context preserves JSON nesting and table relationships, but one field's citation cannot stand in for another field's value. The complete enriched excerpt must fit a 4,000-byte context limit. An oversized candidate produces `SOURCE_UNAVAILABLE` instead of being truncated.

The backend checks source bytes, validity, LLM permission and snapshot identity before model work, and checks snapshot bytes again after screening. Detectors screen the interpretation catalogue and assembled answer context. Detector errors block further processing; a successful check still cannot guarantee detection of every malicious input.

Citations must match an eligible source's version, hash, locator and literal excerpt. These exact-match checks establish where text came from; the independent verifier assesses whether it supports the answer. Raw validation errors and rejected outputs are excluded from telemetry. See [evaluation and metrics](evaluation.md).

## Extend a processing phase

Agent definitions live in `src/mastra/agents`. Workflow steps and runtime setup live in `src/mastra/workflows/vendor-risk-drafts`.

1. Read the existing phase and its schema.
2. Put deterministic response rules in the schema. `compatibleResponseSchema(question)` enforces question length and choice constraints for both drafts and reviewer corrections.
3. Call business phases through `generatePhase(agent, options, context, prompt, schema)`. It validates output, authorizes provider work and uses structured output with one step and no tools.
4. Keep current-source, citation eligibility and reviewer authorization checks in execution code.
5. Run focused offline tests before any live evaluation.

The provider wrapper checks stream completion and duplicate JSON keys, sanitizes diagnostics and counts each physical attempt. Keep application retries there so usage remains accurate. Native injection and personal-information detectors share the payload attempt limit. Direct Studio agent prompts cannot authorize provider execution.
