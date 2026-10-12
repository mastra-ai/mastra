# Review and document response

Use `npm run respond -- /absolute/path/questionnaire.xlsx` (or `.docx`) for intake, drafting, readable review and one returned file. Use `npm run respond -- --resume <run-id>` after interruption. The command saves its source checkpoint before presenting the run ID. Known verified layouts proceed automatically; exceptions receive specific mapping prompts. Every prefilled replacement requires `REPLACE`. Responses, qualifications, safe reasons and citations appear in a consolidated review. Choose `release`, `correct`, `unknown` or `withheld` for each question, then inspect the complete revised set and type `APPROVE`. Cancellation, EOF, invalid noninteractive input and stale review state never approve.

Source/mapping progress, prefilled decisions and individual question review choices survive cancellation. Resuming a validated unchanged review set reuses its checks. Changed factual content still requires fresh native security and independent support verification within the original budget. Terminal escape controls are removed from displayed document text.

The lower-level commands below remain administration and inspection interfaces. They are unnecessary for the primary respond journey.

## Studio intake

`npm run demo` explicitly prepares the fictional sample files and evidence profile. Existing data is preserved; partial or unsafe data stops preparation with a diagnostic. Then run `npm run dev` to open Studio. Preparation makes no provider request or answer approval.

Configure `.runtime/profile.json` once with absolute local evidence root/manifest paths, scope and execution policy. Demo preparation writes the fictional profile only when absent; custom profiles and state are preserved. Source eligibility remains manifest-driven and topic retrieval remains bounded to the eligible snapshot.

The tested stable Studio 1.33.0 rejects XLSX/DOCX chat attachments. In Studio select **vendor-risk-intake**, using an absolute local questionnaire path:

```json
{
  "runId": "review-1",
  "sourcePath": "/path/to/template/.runtime/demo/questionnaire.xlsx",
  "sourceId": "questionnaire-source",
  "questionnaireId": "questionnaire-1",
  "title": "Fictional vendor review"
}
```

The inspection pauses even when one mapping candidate exists. Review all regions and exclusions, then resume with `{ "mapping": <confirmed mapping object>, "confirm": true }`. The mapping is bound to the exact source hash. Unsupported layouts or changed source bytes fail rather than guess. The result supplies input for **vendor-risk-questionnaire**:

```json
{
  "runId": "review-1",
  "evidenceRoot": "/path/to/template/.runtime/demo/evidence",
  "manifestPath": "/path/to/template/.runtime/demo/manifest.json"
}
```

The parent uses the bounded **vendor-risk-drafts** child, then suspends once at **review-answer-set**, outside the parallel loop. The default finite budget can leave gaps in the 24-question demo. Changing the execution policy requires a fresh run; never reset reservations on an existing run.

## Inspect and submit review

`npm run review -- status --run-id review-1` reads the restricted local review record without model calls. It includes original questions, drafts, escalation reasons, immutable digests and revision. Supporting text is local operator data; keep the terminal and decision files private.

