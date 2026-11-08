# Billing components

The billing modules validate policies and persist organization accounts, commercial eligibility and immutable usage in a local libSQL file. The local provider requires no payment credentials. Initialize them separately from Mastra with `initializeBilling` from `src/billing/setup.ts`.

The configured Mastra server exposes authenticated Hono organization routes under `/billing`. It creates no anonymous identities. The lower-level commercial provider remains a trusted server API: do not expose `ensureAccount`, usage delivery or state reads without the organization service's current permission checks. Typed agent generation and persistent workflow execution use the billing gateway described below. Polar commercial services and hosted sessions are available with the explicit configuration below. Durable webhook intake and bounded delivery/recovery workers share the same SQL history and source refresh service.

## Weather gateway

The registered resources are exactly `weather-agent` and `weather-report`. Both use the static `openai/gpt-6-luna` model through the Responses API with reasoning effort `none`, one step per nested generation, no model/processor retries, and a 400-output-token limit per call. This bounds calls and output, not total input tokens or provider cost. `OPENAI_BASE_URL` is an optional trusted server configuration for an OpenAI Responses-compatible endpoint; callers cannot select models or endpoints.

The agent requires the `weather-access` subscription and charges 3 prepaid `weather-credits` per successful summary. A successful report costs 1 prepaid `weather-tasks` unit. Setup grants the shared workspace 30 credits, 10 tasks, once, plus a metered `weather-tokens` counter. It creates owner/member/outsider identities through trusted organization APIs, converts the owner's workspace, and accepts an explicit member invitation. The outsider remains in a separate personal workspace with no shared allowance.

`npm run setup` works before dependencies are installed. It never overwrites `.env`, replaces identities, rotates credentials, restores revoked access, or resets allowance. Credentials are returned once, then promptly persisted with atomic private writes under an exclusive `data/setup.lock`. SQL and the filesystem are separate commits: a crash between provisioning and writing its returned credential fails safely on retry. Restore the matching private state; there is no reset command. A stale setup lock requires checking that no setup process is active before removing that lock. Preserve both databases and `data/local-profiles.json` together. Do not copy private profiles to a different database.

`BILLING_MODE=local` permits local identities only with the local provider and loopback binding, including `npm start`. `BILLING_MODE=production` and Polar reject local identity. Without `BILLING_MODE`, production inference still follows `NODE_ENV`/`MASTRA_DEV`. Select production explicitly when integrating trusted JWT identity. Setup refuses production, Polar, JWT, or custom billing configuration so it cannot seed a paid account accidentally.

The CLI reads private bearer credentials itself; do not paste credentials into command arguments. Its default payer is the shared owner's workspace even for `--profile member` or `--profile outsider`. `--workspace <id>` selects a different authorized workspace. `--url http://127.0.0.1:<port>` selects a local port; credentials are not sent to remote URLs or followed redirects. `--key <key>` binds retries to the same operation and input. Omitting it generates a fresh key. Use `--input <file>` or `--json '<JSON>'` for caller input.

Observation input has exactly `location`, an ISO `observedAt` timestamp with timezone, `temperatureC` (-90..65), `feelsLikeC` (-100..80), `humidityPercent` (0..100), `windKph` (0..500), `precipitationChancePercent` (0..100), and `conditions`. Unknown fields and out-of-range values are rejected before model execution. Dates describe supplied observations; the template never claims they are current weather.

The workflow generates a draft, suspends at `approval`, and retains the task reservation for up to 24 hours. Resume with `{ "approved": true }` or `{ "approved": true, "observations": { ... } }` to correct the full observation object before final generation. Both nested calls belong to the workflow's one execution. Restart preserves snapshots without rerunning the draft. Resume rechecks current credential and membership; sharing a payer never grants another actor access to private reports. Failure or confirmed cancellation records zero billed units and releases its hold. Uncertain external work remains held for reconciliation.

Set `WEATHER_WORKFLOW_POLICY=tokens` before starting the server to select the alternative metered usage policy: measure actual SDK `tokens` across both nested generations and settle them only on success. Its 8192-unit policy limit rejects overflow; it is not a prepaid token or provider-cost guarantee. Canceled or failed reports still bill zero. Existing runs keep their original policy snapshot. Token observations are captured from SDK usage, but the template does not declare an enforceable total-token bound or use output limits as a prepaid token guarantee.

CLI operations map to the authenticated gateway:

