# Persistent review and approved exports

The local OS operator owns evidence approval and answer release. Documents, model output and decision files cannot grant reviewer privileges. Studio binds to `127.0.0.1`; this example has no production authentication service or public channel.

## Studio intake

`npm run dev` prepares originally authored fictional demo files only when `.runtime/demo` is absent. Existing data is preserved; partial or unsafe directories stop startup with a diagnostic. No provider request or answer approval occurs during preparation.

Configure `.runtime/profile.json` once with absolute local evidence root/manifest paths, scope and execution policy. Startup writes the fictional profile only when absent; custom profiles and state are preserved. Source eligibility remains manifest-driven and topic retrieval remains bounded to the eligible snapshot.

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

The shortened example requires the remaining question dispositions before submission. `release` uses an eligible supported draft. A factual `correction` must satisfy the complete draft schema, eligible source/locator bindings, response constraints and independent support verification. `review_required` source disclosure requires explicit `releaseDocumentIds` scoped to that question's citations. `restricted` disclosure and security-blocked questions cannot be released; use safe `unknown` or `withheld` gaps. Gap dispositions cannot carry factual corrections, citations or limitations. Original question text containing protected content is withheld from customer artifacts too.

```text
npm run review -- submit --run-id review-1 --decision /path/to/decision.json
npm run review -- status --run-id review-1
npm run review -- resume --run-id review-1
```

Submission and export use the configured evidence profile. To override its paths, supply both `--root` and `--manifest`; a partial override fails. Status, resume and cleanup do not require a profile.

`finalApproval: false` records a reviewed set while keeping approval pending. A subsequent decision must use the returned revision/digest. New release text is checked within the original physical-call budget; unchanged checks can be reused. Actor identity comes from the server's actual OS user, with decision time recorded in the audit. No model can manufacture it.

After the physical-call, spend or elapsed-time limit is exhausted, approve a complete gap set using only `unknown` with `No releasable supported answer is available.` or `withheld` with `Evidence is withheld.`. This path makes no provider calls and preserves the original limits and usage ledger. It exports question identity/order with an explicit generated label explaining that original text was withheld; original question text, source labels, factual answers and citations are absent. Custom reasons, corrections and releases fail because their required checks cannot run within the exhausted budget. Local protected-content checks and current source/policy validation still apply, and the bundle is marked `delivered_with_gaps` only after explicit final approval.

The identical decision ID/payload returns its saved outcome without repeating checks. A conflicting replay or competing stale revision fails. Submitting changed content revokes previous approval before checks; protected/unsupported changes leave review pending. Changes to source bytes, validity or manifest policy invalidate the run's approval and require a fresh intake/snapshot/run.

## Restart and retry

Restart Studio and reopen the existing parent run. The local command restores the stored public Mastra workflow snapshot, then resumes **review-answer-set** using the approved revision/digest. It never restarts the draft child to reopen review. Studio can also resume this step with `{ "approvalId": <approved decision ID>, "revision": <approved revision>, "digest": <approved digest> }`; submitting these fields alone cannot approve a set.

Export writes are staged and content-validated before atomic publication. Only a complete six-file bundle receives an exported status and manifest. Retry after an export file/state failure with:

```text
npm run review -- export --run-id review-1
```

If the files were published before the state write failed, retry validates every file and reconciles status. Existing bundles with mismatching content or hashes are rejected. A process killed during a claimed operation leaves a durable claim. Once the old process has stopped and the claim is at least two minutes old, explicitly recover it using the token shown by status:

```text
npm run review -- recover-claim --run-id review-1 --claim-token <current token>
```

Then retry the applicable decision/export operation. Recovery does not replenish usage or restore stale approval.

## Bundle contents

All artifacts derive from one versioned releasable projection, preserving order, response options, supported negative/partial answers, limitations, public citations and safe gap reasons. Quality is `delivered_with_gaps` whenever unknown/withheld answers remain.

- `questionnaire.xlsx`: literal-string Questionnaire and Evidence sheets.
- `questionnaire.csv` and `evidence.csv`: quoted fields with formula-capable values prefixed by an apostrophe, including leading whitespace/control characters.
- `completed.json`: canonical versioned answer/evidence set, quality/counts and exact approval reference.
- `completed.md`: escaped text and disabled active links/markup.
- `completed.pdf`: paginated questionnaire and evidence with locally embedded fonts. Glyph coverage, extracted content and page bounds are validated; unsupported glyphs fail without substitution.
- `manifest.json`: exact approval/projection binding and byte counts/SHA256 hashes for every artifact.

Private file paths/titles and restricted excerpts are excluded. JSON stores literal text as data. Customer artifacts contain only releasable evidence; original source documents are not attached. New artifacts do not edit the buyer's original form.

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
