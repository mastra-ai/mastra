# Operating the intake application

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

Reference and target must be distinct sources. General document comparison can use an unaccepted proposal and does not require an issued policy number. `agreed_terms_checking` additionally requires an explicitly accepted proposal or contract and an issued target policy. The response identifies missing or conflicting fields. These declarations prepare intake; they do not run comparison or approve a report. Case state remains `CREATED`.

## Local access and persistence

Open Studio using the configured `127.0.0.1` address. Requests with another Host or Origin are rejected. The local operator and OS account are trusted; multi-tenant access is unsupported.

The private runtime folder, `.runtime` by default, contains the case database, separate Mastra history database and immutable source files. Stop the server before backing up or restoring the entire folder together. Missing or changed files produce an explicit unavailable or integrity response. Interrupted attempts and unreferenced files remain visible in recovery status; perform any manual cleanup with the server stopped.

## PDF extraction

Attach textual PDFs directly. Remote URLs, arbitrary filesystem paths, encrypted files and OCR are unsupported. Evidence uses physical page numbers, irrespective of printed labels. Blank, image-only and mixed pages have distinct extraction limitations; unextracted content cannot support absence claims.

PDF.js runs sequentially in a separate process per document, limited to 10 CPU seconds, a 15-second wall timeout, 128 MiB V8 old space, 8 MiB extraction output and four-million-pixel images. The heap limit does not impose a hard RSS or native-memory ceiling. Complex documents can fail safely within these operational bounds even when they meet the upload capacities in `src/mastra/config/limits.ts`.
