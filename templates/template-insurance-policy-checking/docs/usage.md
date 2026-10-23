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

The `comparePolicy` agent tool and this command both run the persisted `policyCheckingWorkflow`. Comparison extracts structured terms using OpenAI Responses, verifies quotations against captured physical pages or record fields, compares exact decimal values and preserves currency, basis, units, entity distinctions and date granularity. Changed clauses receive a separate structured semantic assessment. Similar wording alone cannot establish equivalent coverage. An omitted term is reported only against a fully reviewed scope; evidence includes the expected term and excerpts from the searched target pages or records.

Agreed-term checking applies only changes with affirmative documented approval identifying the policy, approver, term, scope and effective date. Negated, pending or conditional approval, conflicting binders and incomplete evidence require review. Uploaded instructions never approve findings or reports. General document comparison makes document observations without inferring contractual acceptance or recommending an insurer correction.

The bundled `src/mastra/config/processing.ts` intentionally sets `budget: null`. Before paid processing, supply explicitly approved values for every field of `processingBudgetSchema`: attempts, request counts, input/output and total token ceilings, cost ceiling, conservative per-token pricing assumptions, timeout and response bytes. The extraction model is configurable with `POLICY_EXTRACTION_MODEL` and defaults to `gpt-6.1-sol`; `OPENAI_API_KEY` remains the only external credential. Conversation dispatch is separately disabled. There is no automatic paid retry or fallback model. Cost estimates identify their configured pricing assumption; actual billing cost can be unavailable. Missing usage never releases a reservation as if it were free.

`/status` lists processing attempts, saved analysis IDs, classifications, limitations and profile provenance. Exact excerpts remain accessible through `/evidence`; the status notice does not resend full documents to a conversation model. An analysis can complete with unresolved observations. It creates no report, review request or approval, and the case returns to `CREATED` with a saved analysis reference. A processing failure sets `FAILED` and retains successful partial extractions privately. To retry, use the failed attempt ID as `retryAttemptId` and the current revision, preserving sources, clarification, profile, comparison date, model and budget. Retries share the original reservations and attempt ceiling. Changed inputs require an explicit new intake or clarification before a new analysis.

Interrupted work remains processing until its bounded request lease expires, then status recovery records a failure that requires an explicit retry. A restart cannot infer success or approval. While processing, source intake, `/new` and clarification cannot replace the active case.

## Insurance profiles and providers

Register line/company profiles in `src/mastra/config/insurance.ts`. Each has an ID, version, categories, terminology and declarative rules with a category/key and `required` or `review` requirement. Profile rules appear separately from contractual comparisons and cannot create accepted terms or authorized changes. Change the profile version when its rules change; new analyses freeze the effective configuration while retaining earlier snapshots. Unknown categories use the same typed core rather than acquiring property-specific requirements.

Input providers registered in `src/mastra/providers.ts` implement `InputProvider`, including a request schema and immutable captured sources. The PDF provider is wired by default. Structured-record providers preserve record/field locators and captured values; comparison verifies these against the saved records and original checksum. Consumers can add adapters through the registry without changing the tools or comparator. Output registrations remain reserved for later report support.

## Local access and persistence

Open Studio using the configured `127.0.0.1` address. Requests with another Host or Origin are rejected. The local operator and OS account are trusted; multi-tenant access is unsupported.

The private runtime folder, `.runtime` by default, contains the case database, separate Mastra history database and immutable source files. Stop the server before backing up or restoring the entire folder together. Missing or changed files produce an explicit unavailable or integrity response. Interrupted attempts and unreferenced files remain visible in recovery status; perform any manual cleanup with the server stopped.

## PDF extraction

Attach textual PDFs directly. Remote URLs, arbitrary filesystem paths, encrypted files and OCR are unsupported. Evidence uses physical page numbers, irrespective of printed labels. Blank, image-only and mixed pages have distinct extraction limitations; unextracted content cannot support absence claims.

PDF.js runs sequentially in a separate process per document, limited to 10 CPU seconds, a 15-second wall timeout, 128 MiB V8 old space, 8 MiB extraction output and four-million-pixel images. The heap limit does not impose a hard RSS or native-memory ceiling. Complex documents can fail safely within these operational bounds even when they meet the upload capacities in `src/mastra/config/limits.ts`.
