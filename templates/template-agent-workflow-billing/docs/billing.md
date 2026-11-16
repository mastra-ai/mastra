# Billing guide

Use `createBilling` to select a provider and declare commercial keys, then opt individual agents and workflows into billing. Image generation is an example workload; the billing modules do not import it. For a first local run, follow the [README](../README.md). For provider setup, follow [Autumn](autumn.md).

## Configure the application

Configure billing in [src/mastra/index.ts](../src/mastra/index.ts). The following example belongs in that file and assumes existing native `publicAgent`, `paidAgent` and `reportWorkflow` definitions:

```ts
import { Mastra } from '@mastra/core/mastra';
import { createBilling } from '../billing/integration.js';
import { registerApplicationShutdown } from '../billing/lifecycle.js';

const billing = createBilling({
  environment: process.env,
  billingKeys: { meters: [{ key: 'credits', unit: 'credits', funding: ['prepaid'] }] },
  plans: {
    allowances: [
      { key: 'starter-credits', version: 'v1', meter: 'credits', kind: 'order', units: 30, expiry: { type: 'none' } },
    ],
    offers: [{ key: 'starter', version: 'v1', allowances: [{ key: 'starter-credits', version: 'v1' }] }],
  },
});
const integration = await billing.prepare({
  agents: {
    paidAgent: billing.agent(paidAgent, {
      policy: { version: 'v1', charge: { type: 'credits', meter: 'credits', units: 1 } },
    }),
  },
  workflows: {
    report: billing.workflow(reportWorkflow, {
      policy: { version: 'v1', charge: { type: 'credits', meter: 'credits', units: 3 } },
    }),
  },
});
export const mastra = new Mastra({
  agents: { publicAgent, ...integration.agents },
  workflows: integration.workflows,
  tools: integration.tools,
  storage: integration.storage,
  logger: false,
  server: integration.server({ host: '127.0.0.1', port: 4111 }),
});
await integration.attach(mastra);
registerApplicationShutdown(billing.close);
```

1. `createBilling` collects configuration and exposes registration helpers; it does not purchase or provision a plan.
2. `billing.agent` / `billing.workflow` pair native resources with a policy. `prepare` initializes identity, provider, accounting and storage, returning native registrations plus a separate execution facade.
3. Construct your own `Mastra`, keeping your logger, tools, vectors, scorers and other options. Merge application routes/middleware through `integration.server`.
4. `attach` verifies registrations and shared workflow storage, installs the early server boundary and starts recovery. It does not patch native agent methods. Close billing on shutdown and on failed application construction.