Create a decision file outside any customer artifact directory. Copy the current `revision`, `digest`, `policyDigest` and organization from status. Include exactly one disposition for every question, even ordinary supported drafts. The decision schema rejects unknown fields such as client-supplied reviewer privileges.

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
  "finalApproval": true
}
```

The shortened example requires the remaining question dispositions before submission. `release` uses an eligible supported draft. A factual `correction` must satisfy the complete draft schema, eligible source/locator bindings, response constraints and independent support verification. `review_required` source disclosure requires explicit `releaseDocumentIds` scoped to that question's citations. `restricted` disclosure and security-blocked questions cannot be released; use safe `unknown` or `withheld` gaps. Gap dispositions cannot carry factual corrections, citations or limitations. Protected original content blocks same-format publication and requires a corrected source.

```text
npm run review -- submit --run-id review-1 --decision /path/to/decision.json
npm run review -- status --run-id review-1
npm run review -- resume --run-id review-1
```

Submission and export use the configured evidence profile. To override its paths, supply both `--root` and `--manifest`; a partial override fails. Status, resume and cleanup do not require a profile.

`finalApproval: false` records a reviewed set while keeping approval pending. A subsequent decision must use the returned revision/digest. New release text is checked within the original physical-call budget; unchanged checks can be reused. Actor identity comes from the server's actual OS user, with decision time recorded in the audit. No model can manufacture it.

After the physical-call, spend or elapsed-time limit is exhausted, approve a complete gap set using only `unknown` with `No releasable supported answer is available.` or `withheld` with `Evidence is withheld.`. This path makes no provider calls and preserves the original limits and usage ledger. It writes explicit gaps into response fields. Retained original content still requires local disclosure screening; unsafe content blocks publication even when all answers are gaps. Custom reasons, corrections and releases fail because their required checks cannot run within the exhausted budget. Local protected-content checks and current source/policy validation still apply, and the output is marked `delivered_with_gaps` only after explicit final approval.

The identical decision ID/payload returns its saved outcome without repeating checks. A conflicting replay or competing stale revision fails. Submitting changed content revokes previous approval before checks; protected/unsupported changes leave review pending. Changes to source bytes, validity or manifest policy invalidate the run's approval and require a fresh intake/snapshot/run.

## Restart and retry

Restart Studio and reopen the existing parent run. The local command restores the stored public Mastra workflow snapshot, then resumes **review-answer-set** using the approved revision/digest. It never restarts the draft child to reopen review. Studio can also resume this step with `{ "approvalId": <approved decision ID>, "revision": <approved revision>, "digest": <approved digest> }`; submitting these fields alone cannot approve a set.

Export writes are staged and content-validated before atomic publication. Only the validated single document receives an exported status and internal publication record. Retry after an export file/state failure with:

```text
npm run review -- export --run-id review-1
```

If the files were published before the state write failed, retry validates every file and reconciles status. Existing documents with mismatching content or hashes are rejected. A process killed during a claimed operation leaves a durable claim. Once the old process has stopped and the claim is at least two minutes old, explicitly recover it using the token shown by status:

```text
npm run review -- recover-claim --run-id review-1 --claim-token <current token>
```

Then retry the applicable decision/export operation. Recovery does not replenish usage or restore stale approval.

## Answered document

New runs publish exactly one `answered.xlsx` or `answered.docx` in the original input format. The parent workflow returns `{ path, manifest }` after publication; the CLI uses that result directly. Reopening an exported run validates the existing file before returning it. Application code writes literal values into the exact source-bound response destinations. The immutable original is preserved. Existing explanation fields retain safe reasons and limitations; existing evidence fields retain safe citation labels and locators. Full supporting attribution stays in the restricted local review/audit when no evidence field exists.

Unknown and withheld remain explicit. Choice destinations require a compatible explanation field so qualifications and gaps cannot disappear. Missing, protected, merged, ambiguous, overlapping or fixed-layout targets fail before provider work where detectable. Prefilled targets require explicit hash-bound replacement consent. Reviewed content is checked again for representability; nothing is truncated.

The complete retained package is checked locally, including hidden content, headers/footers, comments and metadata. It is never sent wholesale to a model or detector. Unsupported binary/XML payloads and protected original content block release and require a corrected source. Approval cannot bypass these checks or authorize silent redaction of unrelated material.

Publication stores version-2 source/mapping/plan/projection/approval/output bindings internally. Only one answered file is staged and atomically published; no customer manifest or JSON/PDF/CSV/Markdown companion is created. Retry validates the persisted bindings and output hash, reconciles an interrupted state update, and preserves approval and completed work.

## Explicit cleanup

Cleanup selects one run and previews all its runtime revisions, records and snapshot directories. Shared immutable source blobs, original evidence, environment credentials and unrelated runs are preserved.

```text
npm run review -- cleanup-preview --run-id review-1
```

Read the preview and save only the following confirmation fields in a local file:

```json
{
  "runId": "review-1",
  "revision": 1,
  "previewDigest": "<exact preview digest>",
  "confirm": true
}
```

```text
npm run review -- cleanup --run-id review-1 --confirmation /path/to/confirmation.json
```

Preview alone deletes nothing. Missing confirmation, stale previews or symlink escapes fail. Cleanup removes selected application records/files and Mastra snapshots through public APIs. It does not delete evidence source files, `.env`, shared source bytes or external project controls. There is no automatic cleanup or encrypted-at-rest guarantee.

## Domain metrics and tracing

`npm run review -- metrics --run-id review-1` reports durable processing, review, export and usage metrics. See `docs/evaluation.md` for definitions, local storage and telemetry failure behavior. Operator status includes restricted answer and audit records.

## Local process ownership

Stop Studio before running CLI commands that submit review, resume, export or clean up data. One mutating process holds `.runtime/vrq.db.writer`; a second process fails before native database operations reach the driver. `review status` and `review metrics` use query-only connections and can inspect state while Studio owns the writer lease.

After a crash, inspect `.runtime/vrq.db.writer/owner.json` and confirm that its PID has exited. Run `npm run recover:writer -- --token <token>` with the recorded token. Recovery refuses a live process or changed token. Then inspect durable business and workflow state before deciding on any further work. A required terminal snapshot fault can leave native history `running` while application state is `failed`; never use that old native history to automatically restart or replay model work.
