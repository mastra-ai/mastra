# Verification record

Verified on 2026-10-26 (America/Sao_Paulo). All required local, live sandbox, document, Studio, and compiled-application checks passed.

## Scope and provenance

- Branch: `feat/template-accounts-payable-invoice-processing`, created from local `main` at `4ea5bca0587061b52e73c3086834e5ed906b1163`.
- Imported https://github.com/sanketagarwal/accounts-payable-invoice-processing at `e8163138d630bf6e839f4c2330d26d76306e92a7`; removed the source repository's nested Git metadata.
- All tracked changes are inside `templates/template-accounts-payable-invoice-processing`. The preexisting untracked insurance template was preserved.
- Only local conventional commits were created. No push, pull request, deployment, publication, or Sanity changes.
- External official MCP source: https://github.com/intuit/quickbooks-online-mcp-server at `31a1dd5c3e170e368dbff651abbaf61aabde6ed9`. Installed and compiled inside `.local/quickbooks-online-mcp-server`; its source checkout remains clean.
- Credentials, npm caches, the local lockfile, databases, generated invoices, and raw evidence remain ignored inside this template. No credential values were found in tracked files.

## Resolved dependencies

All five Mastra package declarations use `latest`. Published versions were queried during this run and the resolution was retained in the ignored local `package-lock.json`, in accordance with the template contribution policy.

| Package          | Resolved version |
| ---------------- | ---------------- |
| `@mastra/core`   | 1.79.0           |
| `@mastra/libsql` | 1.27.0           |
| `@mastra/mcp`    | 2.5.0            |
| `@mastra/memory` | 1.39.0           |
| `mastra`         | 1.35.0           |
| `zod`            | 4.6.7            |
| `oxfmt`          | 0.74.0           |
| `oxlint`         | 1.89.0           |

The recorded shell reports Node.js 24.19.0 and npm 11.17.0. CLI server subprocesses reported Node.js 26.8.2. The lockfile SHA-256 is `d7b6f1accae388252a8149b241f6d528773320e5ad3b4d589f150654b8b35638`; exact resolution metadata is also in `.local/evidence/resolved-versions.json`.

MCP v2 requires Zod 4. The compatibility change is the explicit string-key argument to `z.record`. The pre-change typecheck failed with TS2554; types and the original tests passed after this adjustment. No provider interface or architectural migration was required.

## Commands and results

| Check                                                              | Result                                                                                |
| ------------------------------------------------------------------ | ------------------------------------------------------------------------------------- |
| Original `npm install --workspaces=false --cache .npm-cache`       | Passed                                                                                |
| Original `npm run check`                                           | Passed: TypeScript and 12 original tests                                              |
| Original `npm run build`                                           | Passed on the network-enabled retry; the original CLI emitted a virtual-entry warning |
| Updated `npm install` and clean `npm ci`                           | Passed with the local lockfile                                                        |
| Final `MASTRA_TELEMETRY_DISABLED=1 npm run check`                  | Passed: format, lint, types, 20 local tests, and build                                |
| Official MCP stdio discovery in read-only and posting modes        | Passed: search schemas present; `create-bill` available only with writes enabled      |
| `MASTRA_TELEMETRY_DISABLED=1 npm run test:integration`             | Passed against the dedicated real sandbox, with no skipped cases                      |
| Real OpenAI PDF, PNG, and JPEG agent calls                         | Passed with `openai/gpt-5.6-sol`                                                      |
| README interaction through Studio using real OpenAI and QuickBooks | Passed for all three formats, explicit approval, and rejection                        |
| Final compiled `npm start` plus PDF request over HTTP              | Passed: real QuickBooks duplicate detected, routed to review without another Bill     |
| README links, canonical file targets, and section anchors          | Passed: 15 absolute links; canonical references use monorepo `main`                   |
| Scope, credential scan, and external MCP source integrity          | Passed                                                                                |

The local workflow suite runs real Mastra, real file-backed LibSQL, production posting locks, and the production MCP client across process restarts. Only the external accounting boundary is simulated over stdio. It covers blocked/review decisions, missing and inactive vendors, missing screening and explicit bypass, missing/mismatched POs, confidence, approval/tolerance boundaries, duplicates, provider errors and missing tools, tax configuration, forged submissions, line identity, and persistence through approval/rejection.

The separate real integration suite fails clearly when configuration is missing. This failure was verified before credentials were configured. Live execution acknowledged the dedicated sandbox realm and refused production. No test weakened assertions to obtain a pass.

