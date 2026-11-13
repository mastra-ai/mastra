# Billing guide

Use this template to add subscription access, prepaid credits, per-task charges, or measured usage to Mastra agents and workflows. Start with the local example in the [README](https://github.com/mastra-ai/mastra/blob/main/templates/template-agent-workflow-billing/README.md), then configure policies and connect [Autumn](autumn.md) when you need provider-owned prepaid billing.

## How billing works

A workspace pays for execution. Each person authenticates separately, and workspace members share the billing allowance while keeping their execution results private.

Each request follows the same flow:

1. Verify the caller, workspace membership, and any required subscription or entitlement.
2. Reserve the units required by the resource's billing policy.
3. Execute the agent or workflow.
4. Charge once on success. Confirmed failure or cancellation releases the reservation without charging.
5. Confirm the same prepaid reservation without a second usage debit. Metered postpaid policies instead deliver immutable usage through the outbox.

An idempotency key identifies one operation. Retrying with the same key and input returns the saved result or status without executing or charging again. Reusing that key with different input returns a conflict.

If execution or measurement cannot be confirmed, the reservation stays held for investigation. Recovery does not automatically rerun uncertain work. A failed usage export does not rerun the agent or undo local consumption.

## Local image example

`npm run setup` creates personal profiles with 30 simulated image credits each, seeded once. The `image-agent` produces one private image for one credit. The `image-kit` saves three prompts for the same subject in Notion-inspired, 3D and vector illustration styles, holds three credits while awaiting approval, then confirms three only after all artifacts persist. Nested calls share the parent reservation.

Use [the image guide](images.md) for CLI inputs, protected downloads, fixed generation settings and failure/replay behavior. Repeating setup preserves identities and spent balances. Recognized legacy local credit balances transition conservatively without resetting history.

## Choose a billing policy

Edit the resource policies in [src/mastra/image-definitions.ts](https://github.com/mastra-ai/mastra/blob/main/templates/template-agent-workflow-billing/src/mastra/image-definitions.ts). Each resource has an optional access requirement and a charging rule.

| Model               | Policy                                                                                              |
| ------------------- | --------------------------------------------------------------------------------------------------- |
| Free access         | `charge: { type: 'none' }` with no access requirement                                               |
| Subscription access | `access: { subscription: 'subscription-access' }` and `charge: { type: 'none' }`                    |
| Prepaid credits     | `charge: { type: 'credits', meter: 'image-credits', units: 1 }`                                     |
| Per-task charge     | `charge: { type: 'per-task', meter: 'tasks', units: 1, funding: 'prepaid' }`                        |
| Measured usage      | `charge: { type: 'usage', meter: 'tokens', measure: 'tokens', maxUnits: 8192, funding: 'metered' }` |

Access requirements and charges can be combined. A subscription can grant access while each successful execution also consumes credits. Local setup simulates prepaid balances. In Autumn mode the provider owns paid credit and its atomic reservations; the policy determines how executions spend those units.

Meter keys and units must match `billingKeys`. Quantities are integers. `prepaid` spends available units; `metered` records usage for billing without a prepaid balance. Policies also support entitlement requirements and metered per-task charges.

The bundled image resources use fixed credits. Generic task and metered policies remain available for other resource definitions. Prepaid token usage and prepaid workflow usage are not supported by the supplied Mastra adapters.

Policy changes apply to new executions. Existing runs keep the policy and reservation recorded when they started.

## Connect your own agents and workflows

The [application catalog](https://github.com/mastra-ai/mastra/blob/main/templates/template-agent-workflow-billing/src/mastra/image-billing.ts) selects the definitions in [src/mastra/image-definitions.ts](https://github.com/mastra-ai/mastra/blob/main/templates/template-agent-workflow-billing/src/mastra/image-definitions.ts). Each definition owns its ID, native factory, adapter limits/version, billing policy, public actions and declared agent dependencies. Adding a definition derives Mastra, billing and Studio registrations together.

Create an application with a typed catalog and a server-side provider selection:

```ts
import { imageBillingCatalog } from './src/mastra/image-billing.js';
import { createBillingApplication } from './src/billing/application.js';

const catalog = imageBillingCatalog(process.env);
const application = await createBillingApplication({ environment: process.env, catalog });
const { runtime, organizations } = application;
```

For the bundled local example, call `createImageApplication({ environment: process.env })` from `src/mastra/image-billing.ts`. It loads the prepared local profiles and seeds before calling the generic application factory. Custom applications supply their own catalog, including local account seeds when needed.

`BILLING_PROVIDER=local` selects persistent simulated accounting with no payment credentials. `BILLING_PROVIDER=autumn` selects the Autumn driver, which reads `AUTUMN_SECRET_KEY` and `AUTUMN_BINDINGS` itself. Configure JWT identity for Autumn. The driver registry in `src/billing/setup.ts` selects the implementation; resource factories receive no provider SDK.

For example, the included agent definition keeps its charge next to its factory:

```ts
{
  id: 'image-agent',
  kind: 'agent',
  create: () => createImageAgent(environment, images),
  adapter: {
    promptSchema: briefSchema,
    version: 'image-agent-v1', maxSteps: 2, maxOutputTokens: 200, artifactSlots: 1,
    outputSchema: imageOutputSchema,
    completion: async scope => ({ text: 'Image generated.', finishReason: 'stop', object: { artifacts: [await images.completed(scope)] } }),
  },
  operations: ['generate'],
  measurements: [],
  policy: {
    version: 'image-agent-v1',
    charge: { type: 'credits', meter: 'image-credits', units: 1 },
  },
}
```

Keep meter/access mappings and local allowances in the catalog configuration. `BILLING_CONFIGURATION` can configure the bundled resources and commercial/provider bindings; it cannot introduce a factory or action. Invalid IDs, dependencies, cycles, operations, mappings and unsupported policy capabilities reject before factories or provider work. Custom Studio action IDs use letters, digits and hyphens.

The application attaches persistent snapshots and authenticated HTTP/Studio boundaries before enabling the dependency resolver and recovery. Call `await application.close()` during shutdown; repeat and concurrent calls share cleanup, including when a disposer fails.

## Invoke billed resources

From trusted server code, invoke an agent through the billing facade. Use `runtime` and `organizations` from the application above. The `credential`, `workspaceId`, and `prompt` come from your authenticated request:

```ts
const context = await organizations.context({ credential, workspaceId });
const response = await runtime.billing.agent('image-agent').generate(prompt, {
  billing: context,
  idempotencyKey: 'image-123',
});

if (response.kind !== 'nested') console.log(response.billing.billedUnits);
```

For the image agent, `prompt` is the image brief, limited to 2,000 characters. Its trusted completion hook requires a durable artifact; model text cannot certify success.

Workflow access uses `runtime.billing.workflow(resourceId)`: call `createRun`, then `start`. Later, load the run with `getRun` and call `resume`, `status`, or `cancel` with a freshly authenticated billing context. Each write needs its own idempotency key.

For the bundled workflow, provide a brief of at most 1,800 characters:

```ts
const run = await runtime.billing.workflow('image-kit').createRun({
  billing: context,
  idempotencyKey: 'kit-123',
});
const draft = await run.start({
  billing: context,
  idempotencyKey: 'draft-123',
  inputData: { brief: 'A coordinated blue bird story' },
});
```

For nested agent calls, declare `agentDependencies` and use `dependencies.nestedAgent(resourceId).generate(prompt)` inside the admitted workflow factory. These calls contribute to the parent execution without a separate charge. Measured workflows must declare `measurement: 'facade-calls'` and the expected calls per segment, such as `[0, 3]` for no image calls before approval and three afterward. Direct model calls outside this facade are not measured by the integration.

Declare workflow `steps` to retain native resume types, and set `autoRestartActiveRuns: false`. Increase the resource version when changing executable code, models, tools, or schemas, and retain compatible definitions for paused runs. Token streaming, time travel, and automatic retries of uncertain work are not supported.

## Identity and HTTP access

Local identities work only with the local provider and a loopback listener. Production and external billing providers require verified JWT identity.

For JWT access:

1. Set `BILLING_MODE=production`.
2. Set `BILLING_JWT_CONFIGURATION` to JSON containing a trusted `issuer`, `audience`, explicit asymmetric `algorithms`, and public `jwks`.
3. Provision each identity through trusted server setup using `organizations.provisionJwt({ issuer, subject, displayName })`.
4. Establish workspace membership before allowing execution.

The template verifies tokens but does not issue them or provide login flows. Tokens cannot create identities. Keep private signing keys outside the configuration.

Owners manage billing and ownership. Admins manage non-owner members. Members can execute permitted resources. Results belong to the initiating actor: being an owner does not grant access to another member's reports.

All customer operations use `/billing`. Send `Authorization: Bearer <credential>` on requests, plus `Content-Type: application/json` and `Idempotency-Key` on writes. The default example uses the CLI; native agent and workflow endpoints remain blocked.

| Method | Path below `/billing/workspaces/:workspaceId`     | Body                                                                                       |
| ------ | ------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| POST   | `/agents/:resourceId/generate`                    | `{ "prompt": "..." }`                                                                      |
| POST   | `/workflows/:resourceId/runs`                     | `{}`                                                                                       |
| POST   | `/workflows/:resourceId/runs/:executionId/start`  | `{ "inputData": ... }`                                                                     |
| POST   | `/workflows/:resourceId/runs/:executionId/resume` | `{ "step": "approval", "resumeData": ... }`                                                |
| POST   | `/workflows/:resourceId/runs/:executionId/cancel` | `{}`                                                                                       |
| GET    | `/workflows/:resourceId/runs/:executionId`        | No body                                                                                    |
| GET    | `/usage`                                          | No body; owner only                                                                        |
| POST   | `/checkout`                                       | `{ "product": "credit-pack", "returnUrl": "https://app.example.com/billing" }`; owner only |
| POST   | `/portal`                                         | `{ "returnUrl": "https://app.example.com/billing" }`; owner only                           |

Bodies are limited to 16 KiB and reject unknown fields. Common responses are `400` for invalid input, `401` for invalid credentials, `403` for denied access, `409` for conflicts, and `503` for unavailable state or storage. Organization and invitation routes are defined in [src/billing/server/routes.ts](https://github.com/mastra-ai/mastra/blob/main/templates/template-agent-workflow-billing/src/billing/server/routes.ts).

## Provider configuration

`initializeBilling` and `initializeMastraBilling` support `local` and `autumn`. Their public configuration contains `resourcePolicies` (serializable agent/workflow policies), `billingKeys` (logical meters, entitlements and subscriptions), and `catalog` (versioned allowances and offers). Driver credentials and customer/feature bindings are read from the server environment. An optional `billingProvider` accepts an implementation of `BillingProvider` from `src/billing/providers/contracts.ts`; it never accepts an Autumn-specific options object. The runtime closes the injected driver after successful initialization. See the [Autumn guide](autumn.md) for a complete configuration, supported policies, checkout/portal mappings, deadlines and explicit sandbox verification.

Local mode supports free, subscription, prepaid fixed/task, and metered task/usage policies. It persists its simulated balances and access grants. Autumn currently supports prepaid reservations and access, plus owner-only checkout/portal; Autumn postpaid is unavailable until its delivery semantics are verified. Do not export usage for a confirmed prepaid lock.

## Persistence and recovery

Billing storage strictly validates schema versions, migration checksums, SQL definitions and foreign keys. The recognized additive v1-to-v2 upgrade preserves identities and financial history, including remaining and consumed local credits. Unresolved obligations block an account's automatic credit transition. Unsupported, altered or unrelated databases fail with `storage_incompatible`, without automatic deletion, reset or reseeding. Autumn and production balances are not migrated. See [existing local state](images.md#existing-local-state) for credit-transition details.

Execution claims, policy snapshots, admitted payer mappings, provider operation payloads, terminal intents, receipts and audit survive restart. Duplicate keys replay the original operation. Recovery reconciles unknown financial outcomes without repeating compute. Passing a deadline or losing an acknowledgement does not prove zero charge. Metered postpaid delivery has separate immutable payloads and persisted retry leases.

Local profile credentials live in the private `data/local-profiles.json`; keep it with the matching database. Missing or corrupt profiles fail safely. Setup does not rotate credentials or refill accounts. Shared workspaces remain available through explicit conversion and invitations; workspace membership does not grant access to another creator's private results.

## Source organization

`src/mastra/index.ts` configures the application with an object containing its environment and billing keys/plans. `src/mastra/image-plans.ts` defines the example's one-credit and three-credit policies, local opening balance and commercial catalog. Add versioned allowances/offers there, or replace them in the entry point; Autumn plan IDs remain in `AUTUMN_BINDINGS`.

| File or directory                   | Responsibility                                                                                                 |
| ----------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| `src/mastra/agents/image-agent.ts`  | Native Mastra agent and its image tool.                                                                        |
| `src/mastra/workflows/image-kit.ts` | Native approval and image generation workflow.                                                                 |
| `src/mastra/image-definitions.ts`   | Pair native factories with policies, completion checks and Studio actions.                                     |
| `src/mastra/image-billing.ts`       | Assemble the image example's typed catalog and local demo setup.                                               |
| `src/billing/application.ts`        | Generic application composition and the documented `BillingApplicationOptions` contract.                       |
| `src/billing/environment.ts`        | Billing database location, identity configuration and environment parsing.                                     |
| `src/billing/setup.ts`              | Driver registry, capability validation and provider initialization.                                            |
| `src/billing/providers/`            | Common provider contract and Local/Autumn implementations.                                                     |
| `src/billing/server/`               | HTTP routes, authenticated Studio tools and the native-route boundary; each factory accepts an options object. |
| `src/billing/storage/`              | SQL, transaction boundaries and persisted financial/execution checks.                                          |
| `src/images/`                       | OpenAI image requests, file persistence, image schemas and PNG validation.                                     |

The former root `resources.ts` assembled the example catalog, rather than defining a standalone agent. It is now `src/mastra/image-billing.ts`; native agents and workflows have their own conventional directories. `BillingApplicationOptions` belongs with the application factory in `billing/application.ts`, rather than in a Mastra entry point or the provider setup module.

`billing/local-profiles.ts` manages the private local demo manifest: synthetic people, organization IDs and bearer credentials created by `npm run setup`. It is not a billing plan or a model profile. Private-directory checks live in `billing/storage/private-files.ts` so image storage does not import demo profile management.

Image tools depend on the `ArtifactPersistence` contract. Billing checks current membership, reservation, execution deadline and artifact ownership in `billing/storage/artifacts.ts`; image code contains no SQL or knowledge of membership tables. Other agents and workflows only need a typed definition and a billing policy. Invoke them through `runtime.billing.agent(...)` or `runtime.billing.workflow(...)` so billing handles admission and terminal results.

The SQL formerly inside `providers/autumn.ts` maintains local account identity and immutable provider-customer links. It does not implement Autumn's remote balance accounting. That bookkeeping now lives in `storage/autumn-accounts.ts`; the historic `customerId` projection from persisted Autumn reservation payloads is driver-specific and remains isolated there. Existing SQL schemas and checksums are unchanged.

The former `billing/configuration.ts` re-export layer has been removed. Import policy schemas and types directly from `billing/policy-configuration.ts`. For a saved `BILLING_CONFIGURATION`, rename `resources` to `resourcePolicies` and `mappings` to `billingKeys`; update programmatic catalogs from `resources` to `definitions`. Existing per-execution policies, balances, artifact tables and immutable financial identities retain their stored representation.
