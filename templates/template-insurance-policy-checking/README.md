# Insurance Policy Checking

Capture synthetic insurance proposals, contracts and issued policies in Mastra Studio. This intake version keeps original PDFs and exact physical-page text locally, records explicit case identity and document roles, and retrieves the same evidence after a restart. Reconciliation, reports and broker review are not available yet.

## Why we built this

Policy checking starts with knowing which documents belong to a case and where each statement came from. Keeping immutable originals, searchable pages and explicit reference choices gives brokers a reliable starting point without treating an unaccepted proposal as agreed coverage.

## Prerequisites

- Use independently authored synthetic documents. The default input accepts direct textual PDF attachments, including insurance lines beyond property. Remote URLs, local paths, image-only PDFs, encrypted files and OCR are unsupported.
- No external credential is needed for deterministic intake. Conversation model dispatch is disabled while spending configuration is unavailable. Setting `OPENAI_API_KEY` alone does not enable paid calls.
- Optional local settings in `.env`: `POLICY_OPERATOR_ID` identifies the local broker (default `local-broker`), `PORT` selects the loopback port (default `4111`), and `POLICY_DATA_DIR` selects private persistence (default `.runtime` in the project root).

## Quickstart 🚀

1. **Create the project**
   - Run `npx create-mastra@latest insurance-policy-checking --template insurance-policy-checking`.
   - Run `cd insurance-policy-checking`, then `npm install`.
2. **Configure the local session**
   - Run `cp .env.example .env` and use the optional settings described above.
3. **Start Studio**
   - Run `npm run dev` and open [Mastra Studio](http://127.0.0.1:4111).
   - Select **Policy Checking**, attach two synthetic textual PDFs using **Add attachment → Add a local file**, and send a message. The intake response identifies the saved case and sources, then asks for clarification. Studio displays this deterministic response in its processor notice while model dispatch is disabled.

## Try it out

- Send `/status` to read the selected case, source hashes, physical-page counts, extraction limitations and missing clarification. Case state stays `CREATED`; captured documents are not a completed comparison.
- Send `/evidence SOURCE_ID 2`, replacing `SOURCE_ID` with a saved source ID, to read exact text from physical PDF page 2. Printed page labels do not change physical numbering.
- Attach the same PDF twice in one message. The case keeps one immutable source for identical bytes. New bytes create another source rather than overwriting history.
- Start another Studio conversation and attach a liability proposal. Return to the first conversation after restarting the server; each conversation keeps its own selected case.
- To start a fresh case in the current conversation, attach its documents with the message `/new`. Earlier source files remain in private storage.

## Customization

- Ask your coding agent: “Add an insurance line profile and a local structured-record input provider. Explore the contracts and propose a plan before changing the implementation.” Profiles live in `config/insurance.ts`; provider category arrays and explicit defaults live in `providers.ts`.
- Change `config/limits.ts`, then restart. Defaults are four documents per case, 10 MiB per PDF, 50 physical pages per PDF and 100 physical pages per case. These values feed upload schemas, parser checks and HTTP capacity. Raising capacity does not authorize model spending. Register a provider with its request schema and shared captured-source contract; structured records use real record/field locators and never invent PDF pages.

## Case clarification

The `clarify-case` tool accepts explicit intent, distinct reference and target source IDs, document roles, case identity and the expected case revision. General document comparison can use unaccepted proposals and does not require an issued policy number. Agreed-term checking additionally requires a stated accepted proposal/contract and an issued target policy. These declarations prepare intake; they do not run comparison or approve a report.

With model dispatch disabled, send `/clarify ` followed by a JSON object with the same fields. For example, replace the IDs and revision with values from `/status`:

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

## Local storage and parser limits

Keep the server bound to its configured `127.0.0.1` address and open Studio using that exact host. Requests with another Host or Origin are rejected, including generic mutation routes. The local operator and OS account remain trusted; this is not a multi-tenant access system.

The runtime folder contains the application database, separate Mastra history database and private immutable source files. Stop the server before backing up or restoring the entire folder as a pair. Missing or changed files produce an explicit unavailable/integrity response. Interrupted attempts and unreferenced files remain visible in recovery status. Cleanup is manual with the server stopped.

PDF.js runs sequentially in a separate process per document with 10 CPU seconds, a 15-second wall timeout, 128 MiB V8 old space, an 8 MiB extraction-output boundary and a four-million-pixel image guard. V8 heap limits do not impose a hard RSS/native-memory ceiling. Large or complex documents can fail safely within these operational bounds even when they meet upload capacities. Blank, image-only and mixed pages have distinct limitations; unextracted content cannot support absence claims.

## Development checks

Run `npm run format:check`, `npm run typecheck`, `npm run test:unit`, `npm run test:integration` and `npm run build`. Run `npm run test:studio` for the real installed Studio attachment/restart proof. Browser tests require Playwright Chromium; `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` can select an existing Chromium executable. Tests replace only the external paid provider with a local controlled HTTP server and make no paid model calls.

## About Mastra templates

This is an official Mastra template. Official templates live in the [Mastra monorepo](https://github.com/mastra-ai/mastra) and are synchronized to standalone repositories.

[Want to contribute?](./CONTRIBUTING.md)