| Command                | Gateway operation                                                                                                   |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------- |
| `generate`             | `POST /billing/workspaces/:workspaceId/agents/weather-agent/generate` with `{ "prompt": "<JSON weather request>" }` |
| `start`                | Create a `weather-report` run, then start it with `{ "inputData": <observations> }`                                 |
| `status <executionId>` | Read the actor's workflow projection and receipt                                                                    |
| `resume <executionId>` | Resume `approval` with the validated approval object                                                                |
| `cancel <executionId>` | Cancel the actor's workflow                                                                                         |
| `account`              | Owner-only safe confirmed meter/allowance summary                                                                   |

Raw HTTP agent requests use a JSON-encoded prompt `{ "observations": <observation object>, "purpose": "summary" }`; the gateway validates it with the same schema used by the CLI and workflow. All operations require bearer authentication; writes also require `Idempotency-Key`. Local provider balance reflection runs asynchronously through the existing recovery worker, normally within 30 seconds. Pending ledger consumption still fences admission before export. Account summaries label provider balances as `confirmedBalance`; a recent receipt may still show pending delivery. Receipts distinguish observed units, billed units, and delivery/settlement status without exposing provider identifiers or credentials.

The local proof runs actual clean-copy setup, installation, dev, build, start, controlled model HTTP and private SQL. `TEMPLATE_RUNTIME_ONLY=1` reuses dependencies and omits the clean-install/build portion while executing the same semantic journeys on another supported runtime. It never marks those journeys skipped. The explicit `npm run test:openai` command uses a disposable local account and database, the selected `OPENAI_API_KEY`, and `--live`. It makes at most one bounded generation followed by idempotent replay, rejects a missing key, and outputs only a safe proof summary. It never uses Polar credentials or an existing balance.

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

Admins may manage admin/member roles and invitations, but cannot add, demote or remove owners. Registered deterministic executors use these permissions at transactional admission. Organization-management routes do not execute resources or charge an account. The configured execution routes below use the same authorization service before admission. Actor-private records remain visible only to their initiating actor with current workspace membership, including historical records created before conversion. Owners and admins cannot read another actor's projection. The bounded `seedPrivateRecord` trusted storage contract demonstrates that boundary with a `{ text }` projection; it is not an execution engine or public write endpoint.

## Server configuration and HTTP API

`npm run dev` constructs the Mastra instance with these custom Hono routes. Run `npm run setup` first for local example identities and allowance. The default database is `data/billing.db`, the listener is `127.0.0.1:4111`, and CORS is disabled. The default path resolves against Mastra's project root, rather than its server/public working directory. `BILLING_DATABASE_URL` can select an absolute persistent file URL; its parent directory must exist. `BILLING_PORT` changes the port. Keep the database and secrets outside any static-file root. The template does not configure a static directory for private data.

Send `Authorization: Bearer <credential>` on every organization, execution and commercial request. The exact `POST /billing/webhooks/polar` endpoint uses Polar signature authentication. Use `Content-Type: application/json` and `Idempotency-Key` for every write. Workspace selection never grants membership. Mutation keys are scoped by actor, workspace and operation and retain a normalized request fingerprint; changing the input under the same key returns `409`. Invitation creation returns its token only on the first committed request, so a lost response requires a new invitation/key rather than secret recovery.

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

The supplied entry point reserves customer access for `/billing/*`. Instance middleware closes early development/browser routes, and an earlier catch-all route closes native routes that skip user middleware. Keep both parts when registering resources. Studio and native agent/workflow, streaming, asynchronous, restart, time-travel, MCP, A2A, Responses and private-data routes cannot serve as alternative customer APIs. Keep databases and source files outside static roots.

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

Use a resource/policy configuration whose measurement bound matches the executor. Usage registration requires a finite supported bound; prepaid configuration additionally requires an enforceable measurement declaration. The supplied executor contract is a trusted promise about application units, not a cap on model/provider costs. Use `MastraBilling` below for real Mastra resources and lifecycle handling. The lower-level deterministic executor API remains available for trusted server components. Configure the Polar provider as described below when using verified remote commercial sources.

Admission atomically rechecks current identity, local credential activity or verified JWT deadline, workspace membership, commercial version, idempotency and spendable credit. Provider observations occur outside SQL transactions. Version conflicts reread at most three times; unsafe or unverified commercial state returns retryable `state_unavailable`. Free work without an access guard needs no provider access. Paid access rechecks both configured entitlement and subscription validity, meter funding and current periods.