## Verified correction: Bill/PO linkage

The first real integration run created Bill `146`, but reading it back showed no PO link. The original adapter sent only a header-level `LinkedTxn`. A controlled sandbox probe, Bill `147`, confirmed that a line-level `LinkedTxn` with the actual PO `TxnLineId` preserves the reference.

The production adapter now rereads the approved PO, checks that its mapped accounting data has not changed, and sends each actual PO line ID on the corresponding expense line. It retains the configured expense accounts and `create-bill` tool name. Missing or changed external PO data prevents posting.

The stdio regression failed before the fix on the missing persisted PO reference. It passed afterward, including reordered invoice lines and missing/changed PO guards. The full real integration then passed without relaxing its Bill read-back assertions.

## Real QuickBooks coverage and created records

Dedicated company: **Sandbox Company US b105**, QuickBooks Online Plus, United States. The application and OAuth connection were configured for sandbox only. Records below are fictitious; preexisting records were not deleted or altered.

| Run                                               | Vendors    | Items     | POs           | Bills         |
| ------------------------------------------------- | ---------- | --------- | ------------- | ------------- |
| Initial reproduction and PO-link probe            | 58         | 19        | 145           | 146, 147      |
| Passing real integration, prefix `APmvpusa3ha316` | 59, 60, 61 | 20        | 148, 150, 152 | 149, 151, 153 |
| Studio, prefix `STmvpuub9c`                       | 62, 63, 64 | Reused 20 | 154, 155, 156 | 157, 158      |

The passing live integration verified read-only behavior, required screening without bypass, valid below-threshold posting, Bill vendor/number/currency/amounts/expense account/PO linkage, suspension and explicit approval after restarting the process, rejection without a Bill, replay after restart without duplication, and the configured tax expense account. The tax-account contract was exercised directly through the provider using the real MCP; the local suite also exercises tax through the full workflow. Missing tax configuration created no Bill.

## Studio and compiled application

| Format | Invoice          | Run ID                                 | Result                                                       |
| ------ | ---------------- | -------------------------------------- | ------------------------------------------------------------ |
| PDF    | `STmvpuub9cpdf`  | `436c657a-d544-45bd-88fc-e7e1b3ac51d2` | USD 100 automatically posted as Bill 157                     |
| PNG    | `STmvpuub9cpng`  | `acfdba91-67eb-434b-93e8-72c622d9dde0` | USD 1,200 suspended, explicitly rejected by run ID; no Bill  |
| JPEG   | `STmvpuub9cjpeg` | `bb80f447-2432-4e0c-b3d8-4c68b9b6f672` | USD 1,300 suspended, explicitly approved by run ID; Bill 158 |

Studio used the README prompt `Process the attached invoice.` Approval and rejection used the documented prompts and the returned run IDs. Subsequent real QuickBooks reads confirmed vendors, amounts, currency, expense and AP accounts, PO references, actual PO line IDs, and absence of a Bill for the rejected PNG.

The final compiled application processed the already-posted real PDF through `/api/agents/accounts-payable-agent/generate`. It returned HTTP 200, `not_postable`, `review`, and `POSSIBLE_DUPLICATE`. The compiled verification ran with posting disabled.

Raw local evidence is preserved under `.local/evidence`, `.local/integration`, and `.local/studio-live`. Relevant files include the final check log, before/after PO regression logs, real integration logs and created-record manifests, OpenAI document results, Studio snapshots/screenshots, Bill verification, and the compiled application's request result. Credentials and raw generated artifacts are not committed.

## Documentation and operating defaults

The README follows the official template structure and preserves the original title and motivation. It documents npm installation, environment values, external MCP preparation and OAuth, the exact Studio agent and first prompt, approval/rejection by run ID, and QuickBooks' two-way matching and missing receipt/screening capabilities. All README link destinations are absolute; file targets and anchors were checked against the local template using the requested canonical `main` mapping. External service/repository destinations were opened or used during verification.

Posting remains disabled in `.env.example` and the local application `.env`; screening bypass also remains disabled in both. Live tests enabled these settings only in their explicitly dedicated sandbox processes. The integration write acknowledgement is separate from application posting.

The new scaffold slug's Sanity publication remains the user's responsibility and was not performed. Canonical README links intentionally describe the template as incorporated into monorepo `main`, as requested. No required implementation or test blockers remain.
