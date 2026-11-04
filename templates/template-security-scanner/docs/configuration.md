# Configuration

Copy `.env.example` to `.env` for a new installation. Commands load it automatically; exported shell variables take precedence. The listener uses `127.0.0.1:4111` by default. Use `PORT` to change the port.

`DATABASE_URL` accepts a relative `file:./data/<name>.db` URL. Application storage and its derived `-mastra.db` sibling must stay separate from the operational fence `discovery-instance.db`; that reserved name is rejected regardless of letter case. For a new installation, choose a name such as `security-scanner`. If existing data uses the reserved name, stop the server and preserve the directory before arranging a reviewed migration or compatible restore; do not rename an open database.

## Local sign-in and credentials

Generate two independent values:

```sh
node --input-type=module -e "import { randomBytes } from 'node:crypto'; console.log(randomBytes(32).toString('base64url')); console.log(randomBytes(32).toString('hex'))"
```

Set the first value as `CONTROL_BOOTSTRAP_SECRET` and the second as `SCANNER_ENCRYPTION_KEY`. Keep both private. `CONTROL_SESSION_TTL_SECONDS` defaults to 1800 and accepts 1–3600 seconds. Sessions expire at a fixed time and end when the server stops.

The console supports public, bearer, and header profiles. Cookie sessions use a header profile with header name `cookie`. Supported header names are `authorization`, `cookie`, `x-api-key`, and `x-test-identity`. Credentials must be printable ASCII without line breaks. An authenticated profile needs an identity endpoint returning HTTP 200 with exactly `{ "identity": "<expected identity>", "role": "<registered role>" }` within 4096 bytes. Check the identity again after changing a credential or revision.

Identity states are `CHECK_REQUIRED`, `READY`, `AUTH_REQUIRED`, `CREDENTIAL_UNAVAILABLE`, and `UNAVAILABLE`. A rejected or expired identity cannot authorize discovery. If admission reports `CREDENTIAL_METADATA_CONFLICT`, use an isolated opaque credential value that does not collide with the required metadata.

## Targets and scans

Create a policy, then a target with explicit authorization evidence, approved origins, allowed/excluded paths, methods, and finite limits. Excluded paths take precedence. Target URLs must be canonical HTTP(S) URLs without credentials, query values, fragments, percent encoding, or traversal. Non-lab policies require `retention: { evidenceDays, approvedBy }`, with 1–365 days.

Discovery requires `SCANNER_DISCOVERY_ENABLED=true` and successful `npm run setup`. Select HTTP or headless mode in **New scan**. Private and loopback destinations remain blocked; marking a target `lab` does not grant access to them. `npm run lab` supplies its own verified Docker fixture boundary.

`COMPLETED` denotes a complete scan; `COMPLETED_WITH_ERRORS` retains partial inventory. `AUTH_REQUIRED`, `FAILED`, and `CANCELLED` are distinct outcomes. Inspect the reason, budget, role status, and cleanup together. Cleanup debt blocks conflicting admission until reconciliation succeeds. Discovery inventory never confirms a vulnerability on its own.

## Investigations

Set `SCANNER_INVESTIGATION_ENABLED=true` and `MORPH_API_KEY` only after confirming access to `EXPLORER_MODEL` and `JUDGE_MODEL`. Defaults are `morph-dsv41flash-abliterated` and `morph/morph-glm53-744b`. Planning, recurrence, and advisory-triggered reassessment can make paid requests, including after restart.

In Scans, choose **Investigate** on a complete scan, then **Plan investigation**. Verification is available only through the owned Docker lab adapter; other deployments fail closed. Authenticated tests require registered identities and owned resources. Active SSRF additionally requires the exact current approval and its owned callback. Review a pending request in Approvals before deciding.

After a completed scan, register or renew an owned resource with `POST /api/targets/<target-id>/verification-resources`. Repeat registration after target, policy, profile, or credential revisions change, including identity revisions recorded by a later scan. An identical current registration returns the same ID with HTTP 200; a renewal returns a new ID with HTTP 201. Historical hypotheses keep their original IDs and cannot reuse stale authorization. Changed metadata at the same lineage returns a conflict.

API investigation admission accepts `maxRequests` 1–100, `maxDurationSeconds` 1–3600, and `maxTokens` 1–24576. The console selects 16384 tokens. `usedTokens` records conservative shared reservations across planning and review, rather than provider billing. `TOKEN_BUDGET_EXCEEDED` stops further calls. A job can complete with a blocked or inconclusive outcome. Empty findings are valid.

## Advisory synchronization

Use **Synchronize advisories** to contact cve.now manually. Local references and playbooks work offline. Imported advisory text is untrusted; version applicability remains unknown without verified version/range evidence. The inbox polls a bounded portion of the feed and displays stale status, incomplete coverage, and retry timing. A failed or inconsistent cve.now cycle reports `SKIPPED`, retains successfully imported pages as partial data, and does not plan hypotheses. The next opt-in scheduled cycle or manual attempt can retry after the persisted backoff; skipped cycles are never marked complete.

For scheduled sync, set all three values and restart:

```dotenv
SCANNER_ADVISORY_SYNC_ENABLED=true
SCANNER_ADVISORY_SYNC_CRON=0 6 * * *
SCANNER_ADVISORY_SYNC_TIMEZONE=America/Sao_Paulo
```

Cron accepts five fields, each `*` or one integer. Use an IANA timezone. Read `/api/advisory-schedule` for its revision and next occurrence; POST `{ "paused": true, "revision": <current revision> }` to `/api/advisory-schedule/pause` to pause. Resume with `paused: false` and the new revision. If investigation is enabled, eligible new or revised advisories can trigger paid planning from existing completed scans.

## API access

Mutations require the matching `Origin`, a session cookie, and `X-CSRF-Token`. PUT and DELETE for policies, targets, and profiles, plus PUT for advisory triage, require the current `If-Match: "<revision>"`. Other mutations use their route-specific revision contract. Creating a profile requires the target revision; re-read the target afterward. PUT replaces the full input. Collections use `?limit=25&offset=0`, with limit 1–100.

This local example signs in and lists targets without contacting a target or model:

```sh
node --env-file-if-exists=.env --input-type=module <<'JS'
const origin = `http://127.0.0.1:${process.env.PORT ?? 4111}`;
const login = await fetch(`${origin}/api/session`, {
  method: 'POST',
  headers: { origin, 'content-type': 'application/json' },
  body: JSON.stringify({ secret: process.env.CONTROL_BOOTSTRAP_SECRET }),
});
if (login.status !== 201) throw new Error(`Sign-in failed: ${login.status}`);
const cookie = login.headers.get('set-cookie').split(';')[0];
const response = await fetch(`${origin}/api/targets`, { headers: { origin, cookie } });
if (!response.ok) throw new Error(`Read failed: ${response.status}`);
console.log(await response.json());
JS
```

See the schemas in [`core/contracts.ts`](../src/core/contracts.ts), [`discovery/contracts.ts`](../src/discovery/contracts.ts), and [`investigation/contracts.ts`](../src/investigation/contracts.ts) for request fields, and [`http/`](../src/http/) for routes. Native Mastra endpoints expose allowlisted metadata only; execution is disabled. Errors return a sanitized `{ code }`; 400 indicates invalid input, 403 denial, 404 missing data, 409 conflict, 413 oversized input, and 503 unavailable prerequisites.