A successful invocation charges its original immutable policy once. Credit/task policies reserve their fixed units; usage reserves `maxUnits` and releases unused capacity after complete measurement. Shared prepaid allowance subtracts active reservations and settled debits until exact reflection is proven. The local provider proves immutable event payload reflection against the same versioned SQL state; reporting usage therefore never subtracts a debit twice. Reconciliation requests include at most 1,000 pending event IDs, while transactional exact-payload reflection covers older history; this request bound imposes no lifetime or pending-count limit on valid work. Metered usage reserves a bounded execution budget without subtracting prepaid credit. Ledger, reservation release, terminal state and stable outbox payload commit together. Outbox delivery remains pending; no automatic worker sends it.

Confirmed failure or cancellation writes a zero-charge ledger outcome and releases its reservation. Complete zero usage charges zero and emits no usage event. Confirmed usage above the bound becomes a failed, zero-charge outcome after termination; uncertain termination retains the hold. A thrown executor, malformed completion or unknown outcome is uncertain and never automatically rerun. Successful work with incomplete measurement stays pending with its reservation held. Missing measurement is `observedUnits: null`; a partial trusted sum is shown while `billedUnits` remains null. No invented usage, automatic refunds or recovery command releases these holds.

Keys are scoped by actor, workspace, resource and operation, with canonical JSON input fingerprints. The same key/input replays the saved result/status under the original policy even after configuration changes; different input conflicts. Concurrent same-process retries return the existing running status. A different process observing a running claim marks it uncertain rather than dispatching it again. Current authorization is required for every replay/read; other members, including owners, cannot read another actor's result. Operation tombstones and accounting history are immutable, with no destructive cleanup supplied.

Inputs and result projections contain JSON only: at most 16 KiB UTF-8, depth 12, 2,048 nodes, 256 fields/items per container, 128-character keys and 16,384-character strings. Cycles, nonfinite numbers, accessors, symbols, sparse arrays, SDK instances and prototype-sensitive keys are rejected. Keys are bounded identifiers. Fingerprinting normalizes object key order and negative zero. Persist only the projection needed by your application; results can include private content and require appropriate database access and retention controls. Receipts expose execution/policy/state/unit fields without external account identifiers or provider details.

Migration v3 appends execution claims, immutable configuration snapshots, reservations, deduplicated measurements, terminal ledger and outbox records without rewriting migrations v1/v2. All three named accounting proofs run through the public gateway with real disposable SQL, including 20 independent-process shared-credit races, rollback at outbox insertion, crash/replay uncertainty, policy/funding/outcome combinations and exact reflected-debit accounting. `npm run test:integration` includes them.

## Typed Mastra execution

Register real Mastra resources with `agentResource` and `workflowResource`, then construct `MastraBilling` with the same organization service and accounting provider. `initializeMastraBilling` opens the accounting components and a private persistent `workflow.db` beside `billing.db`. It rejects using the same file for accounting and Mastra snapshots. Keep both files and their WAL files on durable local disk; no transaction spans the two databases. Workflow setup creates the main file with owner-only permissions before opening SQLite and restricts existing WAL/SHM sidecars to the same mode. It accepts only regular files owned by the process user, rejects symbolic/hard links, and never changes a parent directory or the process umask. Use a trusted directory on a filesystem that enforces these permissions; startup cannot revoke another process's already-open descriptor or undo earlier disclosure.

The following integration assumes you have constructed fresh `agent`, `workflow`, `organizations` and `configuration` instances for this process. Bind the returned storage to that same Mastra instance before starting the expiry worker; do not reuse native workflow instances tied to a closed store. A registered workflow must set `options: { autoRestartActiveRuns: false }`; the billing lifecycle owns recovery and never automatically repeats uncertain external work.

```ts
import { Mastra } from '@mastra/core/mastra';
import { agentResource, workflowResource } from '../src/billing/mastra-resources.js';
import { initializeMastraBilling } from '../src/billing/mastra-setup.js';
import { billingOnlyServer, enforceBillingBoundary } from '../src/server/security.js';

const execution = await initializeMastraBilling({
  organizations,
  configuration,
  databaseUrl: 'file:///absolute/path/to/data/billing.db',
  agents: {
    assistant: agentResource(agent, {
      version: 'assistant-v1',
      maxSteps: 2,
      maxOutputTokens: 512,
    }),
  },
  workflows: {
    report: workflowResource(workflow, {
      version: 'report-v1',
      measurement: 'facade-calls',
      expectedCalls: [1, 1],
    }),
  },
});

export const mastra = enforceBillingBoundary(
  new Mastra({
    agents: { assistant: agent },
    workflows: { report: workflow },
    storage: execution.storage,
    server: billingOnlyServer(organizations, execution.billing.http, execution.commercial, execution.recovery),
  }),
);

await execution.startRecovery().ready;
// On application shutdown, await execution.close() before exiting.
```

