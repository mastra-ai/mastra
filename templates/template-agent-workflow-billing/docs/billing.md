# Billing guide

Configure billing independently of your agents and workflows. The template uses `createBilling(...)` to resolve its provider and commercial configuration, optional registration wrappers to select paid resources, and an ordinary `new Mastra({...})` for the application itself.

## Configure the application

`src/mastra/index.ts` contains the provider environment, logical `credits` meter, `starter` offer, resource policies and the Mastra constructor. Example-specific factories stay in `src/mastra/agents` and `src/mastra/workflows`. Nothing in the billing integration imports the image example.

A minimal application with an existing `publicAgent`, `paidAgent` and `reportWorkflow` looks like this:

```ts
import { Mastra } from '@mastra/core/mastra';
import { createBilling } from './src/billing/integration.js';

const billing = createBilling({
  environment: process.env,
  billingKeys: {
    meters: [{ key: 'credits', unit: 'credits', funding: ['prepaid'] }],
  },
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
```

The registration wrappers pair native resources with policies. `prepare` unwraps both paid and ordinary registrations into native Mastra maps and initializes billing. `attach` verifies those registrations and the workflow snapshot domain, installs the transport boundary, then starts recovery. Call `billing.close()` during shutdown and after a failed application construction. The template registers this cleanup with `registerApplicationShutdown`.

Add unwrapped resources directly to `new Mastra({ agents, workflows })`, or include them in `prepare` if you prefer a single registration map. Resources registered without a wrapper retain native execution routes and use your ordinary Mastra authentication configuration. Protected resources execute through the billing facade and authenticated `/billing` routes. Their native execution routes stay closed, including when unwrapped resources coexist in the same application. A `charge: { type: 'none' }` policy still opts into the billing gateway and its identity/idempotency behavior; omitting the wrapper leaves the resource native.

Registration wrappers do not intercept trusted server code that deliberately calls a raw native instance. Use the facade for protected calls. Native Studio chat for protected resources is not implemented by this registration API.

## Keep your Mastra configuration

You own `new Mastra({...})`: configure logger, vectors, scorers, observability, tools and other Mastra options there. Merge your tools with `integration.tools` when Studio billing actions are enabled. Pass your Hono routes and middleware to `integration.server({ ... })`; it preserves server settings while adding the protected transport boundary. Explicit public routes retain Mastra's normal `requiresAuth` middleware semantics.

To use your own durable workflow snapshot store, pass it as `storage` to `createBilling`, then use `integration.storage` in the Mastra constructor. Billing initializes but does not close an application-owned store. Snapshot storage must remain shared between Mastra and billing recovery. `billing.db` separately retains financial and execution bookkeeping.

The lower-level `createBillingApplication({ catalog, createMastra })` remains available for catalog-based integrations. Its return value is a service bundle containing `.mastra`, not a replacement Mastra class. Its `createMastra` callback can construct a customized instance. The primary template entry point uses the explicit constructor above.

## Providers, plans and local development

`BILLING_PROVIDER=local` selects persistent simulated accounting. `BILLING_PROVIDER=autumn` selects the driver that reads `AUTUMN_SECRET_KEY` and `AUTUMN_BINDINGS`. An explicit `provider` option must agree with the environment. `billingProvider` optionally supplies an implementation of the common contract in `billing/providers/contracts.ts`.

`billingKeys` describes logical meters and access keys. `plans.allowances` defines versioned quantities and expiry terms; `plans.offers` groups these terms into products. Declaring a plan never creates a remote plan, starts a subscription or grants funds. Autumn resources must exist and be bound separately. See the [Autumn guide](autumn.md).

Local simulation accepts `localAccounts` seeds or an async seed resolver. Seeds initialize new accounts only and never replenish an existing one. The template's optional `localDemoAccounts` helper reads the private identities prepared by `npm run setup` and seeds the generic `credits` meter. Replace or omit that development helper for your own identity provisioning. Agents and workflows never read profiles, memberships or SQL.

`BILLING_CONFIGURATION` remains an optional complete override for canonical configuration (`resourcePolicies`, `billingKeys`, `catalog`, `localAccounts`, `hosted`, `provider`). Its resource policies must agree with the protected registrations. Leave it unset when maintaining configuration in `index.ts`.

