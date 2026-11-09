# Billing in Studio

Set `BILLING_STUDIO_ENABLED=true` in `.env`, then run `npm run dev` and open <http://127.0.0.1:4111/tools>. Local setup and the authenticated CLI remain available. `npm run build` includes Studio when this flag is set; `npm start` serves the built Studio. Rebuild after changing the flag.

## Authentication

Open **Settings → Headers**, add `Authorization` with value `Bearer <credential>`, and save. For local mode use the owner credential from the private `data/local-profiles.json`. For Polar use a JWT from your configured issuer. The token must have a valid signature, issuer, audience, subject and expiration and match a previously provisioned, active local principal. Expired tokens must be replaced in Settings.

The Studio shell and authentication capabilities are public so Settings remains reachable. Tool and agent definitions require authentication. The browser stores custom headers; use a dedicated demonstration profile and keep the token and Settings screen out of recordings. API keys, signing keys and Polar credentials stay on the server. Studio request context cannot select a different identity.

Polar setup requires `BILLING_MODE=production`, `BILLING_PROVIDER=polar`, `BILLING_JWT_CONFIGURATION`, `BILLING_CONFIGURATION`, `BILLING_CONTACTS` and `POLAR_ACCESS_TOKEN`. See [billing configuration](billing.md#polar). Keep credentials in `.env`, never in the committed configuration.

To preserve an existing Polar customer's `external_id` of `workspace:northstar`, provision its trusted application owner with the stable workspace ID:

```ts
await organizations.provisionJwt({
  issuer: 'https://identity.example.com',
  subject: 'northstar-owner',
  displayName: 'Northstar Travel',
  workspaceId: 'northstar',
});
```

This is a trusted server setup API, never a browser endpoint. Repeated provisioning preserves identity and membership. A different principal cannot claim the same workspace, and an existing principal cannot be moved by reprovisioning. Without `workspaceId`, provisioning generates an ID as before. Convert the personal workspace to shared and invite members through the existing organization APIs. Polar resolves `workspace:<workspaceId>` and verifies its seller association; contact email is not an identity match.

## Run billed actions

Open a tool and choose **Playground**. The Form and JSON views use the same schemas. Every tool takes `workspaceId`, which is checked against the authenticated user's current membership.

| Tool                             | Input beyond workspaceId                                        | Result                                                         |
| -------------------------------- | --------------------------------------------------------------- | -------------------------------------------------------------- |
| `billing-account`                | None                                                            | Owner-only allowance, consumed, reserved and spendable credits |
| `billing-weather-summary`        | `idempotencyKey`, `observations`                                | Summary and billing receipt                                    |
| `billing-weather-report-start`   | `idempotencyKey`, `observations`                                | Suspended draft with `executionId`; reservation held           |
| `billing-weather-report-status`  | `executionId`                                                   | Private report status and receipt                              |
| `billing-weather-report-approve` | `executionId`, `idempotencyKey`, `approval: {"approved": true}` | Completed report and one capture                               |
| `billing-weather-report-cancel`  | `executionId`, `idempotencyKey`                                 | Cancellation and reservation release                           |

For example, submit this to `billing-weather-summary` with your provisioned workspace ID:

```json
{
  "workspaceId": "northstar",
  "idempotencyKey": "weather-summary-001",
  "observations": {
    "location": "Porto Alegre",
    "observedAt": "2026-11-09T12:00:00Z",
    "temperatureC": 24,
    "feelsLikeC": 26,
    "humidityPercent": 70,
    "windKph": 18,
    "precipitationChancePercent": 60,
    "conditions": "Cloudy with showers possible"
  }
}
```

The default summary policy costs 3 credits. The default local report policy costs 1 task; the configured Polar policy determines its charge. Copy the report's `executionId` into status, approval or cancellation. The creator alone can access a private report, including after restarting the server. A successful nested agent call contributes to the report's measurement without a separate summary charge.

Repeat the exact input and idempotency key to replay its saved result. The receipt keeps its original `billedUnits` and sets `replayed: true`; it does not represent a new charge. Use a new key for new work. Schema errors are rejected before execution. Tool failures return a safe `error` object; they must not be interpreted as successful work.

The integration uses **Tools**, not native agent chat or native workflow runs. Those execution routes and private memory, traces and run storage remain closed. Adding a new Studio action requires adding its authenticated gateway tool; enabling Studio never opens all native APIs.

## Credits in Polar mode

Use `billing-account` before and after execution. `allowance` is the application ledger: verified grants, committed consumption, active reservations and spendable credit. Grants come from eligible Polar orders and subscription periods, not a seeded balance. A summary deducts immediately after success; a suspended report reserves its configured amount and deducts only on successful approval. Cancellation releases the reservation.

Usage is delivered asynchronously to Polar through the durable outbox. Polar's displayed meter can lag behind the application ledger. Wait for export and confirm the matching event and consumed units; do not reset local storage or grant extra credits to force the numbers to agree.

Studio custom headers and tool testing are described in the [Mastra Studio documentation](https://mastra.ai/docs/studio/overview).