`enforceBillingBoundary` installs middleware before early browser and development routes. `billingOnlyServer` also registers a denial route before native handlers, including framework-public routes that bypass user middleware. Removing either part weakens this boundary. All customer operations authenticate through the `/billing` application. Internal Mastra objects stay in trusted setup; facades return no raw agent executor or workflow run handle.

Resource adapter versions identify executable definitions and model/tool configuration. Persisted definition signatures also bind agent execution limits and workflow measurement checkpoints; billing policies are kept separately. Keep a compatible registered definition for suspended runs; changing its version causes existing runs to fail closed instead of resuming different code. Billing policy changes apply to new executions; an admitted workflow continues under its persisted policy and reservation.

### Generate and replay

```ts
const billing = execution.billing;
const context = await organizations.context({ credential, workspaceId });
const response = await billing.agent('assistant').generate('Summarize the request.', {
  billing: context,
  idempotencyKey: 'summary-123',
  abortSignal: AbortSignal.timeout(30_000),
  onStepFinish: step => console.log(step.finishReason),
});

if (response.kind === 'immediate') {
  console.log(response.result.text, response.billing.billedUnits);
} else if (response.kind === 'replay') {
  console.log(response.result?.text, response.billing.replayed);
}
```

The facade accepts bounded text prompts and the explicit callback/abort subset. Model selection, request context, processors, persistence, token limits and required measurement callbacks remain controlled by registration. Accounting capture runs before a permitted `onStepFinish` callback. Supplying additional execution options fails validation. Structured output is configured with an `outputSchema` on `agentResource`; its type carries through the actual SDK result and replay projection.

`kind: 'immediate'` contains the actual `FullOutput`, plus a separately named `projection`. `kind: 'replay'` contains only a validated projection or `null` when no output is available. The projection contains `text`, `finishReason` and optional schema-validated `object`; it never pretends to contain SDK steps, callbacks, streams or instances. HTTP returns the same projection, never the full SDK result. Projection limits are the same bounded JSON limits as accounting inputs.

### Workflow lifecycle

```ts
const run = await billing.workflow('report').createRun({
  billing: context,
  idempotencyKey: 'create-report-123',
});
await run.start({
  billing: context,
  idempotencyKey: 'start-report-123',
  inputData: { count: 0 },
});

// In a later process, obtain fresh credentials/context before loading the run.
const recovered = await billing.workflow('report').getRun({
  executionId: run.executionId,
  billing: freshContext,
});
const result = await recovered.resume({
  billing: freshContext,
  idempotencyKey: 'approve-report-123',
  step: 'approval',
  resumeData: { approved: true },
});
```

These input/resume shapes depend on your concrete registered workflow. `createRun` records a billing-owned ID without creating a Mastra run, executing a step or reserving credit. `start` admits the execution and creates its deterministic associated Mastra run. Repeated create/start/resume keys don't dispatch work again; conflicting inputs under the same operation key return `conflict`. Resume uses its own key and retains the original policy and reservation.

`getRun`, `status`, `resume` and `cancel` verify current credentials, membership, selected workspace and initiating actor before accessing snapshots or private results. Another member or owner cannot read or resume the initiating actor's run. Resume also rechecks current paid eligibility. `run.status(context)` returns only a projection with execution ID, lifecycle status, optional validated output, suspended step IDs and expiry. Full steps, raw snapshots and suspension payloads are excluded.

Workflow replies distinguish the actual immediate SDK return from persisted replay in the same way as generation. Input schemas are checked before admission, then original JSON is forwarded so the SDK applies input transforms once. Workflow output validation/transforms run once when capturing the projection. Replay checks its bounded stored envelope and matching definition, then returns that previously validated value without running schema transforms again. An output-transforming schema can therefore produce a projection different from the immediate native SDK result. The projection carries the lifecycle status; the accounting receipt can remain `running`/`reserved` while that lifecycle is suspended. A completed workflow with incomplete billable measurements exposes `uncertain` lifecycle state and pending settlement.

