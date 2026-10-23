# Operating policy checking

## Clarify a case

Send `/clarify ` followed by a JSON object. Replace the IDs and revision below with values from `/status`; use the insured identity and document roles for your case.

```json
{
  "caseId": "11111111-1111-4111-8111-111111111111",
  "expectedRevision": 1,
  "identity": {
    "policyNumber": null,
    "insuredName": "Elm Harbor Fabrication LLC",
    "insuranceProduct": "Commercial property"
  },
  "intent": "document_comparison",
  "referenceId": "22222222-2222-4222-8222-222222222222",
  "targetId": "33333333-3333-4333-8333-333333333333",
  "roles": [
    { "sourceId": "22222222-2222-4222-8222-222222222222", "role": "proposal" },
    { "sourceId": "33333333-3333-4333-8333-333333333333", "role": "issued_policy" }
  ],
  "acceptedBaseline": null
}
```

Reference and target must be distinct sources. General document comparison can use an unaccepted proposal and does not require an issued policy number. `agreed_terms_checking` additionally requires an explicitly accepted proposal or contract and an issued target policy. Set `acceptedBaseline` to the broker's explicit acceptance statement and the reference source ID. Include supporting sources as `amendment` or `binder` roles. The response identifies missing or conflicting fields. Clarification does not run comparison or approve a report.

## Compare documents

Send `/compare ` followed by the request below, using the latest revision from `/status`:

```json
{
  "caseId": "11111111-1111-4111-8111-111111111111",
  "expectedRevision": 2,
  "profileId": "generic",
  "asOf": "2026-05-01",
  "retryAttemptId": null
}
```

The `comparePolicy` agent tool and this command both run the persisted `policyCheckingWorkflow`. An internal Mastra processing agent extracts structured terms through the native OpenAI Responses provider. The reconciliation domain verifies quotations against captured physical pages or record fields, compares exact decimal values and preserves currency, basis, units, entity distinctions and date granularity. Changed clauses receive a separate structured semantic assessment. Similar wording alone cannot establish equivalent coverage. An omitted term is reported only against a fully reviewed scope; evidence includes the expected term and excerpts from the searched target pages or records.

Agreed-term checking applies only changes with affirmative documented approval identifying the policy, approver, term, scope and effective date. Negated, pending or conditional approval, conflicting binders and incomplete evidence require review. Uploaded instructions never approve findings or reports. General document comparison makes document observations without inferring contractual acceptance or recommending an insurer correction.

The bundled `src/mastra/config/processing.ts` intentionally sets `budget: null`. Before paid processing, supply explicitly approved values for every field of `processingBudgetSchema`: attempts, request counts, input/output and total token ceilings, cost ceiling, conservative per-token pricing assumptions, timeout and response bytes. The extraction model is configurable with `POLICY_EXTRACTION_MODEL` and defaults to `gpt-6.1-sol`; `OPENAI_API_KEY` remains the only external credential. Conversation dispatch is separately disabled. Each processing generation uses one step with native structured output, no tools or memory, and no automatic retry, fallback or second structuring model. The original schemas and source-evidence checks validate every result. The processing agent is internal to authorized attempts and is not a separate Studio entry point. Cost estimates identify their configured pricing assumption; actual billing cost can be unavailable. Native Mastra timeouts bound each generation and provider call, including response-body consumption and response processing. A response processor validates the provider’s raw completion status and token counters, records available usage and rejects inconsistent totals or usage above the reservation. A bounded transport extension reserves each actual SDK request transactionally using its UTF-8 payload size plus conservative protocol overhead, caps raw response bytes before SDK parsing and rejects redirects. The official `@ai-sdk/openai` provider supplies per-request fetch injection, which the installed Mastra model router does not expose. Missing usage never releases a reservation as if it were free.

