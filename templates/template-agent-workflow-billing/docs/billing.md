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

## Local weather example

`npm run setup` creates John and `John's Org`, Mary and `Mary's Org`, and Alex and `Alex's Org`. Each person owns a separate personal workspace with 30 simulated credits, 10 tasks, and an active example subscription seeded once. The private profile aliases are `owner`, `member`, and `outsider`, respectively. Repeating setup preserves credentials, workspace identities, memberships, audit, and spent balances.

| Resource         | Default billing                                              | Behavior                                                             |
| ---------------- | ------------------------------------------------------------ | -------------------------------------------------------------------- |
| `weather-agent`  | Active `weather-access` subscription and 3 `weather-credits` | Summarizes supplied observations                                     |
| `weather-report` | 1 prepaid `weather-tasks` unit                               | Drafts a report, waits for approval, then generates the final report |

The agent does not fetch weather. Both resources use the observations supplied by the caller. See the [input schemas](https://github.com/mastra-ai/mastra/blob/main/templates/template-agent-workflow-billing/src/weather/observations.ts) for required fields and accepted ranges.

The workflow keeps its reservation while paused, including across server restarts. Resume with `{ "approved": true }`, or add a complete `observations` object to correct the input. Confirmed cancellation releases the reservation. The default suspension budget is 30 minutes. Execution and finalization cutoffs precede the explicit reservation expiry. Recovery cancels a positively confirmed suspension; ambiguous compute or provider outcomes remain visible for reconciliation.

The CLI reads private credentials from `data/local-profiles.json`:

| Command                                                                                | Purpose                               |
| -------------------------------------------------------------------------------------- | ------------------------------------- |
| `npm run weather -- generate --input observations.json --key summary-one`              | Generate a summary                    |
| `npm run weather -- start --input observations.json --key report-one`                  | Start a report and pause for approval |
| `npm run weather -- status <executionId>`                                              | Read your report's status and receipt |
| `npm run weather -- resume <executionId> --json '{"approved":true}' --key approve-one` | Approve and complete your report      |
| `npm run weather -- cancel <executionId> --key cancel-one`                             | Cancel your report                    |
| `npm run weather -- account`                                                           | Read billing information as the owner |

Use `--profile member` or `--profile outsider` to try authorization with another identity. The default payer is the selected person's personal workspace; `--workspace <id>` selects another workspace you can access. Omitting `--key` creates a new key for each command.

## Choose a billing policy

Edit the resource policies in [src/weather/resources.ts](https://github.com/mastra-ai/mastra/blob/main/templates/template-agent-workflow-billing/src/weather/resources.ts). Each resource has an optional access requirement and a charging rule.

| Model               | Policy                                                                                                      |
| ------------------- | ----------------------------------------------------------------------------------------------------------- |
| Free access         | `charge: { type: 'none' }` with no access requirement                                                       |
| Subscription access | `access: { subscription: 'weather-access' }` and `charge: { type: 'none' }`                                 |
| Prepaid credits     | `charge: { type: 'credits', meter: 'weather-credits', units: 3 }`                                           |
| Per-task charge     | `charge: { type: 'per-task', meter: 'weather-tasks', units: 1, funding: 'prepaid' }`                        |
| Measured usage      | `charge: { type: 'usage', meter: 'weather-tokens', measure: 'tokens', maxUnits: 8192, funding: 'metered' }` |

Access requirements and charges can be combined. A subscription can grant access while each successful execution also consumes credits. Local setup simulates prepaid balances. In Autumn mode the provider owns paid credit and its atomic reservations; the policy determines how executions spend those units.

Meter keys and units must match `mappings`. Quantities are integers. `prepaid` spends available units; `metered` records usage for billing without a prepaid balance. Policies also support entitlement requirements and metered per-task charges.

For the included workflow, set `WEATHER_WORKFLOW_POLICY=tokens` before starting the server to measure SDK tokens across both model calls. It charges only on successful completion, up to the configured 8,192-unit limit. An output-token limit does not guarantee a total-token or monetary cost cap. Prepaid token usage and prepaid workflow usage are not supported by the supplied Mastra adapters.

Policy changes apply to new executions. Existing runs keep the policy and reservation recorded when they started.

## Connect your own agents and workflows

The [application catalog](https://github.com/mastra-ai/mastra/blob/main/templates/template-agent-workflow-billing/src/resources.ts) selects the definitions in [src/weather/resources.ts](https://github.com/mastra-ai/mastra/blob/main/templates/template-agent-workflow-billing/src/weather/resources.ts). Each definition owns its ID, native factory, adapter limits/version, billing policy, public actions and declared agent dependencies. Adding a definition derives Mastra, billing and Studio registrations together.

Create an application with a typed catalog and a server-side provider selection:

```ts
import { applicationCatalog } from './src/resources.js';
import { createBillingApplication } from './src/mastra/setup.js';

const catalog = applicationCatalog(process.env);
const application = await createBillingApplication(process.env, { catalog });
const { runtime, organizations } = application;
```

For local setup, omit the explicit catalog so the application loads the bundled profile balances. `BILLING_PROVIDER=local` selects persistent simulated accounting. For Autumn, set `BILLING_PROVIDER=autumn`, configure JWT identity, and supply server-side `autumn` options containing the secret and feature/customer bindings. The provider factory map in `src/billing/setup.ts` selects the implementation; resource factories receive no provider SDK.

For example, the included agent definition keeps its charge next to its factory:

```ts
{
  id: 'weather-agent',
  kind: 'agent',
  create: () => createWeatherAgent(environment),
  adapter: { version: 'weather-agent-v1', maxSteps: 1, maxOutputTokens: 400 },
  operations: ['generate'],
  measurements,
  policy: {
    version: 'weather-agent-v1',
    access: { subscription: 'weather-access' },
    charge: { type: 'credits', meter: 'weather-credits', units: 3 },
  },
}
```

Keep meter/access mappings and local allowances in the catalog configuration. `BILLING_CONFIGURATION` can configure the bundled resources and commercial/provider bindings; it cannot introduce a factory or action. Invalid IDs, dependencies, cycles, operations, mappings and unsupported policy capabilities reject before factories or provider work. Custom Studio action IDs use letters, digits and hyphens.

The application attaches persistent snapshots and authenticated HTTP/Studio boundaries before enabling the dependency resolver and recovery. Call `await application.close()` during shutdown; repeat and concurrent calls share cleanup, including when a disposer fails.

From trusted server code, invoke an agent through the billing facade. Use `runtime` and `organizations` from the application above. The `credential`, `workspaceId`, and `prompt` come from your authenticated request:

```ts
const context = await organizations.context({ credential, workspaceId });
const response = await runtime.billing.agent('weather-agent').generate(prompt, {
  billing: context,
  idempotencyKey: 'summary-123',
});

if (response.kind !== 'nested') console.log(response.billing.billedUnits);
```

For the weather agent, `prompt` is JSON containing `{ observations, purpose: 'summary' }`. Use `weatherPrompt` from `src/weather/observations.ts` to construct it.

Workflow access uses `runtime.billing.workflow(resourceId)`: call `createRun`, then `start`. Later, load the run with `getRun` and call `resume`, `status`, or `cancel` with a freshly authenticated billing context. Each write needs its own idempotency key.

For the bundled workflow, `observations` is the caller's validated weather input:

```ts
const run = await runtime.billing.workflow('weather-report').createRun({
  billing: context,
  idempotencyKey: 'report-123',
});
const draft = await run.start({
  billing: context,
  idempotencyKey: 'draft-123',
  inputData: observations,
});
```

For nested agent calls, declare `agentDependencies` and use `dependencies.nestedAgent(resourceId).generate(prompt)` inside the admitted workflow factory. These calls contribute to the parent execution without a separate charge. Measured workflows must declare `measurement: 'facade-calls'` and the expected calls per segment, such as `[1, 1]` for one call before approval and one after it. Direct model calls outside this facade are not measured by the integration.

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

Bodies are limited to 16 KiB and reject unknown fields. Common responses are `400` for invalid input, `401` for invalid credentials, `403` for denied access, `409` for conflicts, and `503` for unavailable state or storage. Organization and invitation routes are defined in [src/server/billing.ts](https://github.com/mastra-ai/mastra/blob/main/templates/template-agent-workflow-billing/src/server/billing.ts).

## Provider configuration

`initializeBilling` and `initializeMastraBilling` support `local` and `autumn`. Their public configuration contains policies, logical meter/access mappings, and the commercial catalog. Provider credentials and customer/feature bindings remain server-side in `autumn` options. See the [Autumn guide](autumn.md) for a complete configuration, supported policies, checkout/portal mappings, deadlines and explicit sandbox verification.

Local mode supports free, subscription, prepaid fixed/task, and metered task/usage policies. It persists its simulated balances and access grants. Autumn currently supports prepaid reservations and access, plus owner-only checkout/portal; Autumn postpaid is unavailable until its delivery semantics are verified. Do not export usage for a confirmed prepaid lock.

## Persistence and recovery

Billing storage uses a single supported fresh schema with strict version, checksum, SQL-definition, and foreign-key validation. An older, altered or unrelated database fails with `storage_incompatible`; startup and setup never delete, import, or reseed it. Choose an explicit new local database only when you intend a fresh instance. Existing production balances are not migrated by this template.

Execution claims, policy snapshots, admitted payer mappings, provider operation payloads, terminal intents, receipts and audit survive restart. Duplicate keys replay the original operation. Recovery reconciles unknown financial outcomes without repeating compute. Passing a deadline or losing an acknowledgement does not prove zero charge. Metered postpaid delivery has separate immutable payloads and persisted retry leases.

Local profile credentials live in the private `data/local-profiles.json`; keep it with the matching database. Missing or corrupt profiles fail safely. Setup does not rotate credentials or refill accounts. Shared workspaces remain available through explicit conversion and invitations; workspace membership does not grant access to another creator's private results.