`run.cancel({ billing: context, idempotencyKey })` cannot reverse a completed charge. Confirmed cancellation of a suspended run releases once. Cancellation of a locally active run propagates abort and waits for execution termination. A foreign active run may persist `canceled` in Mastra while external work continues; that snapshot alone never authorizes release. Its accounting outcome remains uncertain with the hold retained. Fencing versions prevent a late owner from charging after cancel/expiry has claimed the execution.

Suspensions expire after `suspendedReservationTtlMs`, defaulting to 24 hours. The expiry worker scans immediately at startup and periodically afterward. It claims the suspension against resume/cancel, checks the actual persisted Mastra state is suspended, cancels it, then releases once. Runtime/accounting disagreement or unconfirmed termination retains an uncertain hold. The worker never restarts uncertain work. Inspect and reconcile such holds operationally; no automatic repair or destructive cleanup is provided.

### Measurements and supported bounds

Configure any needed `tokens`, `input-tokens`, `output-tokens` and `model-calls` measurements with matching meter units. Framework per-step usage is captured once with stable execution, segment, call and step identities. Aggregate `usage`/`totalUsage` is never added to those observations. A partial sum remains observable when a later call fails or omits usage. Missing values remain unknown; explicit numeric zero is a complete observation. Recovered tool errors can still produce a successful logical generation; unhandled model/workflow failures and cancellation bill zero.

| Resource and measurement                                | Supported funding  | Admission and ceiling                                                                                                                                                                                                            |
| ------------------------------------------------------- | ------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Agent model calls                                       | Prepaid or metered | `maxSteps` with SDK/processor retries disabled bounds each invocation; prepaid rejects explicit agent retries, fallback lists and dynamic model selection; nested invocations must fit the remaining call budget before dispatch |
| Agent input/output/total tokens                         | Metered            | Finite `maxUnits`, bounded prompts/steps/output requests, abort after confirmed overflow; overflow bills zero after termination                                                                                                  |
| Certified workflow facade calls and tokens              | Metered            | Required per-segment invocation counts and complete captured measurements; unsupported/unknown segments cannot dispatch                                                                                                          |
| Uncertified workflow usage or prepaid workflow usage    | Rejected           | No completeness or enforceable reservation guarantee                                                                                                                                                                             |
| Prepaid agent token usage                               | Rejected           | Request output limits don't establish a complete input/output token reservation bound                                                                                                                                            |
| Fixed credits/tasks and free/subscription-only policies | Supported for both | Existing atomic admission and one successful logical charge                                                                                                                                                                      |

An instrumented workflow declares `measurement: 'facade-calls'` and the exact number of facade generations expected in each start/resume segment. The array `[1, 1]` certifies one invocation before the first suspension and one after resume. A trusted step calls `billing.nestedAgent('assistant').generate(prompt)`; this helper works only inside an admitted execution, inherits its identity and contributes measurements to its parent without another reservation or charge. It rechecks current authorization and persists no bearer credential in snapshots.

Certify selected workflow code and verify its model requests against these checkpoints. Arbitrary raw agent/model calls, background model work, or uninstrumented nested calls are outside this measurement contract; declaring a resource doesn't automatically certify it. A mismatched invocation count or any missing billable observation prevents usage settlement. Do not mark arbitrary workflow code complete because one visible call reported usage. No application token budget promises a cap on provider monetary cost.

### Execution HTTP routes

All routes use the authenticated workspace selection and the same facade/accounting rules. Writes require `Idempotency-Key`. Bodies reject extra fields and remain limited to 16 KiB.

| Method | Path below `/billing/workspaces/:workspaceId`     | Body                                        |
| ------ | ------------------------------------------------- | ------------------------------------------- |
| POST   | `/agents/:resourceId/generate`                    | `{ "prompt": "..." }`                       |
| POST   | `/workflows/:resourceId/runs`                     | `{}`                                        |
| POST   | `/workflows/:resourceId/runs/:executionId/start`  | `{ "inputData": ... }`                      |
| POST   | `/workflows/:resourceId/runs/:executionId/resume` | `{ "step": "approval", "resumeData": ... }` |
| POST   | `/workflows/:resourceId/runs/:executionId/cancel` | `{}`                                        |
| GET    | `/workflows/:resourceId/runs/:executionId`        | No body                                     |

The installed route manifest is exercised against development and built servers with registered resources, valid customer credentials and a controlled model HTTP boundary. Native execution, private run data, streaming, asynchronous, restart/time-travel and alternate protocol requests must produce no model requests or private result disclosure. Re-run these proofs whenever Mastra dependencies change. Token streaming, durable agent resume, time travel and automatic uncertain-work retries remain unsupported.

