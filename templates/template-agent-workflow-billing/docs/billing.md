# Local billing components

The billing modules validate policies and persist organization accounts, commercial eligibility and immutable usage in a local libSQL file. They require no payment credentials. Initialize them separately from Mastra with `initializeBilling` from `src/billing/setup.ts`.

The configured Mastra server exposes authenticated Hono organization routes under `/billing`. It creates no anonymous identities. The lower-level commercial provider remains a trusted server API: do not expose `ensureAccount`, usage delivery or state reads without the organization service's current permission checks. Agent/workflow execution, paid admission, Polar integration, checkout, portal sessions and webhook verification are unavailable.

## Configure an account and meter

Install dependencies with `npm install`. Use an absolute file URL and an existing writable parent directory. For example, create `data/` before selecting `file:///absolute/path/to/data/billing.db`.

```ts
import { initializeBilling } from '../src/billing/setup.js';

const billing = await initializeBilling({
  storage: { url: 'file:///absolute/path/to/data/billing.db' },
  configuration: {
    provider: 'local',
    resources: [
      {
        id: 'assistant',
        kind: 'agent',
        operations: ['generate'],
        policy: {
          version: 'v1',
          access: { entitlement: 'assistant-access' },
          charge: { type: 'credits', meter: 'assistant-credits', units: 3 },
        },
      },
    ],
    mappings: {
      entitlements: ['assistant-access'],
      meters: [{ key: 'assistant-credits', unit: 'credits', funding: ['prepaid'] }],
    },
    localAccounts: [
      {
        workspaceId: 'team',
        entitlements: [{ key: 'assistant-access', validFrom: '2026-01-01T00:00:00Z', validUntil: null }],
        meters: [{ key: 'assistant-credits', funding: 'prepaid', balance: 100 }],
      },
    ],
  },
});

try {
  const account = await billing.provider.ensureAccount({ workspaceId: 'team' });
  const event = {
    id: 'usage-1',
    executionId: 'execution-1',
    account,
    policyVersion: 'v1',
    meter: 'assistant-credits',
    units: 3,
    occurredAt: '2026-11-06T12:00:00Z',
    metadata: { resourceId: 'assistant', resourceKind: 'agent' as const },
  };

  await billing.provider.reportUsage(event); // accepted
  await billing.provider.reportUsage(event); // duplicate, no second debit
  const state = await billing.provider.getState(account); // balance 97
  const reconciliation = await billing.provider.reconcile({ account, eventIds: [event.id] });
  // reconciliation.reflectedEventIds identifies usage proven reflected locally.
} finally {
  billing.close();
}
```

Only send positive billable usage after confirmed logical success. Failed, canceled and zero-charge outcomes don't produce a billable event. This primitive doesn't validate an execution outcome or policy authorization. Keep prompts, results and credentials out of usage metadata; only `resourceId` and `resourceKind` are accepted.

Local account seeds apply once, when `ensureAccount` first creates that workspace. Reopening or changing seed values doesn't reset balances or eligibility. Accounts without a seed start with no grants or meters. Entitlements and subscriptions have separate validity windows; snapshots include only currently active grants. Meter periods are persisted boundaries, with no automatic renewal or balance reset.

## Policies and accounting

Access can require an entitlement, a subscription, or both. A `none` charge supports free or subscription-only access. Fixed `credits` use prepaid credit units. `per-task` supports agents and workflows with integer task units. `usage` requires a registered measurement with matching units and a positive `maxUnits`; prepaid measurements must declare an enforceable bound. Measurement declarations describe a resource's required capabilities, and don't themselves enforce executor limits.

Every quantity must be a safe integer. Metered meters require `balance: null` and accumulate consumption without a prepaid debit. Prepaid meters reject insufficient credit. Driver mappings use logical keys; invalid keys, duplicate mappings, unsupported operations, missing capabilities and failed-charge overrides fail initialization. Parsed configuration is deeply frozen.

An event ID claims one immutable payload across all accounts. An identical retry returns `duplicate`; changed contents or account return `BillingError` with code `conflict`. Local delivery acceptance and reconciliation are separate results. Reconciliation returns only the requested event IDs proven reflected in the same account's snapshot; missing events are omitted.

Storage uses explicit write transactions with foreign-key enforcement checked on each connection. Write-ahead logging (WAL) is required so independent readers don't block usage commits. Each transaction attempt owns and closes a single-connection client; retries don't reuse a connection with a failed statement. Lock contention retries the complete aborted transaction for up to 50 attempts with 20 ms between attempts, then returns a safe retryable error. No provider or model calls run inside a transaction.

