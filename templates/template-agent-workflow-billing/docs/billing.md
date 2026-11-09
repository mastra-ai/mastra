# Billing guide

Use this template to add subscription access, prepaid credits, per-task charges, or measured usage to Mastra agents and workflows. Start with the local example in the [README](https://github.com/mastra-ai/mastra/blob/main/templates/template-agent-workflow-billing/README.md), then configure policies and connect Polar when you need payments.

## How billing works

A workspace pays for execution. Each person authenticates separately, and workspace members share the billing allowance while keeping their execution results private.

Each request follows the same flow:

1. Verify the caller, workspace membership, and any required subscription or entitlement.
2. Reserve the units required by the resource's billing policy.
3. Execute the agent or workflow.
4. Charge once on success. Confirmed failure or cancellation releases the reservation without charging.
5. Report successful usage to the provider in the background.

An idempotency key identifies one operation. Retrying with the same key and input returns the saved result or status without executing or charging again. Reusing that key with different input returns a conflict.

If execution or measurement cannot be confirmed, the reservation stays held for investigation. Recovery does not automatically rerun uncertain work. A failed usage export does not rerun the agent or undo local consumption.

## Local weather example

`npm run setup` creates an owner, a member of the owner's shared workspace, and an outsider. It grants the shared workspace 30 credits, 10 tasks, and an active example subscription once. Repeating setup preserves credentials, membership, and remaining allowance.

| Resource         | Default billing                                              | Behavior                                                             |
| ---------------- | ------------------------------------------------------------ | -------------------------------------------------------------------- |
| `weather-agent`  | Active `weather-access` subscription and 3 `weather-credits` | Summarizes supplied observations                                     |
| `weather-report` | 1 prepaid `weather-tasks` unit                               | Drafts a report, waits for approval, then generates the final report |

The agent does not fetch weather. Both resources use the observations supplied by the caller. See the [input schemas](https://github.com/mastra-ai/mastra/blob/main/templates/template-agent-workflow-billing/src/weather/observations.ts) for required fields and accepted ranges.

The workflow keeps its reservation while paused, including across server restarts. Resume with `{ "approved": true }`, or add a complete `observations` object to correct the input. Confirmed cancellation releases the reservation. Paused runs expire after 24 hours when recovery can confirm and cancel the persisted suspension.

The CLI reads private credentials from `data/local-profiles.json`:

| Command                                                                                | Purpose                               |
| -------------------------------------------------------------------------------------- | ------------------------------------- |
| `npm run weather -- generate --input observations.json --key summary-one`              | Generate a summary                    |
| `npm run weather -- start --input observations.json --key report-one`                  | Start a report and pause for approval |
| `npm run weather -- status <executionId>`                                              | Read your report's status and receipt |
| `npm run weather -- resume <executionId> --json '{"approved":true}' --key approve-one` | Approve and complete your report      |
| `npm run weather -- cancel <executionId> --key cancel-one`                             | Cancel your report                    |
| `npm run weather -- account`                                                           | Read billing information as the owner |

Use `--profile member` or `--profile outsider` to try authorization with another identity. The default payer remains the shared workspace; `--workspace <id>` selects another workspace you can access. Omitting `--key` creates a new key for each command.

## Choose a billing policy

Edit [src/weather/configuration.ts](https://github.com/mastra-ai/mastra/blob/main/templates/template-agent-workflow-billing/src/weather/configuration.ts). Each resource has an optional access requirement and a charging rule.

| Model               | Policy                                                                                                      |
| ------------------- | ----------------------------------------------------------------------------------------------------------- |
| Free access         | `charge: { type: 'none' }` with no access requirement                                                       |
| Subscription access | `access: { subscription: 'weather-access' }` and `charge: { type: 'none' }`                                 |
| Prepaid credits     | `charge: { type: 'credits', meter: 'weather-credits', units: 3 }`                                           |
| Per-task charge     | `charge: { type: 'per-task', meter: 'weather-tasks', units: 1, funding: 'prepaid' }`                        |
| Measured usage      | `charge: { type: 'usage', meter: 'weather-tokens', measure: 'tokens', maxUnits: 8192, funding: 'metered' }` |

Access requirements and charges can be combined. A subscription can grant access while each successful execution also consumes credits. One-time purchases fund prepaid allowances; the policy determines how executions spend those units.

Meter keys and units must match `mappings`. Quantities are integers. `prepaid` spends available units; `metered` records usage for billing without a prepaid balance. Policies also support entitlement requirements and metered per-task charges.

For the included workflow, set `WEATHER_WORKFLOW_POLICY=tokens` before starting the server to measure SDK tokens across both model calls. It charges only on successful completion, up to the configured 8,192-unit limit. An output-token limit does not guarantee a total-token or monetary cost cap. Prepaid token usage and prepaid workflow usage are not supported by the supplied Mastra adapters.

Policy changes apply to new executions. Existing runs keep the policy and reservation recorded when they started.

## Connect your own agents and workflows

The [weather resources](https://github.com/mastra-ai/mastra/blob/main/templates/template-agent-workflow-billing/src/weather/resources.ts) and [application setup](https://github.com/mastra-ai/mastra/blob/main/templates/template-agent-workflow-billing/src/mastra/setup.ts) provide the complete integration example:

1. Register agents with `agentResource` and workflows with `workflowResource`.
2. Pass those registrations, the matching billing configuration, and an `OrganizationService` to `initializeMastraBilling`.
3. Attach the returned storage to the same Mastra instance. Keep both `billingOnlyServer` and `enforceBillingBoundary` so native execution routes cannot bypass billing.
4. After attaching resources and storage, call `await runtime.startRecovery().ready`. Call `await runtime.close()` during shutdown.

From trusted server code, invoke an agent through the billing facade. Here, `runtime` is the result of `initializeMastraBilling`, `organizations` is its organization service, and `credential`, `workspaceId`, and `prompt` come from your authenticated request:

```ts
const context = await organizations.context({ credential, workspaceId });
const response = await runtime.billing.agent('weather-agent').generate(prompt, {
  billing: context,
  idempotencyKey: 'summary-123',
});

console.log(response.billing.billedUnits);
```

For the weather agent, `prompt` is JSON containing `{ observations, purpose: 'summary' }`. Use `weatherPrompt` from `src/weather/observations.ts` to construct it.

Workflow access uses `runtime.billing.workflow(resourceId)`: call `createRun`, then `start`. Later, load the run with `getRun` and call `resume`, `status`, or `cancel` with a freshly authenticated billing context. Each write needs its own idempotency key.

For nested agent calls, use `runtime.billing.nestedAgent(resourceId).generate(prompt)` inside the admitted workflow. These calls contribute to the parent execution without a separate charge. Declare the agent in `agentDependencies`. Measured workflows must declare `measurement: 'facade-calls'` and the expected calls per segment, such as `[1, 1]` for one call before approval and one after it. Direct model calls outside this facade are not measured by the integration.

Set workflow `autoRestartActiveRuns: false`. Increase the resource version when changing executable code, models, tools, or schemas, and retain compatible definitions for paused runs. Token streaming, time travel, and automatic retries of uncertain work are not supported.

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

## Polar

Polar handles products, purchases, subscriptions, checkout, and the customer portal. The application ledger tracks prepaid grants, reservations, and consumption. Credits come from verified purchases or subscription periods, never from a Polar meter balance.

### Configure products and allowances

Create the products, prices, meters, and meter-credit benefits in your Polar organization. Then connect them to the template's logical configuration:

- `mappings` names the meters and access keys used by policies.
- `catalog.allowances` defines the number of units, source type, expiry, and version.
- `catalog.offers` groups exact allowance versions under a checkout key.
- `polar.grants` links an allowance to Polar product, price, benefit, and meter IDs.
- `polar.products` links an offer to its checkout product.
- `polar.meters` defines the event and unit field used to export consumption.

For example, this configuration sells a one-time pack of 100 credits and charges 3 per successful `assistant` invocation. It is an example for your own registered agent. To use the supplied weather application, configure its exact `weather-agent` and `weather-report` resources, policies, and mappings instead.

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
  catalog: {
    allowances: [
      {
        key: 'prepaid-credits',
        version: 'credits-v1',
        meter: 'credits',
        kind: 'order',
        units: 100,
        expiry: { type: 'none' },
      },
    ],
    offers: [{ key: 'credit-pack', version: 'v1', allowances: [{ key: 'prepaid-credits', version: 'credits-v1' }] }],
  },
  polar: {
    server: 'https://sandbox-api.polar.sh',
    organizationId: sellerOrganizationId,
    grants: [
      {
        allowance: { key: 'prepaid-credits', version: 'credits-v1' },
        productId,
        priceId,
        benefitId,
        meterId,
      },
    ],
    meters: [{ key: 'credits', funding: 'prepaid', eventName: 'work.succeeded', unitsField: 'units' }],
    products: [{ key: 'credit-pack', version: 'v1', productId }],
    returnUrls: ['https://app.example.com/billing'],
  },
};
```

Replace the ID variables with values from your Polar organization. The benefit must grant the configured units with `rollover: false`; credit products cannot include metered overage prices. Configure the event name and unit field to match your Polar meter. Keep return URLs restricted to your application.

For recurring allowances, use `kind: 'subscription'` and `expiry: { type: 'period' }` with a matching recurring product, fixed price, subscription, and benefit. Each verified period grants units once. One-time allowances use `kind: 'order'` and either no expiry or a duration measured from the verified purchase time.

For postpaid usage, use a `metered` policy and meter mapping with `productId`, `priceId`, and `meterId`. The customer needs an active subscription with that metered price. Subscription and entitlement access checks are configured separately through `polar.subscriptions` and `polar.entitlements` and their logical mappings.

Catalog revisions are immutable. Add a new version when changing allowance terms and retain revisions and bindings needed by existing purchases. Refunds, revocations, or expiry make the affected units unavailable for new work; refreshes never restore already consumed credit. Archived products can support existing purchases and subscriptions, but cannot open new checkout sessions.

### Configure the server

After configuring JWT identity, set these environment variables for the supplied application:

| Variable                    | Value                                                                                                            |
| --------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `BILLING_MODE`              | `production`                                                                                                     |
| `BILLING_PROVIDER`          | `polar`                                                                                                          |
| `BILLING_CONFIGURATION`     | JSON configuration for the registered weather resources, catalog, and Polar mappings                             |
| `BILLING_JWT_CONFIGURATION` | Trusted JWT verification configuration                                                                           |
| `BILLING_CONTACTS`          | Trusted workspace contacts, for example `{"workspace-id":{"email":"billing@example.com","name":"Example team"}}` |
| `POLAR_ACCESS_TOKEN`        | Organization token for the configured Polar seller and environment                                               |
| `POLAR_WEBHOOK_SECRET`      | Signing secret for Polar notifications                                                                           |

Use a separate persistent database for Polar when moving from the local demo. Local seeded accounts cannot become paid Polar accounts, and `npm run setup` is only for the local example. Billing contacts must come from your trusted workspace records, not the requesting member's email or an unverified token claim.

When constructing your own application, pass `configuration` and `polar: { token, webhookSecret, contact }` to `initializeMastraBilling`, where `contact(workspaceId)` returns the trusted contact. Keep tokens and secrets out of the public configuration.

Configure Polar notifications to reach `POST /billing/webhooks/polar` through your deployed ingress. This endpoint verifies the signature instead of using customer bearer authentication. The recovery worker refreshes verified commercial state and exports usage. An unavailable or unverifiable provider state blocks paid admission.

Checkout accepts logical offer keys, and its return URL must exactly match `polar.returnUrls`. Completed requests replay their original hosted URL. If the provider response is uncertain, investigate before creating another checkout. Hosted URLs grant access to a session; keep them out of logs.

### Read the balance

The owner-only `/usage` response includes `granted`, `consumed`, `reserved`, `unavailable`, and `spendable` units for Polar allowances. Use `spendable` for available credit. Reserved units cannot fund another execution.

Local balance reflection is asynchronous, normally within 30 seconds. Receipts can show pending delivery after successful work, while admission already accounts for the consumed units. Provider delivery status and application consumption are separate.

## Storage and recovery

Run one Node service with persistent local disk. The template stores billing history in `data/billing.db` and workflow snapshots in `data/workflow.db`. Remote and in-memory databases are not supported; multi-host deployment is outside this template's supported setup.

Keep `.env`, both databases and their SQLite sidecars, and `data/local-profiles.json` private. Preserve matching credentials and databases together. `BILLING_DATABASE_URL` can select an absolute `file:///...` path with an existing writable parent directory; `BILLING_PORT` changes the default port of 4111.

Recovery retries usage exports and verified source refreshes and expires compatible suspended workflows. Uncertain execution, incomplete usage, permanent delivery failures, or mismatched workflow snapshots require investigation. No automatic refund, destructive reset, or financial repair command is provided.

Build with `npm run build` and serve with `npm start`. For development checks, run `npm run test:unit`, then `npm run test:integration`. `npm run test:local` verifies the local application flow; `npm run test:openai` explicitly performs one live model generation and replay using your OpenAI key.

## Use another billing provider

Implement the [BillingDriver contract](https://github.com/mastra-ai/mastra/blob/main/templates/template-agent-workflow-billing/src/billing/driver.ts) and inject the constructed driver through `initializeMastraBilling({ drivers: [...] })` or `createWeatherApplication(environment, { drivers: [...] })`. Set `configuration.provider` and `BILLING_PROVIDER` to the driver's ID. Keep credentials inside the driver and retain the same logical policies and catalog.

Changing the selected provider does not migrate existing accounts. Trusted server code must use `BillingService.switchProvider`. Keep historical drivers, bindings, and catalog revisions available so existing grants and pending usage remain verifiable. Provider replacement does not transfer purchases, subscriptions, or invoices.

Retire a historical provider only after closing its external sales and resolving active grants, executions, and deliveries. Use the trusted `retireProvider` API with evidence of that closure. New verified notifications can require reactivating its driver. See [src/billing/service.ts](https://github.com/mastra-ai/mastra/blob/main/templates/template-agent-workflow-billing/src/billing/service.ts) for lifecycle APIs. Polar is the included external integration; Stripe and Paddle drivers are not included.
