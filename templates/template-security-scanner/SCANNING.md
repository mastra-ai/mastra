# Discovery operation

Discovery is an explicit, bounded operation on an authorized target. It creates inventory and sanitized evidence, not confirmed vulnerability findings. The full setup currently supports native `linux/arm64` only.

## Enable admission

Complete `npm run setup`, configure the protected operator session and encryption key described in [local API operation](CONTROL_PLANE.md), and explicitly set `SCANNER_DISCOVERY_ENABLED=true` in the private `.env` before starting the server. The default remains false. `npm run doctor` and `GET /api/runtime` report effective admission readiness. A missing or stale capability receipt fails closed; rerun setup after changing runtime sources or inputs.

The listener binds to literal loopback. Session, exact Host/Origin, CSRF, ownership, revisions and body limits apply to discovery routes as well as control-plane routes. Native Mastra execution routes remain blocked. Only one process and one active discovery may own an installation at a time; there is no automatic retry, lease scheduler or recurring scan worker.

Authorize only HTTP(S) origins and paths you own or have explicit permission to assess. Exclusions override inclusions. A target's `lab` environment alone does not permit private-network access. The metadata-only loopback example in CONTROL_PLANE.md is not a runnable discovery target. For ordinary discovery, register an authorized public origin and verify its policy/profile bindings first. Non-lab targets require an operator-selected `retention: { evidenceDays, approvedBy }` policy; no retention period is inferred.

## Admit and read a scan