The bundled example keeps image-specific adapters and Playground actions in [src/images/image-adapters.ts](../src/images/image-adapters.ts). Its `completion` hooks verify durable image outputs before billing confirms success; the charge amounts remain in the policies in `src/mastra/index.ts`. Native conversation integration is composed separately through [src/studio-billing/index.ts](../src/studio-billing/index.ts), as shown in the [Studio guide](studio.md#compose-your-own-conversation-agent).

An unwrapped resource stays native and uses the application's ordinary authentication. `charge: { type: 'none' }` still uses billing identity, access and idempotency. Raw server-side calls to a native agent bypass the billing facade; use `integration.billing` for protected execution. The bundled image tool additionally requires an admitted execution scope, so invoking its raw agent is not a supported free image service. OpenAI still charges the operator for any actual model calls.

## Providers and plans

`provider` defaults to `BILLING_PROVIDER`, then `local`; an explicit value must agree with the environment. `billingProvider` optionally supplies an implementation of [the provider contract](../src/billing/contracts/provider.ts). `environment` defaults to `process.env`.

| Setting             | Meaning                                                                           |
| ------------------- | --------------------------------------------------------------------------------- |
| `billingKeys`       | Logical meter, entitlement and subscription keys used by resource policies.       |
| `plans.allowances`  | Versioned prepaid quantities and expiry terms.                                    |
| `plans.offers`      | Logical commercial offers grouping allowances and access keys.                    |
| `localAccounts`     | Trusted seeds for new simulated accounts; existing balances/grants are preserved. |
| `hosted.returnUrls` | Exact allowlist for checkout and portal return URLs.                              |

Declaring `plans` never creates remote resources, attaches a subscription or grants funds. In Autumn, create the plan and its benefits there. Bind logical checkout offers with `plans: [{ key: 'pro', planId: 'studio-pro' }]` in `AUTUMN_CONFIG_FILE`; bind access separately with `subscriptions`. A plan granting credits alone does not make an agent subscription-gated. Autumn remains the authority for balances and subscription state.

`BILLING_CONFIG_FILE` optionally selects a complete JSON configuration override (`provider`, `resourcePolicies`, `billingKeys`, `catalog`, `localAccounts`, `hosted`), not a partial patch. Policies must agree with registered resources. Leave it unset to configure the application in TypeScript. Explicit missing/invalid files fail startup. Relative configuration paths resolve from the project root; secrets remain scalar environment variables.

## Choose a policy

| Policy                               | Configuration                                                                                       |
| ------------------------------------ | --------------------------------------------------------------------------------------------------- |
| Gateway-protected, no per-use charge | `charge: { type: 'none' }`                                                                          |
| Fixed credits                        | `charge: { type: 'credits', meter: 'credits', units: 1 }`                                           |
| Prepaid task                         | `charge: { type: 'per-task', meter: 'tasks', units: 1, funding: 'prepaid' }`                        |
| Measured postpaid usage              | `charge: { type: 'usage', meter: 'tokens', measure: 'tokens', maxUnits: 8192, funding: 'metered' }` |

Keys and units must exist in `billingKeys`. Quantities are integers. Unsupported capabilities reject during preparation. Autumn supports prepaid reservations and access checks; postpaid delivery is currently disabled in this driver pending verification of retry/lost-ack semantics. Local simulation also supports metered policies.

### Subscription-only access

Set a subscription requirement and no per-use charge:

```ts
// Add this key to createBilling({ billingKeys: ... }).
billingKeys: { subscriptions: ['pro'] }

// Register the protected agent with this policy.
policy: {
  version: 'pro-access-v1',
  access: { subscription: 'pro' },
  charge: { type: 'none' },
}
```

In Autumn configuration, add `"subscriptions": [{ "key": "pro", "planId": "studio-pro" }]`. Only a matching active subscription that is not past due and has not expired grants access. No credits are reserved or deducted. The current Autumn binding schema still requires at least one valid meter binding, even if this policy does not consume it; retain the walkthrough's `credits` mapping. Local simulation can omit meters entirely and seed a subscription:

```ts
localAccounts: [
  {
    workspaceId: trustedWorkspaceId,
    subscriptions: [{ key: 'pro', validFrom: '2026-01-01T00:00:00Z', validUntil: '2027-01-01T00:00:00Z' }],
  },
];
```

The subscription price and recurring collection belong to Autumn/payment configuration, not `charge: 'none'`. Model-provider costs still apply. This policy example is for a generic resource with ordinary validated output. The bundled Image Generation/Image Kit artifact persistence requires an active prepaid reservation: changing only their charge to `none` does not support subscription-only image generation. That use case needs an artifact-admission implementation that supports execution without a credit hold; keep their credit policy until then. To require both subscription and credits, combine the same `access` with a credit charge.

## Execution and settlement

Identity and live membership are checked before admission. Access policy is evaluated against the provider's current commercial state. Prepaid work reserves its budget before paid compute, confirms the same reservation after complete success and releases after confirmed failure/cancellation. Insufficient balance rejects before the business agent/model runs. Missing subscription returns `forbidden`. A chat model may already have run to select the business tool; its provider cost is separate.

Reusing the same key/input replays saved work; a changed input conflicts. A timeout does not prove zero charge. Unknown execution or settlement remains pending/uncertain until matching positive evidence arrives. Recovery never automatically repeats uncertain compute or adds a second prepaid debit. Receipts separate `executionStatus`, `settlementStatus`, `billedUnits` and `replayed`.

For nested work, declare `agentDependencies` and call `billing.nestedAgent(id).generate(prompt)` inside the workflow. Those calls share the parent's budget. Adapter options provide schemas, step/output limits, durable completion and trusted measurements; increment executable adapter versions when behavior changes and retain compatible definitions for paused runs.

Prepaid policy `reservationBudget` sets `executionMs`, `finalizationMs`, `expiryMarginMs` and `lifetimeMs`. Together with `suspendedReservationTtlMs`, these must fit the lifetime (maximum 24 hours). Application execution/finalization cutoffs precede remote expiry. Resume revalidates access and the hold. An in-budget confirmation already dispatched may settle after expiry; elapsed time, missing logs or HTTP 400/409 never establish a release.

## Invoke billed resources

From a trusted server handler, authenticate on each request:

```ts
const context = await integration.organizations.context({ credential, workspaceId });
const response = await integration.billing.agent('paidAgent').generate(prompt, {
  billing: context,
  idempotencyKey: messageId,
});
const run = await integration.billing.workflow('report').createRun({
  billing: context,
  idempotencyKey: 'report-001',
});
await run.start({ billing: context, idempotencyKey: 'report-start-001', inputData });
```

For an external frontend, call the template's authenticated billing HTTP endpoints:

```ts
const response = await fetch(`${baseUrl}/billing/workspaces/${workspaceId}/agents/image-agent/generate`, {
  method: 'POST',
  headers: {
    Authorization: `Bearer ${accessToken}`,
    'Content-Type': 'application/json',
    'Idempotency-Key': messageId,
  },
  body: JSON.stringify({ prompt: 'A blue bird in a quiet forest' }),
});
const result = await response.json();
if (!response.ok) throw new Error(result.error?.code ?? 'billing_request_failed');
```

Workflow routes under the same workspace prefix are `POST /workflows/:resourceId/runs`, `POST /workflows/:resourceId/runs/:executionId/start` (`{ inputData }`), `GET /workflows/:resourceId/runs/:executionId`, and `POST .../resume` (`{ step, resumeData }`) or `POST .../cancel` (`{}`). Writes require a stable idempotency key. Usage and hosted sessions are owner-authorized.

See the official [Mastra Client SDK](https://mastra.ai/docs/server/mastra-client) for frontend/native-agent integration and custom headers. Protected business agents deliberately reject the SDK's ordinary native generation routes; use the billing endpoints above. Decorated conversation agents use the supported native chat routes through the [Studio wrapper](studio.md). Keep Autumn/model secrets on the server.

## State and storage

The parent directory of a local billing database, including an explicit `BILLING_DATABASE_URL`, must belong to the current user and must not be writable by the group or other users. A dedicated owner-only directory (`0700`) is recommended. The template verifies directory ownership and write permissions before opening SQLite and on every transaction; database files and sidecars remain owner-only (`0600`).

`integration.storage` is the shared durable Mastra store for workflow snapshots and conversation memory. Pass an application-owned store to `createBilling({ storage })` if needed; billing initializes but does not close it. The separate `billing.db` keeps financial, identity, execution and ownership records.

Existing schemas/checksums are validated without automatic resets. The retained local meter migrations move an idle historical `weather-credits` / `image-credits` balance into `credits` without refilling or creating a second balance. Active reservations and uncertain work must settle first. Autumn balances are never migrated locally; preserve original provider/customer/feature bindings for pending settlement.
