# Autumn billing

Autumn owns paid credit balances and reservations. Local mode simulates the same reserve, execute, confirm or release lifecycle in the private SQL database and needs no payment credentials. The bundled image agent costs one credit; the approval kit costs three credits after complete success. OpenAI image generation uses a separate API key.

## Configuration

Autumn startup is separate from `npm run setup`, which only prepares local simulated profiles. Use an existing sandbox customer with available test credits, a consumable metered image feature, and a credit pool with flat 1:1 conversion. Startup does not create remote products, attach plans or refill balances. The template does not provide a payment dashboard. Provision these resources through your own trusted Autumn administration flow before starting the app.

Set these server environment variables:

- `BILLING_MODE=production` and `BILLING_PROVIDER=autumn`, including when using an Autumn sandbox key. Production here selects verified JWT identity; it does not change a sandbox key into a live key.
- `OPENAI_API_KEY` for generation, independently of billing, and optionally `BILLING_STUDIO_ENABLED=true` for Studio Tools.
- `AUTUMN_SECRET_KEY` from your Autumn environment, never a browser header.
- `BILLING_JWT_CONFIGURATION` with your trusted issuer, audience, allowed asymmetric algorithms and public JWKS. See [identity provisioning](#identity-provisioning).
- `BILLING_CONFIGURATION` containing the complete JSON below, matching the bundled definitions in `src/images/resources.ts`. `localAccounts` must be empty. This is a full configuration override, not a partial patch. The bundled catalog applies the configured policies, operations and measurements to its existing image definitions; it cannot add factories or actions. Keep both bundled resource IDs and kinds. When supplying your own typed catalog, its resource definitions and the override must agree. The example below retains the bundled one-credit image and three-credit kit policies.

```json
{
  "provider": "autumn",
  "hosted": { "returnUrls": [] },
  "catalog": { "allowances": [], "offers": [] },
  "resources": [
    {
      "id": "image-agent",
      "kind": "agent",
      "operations": ["generate"],
      "measurements": [],
      "policy": {
        "version": "image-agent-v1",
        "charge": { "type": "credits", "meter": "image-credits", "units": 1 }
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
        "charge": { "type": "credits", "meter": "image-credits", "units": 3 }
      }
    }
  ],
  "mappings": {
    "entitlements": [],
    "subscriptions": [],
    "meters": [{ "key": "image-credits", "unit": "credits", "funding": ["prepaid"] }]
  },
  "localAccounts": []
}
```

Set `AUTUMN_BINDINGS` to this server-owned JSON. Replace `TRUSTED_WORKSPACE_ID` with the personal workspace returned by trusted provisioning of John below. `johns-org`, `generated_images` and `image_credits` must be the IDs of your existing sandbox resources, not IDs supplied by the browser. The sandbox proof uses the same logical `image-credits` mapping with its isolated `johns-org-sandbox-proof` workspace.

```json
{
  "customers": [{ "workspaceId": "TRUSTED_WORKSPACE_ID", "customerId": "johns-org", "name": "John's Org" }],
  "meters": [{ "key": "image-credits", "featureId": "generated_images", "creditPoolId": "image_credits" }],
  "subscriptions": [],
  "entitlements": [],
  "plans": [],
  "returnUrls": []
}
```

For `.env`, serialize each JSON object on one line with the quoting supported by your environment loader, or inject the JSON directly through your process environment. Since the customer name contains an apostrophe, avoid wrapping that JSON in unescaped single quotes. Do not place secret keys inside `BILLING_CONFIGURATION` or `AUTUMN_BINDINGS`.

### Identity provisioning

`BILLING_JWT_CONFIGURATION` has this shape: `{ issuer, audience, algorithms, jwks: { keys: [...] } }`. Supply the actual issuer URL and audience used by your identity provider, an explicit list such as `["RS256"]`, and its matching public asymmetric JWKs. Empty keys, private key material and symmetric algorithms are rejected. Tokens need valid `iss`, `aud`, `sub` and `exp` claims. The app verifies tokens but does not issue them or provide login.

Provision John once in trusted server-side TypeScript against the same configured database and environment used by the app:

```ts
import { configuredOrganizations } from './src/mastra/environment.js';

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

The same options can be passed to `initializeMastraBilling({ autumn: { secretKey, bindings }, ... })`. Keep credentials outside configuration snapshots and source control. Account setup uses Autumn's get-or-create with the stable configured customer ID; it does not attach a plan or replenish credits. Configure plans and test balances separately in Autumn.

Checkout maps a logical catalog offer key to `plans[].planId`. Both the application `hosted.returnUrls` and provider `returnUrls` must allow the exact return URL. Checkout/portal dispatch retains the existing owner authorization and durable action key. Hosted payments require a separately configured payment processor; a reservation proof does not verify purchases.

Each workspace has one immutable Autumn customer in its billing database. Restore the original customer mapping to recover pending settlement if the mapping changes. Resuming an existing reservation also requires the original feature and credit pool. Hosted session replay requires the original payer and, for checkout, the original mapped plan.

## Policies and deadlines

Free and subscription-only policies create no credit hold. Fixed credits, prepaid tasks and bounded prepaid measurements reserve before compute; measured success confirms the trusted observed units, up to the reserved maximum. Failed/canceled work releases the hold. Nested agent calls belong to the parent's budget.

A policy may set `suspendedReservationTtlMs` and `reservationBudget`:

```ts
policy: {
  version: 'image-kit-v2',
  charge: { type: 'credits', meter: 'image-credits', units: 3 },
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