## Polar configuration

Polar owns products, paid orders, subscriptions and benefit eligibility. The application owns prepaid grants, allocations and successful consumption. This integration uses native fetch and the pinned `Polar-Version: 2026-10` contract. It rejects a different response version and never infers a local grant from a Polar meter balance.

Set `provider: 'polar'`, omit local seeds and add a `polar` configuration to the existing resource/policy configuration:

```ts
const configuration = {
  provider: 'polar',
  resources: [
    {
      id: 'assistant',
      kind: 'agent',
      operations: ['generate'],
      policy: { version: 'v1', charge: { type: 'credits', meter: 'credits', units: 3 } },
    },
  ],
  mappings: { meters: [{ key: 'credits', unit: 'credits', funding: ['prepaid'] }] },
  polar: {
    server: 'https://sandbox-api.polar.sh',
    organizationId: sellerOrganizationId,
    grants: [
      {
        kind: 'order',
        meter: 'credits',
        version: 'credits-v1',
        productId,
        priceId,
        benefitId,
        meterId,
        units: 100,
        expiry: { type: 'none' },
      },
    ],
    meters: [{ key: 'credits', funding: 'prepaid', eventName: 'work.succeeded', unitsField: 'units' }],
    products: [{ key: 'credit-pack', productId }],
    returnUrls: ['https://app.example.com/billing'],
  },
};
const commercial = await initializeBilling({
  configuration,
  storage: { url: databaseUrl },
  polar: {
    token: process.env.POLAR_ACCESS_TOKEN!,
    webhookSecret: process.env.POLAR_WEBHOOK_SECRET,
    contact: async workspaceId => trustedWorkspaceContacts[workspaceId],
  },
});
```

Use an organization access token scoped to the configured seller. Customer and event requests rely on that token's scope; responses and stored links must still match the configured seller organization. IDs in this example are server configuration values from your own Polar account. The contact resolver returns `{ email, name? }` for that workspace from a trusted server directory. It must not use the current member's email or an unverified token claim. A stable `workspace:<workspaceId>` customer external ID resolves customer-creation conflicts and lost responses. An existing local account cannot be repurposed as a Polar account.

For recurring grants, use `kind: 'subscription'` and `expiry: { type: 'period' }`. The product must be recurring, with a matching active subscription, configured fixed price and granted, non-revoked meter-credit benefit. Each exact subscription period funds once; active free subscriptions qualify with explicit mappings even when no order exists. The provider meter cycle must match the subscription allowance cycle when a distinct cycle is configured. One-time grants require a matching paid purchase order and order-linked benefit; a zero-price paid order is valid. One-time expiry is either explicit `none` or `{ type: 'duration', milliseconds }` anchored to the verified order creation time.

The configured units must equal the verified meter-credit benefit units, with `rollover: false`. Credit products cannot attach metered overage prices. Product, benefit, source, price or immutable mapping conflicts fail closed. Renaming a logical meter or changing a mapping version cannot reissue a purchase or period. Unsupported prorations, pending plan changes, refunds and revoked sources cannot mint credit. Complete authenticated pagination and current source links are checked on every paid admission/resume; there is no cached-eligibility fallback. This is point-in-time provider evidence, rather than a transaction across Polar endpoints.

For postpaid usage, configure a logical meter with `funding: ['metered']`, and a Polar meter mapping with `funding: 'metered'`, `productId`, `priceId` and `meterId`. An active subscription must include that verified metered price. Use the existing bounded `usage` or `per-task` policy with `funding: 'metered'`. No prepaid allocations are created for that execution. Configure subscription/entitlement guards separately through `polar.subscriptions: [{ key, productId }]` and `polar.entitlements: [{ key, benefitId }]` and corresponding logical mappings.

`initializeMastraBilling` accepts the same `polar: { token, contact, webhookSecret? }` options and returns `commercial` alongside the typed execution facade. Pass that service and the returned recovery component to `billingOnlyServer(organizations, billing.http, commercial, recovery)` to expose commercial and webhook routes. Attach registered resources and the returned persistent storage to Mastra before awaiting `startRecovery().ready`. Await `close()` on application shutdown; it stops new sweeps and drains active work before closing stores. Instantiate `OrganizationService` with a verified JWT adapter and `provider: 'polar'`; local credentials are rejected in Polar mode.

