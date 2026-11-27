# Configuration

Commands load `.env` automatically; exported shell variables take precedence. See [`.env.example`](../.env.example) for defaults. Restart the server after changing settings.

## Local runtime

Use Node 24 or later; `.nvmrc` selects Node 24 for development. The pinned crawler and Chromium sandbox require a native Linux ARM64 Docker daemon. `DOCKER_PLATFORM` accepts only `linux/arm64`; AMD64 and emulation are unsupported. Setup rejects unsupported configuration before preparing runtime resources.

Use npm 11 or later to install this standalone template. A fresh manifest-only installation with npm 10.9.9 on Node 24.19.0 failed inside npm's dependency resolver with `Cannot read properties of null (reading 'edgesOut')`; the equivalent installation with npm 11.17.0 succeeded. The npm requirement preserves that working installation path; it does not imply npm 10 fails for every project. Install with `npm install --workspaces=false`.

## Local access

Generate two independent values:

```sh
node --input-type=module -e "import { randomBytes } from 'node:crypto'; console.log(randomBytes(32).toString('base64url')); console.log(randomBytes(32).toString('hex'))"
```

Set the first as `CONTROL_BOOTSTRAP_SECRET` for sign-in and the second as `SCANNER_ENCRYPTION_KEY` for stored target credentials. Keep them private and retain the encryption key across restarts.

The console listens on `127.0.0.1:4111`; change `PORT` to use another port. `CONTROL_SESSION_TTL_SECONDS` defaults to 1800 and accepts 1–3600 seconds. Sessions also end when the server stops.

`DATABASE_URL` defaults to `file:./data/security-scanner.db`. Custom names must stay under `data/`. The name `discovery-instance.db` is reserved for the runtime. Use [backup and restore](operations.md#backup-and-restore) when moving existing data.

## Targets and identities

Create a policy before its target. Set approved origins, allowed and excluded paths, methods, request limits, and authorization evidence. Excluded paths take precedence. Non-lab policies also require `retention: { evidenceDays, approvedBy }`, with 1–365 days.

Use canonical HTTP(S) target URLs without credentials, query values, fragments, percent encoding, or traversal. External REST API-key targets require HTTPS. Private addresses are accepted only through the verified project-owned Docker examples; selecting a lab label alone doesn't grant access.

Choose the profile type for your target:

- **REST API**: use separate `api_key_header` profiles and an existing account-specific access-check path. The [REST assessment guide](bola-assessment.md) covers the account identifier needed for cross-account checks.
- **Website**: use public, bearer, or header profiles. Cookie sessions use a header profile named `cookie`. Supported header names are `authorization`, `cookie`, `x-api-key`, and `x-test-identity`. Authenticated profiles need an identity endpoint returning HTTP 200 with exactly `{ "identity": "<expected identity>", "role": "<registered role>" }` within 4096 bytes.

Check identities after the final target, policy, or credential edit. Authenticated profiles must be `READY` at the current revisions. `AUTH_REQUIRED` means access was rejected or expired; `CREDENTIAL_UNAVAILABLE` requires [key recovery or credential registration](operations.md#retention-and-key-loss).

Discovery requires `SCANNER_DISCOVERY_ENABLED=true` and successful setup. A `COMPLETED_WITH_ERRORS` scan contains partial inventory: inspect its reason, role status, budgets, and cleanup before using it. Inventory alone doesn't confirm a vulnerability.

## Models and investigations

Enable `SCANNER_INVESTIGATION_ENABLED=true` and set `MORPH_API_KEY` for model-backed work. Morph is the model provider; no OpenAI credential is required. The defaults are:

| Setting          | Model                          | Role                  |
| ---------------- | ------------------------------ | --------------------- |
| `EXPLORER_MODEL` | `morph-dsv41flash-abliterated` | Nemo, Sherlock, Dupin |
| `JUDGE_MODEL`    | `morph/morph-glm53-744b`       | Watson                |

Override either model in `.env` with a compatible Morph alias available to your account. Aliases start with a letter or digit, contain only letters, digits, `.`, `_`, or `-`, and may have one leading `morph/` namespace; the whole value is limited to 128 characters. The optional namespace is removed for both models before dispatch to the fixed Morph endpoint. Validation checks alias syntax, not provider availability or structured-output compatibility. Verify those before enabling live calls with another model. Changing providers requires an [implementation change](customization.md#agents-and-models).

The explorer default is intentionally selected for creative, evidence-grounded hypotheses; Watson uses the independent judge model. Model responses cannot authorize execution, expand scope, or replace deterministic evidence. Discovery and investigation remain opt-in. Planning, recurring investigations, and advisory reassessment can make paid calls, including after restart.

For REST targets, use **Start REST assessment**. For owned-lab checks, open a completed scan in **Scans**, select **Investigate**, then **Plan investigation**. General playbook verification runs only in the owned Docker lab; active SSRF also requires a current approval and owned callback.

Lab checks use owned resources registered through `POST /api/targets/<target-id>/verification-resources`. Renew registration after target, policy, profile, or credential revisions change. Renewal creates a new ID while preserving historical bindings.

Investigation limits accept `maxRequests` 1–100, `maxDurationSeconds` 1–3600, and `maxTokens` 1–24576. The console uses 16384 tokens. Reported `usedTokens` counts conservative reservations, not provider billing. A completed job can have an inconclusive outcome or no findings.

## Advisories

With the server running, use **Synchronize advisories** or `npm run sync:advisories`. This contacts cve.now. When investigations are enabled, eligible advisories can also trigger paid planning.

An unsuccessful or inconsistent feed cycle returns `SKIPPED`. Imported pages remain visible as partial data, no hypotheses are planned for that cycle, and the next manual or scheduled attempt respects the displayed backoff.

To schedule synchronization, set all three values:

```dotenv
SCANNER_ADVISORY_SYNC_ENABLED=true
SCANNER_ADVISORY_SYNC_CRON=0 6 * * *
SCANNER_ADVISORY_SYNC_TIMEZONE=America/Sao_Paulo
```

Cron accepts five fields, each `*` or one integer, and an IANA timezone. Read `/api/advisory-schedule` for the next occurrence and revision. POST `{ "paused": true, "revision": <current revision> }` to `/api/advisory-schedule/pause` to pause; resume with `paused: false` and the new revision.

In **Vulnerabilities**, **Ignore** records a reason and scope, **Investigate** creates a manual case, and **Search scanner/checker** searches the local catalog. Advisory severity doesn't establish target relevance or a confirmed finding. Local references and playbooks remain available offline.

## API clients

Sign in with `POST /api/session` and `{ "secret": "<CONTROL_BOOTSTRAP_SECRET>" }`. Keep the returned session cookie and CSRF token in your client.

- Send the matching `Origin`, cookie, and `X-CSRF-Token` on mutations.
- Use `If-Match: "<revision>"` for policy, target, and profile updates/deletes, and advisory triage updates. Other routes declare their revision in the request body.
- Re-read a target after adding a profile. PUT replaces the complete input.
- Paginate collections with `?limit=25&offset=0`; the maximum limit is 100.

Request schemas live in [core](../src/core/contracts.ts), [discovery](../src/discovery/contracts.ts), and [investigation](../src/investigation/contracts.ts). Routes live in [`src/http/`](../src/http/). Native Mastra endpoints expose allowlisted metadata; execution uses the protected application routes. Errors return a sanitized `{ code }`.