Use the authenticated `api` helper from [the local API example](CONTROL_PLANE.md#first-interaction). After creating your authorized target, public profile and policy, re-read their current metadata and submit:

```js
const current = await api(`/api/targets/${target.id}`);
const selected = await api(`/api/targets/${target.id}/profiles/${profile.id}`);
const scan = await api(`/api/targets/${target.id}/scans`, 'POST', {
  targetRevision: current.revision,
  policyRevision: policy.revision,
  mode: 'http',
  idempotencyKey: crypto.randomUUID(),
  profiles: [
    {
      targetRevision: current.revision,
      policyRevision: policy.revision,
      profileId: selected.id,
      profileRevision: selected.revision,
      credentialRevision: selected.credentialRevision,
    },
  ],
});
console.log({ scanId: scan.id, jobId: scan.jobId, state: scan.state });
```

Admission returns 202 only after committing the scan and its linked job. A matching idempotency key/request returns that same scan; changing the request under the key returns 409. Stale bindings and concurrent admission return 409 without silently substituting new revisions or starting extra work. Profiles run sequentially under one shared request, byte, duration and concurrency budget. Select `mode: 'headless'` for the sandboxed browser and separate XHR observations. Supported operations do not submit forms or authorize POST/PUT/PATCH/DELETE traffic.

| Method | Route                      | Behavior                                                          |
| ------ | -------------------------- | ----------------------------------------------------------------- |
| GET    | `/api/scans`               | Paginated scans owned by the operator                             |
| GET    | `/api/targets/:id/scans`   | Paginated scans for the owned target                              |
| GET    | `/api/scans/:id`           | Persisted state, reasons, per-role counters, budgets and cleanup  |
| GET    | `/api/scans/:id/inventory` | Paginated sanitized observations with evidence provenance         |
| GET    | `/api/scans/:id/evidence`  | The retained sanitized evidence records                           |
| POST   | `/api/scans/:id/cancel`    | Empty object; await bounded owned cleanup and record cancellation |

Read collections with `?limit=100&offset=0`; limits and offsets follow the control-plane contract. Poll the scan until terminal. Cancel with `await api('/api/scans/' + scan.id + '/cancel', 'POST', {})`. Repeating cancellation on a terminal scan does not reopen it.

## Authenticated profiles

Public profiles need no credential. Header and bearer profiles use their registered safe identity endpoint before and after discovery. Cookie sessions use `kind: 'header'` and header name `cookie`. Credentials are resolved inside trusted runtime memory, staged in a mode-0600 per-profile file, and excluded from arguments, API output, ordinary logs and evidence. Each profile gets its own sandbox and browser/NSS state; headers cannot cross roles or origins.

The identity endpoint must return HTTP 200 with exactly `{ identity, role }` matching its registered expectations. Login redirects, expired profiles, rejection and account mismatch produce `AUTH_REQUIRED`. A recorded authentication failure blocks subsequent authenticated discovery until the credential/session is repaired and checked. A transport or malformed/oversized identity response is unavailable rather than a successful authentication result. Missing/wrong encryption keys never fall back to plaintext.

Credential-aware guards also protect fixed metadata. A cookie fragment such as `locale=en` can collide with ordinary metadata containing that value. Such a profile can be registered but admission returns `CREDENTIAL_METADATA_CONFLICT` before persisting a scan or contacting the target. Use an appropriately isolated opaque session value or adjust the profile under your application's authentication contract. This conservative rejection is intentional; support for cookie sessions does not mean all arbitrary cookie combinations are accepted.

## Inventory and provenance

Each retained record has target/scan identity, observation time, profile/role, source, sanitized observation, SHA-256 and optional expiry. The scan links the exact target, policy, profile and credential revisions. Values are minimized to canonical origin/path, allowlisted method, parameter names, kind and source. Query values, raw response bodies and arbitrary metadata are not exported.

An HTTP endpoint can claim `upstream-response` and a status only when the trusted gateway observed the real response. A genuine upstream 403 remains legitimate inventory. Local policy denials are withheld; unverified transport responses cannot claim target status. Forms, XHR and browser-visible surfaces use `advertised` provenance with no upstream status claim, even if a browser response copies a visible marker. Discovery evidence always has `confirmationEligible: false`. No technology version is inferred from unknown evidence.

Raw Katana stdout/stderr exists only in bounded, private ephemeral trusted memory. Native retained output buffers remain disabled. The incremental parser has finite line, total-byte, record and exported-size bounds. It counts malformed, secret-bearing, withheld and minimized fields without retaining their contents. Unsafe fields are discarded before persistence or API export while safe neighboring inventory remains useful. Partial or withheld evidence never confirms a finding.

## Lifecycle, retention and cleanup

`COMPLETED` means discovery finished within its supported boundary. `COMPLETED_WITH_ERRORS` preserves useful partial inventory and sanitized counters for withholding, local denials, unverified responses, output bounds or exhausted budgets. `AUTH_REQUIRED`, `FAILED` and `CANCELLED` preserve their distinct meaning. Inspect `reason`, `diagnostic`, role identity, `partial`, `budget` and `cleanup` together.

Shared budgets are reserved atomically before upstream contact. Concurrency release never refunds consumed requests or bytes. Exhaustion stops further dispatch and records the exhausted dimension. Crashed or interrupted work with uncertain consumption records an unknown exhausted budget; it never restores capacity or resumes crawling automatically.

Target, policy or profile mutations quiesce affected work before committing a new revision. Cancellation and shutdown await owned cleanup. Restart reconciles interrupted work as failed, removes only its recorded resources and preserves unrelated containers/networks and shared-image consumers. `cleanup: DEBT` or an unfinished cancellation remains visible and blocks conflicting admission until reconciliation succeeds. No global Docker pruning is used.

Evidence expiration uses the operator's selected retention period. Deletion atomically increments persisted `evidenceRetention.expiredCount` and records `lastExpiredAt`, so empty inventory after expiry is distinguishable from a scan that found no retained evidence. These counts survive restart. Expiration does not invent a new discovery outcome or restore deleted raw evidence.

## Local verification

`npm run test:unit` checks pure schemas, bounded parsing and existing control-plane regressions. `npm run test:discovery` selects four real discovery API/native/libSQL proofs, including shutdown during admission, and `npm run test:gateway` selects the two real gateway proofs. These use only project-owned Docker fixtures and ephemeral credentials; their private runner exports fixed outcomes and counts, validates every required selected test, binds results to a stable source digest, and cleans owned resources after a test-worker crash or timeout.

`npm run check:gateway -- format`, `-- style` and `-- unit` run check-only Python validation in a pinned, capability-free, network-disabled container. Ruff 0.16.9 checks formatting/lint for the policy, policy unit tests and durable Python fixtures; mypy 1.20.2 checks the typed policy/unit contract strictly under Python 3.15; unittest must execute nonempty policy tests. Inputs are integrity-pinned under `docker/validation/`. The developer-only `format-write` selector explicitly formats those Python sources; it is not a verification command. Downloading validation wheels is preparation, and the container build itself is offline.