Keep the database on persistent local disk. This component supports local files; remote URLs, sync configuration and in-memory databases are rejected. Schema history, checksums and definitions are checked transactionally. Incompatible storage stops initialization without deleting data. Preserve the database when changing application versions. No destructive reset or accounting cleanup is provided.

Run `npm run test:unit` before `npm run test:integration`. The integration suite uses disposable real databases and two independent child processes, including 20 contended duplicate-event rounds and a shared-credit overspend race. Run `npm run check` for TypeScript and formatting.

## Identities and workspaces

`OrganizationService` separates the authenticated actor from the selected workspace payer. Trusted provisioning creates a persistent identity, personal workspace and owner membership in one SQL transaction. Explicit owner conversion changes that same workspace to `shared`; its ID and commercial history remain unchanged. Invitations cannot share a personal workspace before conversion.

Local identities use generated 256-bit opaque credentials, stored only as SHA-256 hashes. Provision identities from trusted application setup, never an unauthenticated HTTP endpoint:

```ts
import { OrganizationService } from '../src/billing/organizations.js';
import { OrganizationStorage } from '../src/billing/storage/organizations.js';

const storage = await OrganizationStorage.open({ url: 'file:///absolute/path/to/data/billing.db' });
const organizations = new OrganizationService(storage, { mode: 'local', provider: 'local' });

const alice = await organizations.provisionLocal({ profileId: 'alice', displayName: 'Alice' });
const bob = await organizations.provisionLocal({ profileId: 'bob', displayName: 'Bob' });
// Deliver each non-null credential privately to its identity. It is returned once.
// Reprovisioning the same profile returns the same IDs and credential: null.

const owner = await organizations.context({ credential: alice.credential! });
await organizations.convert(owner, 'share-personal-workspace');
const invitation = await organizations.invite(owner, 'invite-bob', {
  recipientId: bob.identity.id,
  role: 'member',
  expiresAt: new Date(Date.now() + 3_600_000).toISOString(),
});
// Deliver invitation.token privately. Retrying the same key returns token: null.
await organizations.acceptInvitation({ credential: bob.credential!, key: 'accept-alice', token: invitation.token! });
const member = await organizations.context({ credential: bob.credential!, workspaceId: alice.workspaceId });
// owner.actorId !== member.actorId; both select alice.workspaceId as payer.
organizations.close();
```

Context objects are bound to their originating service; serialized copies cannot authorize operations. Every consuming operation reauthenticates credentials and checks current identity activity, membership and permissions. Revocation, membership removal and role changes invalidate old access. Store credentials in the application's secret store: there is no password, session, credential-recovery or email-delivery service. Trusted operators can revoke a local credential with `storage.revokeCredential(credential)` or deactivate an identity with `storage.setIdentityActive(id, false)`. Reprovisioning does not recover a lost secret or reactivate an identity.

Invitation acceptance authenticates its existing, verified recipient identity. Tokens contain no trusted identity claims, are stored only as hashes, expire, and can add a membership once. A retry with the original key returns the existing membership only while that recipient still has access; a different acceptance key cannot reuse the token. Concurrent role changes/removals count owners within the same SQL write transaction, so at least one owner remains.

| Role   | Execute permitted resources | Manage non-owner members | Billing and ownership |
| ------ | --------------------------- | ------------------------ | --------------------- |
| Owner  | Yes                         | Yes                      | Yes                   |
| Admin  | Yes                         | Yes                      | No                    |
| Member | Yes                         | No                       | No                    |

Admins may manage admin/member roles and invitations, but cannot add, demote or remove owners. Registered deterministic executors use these permissions at transactional admission. The HTTP routes do not execute resources or charge an account. Actor-private records remain visible only to their initiating actor with current workspace membership, including historical records created before conversion. Owners and admins cannot read another actor's projection. The bounded `seedPrivateRecord` trusted storage contract demonstrates that boundary with a `{ text }` projection; it is not an execution engine or public write endpoint.

## Server configuration and HTTP API

`npm run dev` constructs the Mastra instance with these custom Hono routes. The default database is `data/billing.db`, the listener is `127.0.0.1:4111`, and CORS is disabled. The default path resolves against Mastra's project root, rather than its server/public working directory. `BILLING_DATABASE_URL` can select an absolute persistent file URL; its parent directory must exist. `BILLING_PORT` changes the port. Keep the database and secrets outside any static-file root. The template does not configure a static directory for private data.