`/status` lists processing attempts, saved analysis IDs, classifications, limitations and profile provenance. Exact excerpts remain accessible through `/evidence`; the status notice does not resend full documents to a conversation model. An analysis can complete with unresolved observations. The workflow freezes its report snapshot, publishes a verified PDF draft and suspends for broker review. The case becomes `AWAITING_REVIEW` only after the draft is durable. It grants no approval. A processing failure sets `FAILED` and retains successful partial extractions privately. To retry, use the failed attempt ID as `retryAttemptId` and the current revision, preserving sources, clarification, profile, comparison date, model and budget. Retries share the original reservations and attempt ceiling. Changed inputs require an explicit new intake or clarification before a new analysis.

Interrupted work remains processing until its bounded request lease expires, then status recovery records a failure that requires an explicit retry. A restart cannot infer success or approval. While processing, source intake, `/new` and clarification cannot replace the active case.

## Retrieve and recover a draft

Send `/report` in the original conversation to read the saved report, version, findings and download link. A draft includes the comparison intent, profile version, exact evidence locators, checked-term counts and limitations. A general document comparison remains a comparison of the supplied documents; it does not establish accepted coverage. Source excerpts can also be read with `/evidence` or the source evidence tool. No new model call is needed for report retrieval or PDF rendering.

The workflow remains suspended after a restart. Direct workflow resume cannot approve a report or create final output. Working memory shows convenience identifiers; the saved case, report snapshot and workflow remain authoritative. Only an explicit `/review` command can record broker decisions. Review commands are handled before conversation model dispatch; the agent has no approval tool.

If rendering or saving fails, `/report` explains the error without exposing a successful download. Fix the provider or storage problem, then send `/report ` followed by:

```json
{
  "caseId": "11111111-1111-4111-8111-111111111111",
  "retryPublication": true
}
```

Retry uses the original report, version, workflow run and selected provider. It does not repeat comparison or consume another processing budget. Restore a missing or damaged published file from the matching backup; a checksum failure never returns a successful link. A changed provider selection cannot silently redirect a saved publication.

A report snapshot freezes the case input. Request an evidence revision before adding evidence to that case, or use `/new` with attachments to start a separate case. Existing report records and files remain immutable. Send `/case CASE_ID` in the original conversation to select a previously captured case, then `/report` to retrieve its draft. This selection cannot access cases from another conversation, and it is blocked while the active case is processing. Downloads require the original operator, conversation and selected case; copying a filename or another case's link does not select that case.

## Review an exact report version

Read `/report`, download and inspect the draft. Copy its case/report identifiers, version, snapshot checksum and current case revision into `/review ` followed by JSON. Generate a new UUID for `operationId`; reusing it with the identical decision returns the recorded result, while a changed decision requires a new ID. The configured local operator supplies the reviewer identity; never add a `reviewerId` field.

```json
{
  "operationId": "44444444-4444-4444-8444-444444444444",
  "caseId": "11111111-1111-4111-8111-111111111111",
  "reportId": "55555555-5555-4555-8555-555555555555",
  "version": 1,
  "snapshotHash": "COPY_THE_64_CHARACTER_CHECKSUM_FROM_REPORT",
  "expectedRevision": 5,
  "expectedState": "AWAITING_REVIEW",
  "action": "approve",
  "dispositions": [
    {
      "findingId": "66666666-6666-4666-8666-666666666666",
      "disposition": "confirmed",
      "reason": null,
      "severityOverride": null
    }
  ]
}
```

Use finding IDs from this exact report. Omit `dispositions` or use an empty array to approve the report without confirming any finding. Confirmation, dismissal and severity overrides are recorded separately from the machine observation. Dismissals and severity overrides require a nonempty `reason`. To save dispositions without approving, use `action: "disposition"`. Each saved decision changes the case revision; read `/report` again before another operation. A stale version, checksum, revision or conversation changes no authority.

