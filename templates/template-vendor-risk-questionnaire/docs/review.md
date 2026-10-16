# Review and approval

Review decides which answers and evidence may appear in the completed questionnaire. Drafting alone never approves an export.

For setup, use the [web UI guide](ui.md) or [terminal walkthrough](local-operation.md). Most users can complete review there without creating JSON files or running the administration commands below.

## Choose what to share

Read each original question, draft, citation and limitation before choosing:

| Choice     | When to use it                                        | Example                                                                       |
| ---------- | ----------------------------------------------------- | ----------------------------------------------------------------------------- |
| `release`  | The evidence supports the draft and you may share it  | Release a policy statement supported by the cited approved policy             |
| `correct`  | You need to change the draft using available evidence | Narrow “all accounts” to the employee accounts actually covered by the source |
| `unknown`  | No supported answer is available for release          | The question asks for a recovery test result, but no test record is available |
| `withheld` | You will not disclose the answer                      | The supporting evidence is restricted                                         |

`correct` is an interactive choice. In a JSON decision, a correction uses `disposition: "release"` plus a `correction` object matching the full draft schema. It is not a separate JSON disposition.

Corrections must satisfy the original question's length and choice limits and pass fresh security and independent support checks.

An answer marked `unknown` or `withheld` includes only a safe reason, without factual corrections, citations or limitations. These answers are called **gaps** in the review records.

## Terminal review

1. Start a questionnaire from the template directory:

   ```bash
   npm run respond -- "$PWD/.runtime/demo/questionnaire.xlsx"
   ```

2. Save the printed run ID. Answer mapping prompts if needed. Enter `REPLACE` only for prefilled destinations you intend to replace.
3. Read every draft and choose one of the actions above.
4. Inspect the complete revised answer set. Type `APPROVE` to authorize export.
5. Open the returned `answered.xlsx` or `answered.docx` and inspect the result.

The command saves the source checkpoint before displaying the run ID. Mapping progress, replacement choices and individual review choices survive terminal cancellation. To continue a saved run, replace `review-1` with that ID:

```bash
npm run respond -- --resume review-1
```

Cancellation, end-of-input, invalid noninteractive input and stale review state never approve answers. An unchanged validated review can reuse its checks. Changed facts require new checks within the original budget. Terminal control characters are removed from displayed document text.

## Source sharing rules

The evidence manifest controls source eligibility and disclosure. Approval for LLM use and permission to share with the customer are separate decisions.

| Source disclosure | Review behavior                                                  |
| ----------------- | ---------------------------------------------------------------- |
| `shareable`       | Eligible supported content can be released through normal review |
| `review_required` | Explicitly authorize each source used by that question           |
| `restricted`      | Content cannot be released; choose a safe gap                    |

In JSON, `releaseDocumentIds` lists the source IDs whose disclosure you explicitly authorize for that question. Each must belong to that question's citations. Security-blocked questions cannot be released either.

Changing source bytes, validity or manifest policy invalidates approval and requires a fresh intake, evidence snapshot and run. Approval cannot bypass protected-content checks on the original questionnaire.

## Studio intake and review

Studio is useful for inspecting workflows or supplying an advanced mapping. Use the web UI for file uploads; Studio intake takes a local path.

