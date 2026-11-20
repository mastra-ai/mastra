# Knowledge support

Describe a support issue in Mastra Studio to investigate authorized documentation and customer records. Each turn receives bounded customer history and the current standing policy through native Knowledge pins. A separate reviewer can publish an explicit technician-confirmed outcome as private customer Knowledge or a sanitized tenant finding.

## Why we built this

Support conversations need a clear boundary between shared documentation, one customer's records, and the technician's conversation history. This template prepares relevant evidence before the model runs and preserves review before a finding becomes reusable guidance.

## Prerequisites

- **[OpenAI API key](https://platform.openai.com/api-keys)** configured as `OPENAI_API_KEY` for the default `openai/gpt-4o-mini` model.
- Node.js 24 for the local development workflow.
- Work from this local template directory.
- Studio and seeding share `SUPPORT_DATABASE_URL`, defaulting to the local `.local/support.db` file. Only persistent local file databases are supported. Export an override before both commands to use another database. The seed command reads the process environment.
- `SUPPORT_EXAMPLE` selects trusted application configuration. Its default is `retail-pos`. Use `software-integration` for the alternate example described below. Requests and model arguments cannot select an example or grant profiles.

## Quickstart 🚀

1. **Install dependencies**
   - From `templates/template-knowledge-support-agent`, run `npm ci`.
2. **Add your API key**
   - Run `cp .env.example .env` and fill in the credential from Prerequisites.
3. **Load the example documentation**
   - Preview with `npm run knowledge:seed -- --dataset retail-pos-docs --dry-run`. This validates every file without opening the database.
   - Run `npm run knowledge:seed -- --dataset retail-pos-docs`. This loads original summaries of Square network, payment, and printer references and the example team's safety policy, without customer history.
4. **Start Studio**
   - Run `npm run dev`. Studio listens on loopback at [http://127.0.0.1:4111](http://127.0.0.1:4111).
   - Open the private credential file at the path printed by the launcher locally. Copy the token for `retailops-store-42`. The terminal prints the path, never tokens. Each launch creates a separate file, expires its tokens after eight hours, and removes its file on exit.
   - Open Studio with the `auth_header` query parameter set to `Bearer <copied token>`. Keep this authorization URL private and out of recordings.
   - Select **Support**, open a new chat, and ask “My Square Terminal loses Wi-Fi connectivity. What should I check?” Expect scoped vendor evidence, diagnostic questions, and an explicit empty customer history. The conversation is stored locally.

## Try it out

- Ask “Can I factory reset while offline payments are pending?” The current pinned policy prohibits that action because those payments can be permanently lost.
- Follow the Studio walkthrough below to confirm an outcome, inspect the Curator proposal, and approve private and sanitized tenant findings independently.
- Run `npm run knowledge:seed -- --dataset retail-pos-history`, then start a fresh Store 42 chat about connectivity. Look for dated, applicable history and an open issue, with at most three preflight records.
- Switch to `retailops-store-73`, `retailops-colleague`, and `fieldretail-store-42` to inspect customer, actor, thread, and tenant isolation. A colleague at the same customer can read shared customer Knowledge while conversations remain private to each actor.
- Run the software integration example below to investigate an HTTP 401 with the same Support agent, Knowledge, Memory, authorization, and Review workflow.

## Customization

- Ask your coding agent to explore the code and propose a plan before changing it. For example, “Plan profile mappings and a dataset for our support team, including which scopes each technician and reviewer can read.”
- Replace trusted example configuration in `src/examples/runtime.ts` and register dataset directories, profiles, and mandatory policy aliases in `src/examples/datasets.ts`. Domain instructions and topic terms stay outside the Knowledge core. The policy location, customer record roots, and optional guide listing are configured in `src/examples/support.ts`.

## Studio walkthrough

Use a fresh database for the documentation-only start. Seeding is additive and never deletes previous cases. Stop Studio before changing its process configuration, then restart it with the same database to preserve Knowledge and Memory.

| Profile                | Tenant / customer          | Actor    | Grant             |
| ---------------------- | -------------------------- | -------- | ----------------- |
| `retailops-store-42`   | `retailops` / `store-42`   | `alex`   | Technician        |
| `retailops-colleague`  | `retailops` / `store-42`   | `lee`    | Technician        |
| `retailops-store-73`   | `retailops` / `store-73`   | `riley`  | Technician        |
| `fieldretail-store-42` | `fieldretail` / `store-42` | `sam`    | Technician        |
| `retailops-reviewer`   | `retailops` / `store-42`   | `morgan` | Separate reviewer |

1. **Initial Knowledge**
   - Seed only `retail-pos-docs`. As `retailops-store-42`, browse **Knowledge > support**. Inspect `docs:retailops#guides/network`, `guides/payments`, `guides/printer`, their direct vendor URLs and verification dates, the link graph, and `tenant:retailops#policies/safe-changes`. Vendor summaries and example team policy are labeled separately.
2. **First support interaction and private review**
   - Ask about intermittent Wi-Fi and provide the observed indicator and pending-payment status. After the fictional investigation, send an explicit user confirmation such as “Confirmed: The terminal had selected the guest Wi-Fi network while an adjacent device on the intended network stayed connected. No offline payments were pending. With authorization we selected the intended network and three checks succeeded. Public reference docs:retailops#guides/network, version 1.” This remains an attributed conversation observation until approval.
   - Copy the chat's thread ID and confirmed user message ID from the authenticated native Memory response, `GET /api/memory/threads/<threadId>/messages?agentId=support`, using the technician token. Keep the response private.
   - Open Studio with `retailops-reviewer`, select **Review**, and start it with the input below. Inspect the suspended `review-decision` proposal, its content, target, evidence versions, and `revision`. Resume `review-decision` with the exact revision and an approval or rejection. Rejection and nonpublication dispositions leave Knowledge unchanged.

   ```json
   {
     "threadId": "<technician thread>",
     "messageId": "<confirmed user message>",
     "sourceActorId": "alex",
     "audience": "private"
   }
   ```

   ```json
   {
     "decision": "approve",
     "revision": "<stored proposal revision>",
     "reason": "Verified the confirmed network selection and observed checks"
   }
   ```

3. **Sanitized tenant publication and reuse**
   - Start a separate Review proposal for the same confirmation with `audience` set to `tenant`. Inspect the exact sanitized text, shareable applicability, and existing public source revision before approving. Each publication requires its own approval.
   - Switch to `retailops-store-73` and start a new Support chat about an unintended Wi-Fi network. Ask it to search for reviewed findings. Look for the approved `tenant:retailops#learnings/...` citation. Riley's new thread cannot read Alex's Memory or Store 42's private case.
4. **Customer preflight**
   - Load `retail-pos-history`. Store 42 has a verified Wi-Fi case, a verified printer network case, and an unresolved Ethernet issue. Start a fresh Store 42 connectivity chat. Preflight includes at most three matching records with dates, applicability, and references. Open observations show what remains to verify. Store 73 and Field Retail have separate fictional records and attributed follow-up notes.
5. **Isolation**
   - Browse Knowledge and chat under each profile. Store 73's `RETAILOPS_STORE73_SILVER` marker and note are absent from Store 42. Field Retail's `FIELDRETAIL_STORE42_TEAL` marker and note are absent from Retail Ops, even though both use `store-42`. Direct foreign page and note lookups must be denied or return no private evidence.
   - Use `retailops-colleague` to verify shared Store 42 Knowledge and separate Memory. A fresh thread also has no previous conversation turns. The legacy `north-store` and `north-other` profiles exercise same-actor cross-customer ownership. Second-tenant conversations also have separate owners.
6. **Refreshed policy in the same thread**
   - Ask about resetting with pending offline payments. Edit the short example team policy in `knowledge-datasets/retail-pos/retail-policy.md`, for example by adding an escalation instruction. Rerun the docs seed, reload the Knowledge explorer, and continue the same chat. The next native State Signal delivers the revised policy without a search. Missing, empty, or truncated mandatory policies block actionable guidance.

The three vendor references were verified on 2026-11-20. The original summaries link to the full vendor guides. The cases, dates, technician aliases, markers, and outcomes are fictional and contain no payment data or real credentials.

## Software integration example

Use a separate local database to make the alternate example easy to inspect. Export `SUPPORT_EXAMPLE=software-integration` and `SUPPORT_DATABASE_URL=file:$PWD/.local/integration.db`, then run `npm run knowledge:seed -- --dataset software-integration` and `npm run dev` in that environment.

The generated profiles are `integration-team` (Morgan), `integration-colleague` (Taylor), and the separate `integration-reviewer` (Jamie), all for tenant `software`, customer `example-app`. Open Support as `integration-team` and ask “Our HTTP integration returned 401. What evidence should I check?” Expect the public RFC 9110 procedure at `docs:software#guides/request-check`, the standing rule at `tenant:software#policies/safe-changes`, and an applicability check against the fictional omitted-authentication case. The agent asks about the response status and challenge scheme without requesting credential values.

To exercise review, confirm an observed synthetic outcome as Morgan and repeat the same workflow with `sourceActorId` set to `morgan`, using Jamie's reviewer token. Use `docs:software#guides/request-check` and its current version for tenant publication. No Knowledge, Memory, authorization, or workflow implementation changes are needed.

## Dataset and local operation

The legacy `retail-pos` dataset remains available with its original `north-store`, `north-other`, `south-store`, and `north-colleague` tuples and seeded content. `north-reviewer` remains separate. The new retail datasets use separate scope addresses. Documentation and history use different dataset ownership markers and share contained source files through trusted manifest filename configuration.

Each manifest declares schema version `1`, stable page and note keys, relative Markdown files, source attribution, and links to aliases within that manifest. It cannot select a filesystem root or grant new profiles. Repeating a seed preserves unchanged versions and note IDs. Seed attribution is `seed:<dataset>`. Preserve the exact ownership markers. Removed entries are retained and reported by stored ID.

The ignored `.local/` directory contains the database and private credentials. `SUPPORT_CREDENTIALS_FILE` optionally selects an existing private credentials file. `SUPPORT_STUDIO_ROLE` optionally changes the generated and required role, defaulting to `technician`. Review is an independent trusted `review: true` grant. Removing it from the active file revokes it immediately.

Privileged writers share an exclusive lock beside the canonical database. Contention exits with code `75`. After a crash, apply the same seed with `--recover-lock` only after the owner has stopped. Recovery verifies the host and PID and refuses active or uncertain owners. If `.writer.lock.recovery` remains after interrupted recovery, stop all privileged writers, inspect the recorded path, host, and PID, verify that process has stopped, and remove only that recovery file before retrying. Never remove an active or uncertain lock. Dangling symlinks and hard-link database aliases are rejected.

Seed reruns converge after partial writes and preserve unrelated notes. Clearing a seeded note date uses native add-then-prune because omitting a date in `updateNote` preserves its previous date.

The authenticated route boundary permits Support, owned Memory, scoped Knowledge browsing, and the owned Review lifecycle for reviewers. Client-supplied models, tools, instructions, scopes, and authorization overrides are rejected. Support has viewer-only Knowledge access. A suspended `publish-review` can retry only the exact approval. An interrupted running publication can use owned `POST /api/workflows/review/restart-async?runId=<runId>` with `{}` after the previous process stops. Generic workflow mutation, reset, and trace inspection remain unavailable.

## Local telemetry and deterministic checks

LibSQL 1.31.1 provides native span storage. Mastra Observability writes filtered traces and approved metric samples as spans in the same local database. The samples include native token counts and supported cost estimates for diagnosis.

Operation spans retain only bounded operation names, native outcomes, timestamps, numeric counts, and safe usage fields. Numeric metric events use `metadata.value`, bounded `metadata.labels.operation` and `metadata.labels.status`, and optional `metadata.costContext` for allowlisted model/provider, estimate, and currency. Trace, span, and usage correlations use opaque process-scoped HMAC values. Prompts, outputs, credentials, payment information, customer and actor identifiers, page references, freeform errors, logs, scores, and feedback are excluded. The filtered exporter is the only configured exporter. Adding another exporter requires the same privacy boundary.

Operations cover authorization, preflight, required policy, search/read/list, missing evidence, reviewed finding reuse, proposals, review suspension/resumption, and publication outcomes. Native agent/model/tool/workflow durations and model usage remain observable. An upstream error records failure without manufacturing guidance or publishing Knowledge. Local operators can inspect native `listTraces` and `getTrace` through `storage.getStore('observability')` after `observability.flush()`, using the exports in `src/mastra/index.ts` and `src/mastra/observability.ts`. No telemetry HTTP routes are granted.

Run `npm run typecheck`, `npm run test:unit`, `npm run test:integration`, and `npm run format:check`. Integration checks use disposable databases, real HTTP, dev subprocesses, and a local scripted model provider. They require no real OpenAI credential and send no prompts to an external provider. The versioned synthetic baseline checks retrieval within the top five, visible citations or applicability or explicit insufficiency, isolation, review before publication, policy refresh, alternate configuration, telemetry privacy, and provider failure. Model-backed semantic evaluation is separate from deterministic checks.

## About Mastra templates

This template is under development in the [Mastra template repository](https://github.com/drantunes/mastra/tree/feat/template-knowledge-support-agent/templates/template-knowledge-support-agent). Its current first-run path uses this local directory.