Approval freezes the reviewed snapshot, exact review events, reviewer and UTC time. The associated native workflow verifies that persisted approval and publishes the final PDF. The draft remains unchanged. `/report` returns final downloads only when every applicable artifact is durable. An explicitly confirmed actionable discrepancy in agreed-term checking produces the same correction content in the final PDF appendix and a separate editable Markdown file, labeled “Proposed correction request — not sent”. Approval alone, uncertain observations, authorized changes and ordinary document comparisons produce no correction request. Recipient and broker contact remain placeholders. Nothing is sent.

To reject a draft, use `action: "reject"` with a nonempty `reason`. Rejected and finalized cases remain readable and cannot be reopened; start another case for further work.

To revise, use `action: "revise"` and `revision: { "kind": "presentation", "note": "Explain the requested presentation change" }`. This records a request first; then send `/compare` with the current revision. Presentation revisions reuse the saved analysis without a model call and publish a new version with the request note and prior dispositions for retained findings, including their original report provenance. For new evidence or changed clarification, choose `kind: "evidence"`, attach the supporting document, repeat `/clarify` for the current sources, then `/compare`. Evidence revisions share the original processing budget and attempt limits. A `requires_evidence` disposition needs a reason and an explicit evidence revision action. Old sources, analyses, report snapshots and draft bytes remain available. New machine findings require their own dispositions. Every new report version requires fresh approval; one command cannot revise and approve unseen content.

If final publication fails after approval, the case remains approved with a safe error. Resolve storage/provider configuration and send `/report` with `retryPublication: true` to resume the same approved workflow and artifact identities, without another approval or model call. Restore a missing or damaged published file from the paired backup; retries never rewrite a completed artifact or invent an approval.

## Insurance profiles and providers

Register line/company profiles in `src/mastra/config/insurance.ts`. Each has an ID, version, categories, terminology and declarative rules with a category/key and `required` or `review` requirement. Profile rules appear separately from contractual comparisons and cannot create accepted terms or authorized changes. Change the profile version when its rules change; new analyses freeze the effective configuration while retaining earlier snapshots. Unknown categories use the same typed core rather than acquiring property-specific requirements.

Input providers registered in `src/mastra/providers.ts` implement `InputProvider`, including a request schema and immutable captured sources. The PDF provider is wired by default. Structured-record providers preserve record/field locators and captured values; comparison verifies these against the saved records and original checksum. Consumers can add adapters through the registry without changing the tools or comparator. The `draftOutput` registration selects the PDF draft provider. Output providers receive a typed immutable snapshot with stage, operation and hash bindings. They materialize a descriptor and implement `retrieve` for its bytes; core publication verifies the binding and checksum, saves its own durable private copy, and only then makes a download available. This interface also supports consumer-owned destinations without trusting an unverified URL. The default `reportOutput` provider uses the same layout for an approved final PDF. The `correctionOutput` provider creates an editable Markdown draft when applicable. Both receive the stored approval envelope and exact disposition-event set. Provider IDs and final artifact identities are reserved with approval; removing a registration cannot redirect saved work.

## Local access and persistence

Open Studio using the configured `127.0.0.1` address. Requests with another Host or Origin are rejected. The local operator and OS account are trusted; multi-tenant access is unsupported.

The private runtime folder, `.runtime` by default, contains the case database, separate Mastra history database, immutable source files and published report files. Stop the server before backing up or restoring the entire folder together. Missing or changed files produce an explicit unavailable or integrity response. Interrupted attempts and unreferenced files remain visible in recovery status; perform any manual cleanup with the server stopped.

## PDF extraction

Attach textual PDFs directly. Remote URLs, arbitrary filesystem paths, encrypted files and OCR are unsupported. Evidence uses physical page numbers, irrespective of printed labels. Blank, image-only and mixed pages have distinct extraction limitations; unextracted content cannot support absence claims.

PDF.js runs sequentially in a separate process per document, limited to 10 CPU seconds, a 15-second wall timeout, 128 MiB V8 old space, 8 MiB extraction output and four-million-pixel images. The heap limit does not impose a hard RSS or native-memory ceiling. Complex documents can fail safely within these operational bounds even when they meet the upload capacities in `src/mastra/config/limits.ts`.