## Choose a policy

| Policy                     | Configuration                                                                                       |
| -------------------------- | --------------------------------------------------------------------------------------------------- |
| Free but gateway-protected | `charge: { type: 'none' }`                                                                          |
| Subscription access        | `access: { subscription: 'pro' }`, with an appropriate charge rule                                  |
| Fixed credits              | `charge: { type: 'credits', meter: 'credits', units: 1 }`                                           |
| Per task                   | `charge: { type: 'per-task', meter: 'tasks', units: 1, funding: 'prepaid' }`                        |
| Measured postpaid usage    | `charge: { type: 'usage', meter: 'tokens', measure: 'tokens', maxUnits: 8192, funding: 'metered' }` |

Access keys and meter units must exist in `billingKeys`. Policy quantities are integers. Unsupported provider capabilities fail during preparation. Billing reserves prepaid units before compute, confirms the same reservation on successful completion, and releases it after confirmed failure/cancellation. Uncertain execution or financial outcomes remain held/pending until positive evidence is available. Recovery never automatically repeats uncertain compute or adds a second prepaid usage debit.

Wrappers accept optional `adapter` settings for prompt/output schemas, model step/output limits, durable completion checks and adapter versions. Defaults use the policy version and the standard adapter limits. Supply trusted measurement declarations for usage-based charging. Increase adapter versions when changing executable behavior, models or schemas, and retain compatible definitions for paused runs.

## Invoke billed resources

Inside a trusted request handler:

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
const result = await run.start({
  billing: context,
  idempotencyKey: 'report-001-start',
  inputData,
});
```

Reusing the same operation key and input replays its saved result or status without another charge or model call. A different input with the same key conflicts. Authenticate again before later workflow reads, resume or cancellation.

For nested agent work, declare `agentDependencies` on the workflow registration and use `billing.nestedAgent(id).generate(prompt)` inside the native workflow. The billing integration structurally supplies `ResourceDependencies` to workflow factories. Configure `adapter.measurement: 'facade-calls'` and `expectedCalls` per segment when certifying nested calls. Nested execution belongs to the parent's budget and does not receive a second independent charge.

All customer HTTP operations are under `/billing/workspaces/:workspaceId`. Agent generation uses `POST /agents/:resourceId/generate` with `{ "prompt": "..." }`; workflows use `POST /workflows/:resourceId/runs`, then `POST /workflows/:resourceId/runs/:executionId/start` with `{ "inputData": ... }`. Send a bearer credential, JSON content type and an idempotency key for writes. Balances and hosted sessions remain owner-authorized.

## Studio and private artifacts

The supplied protected actions use [Studio Tools](studio.md). New registrations automatically receive billing HTTP/facade access; optional `actions` expose resource-specific Studio tools. Adding a registration does not enable native chat or native workflow execution for that protected resource. Unwrapped native resources remain outside this gateway.

Image generation is only an example. `images/service.ts` depends on `ArtifactPersistence`, while `billing/storage/artifacts.ts` owns claims, execution/membership checks and artifact ownership. Completion hooks certify durable files before financial confirmation. Other resources can use ordinary validated outputs without implementing artifact persistence.

`png-validation.ts` validates OpenAI's returned bytes; the image model generates the PNG. `billing/local-profiles.ts` manages local demo credentials, not billing plans or model profiles.

## Existing state

SQL schema versions and checksums are validated without automatic resets. Schema v3 adds a retained local meter transition record. For an idle local account, first access using configured `credits` seeds transfers the exact available/consumed quantities from historical `image-credits`, retires the old meter for new spending and preserves all audit identities. It does not create a second spendable balance or refill lost target state.

Active reservations, uncertain execution and pending financial operations block the transition until reconciled. Historical reservations can settle under their original bindings. The earlier recognized v1-to-v2 transition from `weather-credits` remains intact. Autonomous startup does not reset unsupported or altered databases.

Update configured logical meter keys and policy references to `credits`. For Autumn, remote balances are not migrated or recreated: update logical bindings and keep historical meter bindings while old reservations still require them. Customer IDs, remote feature IDs and credit pool IDs continue to identify your existing provider resources.
