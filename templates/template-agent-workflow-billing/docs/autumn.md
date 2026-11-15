# Autumn billing

Autumn owns paid credit balances and reservations. Local mode simulates the same reserve, execute, confirm or release lifecycle in the private SQL database and needs no payment credentials. The bundled image agent costs one credit; the approval kit costs three credits after complete success. OpenAI image generation uses a separate API key.

## Test Autumn sandbox in Studio

This walkthrough uses real Autumn sandbox balances and the bundled image examples. Run every command from the template root on macOS or Linux with Node.js 22.13+ or 24. Install dependencies with `npm install` first. No external experiment folder or identity service is needed: the included scripts provision a demo John principal and issue signed, expiring JSON Web Tokens (JWTs). This demo signer is for localhost sandbox use. For real users, use your identity provider as described under [identity provisioning](#identity-provisioning).

`BILLING_MODE=production` selects verified JWT authentication. **It does not select live Autumn billing.** The `am_sk_test_...` secret and the customer's sandbox environment keep this walkthrough in sandbox. OpenAI requests still use your model account and may incur model charges.

### 1. Create your Autumn account and sandbox key

1. Open [Autumn](https://app.useautumn.com/), sign up, and complete the account and organization onboarding.
2. Select **Sandbox** in the environment selector. Keep this environment selected throughout the walkthrough.
3. Open [Developer settings → API keys](https://app.useautumn.com/sandbox/dev?tab=api_keys). Create a secret key, copy it, and keep it for `AUTUMN_SECRET_KEY` below. It must start with `am_sk_test_`, never `am_sk_live_`.

Autumn documents its [sandbox and live environments](https://docs.useautumn.com/documentation/getting-started/deploy) separately. Sandbox uses a shared Stripe test account by default; a live Stripe connection is not required for this credit test. If your organization has a custom Stripe connection, keep it in test mode.

### 2. Create the image feature and credit pool

In the sandbox dashboard, open **Catalog → Features**. Create these two resources in order. Display names help people recognize them; IDs are the values used in configuration.

| Resource        | Display name     | ID                 | Required settings                                     |
| --------------- | ---------------- | ------------------ | ----------------------------------------------------- |
| Metered feature | Generated Images | `generated_images` | **Metered**, **Consumable**, active                   |
| Credit system   | Image Credits    | `image_credits`    | Include `generated_images` at **1 credit per 1 unit** |

Use **Create feature** for the metered feature and **Create Credit System** for the pool. The [credit system guide](https://docs.useautumn.com/documentation/modelling-pricing/credit-systems) explains this relationship. Configure a flat conversion, with no dimensions, multipliers or tiered rates. The template charges one unit for an image and three for a complete kit.

Open each saved resource and copy its **ID** from the details/editor. Use the metered ID as `AUTUMN_TEST_FEATURE_ID` and the credit-system ID as `AUTUMN_TEST_CREDIT_POOL_ID`. If the dashboard generates different IDs, use those exact values below. Don't copy the display name, a Stripe ID, or the whole dashboard URL.

### 3. Create a plan that grants credits

For the first Studio test, use a free plan with a recurring allowance:

1. In **Plans**, select **Create Plan**, name it **Studio Sandbox**, and use ID `studio-sandbox` (or record the generated plan ID).
2. Select **Free** and enable **Auto-enable** before creating your test customer.
3. In the plan editor, select **Add new feature**, choose **Image Credits** (`image_credits`), select **Included**, and set **Grant Amount** to `30` with interval **per month**. The feature selector may open automatically for a new plan.
4. Keep **Unlimited** off and don't select **Priced** or enable overage. Select **Save** in the feature dialog, then select the plan editor's separate **Save** action. Confirm **30 image credits per month** is shown and **You have unsaved changes** is gone.

Grant the credit pool, rather than an additional direct `generated_images` balance. A direct image allowance would be consumed ahead of the pool and doesn't match this template's pool verification. See Autumn's [free plans](https://docs.useautumn.com/documentation/modelling-pricing/free-plans) and [feature balance behavior](https://docs.useautumn.com/documentation/concepts/features).

The plan supplies the allowance. The template's TypeScript policies decide how much an operation reserves and confirms. No plan ID is required in `.env` for this first test: Autumn has already assigned the allowance to the customer. A paid subscription variant is covered [below](#optional-test-a-paid-subscription).

### 4. Create the sandbox customer and copy its ID

1. Open **Customers → Create Customer** in the sandbox dashboard.
2. Set the customer ID to `johns-org` and its name to **John's Org**. If you use a different ID, copy that exact customer ID into `AUTUMN_TEST_CUSTOMER_ID` below. This is an Autumn customer ID, not a Stripe `cus_...` ID or the application workspace ID.
3. Open the customer's details and confirm **Studio Sandbox** is active. For an existing customer, enable that plan from the customer's plan controls; auto-enable applies when customers are created.
4. In **Balances**, confirm **Image Credits** has **30 available credits** and overage is disabled. If you need to adjust a test allowance, open that balance, choose **Set** or **Add**, enter the amount, and save. [Autumn balance management](https://docs.useautumn.com/documentation/customers/managing-balances) describes these controls.

At least four available credits are needed for one image plus one kit. The optional automated provider proof needs six available credits. Setup doesn't attach plans, create customers or refill balances.

### 5. Configure the template environment

For a new project, run `cp .env.example .env`. If `.env` already exists, edit it without replacing your keys. Replace the existing local settings with the following values, keeping only one active assignment per variable:

```dotenv
OPENAI_API_KEY=REPLACE_WITH_YOUR_OPENAI_KEY
BILLING_MODE=production
BILLING_PROVIDER=autumn
BILLING_STUDIO_ENABLED=true
BILLING_PORT=4111

AUTUMN_SECRET_KEY=am_sk_test_REPLACE_WITH_YOUR_SANDBOX_KEY
AUTUMN_TEST_CUSTOMER_ID=johns-org
AUTUMN_TEST_FEATURE_ID=generated_images
AUTUMN_TEST_CREDIT_POOL_ID=image_credits

BILLING_DATABASE_URL=REPLACE_WITH_THE_FILE_URL_PRINTED_BELOW
BILLING_IDENTITY_CONFIG_FILE=data/autumn-sandbox/identity.json
AUTUMN_CONFIG_FILE=data/autumn-sandbox/autumn.json
```

Print the database URL from your project root and paste the entire output into `BILLING_DATABASE_URL`:

```bash
node --input-type=module -e 'import { resolve } from "node:path"; import { pathToFileURL } from "node:url"; console.log(pathToFileURL(resolve("data/autumn-sandbox/billing.db")).href)'
```

For example, a project at `/home/alex/billing-demo` prints `file:///home/alex/billing-demo/data/autumn-sandbox/billing.db`. The command also handles spaces in paths. The sandbox database is separate from `data/billing.db`, so local simulated identities and balances stay in their original database.

Leave `BILLING_CONFIG_FILE` unset, rather than setting it to an empty string. The entry point already selects Autumn and the bundled one- and three-credit policies. Remove any exported environment variables pointing to another experiment's configuration: shell variables take precedence over `.env`. Leave `AUTUMN_SERVER_URL` unset to contact the real Autumn service.

### 6. Provision the JWT principal and server configuration

```bash
npm run setup:autumn
```

The command checks the existing sandbox customer, feature, flat 1:1 pool mapping and available allowance through the pinned Autumn SDK. These checks don't reserve or consume credits. It then provisions John and his personal workspace in the sandbox database, binds that workspace to the configured Autumn customer, and writes:

| File under `data/autumn-sandbox/` | Purpose                                                    |
| --------------------------------- | ---------------------------------------------------------- |
| `billing.db`                      | Persistent identities, membership, executions and receipts |
| `identity.json`                   | Issuer, audience and public verification key               |
| `autumn.json`                     | Workspace/customer and meter/feature/pool bindings         |
| `signing-key.json`                | Private demo signing key, reused for renewal               |
| `profile.json`                    | John/workspace IDs, signed JWT and expiration              |

All generated files stay in ignored `data/`, with private permissions. The key never goes into Studio. Setup prints the workspace ID and token expiration, not the token. Running setup again with the same configuration reuses the identity, workspace and signing key and issues a fresh JWT. It preserves execution history and never replenishes spent credits. A changed customer/feature/pool binding is rejected rather than silently moving an existing payer.

Starting the server also creates `data/autumn-sandbox/workflow.db` for native workflow and conversation persistence. The bundled image service stores PNGs in `data/private-images/`. Preserve both directories when backing up this sandbox; the billing database alone doesn't contain transcripts or image bytes.

This command replaces `npm run setup` for this walkthrough. The local setup command accepts only local simulated billing; `data/local-profiles.json` credentials don't authenticate in Autumn mode.

### 7. Start Studio and authenticate

In the first terminal:

```bash
npm run dev
```

If a local-mode server is already running, stop it before starting this one. In a second terminal at the same project root, print the complete header value:

```bash
npm run --silent autumn:header
```

On macOS, copy it without displaying it:

```bash
npm run --silent autumn:header | pbcopy
```

Open [Mastra Studio](http://127.0.0.1:4111/settings). Under **Settings → Mastra Connection → Headers**, set the name to `Authorization` and paste the complete `Bearer ...` value. Select **Save configuration**. Use `http://127.0.0.1:4111` as the Mastra instance URL and `/api` as the prefix. Remove an old `X-Billing-Workspace` header for this personal-workspace test.

Verify the running server without generating images:

```bash
npm run autumn:check
```

Expect HTTP 200 for agent definitions and conversation history, followed by an account response with `mode: "autumn"`, `authority: "provider-reservations"` and a `credits` meter. Record its opening `confirmedBalance` as B. The command reads the actual Autumn balance; it doesn't charge credits. Start with at least four available credits.

### 8. Test billed operations in Studio

1. Open **Agents → Studio Assistant** and ask: “Generate one private illustration of a blue bird in a quiet forest.” Check the structured receipt for `executionStatus: "completed"`, settled billing and `billedUnits: 1`, plus a private artifact reference. Run `npm run autumn:check` again; available credits should be B − 1.
2. Ask: “Create a three-style illustration kit of the same blue bird.” Expand the **Image kit start** or **Image kit query** tool card and review `result.pending.approval.prompts`. The three saved prompts request separate, single-panel illustrations in Notion-inspired, 3D and vector styles. While approval is pending, three credits are held: available credits show B − 4. A hold isn't a confirmed charge.
3. Select **Approve**. After all three images persist and settlement confirms, expect one parent receipt with `billedUnits: 3`; nested image agents have no separate charge. The available balance remains B − 4.
4. Reopen the conversation and ask: “Query my saved image and kit operations.” Querying saved work doesn't generate again or consume more credits.
5. For a separate cancellation test, start another kit and select **Decline**. Its receipt must show cancellation and release before you treat the held credits as returned. **Stop** only ends conversation activity; explicitly ask to cancel if business work should be canceled.

Compare the account response with the customer's **Image Credits** balance in Autumn. `providerUsageIncludingHolds` includes reservations; `consumedUnits` is `null` in Autumn mode. Use confirmed receipts to distinguish consumption from holds. Pending/uncertain settlement requires reconciliation, not another generation attempt. To download a PNG, use the command in the [authenticated image download guide](images.md#download-a-private-artifact), passing `data/autumn-sandbox/profile.json` as its fourth argument to select the sandbox JWT and workspace.

### 9. Renew an expired JWT

JWTs last eight hours. To renew without changing the user, workspace, key or balance:

```bash
npm run autumn:renew
npm run --silent autumn:header
npm run autumn:check
```

Replace the saved Studio **Authorization** value with the new output and select **Save configuration**. No server restart is needed for renewal because the public key stays the same. The command can renew after the previous JWT expires, but still verifies that the principal and membership are active. It doesn't contact Autumn or run a business operation. Previously issued tokens remain valid until their own expiration.

Keep `signing-key.json`, `profile.json` and the database together. Deleting the signer is not a renewal procedure. The demo signing key is local test administration; replace it with your real identity provider before deploying for real users. Autumn provides billing, not your application's login.

### Troubleshoot the sandbox walkthrough

| Symptom                                     | Action                                                                                                                                                                              |
| ------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| HTTP 401 in Studio                          | Use `autumn:header`, not `local-profiles.json` or the Autumn secret key. Renew if expired and save the configuration.                                                               |
| `Your API key has expired` in the assistant | Replace `OPENAI_API_KEY` with a valid model key, then restart `npm run dev`. This model API error is separate from the Studio JWT; renewing the JWT doesn't refresh the OpenAI key. |
| API check passes but Studio fails           | Check the Studio URL/prefix, saved header, and any stale workspace header.                                                                                                          |
| Setup rejects the environment               | Use the exact sandbox paths and database URL above; remove duplicate/exported settings and leave `BILLING_CONFIG_FILE` unset.                                                       |
| Customer or feature not found               | Check Sandbox is selected and copy IDs, not names, Stripe IDs or URLs.                                                                                                              |
| Missing/unsupported allowance               | Attach the plan to the existing customer; grant the pool, disable unlimited/overage, and use a flat 1:1 rate.                                                                       |
| Setup lock exists                           | Confirm no setup/renew command is running, then remove only `data/autumn-sandbox/setup.lock` and retry.                                                                             |
| Missing key or changed payer binding        | Restore the original sandbox files and IDs; don't delete the database or reset balances to fix authentication.                                                                      |

### Optional: test a paid subscription

The free allowance above exercises real sandbox reservations and settlement without a payment flow. To also try a recurring paid plan, follow Autumn's [plan configuration](https://docs.useautumn.com/documentation/concepts/plans) and [payment setup](https://docs.useautumn.com/documentation/getting-started/setup):

1. In sandbox **Plans → Create Plan**, create **Studio Pro**, ID `studio-pro`, with **Paid → Recurring**, for example USD 10 per month. Keep **Auto-enable** off.
2. Add `image_credits` with 100 included credits per month, finite usage and no overage. Save and activate. Copy its plan ID from the plan editor; this is not a Stripe product or price ID.
3. Add `AUTUMN_TEST_PLAN_ID=studio-pro` to `.env`, replacing the ID if yours differs. The bundled one-/three-credit policies still apply; a paid plan grants credits rather than automatically adding a subscription requirement to those policies.
4. With the sandbox `.env` loaded, request a test checkout using the SDK already installed in the template:

```bash
node --env-file=.env --input-type=module <<'JS'
import { Autumn } from 'autumn-js';
if (!process.env.AUTUMN_SECRET_KEY?.startsWith('am_sk_test_')) throw new Error('Use a sandbox key.');
if (!process.env.AUTUMN_TEST_CUSTOMER_ID || !process.env.AUTUMN_TEST_PLAN_ID) throw new Error('Set customer and plan IDs.');
const autumn = new Autumn({ secretKey: process.env.AUTUMN_SECRET_KEY, xApiVersion: '2.6.0', failOpen: false, retryConfig: { strategy: 'none' }, useEdge: false });
const customer = await autumn.customers.get({ customerId: process.env.AUTUMN_TEST_CUSTOMER_ID });
if (customer.env !== 'sandbox') throw new Error('The customer must be in sandbox.');
const result = await autumn.billing.attach({ customerId: customer.id, planId: process.env.AUTUMN_TEST_PLAN_ID, redirectMode: 'always' });
console.log(result.paymentUrl);
JS
```

Open the returned checkout URL and complete the sandbox checkout with Stripe's test card `4242 4242 4242 4242`, a future expiry and any valid test CVC. Confirm the subscription is active on the Autumn customer and its credits are available before running `npm run autumn:check` again. This command requests a plan change; run it only when you intend that sandbox purchase. It isn't part of JWT renewal or startup.

`AUTUMN_TEST_PLAN_ID` is used only by the checkout command above. The basic Studio test doesn't require it or a `plans` binding. For application-managed checkout or subscription-gated policies, configure the logical `plans`/`subscriptions` mappings and policies described below. A successful reservation proof doesn't establish that checkout has been tested.

## Configuration

Use this section when connecting your own identity provider or resources instead of the sandbox walkthrough's demo signer.

Autumn startup is separate from `npm run setup`, which only prepares local simulated profiles. Use an existing sandbox customer with available test credits, a consumable metered image feature, and a credit pool with flat 1:1 conversion. Startup does not create remote products, attach plans or refill balances. The template does not provide a payment dashboard. Provision these resources through your own trusted Autumn administration flow before starting the app.

Set these server environment variables:

- `BILLING_MODE=production` and `BILLING_PROVIDER=autumn`, including when using an Autumn sandbox key. Production here selects verified JWT identity; it does not change a sandbox key into a live key.
- `OPENAI_API_KEY` for generation, independently of billing, and optionally `BILLING_STUDIO_ENABLED=true` for Studio Tools.
- `AUTUMN_SECRET_KEY` from your Autumn environment, never a browser header.
- `BILLING_IDENTITY_CONFIG_FILE` pointing to a JSON file with your trusted issuer, audience, allowed asymmetric algorithms and public JWKS. See [identity provisioning](#identity-provisioning).
- Optional `BILLING_CONFIG_FILE` pointing to a file containing the complete JSON below, matching the protected registrations in `src/mastra/index.ts`. Leave it unset to use the entry-point configuration. `localAccounts` must be empty. This is a full configuration override, not a partial patch. The override must agree with the registered policies, operations and measurements; it cannot add native resources or actions. Keep both bundled resource IDs and kinds. When supplying your own typed catalog, its resource definitions and the override must agree. The example below retains the bundled one-credit image and three-credit kit policies.

```json
{
  "provider": "autumn",
  "hosted": { "returnUrls": [] },
  "catalog": { "allowances": [], "offers": [] },
  "resourcePolicies": [
    {
      "id": "image-agent",
      "kind": "agent",
      "operations": ["generate"],
      "measurements": [],
      "policy": {
        "version": "image-agent-v1",
        "charge": { "type": "credits", "meter": "credits", "units": 1 }
      }
    },
    {
      "id": "image-kit",
      "kind": "workflow",
      "operations": ["start", "resume", "cancel"],
      "measurements": [],
      "policy": {
        "version": "image-kit-v2",
        "suspendedReservationTtlMs": 1800000,
        "charge": { "type": "credits", "meter": "credits", "units": 3 }
      }
    }
  ],
  "billingKeys": {
    "entitlements": [],
    "subscriptions": [],
    "meters": [{ "key": "credits", "unit": "credits", "funding": ["prepaid"] }]
  },
  "localAccounts": []
}
```

Set `AUTUMN_CONFIG_FILE` to the path of a file containing this server-owned JSON. Replace `TRUSTED_WORKSPACE_ID` with the personal workspace returned by trusted provisioning of John below. `johns-org`, `generated_images` and `image_credits` must be the IDs of your existing sandbox resources, not IDs supplied by the browser. The sandbox proof uses the same logical `credits` mapping with its isolated `johns-org-sandbox-proof` workspace.

```json
{
  "customers": [{ "workspaceId": "TRUSTED_WORKSPACE_ID", "customerId": "johns-org", "name": "John's Org" }],
  "meters": [{ "key": "credits", "featureId": "generated_images", "creditPoolId": "image_credits" }],
  "subscriptions": [],
  "entitlements": [],
  "plans": [],
  "returnUrls": []
}
```

Save each JSON object in its own external file, for example `configuration/billing.json`, `configuration/autumn.json` and `configuration/identity.json`. Set `BILLING_CONFIG_FILE`, `AUTUMN_CONFIG_FILE` and `BILLING_IDENTITY_CONFIG_FILE` to those paths. Relative paths resolve from the project root in setup, dev and built serving. Absolute paths are supported. Explicit empty, missing, unreadable, malformed or schema-invalid files fail startup with a sanitized configuration error; they never fall back to defaults. The previous serialized environment JSON variables are no longer read. Keep `AUTUMN_SECRET_KEY` and model keys as scalar environment variables; files contain configuration and public identity keys, not secrets.

### Identity provisioning

The JSON file selected by `BILLING_IDENTITY_CONFIG_FILE` has this shape: `{ issuer, audience, algorithms, jwks: { keys: [...] } }`. Supply the actual issuer URL and audience used by your identity provider, an explicit list such as `["RS256"]`, and its matching public asymmetric JWKs. Empty keys, private key material and symmetric algorithms are rejected. Tokens need valid `iss`, `aud`, `sub` and `exp` claims. The app verifies tokens but does not issue them or provide login.

Provision John once in trusted server-side TypeScript against the same configured database and environment used by the app:

```ts
import { configuredOrganizations } from './src/billing/environment.js';

const organizations = await configuredOrganizations(process.env);
try {
  const john = await organizations.provisionJwt({
    issuer: trustedIssuer,
    subject: trustedJohnSubject,
    displayName: 'John',
  });
  // Bind john.workspaceId to the existing johns-org customer on the server.
  // John's signed token must carry the same issuer and subject.
  console.log(john.workspaceId);
} finally {
  organizations.close();
}
```

`trustedIssuer` and `trustedJohnSubject` come from your identity administration, not a client request. Provisioning creates a personal organization owned by John. Provision other people separately; shared membership requires explicit conversion and invitations. No local credential from `data/local-profiles.json` is accepted in Autumn mode. Save John's issued JWT in Studio's **Settings → Mastra Connection → Headers** as `Authorization: Bearer <token>`, or use it on the authenticated HTTP routes. Keep token entry off camera. Once the environment, identity and remote allowance are ready, run `npm run dev`; use `npm run build` then `npm start` for built serving.

Customers are selected by authenticated workspace ID, never a client-supplied customer ID. Optional configured names/emails are trusted provisioning data. Each customer ID must map to one workspace. The driver verifies that the feature is consumable and that the credit pool has a flat 1:1 conversion with no dimensions or multipliers. Unlimited balances, overage and unsupported mappings fail closed.

`initializeBilling` and `initializeMastraBilling` resolve Autumn automatically from `BILLING_PROVIDER=autumn` and the server environment. For an embedded integration, pass `billingProvider: await AutumnBillingProvider.open({ url: databaseUrl }, { secretKey, bindings })` instead; the option accepts the common provider interface. `environment` defaults to `process.env` and can be supplied explicitly for an isolated application. Keep credentials outside configuration snapshots and source control. Account setup uses Autumn's get-or-create with the stable configured customer ID; it does not attach a plan or replenish credits. Configure plans and test balances separately in Autumn.

Checkout maps a logical catalog offer key to `plans[].planId`. Both the application `hosted.returnUrls` and provider `returnUrls` must allow the exact return URL. Checkout/portal dispatch retains the existing owner authorization and durable action key. Hosted payments require a separately configured payment processor; a reservation proof does not verify purchases.

Each workspace has one immutable Autumn customer in its billing database. Restore the original customer mapping to recover pending settlement if the mapping changes. Resuming an existing reservation also requires the original feature and credit pool. Hosted session replay requires the original payer and, for checkout, the original mapped plan.

## Policies and deadlines

Free and subscription-only policies create no credit hold. Fixed credits, prepaid tasks and bounded prepaid measurements reserve before compute; measured success confirms the trusted observed units, up to the reserved maximum. Failed/canceled work releases the hold. Nested agent calls belong to the parent's budget.

A policy may set `suspendedReservationTtlMs` and `reservationBudget`:

```ts
policy: {
  version: 'image-kit-v2',
  charge: { type: 'credits', meter: 'credits', units: 3 },
  suspendedReservationTtlMs: 1_800_000,
  reservationBudget: {
    executionMs: 120_000,
    finalizationMs: 30_000,
    expiryMarginMs: 30_000,
    lifetimeMs: 2_000_000,
  },
}
```

The sum of suspension, execution, finalization and expiry margin must fit the lifetime, capped at 24 hours. Each running segment has a persisted execution deadline. Initial work can use the time remaining before the fixed cutoff. Resume rechecks authorization, eligibility and the owned hold, and requires room for a full execution segment. An active deadline triggers cancellation and release of an acknowledged hold when no confirmation has won. The release remains pending until the provider confirms it. Application cutoffs precede the explicit remote expiry. Remote expiry is eventual: an in-budget dispatched confirmation can settle afterward.

Postpaid task/usage remains supported by local mode. Autumn postpaid is explicitly unavailable until its idempotency-header, retention and lost-ack behavior is verified. This does not imply the Autumn API lacks idempotency support. Unsupported policies reject during configuration rather than silently changing financial behavior.

## Receipts and recovery

SQL claims the logical request and commits immutable provider payloads before dispatch. No database transaction includes network I/O. An ambiguous reserve acknowledgement never authorizes compute; a duplicate 409 or historical reserve log cannot establish current ownership. The request remains visible and is never re-reserved or recomputed automatically. A cancellation that wins before native handoff makes an acknowledged initial hold eligible for one release. During handoff, cancellation stays pending while the owner checks the native outcome. A terminal result from the owning invocation follows the same completion and deadline rules. When cancellation advances the version, a corroborated terminal result from the previous invocation can establish that work ended and allow release. The previous result stays private. Canceling a resume before native dispatch requires a preparation recorded for that version and confirmation that its native suspension closed. A winning cancellation records recovery intent and verifies the native suspension durably before canceling it. Replays and the worker can finish that same cancellation after interruption, using a version and lease to fence concurrent recovery. Older in-flight resumes without a preparation record retain uncertain settlement. If the owner process dies before handoff, recovery can release an acknowledged initial hold. Recovery leaves a handoff with a dead owner uncertain because native work may have started. A missing reserve or release acknowledgement keeps the billed amount unknown.

Execution completion and financial settlement are separate. A saved result can have `settlementStatus: 'pending'` and `billedUnits: null`. A known computation outcome is persisted first. A second SQL transaction chooses the immutable confirm/release request together with its one-time dispatch claim. If confirmation time has expired before that claim, it chooses release and marks the execution unsuccessful while preserving the stored result. An already claimed confirmation is never replaced or released. Recovery uses the persisted payload and the original provider. If the active provider changes, restore the original provider to continue settlement. Unknown finalization is reconciled only by a status-200 provider log whose customer, lock, action, override value and successful response match exactly. Missing logs, 400/409, timeouts and elapsed time remain uncertain. Log availability and retention are provider limitations, so some operations may require operator investigation indefinitely.

A confirmed prepaid lock creates one local audit entry and no deducting usage export. Balance views show provider authority, observation time and bounded pending settlement counts. Autumn's remaining balance already includes its holds. `providerUsageIncludingHolds` is reported separately; `consumedUnits` stays null because that remote usage value does not distinguish confirmed consumption from active holds.

## SDK and verification

The driver pins `autumn-js@1.5.72` (MIT), generated SDK 0.10.18, API version `2.6.0`. The package imports the MIT `fzstd` runtime without declaring it, so the template explicitly pins `fzstd@0.1.1` for clean installs. The client disables fail-open, automatic retries and edge routing, and sets a bounded timeout. An HTTP hook rejects API 202 before the SDK can expose an allowed/success flag.

Controlled HTTP tests run the actual SDK, JWT organizations, SQL, gateway and Mastra lifecycle. The live sandbox command requires an explicit opt-in and an already provisioned test customer:

```sh
node --env-file=.env scripts/test-autumn-sandbox.mjs --live
```

It requires `AUTUMN_SECRET_KEY`, `AUTUMN_TEST_CUSTOMER_ID=johns-org` and `AUTUMN_TEST_FEATURE_ID=generated_images`; `AUTUMN_TEST_CREDIT_POOL_ID` defaults to `image_credits`. It checks the customer's sandbox environment before mutations, requires at least six available test credits, consumes at most two, and never invokes OpenAI or purchases a plan. It measures fresh opening/closing balances, atomic contention, duplicate requests, partial confirm, release, eventual expiry and lost finalization acknowledgement through a real socket. The named personal-customer configuration proof shares the existing reserve/partial-confirm lifecycle through a memoized result, so selecting the whole file still consumes at most two credits. It proves the documented logical image meter and trusted personal customer mapping, not a separate image-generation scenario. Missing evidence fails the proof. This command does not certify real payments or image generation.

For deterministic integration tests only, `AUTUMN_SERVER_URL` can select a loopback HTTP endpoint. Remote overrides are rejected. `AUTUMN_TIMEOUT_MS` optionally sets the request timeout from 100 to 30,000 milliseconds. Neither setting enables SDK retries or fail-open behavior.
