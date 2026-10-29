# Local control plane

The API manages one local operator's policies, explicitly authorized targets, and public, header, or bearer identity profiles. It binds only to `127.0.0.1`. All state lives in the configured file-backed libSQL database. Discovery and confined identity checks are opt-in after runtime setup. Native agent/workflow execution, model requests, recurrence, and general queue execution remain unavailable. See [discovery operation](SCANNING.md).

## Operator configuration

Generate two independent values locally using `node --input-type=module -e "import { randomBytes } from 'node:crypto'; console.log(randomBytes(32).toString('base64url')); console.log(randomBytes(32).toString('hex'))"`. Put the first value in `CONTROL_BOOTSTRAP_SECRET` and the second in `SCANNER_ENCRYPTION_KEY` in your private `.env`. Do not put these values in URLs or source control.

`CONTROL_SESSION_TTL_SECONDS` accepts an integer from 1 through 3600 and defaults to 1800. Sessions have a fixed expiration, require login again after expiration, and are discarded when the server stops. The bootstrap secret creates a session through `POST /api/session`; it is never returned by the API. Session cookies use `HttpOnly`, `SameSite=Strict`, and path `/`. This local server uses HTTP on its literal loopback address.

Without a bootstrap secret, the server exposes only `GET /api/runtime`. With one configured, that same sanitized diagnostic remains readable without a session. All requests require the exact bound Host, and an Origin header, when present, must match the server origin. All mutations require that matching Origin. Except for session creation, mutations also require the session cookie and its `X-CSRF-Token`.

The operator key is used for AES-256-GCM credential envelopes with independent random nonces. Authentication binds each envelope to its target, profile, role, and credential revision. Ordinary metadata and revision records contain only a sealed credential reference. Missing keys prevent secret registration; missing, wrong, or damaged keys/envelopes make existing profiles `CREDENTIAL_UNAVAILABLE`. Restore an intentionally retained original key or replace the credential through profile registration/update under the current key. There is no plaintext recovery or automatic key export.

## First interaction

Start `npm run dev` after runtime setup. In another terminal, run the following from the template directory. It loads the bootstrap secret from `.env`, establishes a session, creates an explicitly authorized lab policy and target, and prints their metadata. The example performs no network request to the target URL.