Send `Authorization: Bearer <credential>` on every request. Use `Content-Type: application/json` and `Idempotency-Key` for every write. Workspace selection never grants membership. Mutation keys are scoped by actor, workspace and operation and retain a normalized request fingerprint; changing the input under the same key returns `409`. Invitation creation returns its token only on the first committed request, so a lost response requires a new invitation/key rather than secret recovery.

| Method | Path                                                         | Input / behavior                                                      |
| ------ | ------------------------------------------------------------ | --------------------------------------------------------------------- |
| GET    | `/billing/context`                                           | Resolve the actor's original personal/converted workspace             |
| GET    | `/billing/workspaces/:workspaceId`                           | Resolve selected workspace and current role                           |
| POST   | `/billing/workspaces/:workspaceId/convert`                   | `{}`; explicit owner conversion                                       |
| POST   | `/billing/workspaces/:workspaceId/invitations`               | `{ recipientId, role, expiresAt }`; verified persistent recipient ID  |
| POST   | `/billing/invitations/accept`                                | `{ token }`; recipient authentication, no prior target membership     |
| GET    | `/billing/workspaces/:workspaceId/members`                   | Owner/admin membership list                                           |
| PATCH  | `/billing/workspaces/:workspaceId/members`                   | `{ memberId, role }`; `role: null` removes membership                 |
| GET    | `/billing/workspaces/:workspaceId/billing-access`            | Check owner billing-management permission; creates no payment session |
| GET    | `/billing/workspaces/:workspaceId/private-records/:recordId` | Initiating-actor-only bounded projection                              |

HTTP request bodies are limited to 16 KiB before JSON parsing; oversized requests return `413`. Schemas reject additional body fields, including actor/account/payer overrides. Safe JSON errors use `401` for invalid credentials, `403` for denied access, `400` for invalid input, `409` for conflicts and `503` for storage failure. Private records do not distinguish missing from unauthorized records. The server does not log credentials or include them in persisted replay results.

No agent/workflow resources are registered yet. This template therefore has no native billable resource path; future execution integration must close Mastra's native/protocol paths before adding resources. Studio is developer tooling. Do not add private database/source files to a static root or deploy developer tooling as an alternative customer API.

## Optional JWT identities

Use `JwtIdentityAdapter` for production, with a fixed trusted public JWKS, issuer, audience and explicit asymmetric algorithms. The adapter verifies signature, `iss`, `aud`, mandatory nonempty `sub`, mandatory `exp`, and applicable `nbf`. It ignores token-supplied key URLs and email for trust decisions. Tokens cannot provision accounts: trusted setup must bind `(issuer, subject)` to an internal identity with `organizations.provisionJwt({ issuer, subject, displayName })` first.

```ts
import { JwtIdentityAdapter } from '../src/billing/identity.js';

const identity = new JwtIdentityAdapter(storage, {
  issuer: 'https://identity.example',
  audience: 'billing-api',
  algorithms: ['ES256'],
  jwks: { keys: [trustedPublicJwk] },
});
const organizations = new OrganizationService(storage, { identity, mode: 'production', provider: 'local' });
await organizations.provisionJwt({ issuer: 'https://identity.example', subject: 'user-123', displayName: 'Alice' });
```

For the supplied Mastra configuration, set `BILLING_JWT_CONFIGURATION` to JSON containing `issuer`, `audience`, `algorithms` and public `jwks`. Outside the Mastra development lifecycle (`MASTRA_DEV=true`), `NODE_ENV=production` rejects local identity at startup; Polar selection also rejects local identity. JWT key rotation requires updating trusted configuration/restarting; no remote discovery or account service is included. Use an external identity provider for token issuance, authentication flows and key lifecycle. Never place private signing keys in this configuration. The production identity example does not enable Polar payments.

Migration v2 adds identity and organization records without changing migration v1 or commercial balances. Keep the database durable, restrict filesystem access, and back it up before upgrades. No destructive reset, automatic result sharing or cleanup is provided. The integration suite includes actual Mastra serving, real JOSE verification and 20 independent-process races each for invitation replay and competing owner removal/demotion.

## Transactional execution accounting

`BillingGateway` coordinates registered, trusted deterministic executors independently of a payment provider or HTTP transport. Construct it with the existing `OrganizationService`, an `AccountingStorage` opened on the same database, the billing provider, validated configuration and one executor for each configured `generate` or `start` operation. Executor code is trusted application setup; never accept executor registrations or outcome measurements from clients. `resume` and `cancel` lifecycle requests are unavailable in this layer. A trusted executor can report a confirmed canceled outcome.