The default server can expose commercial routes using `BILLING_PROVIDER=polar`, `BILLING_CONFIGURATION` containing the JSON configuration above, `BILLING_CONTACTS` containing a trusted workspace-ID-to-contact JSON object, `BILLING_JWT_CONFIGURATION` and `POLAR_ACCESS_TOKEN`. Set `POLAR_WEBHOOK_SECRET` to enable signed notifications. Provision JWT principals through trusted setup before admitting their tokens. The entry point registers `weather-agent` and `weather-report`. Supply configuration for those exact resource IDs, operations and measurements; use `initializeMastraBilling` when replacing the resources. Local example profiles and seeds are never loaded in Polar mode. Keep configuration/contact files and the private SQL file outside static roots.

### Allowance and hosted sessions

All three routes require current workspace owner permission. Checkout/portal writes also require `Idempotency-Key`:

| Method | Path below `/billing/workspaces/:workspaceId` | Body                                                                           |
| ------ | --------------------------------------------- | ------------------------------------------------------------------------------ |
| GET    | `/usage`                                      | No body                                                                        |
| POST   | `/checkout`                                   | `{ "product": "credit-pack", "returnUrl": "https://app.example.com/billing" }` |
| POST   | `/portal`                                     | `{ "returnUrl": "https://app.example.com/billing" }`                           |

Products are logical allowlisted keys and redirects must exactly match configured URLs. Admins/members cannot open billing sessions. The service checks current authorization before the provider call and before returning a new session. Completed session claims replay their original URL; a lost/uncertain provider response leaves a durable ambiguous claim, so the same key never blindly creates another session. Resolve such cases operationally before attempting a new operation. Session URLs are bearer credentials: keep them out of logs and receipts. Billing database files and SQLite sidecars use private `0600` permissions; initialization rejects unsafe links or later permission weakening.

The usage response labels `mode` and `authority`. Polar `allowance` lists each logical meter's `granted`, `consumed`, `reserved`, `unavailable` and `spendable` units from one SQL transaction. Reserved units are not spendable. Historical invalid sources remain visible and consumed history is never reset. Snapshot `confirmedBalance` excludes committed consumption but includes outstanding reservations; use the allowance's `spendable` field for available application credit. No provider meter aggregation watermark is claimed.

Reservations allocate earliest expiry first, with a stable grant-ID tie break. Expiry/revocation prevents new allocation while admitted work retains its reservation. Confirmed success consumes its allocation once; confirmed failure/cancellation releases unused units back to the same source, whose validity still applies. Release cannot resurrect revoked or expired capacity. Fresh verified reactivation may restore only unused capacity of the original source. Usage delivery acceptance, duplicate acknowledgement and outages never change these local totals.

Successful executions persist immutable outbox events. Trusted server code may explicitly deliver them through `provider.reportUsage(event)`; the driver persists both the logical event and its normalized outbound request in one immutable delivery claim. Retries reuse that request even after event-name or units-field mappings change. Previously acknowledged logical-only delivery records remain acknowledged; an uncertain legacy record without its original outbound mapping fails closed and requires operator reconciliation. The recovery worker retries durable outbox events independently of execution. A local debit does not prove a Polar invoice or completed remote delivery. Failed export never repeats compute or changes application credit.

### Signed notifications and recovery

Configure a Polar webhook endpoint for API version `2026-10` at `POST /billing/webhooks/polar`. Set `POLAR_WEBHOOK_SECRET` in the supplied server, or pass `polar.webhookSecret` to initialization. Keep this secret separate from immutable financial mappings. An omitted secret leaves webhook verification unavailable; an empty or malformed configured secret fails startup. Local mode needs no Polar token or signing secret.

The endpoint uses the pinned `@polar-sh/sdk@1.0.2` verifier from `@polar-sh/sdk/2026-10` with the original request bytes. Both modern base64 signing keys and legacy UTF-8 keys are supported by the verifier. Deliveries require `webhook-id`, `webhook-timestamp`, `webhook-signature`, `webhook-api-version: 2026-10`, and signed body `api_version: "2026-10"`. The SDK rejects signatures outside its five-minute timestamp tolerance. Bodies remain limited to 16 KiB. The exact POST path is public for signature authentication; other billing paths and methods still require bearer credentials.

A successful response is `202 { "received": true }`, returned only after durable inbox insertion or an identical duplicate. Conflicting bodies under one delivery ID return `409`; signature failure returns `401`; invalid API version returns `400`; failed durable insertion returns retryable `503`. Authenticated unknown types and notifications for unlinked customers are retained as ignored hints. The next synchronous source read still verifies any subsequently linked customer before paid work.