```sh
node --env-file-if-exists=.env --input-type=module <<'JS'
const origin = `http://127.0.0.1:${process.env.PORT ?? 4111}`;
const login = await fetch(`${origin}/api/session`, {
  method: 'POST',
  headers: { origin, 'content-type': 'application/json' },
  body: JSON.stringify({ secret: process.env.CONTROL_BOOTSTRAP_SECRET }),
});
if (login.status !== 201) throw new Error(`Session rejected: ${login.status}`);
const { csrfToken } = await login.json();
const cookie = login.headers.get('set-cookie').split(';')[0];
async function api(path, method = 'GET', body, revision) {
  const response = await fetch(`${origin}${path}`, {
    method,
    headers: {
      origin, cookie, 'x-csrf-token': csrfToken, 'content-type': 'application/json',
      ...(revision ? { 'if-match': `"${revision}"` } : {}),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const result = response.status === 204 ? null : await response.json();
  if (!response.ok) throw new Error(`API rejected: ${response.status} ${result.code}`);
  return result;
}
const scanLimits = {
  maxRequests: 100, maxDurationSeconds: 60,
  maxResponseBytes: 8192, maxConcurrency: 2,
};
const policy = await api('/api/policies', 'POST', {
  name: 'Owned lab read access', permittedMethods: ['GET'], scanLimits,
});
const target = await api('/api/targets', 'POST', {
  name: 'Account portal lab', entryUrl: 'http://127.0.0.1:8080/',
  approvedOrigins: ['http://127.0.0.1:8080'], allowedPaths: ['/'],
  excludedPaths: ['/account/delete'], permittedMethods: ['GET'], environment: 'lab',
  authorizationEvidenceRef: 'approval:owned-account-portal-lab', authorizationConfirmed: true,
  policyId: policy.id, policyRevision: policy.revision,
  schedule: { enabled: false, timezone: 'UTC' }, scanLimits, authProfileIds: [],
});
const profile = await api(`/api/targets/${target.id}/profiles`, 'POST', {
  name: 'Public visitor', role: 'visitor', kind: 'public',
}, target.revision);
console.log(JSON.stringify({ policy, target: await api(`/api/targets/${target.id}`), profile }, null, 2));
JS
```

For an authenticated profile, replace the profile body with a header or bearer profile. Read its credential from a private environment variable in your local client instead of putting it on a command line. For example:

```js
{
  name: 'Reader account', role: 'reader', kind: 'bearer',
  identityEndpoint: 'http://127.0.0.1:8080/identity', expectedIdentity: 'reader-account',
  credential: { value: process.env.EXAMPLE_PROFILE_TOKEN },
}
```

A header profile uses `kind: 'header'` and `credential: { name: 'cookie', value: process.env.EXAMPLE_PROFILE_COOKIE }`. Supported header names are `authorization`, `cookie`, `x-api-key`, and `x-test-identity`. Credentials must be printable ASCII without line breaks. Public profiles reject credential fields. An optional `expiresAt` uses an ISO UTC timestamp.

## Routes and revisions

Collections return `{ items, limit, offset }`. `limit` is 1–100 (default 25); `offset` is 0–1000000 (default 0). Unknown schema fields are rejected. Resource responses include an `ETag` matching the numeric `revision`. PUT replaces the full input document rather than applying a patch.

| Method           | Route                                        | Input or behavior                                                                       |
| ---------------- | -------------------------------------------- | --------------------------------------------------------------------------------------- |
| POST             | `/api/session`                               | `{ secret }`, returns `csrfToken`, expiration and operator ID, sets cookie              |
| DELETE           | `/api/session`                               | Invalidates the current session                                                         |
| GET, POST        | `/api/policies`                              | List or create a policy                                                                 |
| GET, PUT, DELETE | `/api/policies/:id`                          | Read, replace or remove a policy                                                        |
| GET              | `/api/policies/:id/revisions`                | Read retained policy revisions, newest first                                            |
| GET, POST        | `/api/targets`                               | List or create an authorized target                                                     |
| GET, PUT, DELETE | `/api/targets/:id`                           | Read, replace or remove a target                                                        |
| GET, POST        | `/api/targets/:id/profiles`                  | List or create profiles belonging to that target                                        |
| GET, PUT, DELETE | `/api/targets/:id/profiles/:profileId`       | Read metadata, replace or remove a profile                                              |
| POST             | `/api/targets/:id/profiles/:profileId/check` | Check a bound identity through the confined gateway when discovery is enabled           |
| POST             | `/api/targets/:id/scans`                     | Admit revision-bound discovery when enabled; atomically persist scan/job and return 202 |

PUT and DELETE require `If-Match: "<current revision>"`. Creating a profile requires the target's current revision in `If-Match`. Profile creation/removal updates the parent target's revision and profile IDs. Refreshing credentials increments both profile and credential revisions and removes the previous identity result. Identity checks increment the profile revision when recording their result. Re-read current metadata after each mutation.

A target's `authProfileIds` is managed through profile creation/removal. A target update must retain those IDs. Cross-target profile references are rejected. Changing policy scope creates a new policy revision; targets remain bound to their previous revision until explicitly updated. A policy referenced by a target cannot be deleted. Target deletion atomically removes its profiles, envelopes, and owned revision records.

A policy contains `name`, `permittedMethods`, and `scanLimits`. The target's methods and each limit must fit within that policy. Finite limits are: requests 1–10000, duration 1–3600 seconds, response bytes 1024–10485760, and concurrency 1–8. A policy can include an explicitly chosen `retention: { evidenceDays, approvedBy }`, with 1–365 days. Missing retention blocks non-lab scan admission before dispatch. No retention period is inferred.

Targets require a nonempty authorization evidence reference and explicit `authorizationConfirmed: true`, environment `lab`, `staging`, or `production`, canonical HTTP(S) origins, scoped paths, methods, and a current policy revision. Exclusions override allowed paths, including for the entry URL and safe identity endpoint. Path matching uses segment boundaries. URLs reject credentials, query strings, fragments, percent encoding, traversal, backslashes and noncanonical authorities. Schedules currently accept only `{ enabled: false, timezone: '<IANA timezone>' }`.

## Identity states and execution boundaries

Identity check and scan admission bodies carry all five current binding fields: `targetRevision`, `policyRevision`, `profileId`, `profileRevision`, and `credentialRevision`. They are available in the profile response's `identity` object. Send only those fields. A stale binding returns 409 without silently substituting a current revision.

| State                    | Meaning                                                                                                   |
| ------------------------ | --------------------------------------------------------------------------------------------------------- |
| `CHECK_REQUIRED`         | New or changed profile, or a stale target/policy/identity binding                                         |
| `READY`                  | Public identity, or an owned local fixture check matching both the expected identity and role             |
| `AUTH_REQUIRED`          | Expired profile, rejected session, login redirect, or account/role mismatch                               |
| `CREDENTIAL_UNAVAILABLE` | The envelope cannot be authenticated under the configured key; re-register the credential                 |
| `UNAVAILABLE`            | Unsupported remote transport, timeout, malformed response, oversized response, or other transport failure |

With discovery disabled, remote authenticated checks return `UNAVAILABLE` with reason `REMOTE_IDENTITY_DISABLED`. With discovery enabled, checks use the same confined gateway and per-role credential file as discovery. The identity endpoint must return HTTP 200 with an object containing exactly the expected `identity` and `role`, within 4096 bytes. Expiry, login redirects, rejection, or identity mismatch produce `AUTH_REQUIRED` and prevent further authenticated discovery until repaired. Re-read the profile binding after a check. Identity states are authentication/readiness information, never vulnerability verdicts.

The metadata-only loopback example above does not grant network access. Discovery rejects private, loopback, link-local, metadata and mapped-IPv6 destinations. The project-owned Docker integration laboratory supplies a separately verified fixture boundary; setting a target environment to `lab` does not create a network exception.

Authenticated GET requests can read `/native/agents`, `/native/workflows`, `/native/openapi.json`, and `/native/auth/capabilities` through the official Mastra adapter. Client `requestContext` query values are rejected there. Domain ownership comes from the verified local session and is never taken from request bodies or Mastra request context. All other native routes are denied, including execution with an authenticated session.

## Error responses

Errors return only a sanitized `{ code }`. Invalid shapes/JSON return 400; Host/Origin/session/CSRF/scope denials return 403; absent or inaccessible IDs return 404; stale revisions and conflicting transitions return 409; unavailable keys, transport prerequisites, or disabled scan execution return 503. Request bodies are limited to 16384 bytes before domain or official adapter JSON parsing, including chunked requests. Oversized bodies return 413. Responses use `Cache-Control: no-store`.