```ts
import { BillingGateway } from '../src/billing/gateway.js';
import { AccountingStorage } from '../src/billing/storage/accounting.js';

const accounting = await AccountingStorage.open({ url: databaseUrl }, organizations.storage);
const gateway = new BillingGateway(organizations, accounting, provider, configuration, [
  {
    resourceId: 'assistant',
    operation: 'generate',
    measurements: [{ key: 'token-count', maxUnits: 100 }],
    async execute(input, budget) {
      // Implement a bounded deterministic application operation here.
      // Report only trusted observations after the operation has stopped.
      return {
        status: 'succeeded',
        result: { text: 'Completed' },
        measurements: [{ id: 'call-1', measure: 'token-count', units: 4 }],
        measurementComplete: true,
      };
    },
  },
]);
const response = await gateway.execute(context, {
  resourceId: 'assistant',
  operation: 'generate',
  idempotencyKey: 'request-123',
  input: { prompt: 'Hello' },
});
const receipt = await gateway.read(context, response.billing.executionId);
```

Use a resource/policy configuration whose measurement bound matches the executor. Usage registration requires a finite supported bound; prepaid configuration additionally requires an enforceable measurement declaration. The supplied executor contract is a trusted promise about application units, not a cap on model/provider costs. No Mastra resource adapter, customer execution HTTP route, workflow lifecycle, suspension recovery or Polar driver is included yet.

Admission atomically rechecks current identity, local credential activity or verified JWT deadline, workspace membership, commercial version, idempotency and spendable credit. Provider observations occur outside SQL transactions. Version conflicts reread at most three times; unsafe or unverified commercial state returns retryable `state_unavailable`. Free work without an access guard needs no provider access. Paid access rechecks both configured entitlement and subscription validity, meter funding and current periods.

A successful invocation charges its original immutable policy once. Credit/task policies reserve their fixed units; usage reserves `maxUnits` and releases unused capacity after complete measurement. Shared prepaid allowance subtracts active reservations and settled debits until exact reflection is proven. The local provider proves immutable event payload reflection against the same versioned SQL state; reporting usage therefore never subtracts a debit twice. Reconciliation requests include at most 1,000 pending event IDs, while transactional exact-payload reflection covers older history; this request bound imposes no lifetime or pending-count limit on valid work. Metered usage reserves a bounded execution budget without subtracting prepaid credit. Ledger, reservation release, terminal state and stable outbox payload commit together. Outbox delivery remains pending; no automatic worker sends it.

Confirmed failure or cancellation writes a zero-charge ledger outcome and releases its reservation. Complete zero usage charges zero and emits no usage event. Confirmed usage above the bound becomes a failed, zero-charge outcome after termination; uncertain termination retains the hold. A thrown executor, malformed completion or unknown outcome is uncertain and never automatically rerun. Successful work with incomplete measurement stays pending with its reservation held. Missing measurement is `observedUnits: null`; a partial trusted sum is shown while `billedUnits` remains null. No invented usage, automatic refunds or recovery command releases these holds.

Keys are scoped by actor, workspace, resource and operation, with canonical JSON input fingerprints. The same key/input replays the saved result/status under the original policy even after configuration changes; different input conflicts. Concurrent same-process retries return the existing running status. A different process observing a running claim marks it uncertain rather than dispatching it again. Current authorization is required for every replay/read; other members, including owners, cannot read another actor's result. Operation tombstones and accounting history are immutable, with no destructive cleanup supplied.

Inputs and result projections contain JSON only: at most 16 KiB UTF-8, depth 12, 2,048 nodes, 256 fields/items per container, 128-character keys and 16,384-character strings. Cycles, nonfinite numbers, accessors, symbols, sparse arrays, SDK instances and prototype-sensitive keys are rejected. Keys are bounded identifiers. Fingerprinting normalizes object key order and negative zero. Persist only the projection needed by your application; results can include private content and require appropriate database access and retention controls. Receipts expose execution/policy/state/unit fields without external account identifiers or provider details.

Migration v3 appends execution claims, immutable configuration snapshots, reservations, deduplicated measurements, terminal ledger and outbox records without rewriting migrations v1/v2. All three named accounting proofs run through the public gateway with real disposable SQL, including 20 independent-process shared-credit races, rollback at outbox insertion, crash/replay uncertainty, policy/funding/outcome combinations and exact reflected-debit accounting. `npm run test:integration` includes them.