1. Run `npm run demo`, then `npm run dev:mastra`.
2. Open [Mastra Studio](http://127.0.0.1:4111) and select **vendor-risk-intake**.
3. Enter this input, replacing the source path with the actual absolute path and using a new run ID:

   ```json
   {
     "runId": "review-1",
     "sourcePath": "/absolute/path/to/template/.runtime/demo/questionnaire.xlsx",
     "sourceId": "questionnaire-source",
     "questionnaireId": "questionnaire-1",
     "title": "Fictional vendor review"
   }
   ```

4. Inspect the paused **confirm-input-mapping** step. Confirm the mapping even if only one candidate exists. Follow the [explicit mapping walkthrough](intake.md#submit-an-explicit-mapping-through-studio).
5. Use the intake result as input to **vendor-risk-questionnaire**. It includes the run ID, evidence paths and policy. A minimal input looks like this:

   ```json
   {
     "runId": "review-1",
     "evidenceRoot": "/absolute/path/to/template/.runtime/demo/evidence",
     "manifestPath": "/absolute/path/to/template/.runtime/demo/manifest.json"
   }
   ```

6. Wait for the parent to pause at **review-answer-set**, after the draft child finishes. Stop Studio before using CLI commands that change this run.

Demo preparation preserves existing profiles and makes no provider calls. The configured limits can leave gaps in the 24-question demo. Start a new run to use different limits; never reset usage on an existing run.

## Inspect and submit review JSON

Use this route for administration or a custom integration. The web and terminal flows already build decisions for you.

### 1. Read the current state

```bash
npm run review -- status --run-id review-1
```

This makes no model calls. It returns questions, drafts, reasons for review and the current review identifiers. Keep the output and decision files private because they can contain supporting evidence.

A **revision** is the saved review version. A **digest** is a fingerprint of its contents. Copy these values from the current status; guessing or reusing old values causes rejection.

### 2. Prepare a decision file

Create `.runtime/decision.json`, outside the customer export directory. Copy `organizationId`, `revision`, `digest` and `policyDigest` from status into the corresponding fields below.

This example shows only two questions. Replace the placeholder digests and include exactly one disposition for **every** question in your run before submitting:

```json
{
  "decisionId": "review-decision-1",
  "runId": "review-1",
  "organizationId": "northstar",
  "expectedRevision": 0,
  "expectedDigest": "<current 64-character digest>",
  "policyDigest": "<current 64-character policy digest>",
  "dispositions": [
    {
      "questionId": "VRQ-001",
      "disposition": "release",
      "safeReason": "Supported by approved evidence.",
      "releaseDocumentIds": []
    },
    {
      "questionId": "VRQ-002",
      "disposition": "unknown",
      "safeReason": "No releasable supported answer is available.",
      "releaseDocumentIds": []
    }
  ],
  "finalApproval": false
}
```

`finalApproval: false` validates and saves the reviewed set without authorizing export. Reviewer identity comes from the server's OS user and is recorded with the decision time. Do not add reviewer privileges or unknown fields to the JSON.

### 3. Validate and inspect

With the dev server stopped, run:

```bash
npm run review -- submit --run-id review-1 --decision "$PWD/.runtime/decision.json"
npm run review -- status --run-id review-1
```

Review the saved result and any issues. Changed release text consumes checks within the original budget; unchanged checks may be reused.

### 4. Approve the complete set

When you are ready to approve:

1. Update the file with a new `decisionId` and the latest revision and digests from status.
2. Include the complete reviewed set and set `finalApproval` to `true`.
3. Submit, check the state, and resume the parent workflow:

   ```bash
   npm run review -- submit --run-id review-1 --decision "$PWD/.runtime/decision.json"
   npm run review -- status --run-id review-1
   npm run review -- resume --run-id review-1
   ```

The state must be `approved` before resume. When export finishes, the state becomes `exported` and one answered document is available.

Submit and export use the configured evidence profile. An override must provide both `--root` and `--manifest`. Status, resume and cleanup do not require a profile.

Replaying an identical decision ID and payload returns the saved result without repeating checks. Reusing an ID with changed content or submitting a stale revision fails. Changed content revokes an earlier approval before validation; unsupported or protected changes leave review pending.

### Ask a coding LLM to prepare a decision file

<details>
<summary>Show optional prompt</summary>

Use this prompt only with a coding LLM authorized to inspect the local review data:

```text
Prepare .runtime/decision.json for run [run ID]. Do not submit it.

Read src/mastra/contracts/review.ts and src/mastra/contracts/answer.ts.
Read the current run with npm run review -- status --run-id [run ID].
Use its exact organizationId, revision, digest, policyDigest and question IDs.

Ask me for a disposition for every question and for any source disclosure
permission. Do not choose releases, fabricate supporting evidence, or grant
permission on my behalf. If I request a correction, use the complete draft
schema and preserve valid citation bindings and question constraints.

Include every question exactly once. Set finalApproval to false. Validate
with reviewDecisionSchema, then show a readable summary of my choices and
any unresolved issues. Explain that schema validation does not replace the
server's source, support, security or stale-state checks. Do not submit,
approve, resume, export, or alter source evidence.
```

</details>

## Finish when the budget is exhausted

If call, cost or elapsed-time limits prevent further checks, you can still approve and export the questionnaire with every answer marked `unknown` or `withheld`.

Time spent waiting for your decision does not count toward the processing limit. Drafting and automated review checks share that allowance, including failed review attempts. `EXHAUSTED_REVIEW_REQUIRES_TRUSTED_GAPS` means the remaining allowance cannot support the submitted review; it requires the gap-only choices below. Retrying does not reset usage.

1. Choose `unknown` or `withheld` for every question.
2. Use these exact supported reasons:

   | Disposition | `safeReason`                                   |
   | ----------- | ---------------------------------------------- |
   | `unknown`   | `No releasable supported answer is available.` |
   | `withheld`  | `Evidence is withheld.`                        |

3. Review the complete set and approve it through the normal flow.

This path makes no provider calls and preserves the original usage record. Custom reasons, corrections and releases require checks that cannot run after the budget is exhausted. Local protected-content checks and source/policy validation still apply. Unsafe retained source content can block export even when all answers are gaps. A successful export is marked `delivered_with_gaps`.

## Restart and retry

To reopen review after a restart, use the existing parent run. The CLI restores its saved Mastra workflow state and resumes **review-answer-set** with the approved revision and digest. It does not restart drafting.

Studio can also resume that step with `approvalId`, `revision` and `digest` from an approved decision. Supplying these values cannot itself approve a set.

If an approved export failed while writing files or saving state:

```bash
npm run review -- export --run-id review-1
```

Export validates the staged document before publishing it. A retry checks existing files and reconciles state if publication finished before the state write. Mismatching content or hashes are rejected.

### Recover an interrupted operation

A process killed during review or export can leave a saved **claim**, indicating that it owned the operation.

1. Confirm the old process has stopped.
2. Read `review status` and copy its claim token.
3. Wait until the claim is at least two minutes old.
4. Replace `TOKEN_FROM_STATUS` with that exact token:

   ```bash
   npm run review -- recover-claim --run-id review-1 --claim-token TOKEN_FROM_STATUS
   ```

5. Retry the applicable review or export operation.

Claim recovery does not restore stale approval or replenish usage. If the database writer lock blocks commands, follow [local process ownership](#local-process-ownership) first.

If export fails after terminal approval, `npm run respond -- --resume RUN_ID` can retry export once the underlying problem is fixed. It checks that the saved workflow approval matches the current approved revision and exports that exact set without new model calls or another approval prompt. The original failed workflow history remains available; the review state records the successful export. A stale approval cannot use this recovery path.

## Answered document

Each successful run publishes exactly one `answered.xlsx` or `answered.docx`, preserving the original format. The original source is kept unchanged.

Answers go into the mapped response destinations. Explanation fields receive reasons and limitations; evidence fields receive approved citation labels and locations. If the questionnaire has no evidence field, full supporting attribution stays in the local review and audit records.

Unknown and withheld answers remain explicit. Choice fields need a compatible explanation field so qualifications and gaps are not lost. Missing, protected, merged, overlapping, ambiguous or fixed-layout destinations can block completion. Prefilled destinations need explicit replacement consent. Answers are checked for fit again after review and are never silently truncated.

The template checks retained document content locally, including hidden content, headers, footers, comments and metadata. It does not send the whole package to a model. Unsupported binary/XML content or protected original text blocks publication and requires a corrected source. Approval does not authorize silent removal of unrelated material.

The parent returns `{ path, manifest }` for the published file. The manifest is an internal record binding the source, mapping, completion plan, approved answers and output hash; it is not an extra customer file. No JSON, PDF, CSV or Markdown companion is exported. Reopening a published run validates the existing output.

## Explicit cleanup

Cleanup removes one run's selected runtime records, revisions, files and workflow snapshots. Shared original source blobs, original evidence, `.env` and unrelated runs are preserved. There is no automatic cleanup.

1. Stop the dev server and preview the selected run:

   ```bash
   npm run review -- cleanup-preview --run-id review-1
   ```

2. Read the preview. If you want to remove those items, copy its current revision and digest into `.runtime/cleanup-confirmation.json`:

   ```json
   {
     "runId": "review-1",
     "revision": 1,
     "previewDigest": "<exact preview digest>",
     "confirm": true
   }
   ```

3. Replace the example values before running:

   ```bash
   npm run review -- cleanup --run-id review-1 --confirmation "$PWD/.runtime/cleanup-confirmation.json"
   ```

The preview includes the selected run’s lifecycle records and stored questionnaire and evidence bytes that no other run references. Confirmation rechecks shared references in the final database transaction and preserves bytes still used by another run.

Preview deletes nothing. Missing confirmation, an outdated preview or paths escaping through symlinks fail. This cleanup differs from the UI's **Remove**, which hides a run and disables its HTTP access while retaining audit records and local files.

## Local process ownership

Only one process can write the database. Stop Studio and the web backend before CLI commands that submit, resume, export or clean up. `review status` and `review metrics` use read-only connections and can run alongside the server.

After a crash:

1. Read `.runtime/vrq.db.writer/owner.json`.
2. Confirm that its recorded process ID has exited.
3. Copy its token and run:

   ```bash
   npm run recover:writer -- --token TOKEN_FROM_OWNER_FILE
   ```

4. Inspect the saved run state before resuming work.

Recovery refuses a live process or changed token. A failed final snapshot write may leave native history `running` while application state is `failed`; that history must not automatically restart model work.

For processing, review, export and usage measurements, see [evaluation and metrics](evaluation.md).