Relevant customer, order, subscription and benefit-grant hints invalidate that account's commercial revision immediately. Notifications contain no balance authority. Background refresh and synchronous admission/resume call the same authenticated source reader and idempotent grant application service. An older observation or expired worker lease cannot publish state. Successful application marks only covered notification generations complete in the same transaction as source effects. A newer hint requires another bounded refresh; unavailable evidence denies new paid admission. Reordered or duplicate notifications cannot mint another purchase/period allowance or erase consumption.

`BillingRecovery.runOnce()` runs one bounded sweep. `start()` exposes startup `ready`, schedules nonoverlapping ticks and uses an unreferenced timer; `stop()` drains active work. `initializeMastraBilling.startRecovery()` composes this worker with suspension expiry. Defaults are 10 deliveries and 10 accounts per sweep, a 60-second lease, and a 30-second interval. Standalone trusted integrations can construct `BillingRecovery` with `{ batchSize, leaseMs, intervalMs }`, a `RecoveryStorage` on the same billing file and an expiry callback. Network calls run outside SQL transactions.

Delivery receipts distinguish `pending`, `accepted`, `retrying`, `failed` and `uncertain`. Attempts, next-attempt time, lease ownership and safe error codes are durable; immutable outbox and original provider wire payloads stay unchanged. Retry delay grows exponentially from one second up to one hour plus bounded jitter. An uncertain response retries the original event identity. Permanent rejection stays failed for operator investigation and does not silently retry. Source fetch failures retain pending hints and a persisted retry schedule. `recovery.metrics()` exposes status counts and oldest ages without credentials, signatures or customer content.

After process death, interrupted running work becomes uncertain and retains its reservation. Recovery fences late completion and never invokes generate, start or resume automatically. Durable suspended workflows remain available for authorized resume; overdue compatible suspensions are canceled only after persisted Mastra snapshots confirm suspension and termination. Expiry claims retain durable intent, a bounded lease and a checkpoint that the compatible Mastra snapshot was suspended before cancellation. A restart can finish cancellation after a committed claim or after native cancellation but before accounting settlement, with one zero-charge release. Legacy interrupted expiry claims are adopted conservatively; a canceled snapshot without prior suspension evidence cannot release credit. Missing, active or conflicting runtime snapshots retain uncertain holds and a persisted 30-second retry schedule so they cannot starve later recoverable expirations. Live process ownership, unknown legacy ownership and reused process IDs are treated conservatively. Inspect uncertain holds and permanent delivery failures through trusted operational access; automatic financial repair, refunds and destructive resets are unavailable.

Use one Node service with persistent local SQL on the same host. SQL leases coordinate connections and restarted processes; this template does not certify multi-host deployment or exactly-once external side effects. Keep both billing and workflow snapshot files durable and private, and drain workers before closing storage.

### Polar verification

Run the deterministic integration suite with `./node_modules/.bin/vitest run tests/billing/polar.test.ts`. It uses real loopback HTTP, signed JWTs and actual libSQL, including repeated concurrent reservations, source/usage replay, invalid state and owner session boundaries. It makes no external requests. The cohesive `tests/billing/recovery.test.ts` suite additionally exercises official signature verification, HTTP intake, process death/restart, real Mastra snapshots and repeated SQL lease/source races.

The optional `node scripts/test-polar-sandbox.mjs` proof requires an explicitly selected sandbox `POLAR_ACCESS_TOKEN` and `POLAR_SANDBOX_PROOF` JSON with `{ "organizationId": "...", "databaseUrl": "file:///absolute/proof/billing.db", "contactEmail": "sandbox-fixture@example.com", "country": "BR" }`. A fresh namespaced database is derived from that base path on every invocation; previous databases are retained. Use a synthetic contact supporting plus aliases; a unique alias is derived per workspace. The script provisions disposable zero-price products, benefits, meter, customer, paid purchase and recurring subscription. It uses the actual driver/gateway and retained private SQL file, discards one real usage acknowledgement through a transparent loopback proxy, verifies replay after restart and revokes its disposable subscription. It prints only a safe proof summary and the actual database location. It never targets production or supplies a payment method. Inspect and clean up disposable sandbox resources through your operator workflow; the script does not delete financial history.

Set `POLAR_SANDBOX_DEBUG=1` when diagnosing the optional sandbox proof to print endpoint phases, HTTP status/version and selected field types/linkage booleans. These diagnostics omit response values, credentials and hosted URLs.
