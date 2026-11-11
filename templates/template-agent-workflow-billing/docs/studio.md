# Billing in Studio

Set `BILLING_STUDIO_ENABLED=true` in `.env`, then run `npm run dev` and open <http://127.0.0.1:4111/tools>. Local setup and the authenticated CLI remain available. `npm run build` includes Studio when this flag is set; `npm start` serves the built Studio. Rebuild after changing the flag.

## Authentication

Open **Settings → Headers**, add `Authorization` with value `Bearer <credential>`, and save. For local mode use the owner credential from the private `data/local-profiles.json`. For Autumn use a JWT from your configured issuer. The token must have a valid signature, issuer, audience, subject and expiration and match a previously provisioned, active local principal. Expired tokens must be replaced in Settings.

The Studio shell and authentication capabilities are public so Settings remains reachable. Tool and agent definitions require authentication. The browser stores custom headers; use a dedicated demonstration profile and keep the token and Settings screen out of recordings. API keys, signing keys and Autumn credentials stay on the server. Studio request context cannot select a different identity.

Autumn mode requires `BILLING_MODE=production`, `BILLING_PROVIDER=autumn`, `BILLING_JWT_CONFIGURATION`, `BILLING_CONFIGURATION`, `AUTUMN_SECRET_KEY` and trusted `AUTUMN_BINDINGS`. See the [Autumn guide](autumn.md). Provision trusted JWT principals and personal/shared workspace membership before accepting requests. Customer IDs come from server bindings, never from Studio request context.

Local setup creates John (`profiles.owner`), Mary (`profiles.member`), and Alex (`profiles.outsider`) with separate personal organizations and balances. Use each person's own credential and workspace ID. To share an allowance, explicitly convert the owner's workspace and invite the other person through the organization APIs. Setup never creates shared membership automatically.

## Run billed actions

Open a tool and choose **Playground**. The Form and JSON views use the same schemas. Every tool takes `workspaceId`, which is checked against the authenticated user's current membership.

| Tool                             | Input beyond workspaceId                                        | Result                                                          |
| -------------------------------- | --------------------------------------------------------------- | --------------------------------------------------------------- |
| `billing-account`                | None                                                            | Owner-only provider balance, consumption and pending operations |
| `billing-weather-summary`        | `idempotencyKey`, `observations`                                | Summary and billing receipt                                     |
| `billing-weather-report-start`   | `idempotencyKey`, `observations`                                | Suspended draft with `executionId`; reservation held            |
| `billing-weather-report-status`  | `executionId`                                                   | Private report status and receipt                               |
| `billing-weather-report-approve` | `executionId`, `idempotencyKey`, `approval: {"approved": true}` | Completed report and one capture                                |
| `billing-weather-report-cancel`  | `executionId`, `idempotencyKey`                                 | Cancellation and reservation release                            |

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

The default summary policy costs 3 credits. The default local report policy costs 1 task; your configured policy determines its charge. Copy the report's `executionId` into status, approval or cancellation. The creator alone can access a private report, including after restarting the server. A successful nested agent call contributes to the report's measurement without a separate summary charge.

Repeat the exact input and idempotency key to replay its saved result. The receipt keeps its original `billedUnits` and sets `replayed: true`; it does not represent a new charge. Use a new key for new work. Schema errors are rejected before execution. Tool failures return a safe `error` object; they must not be interpreted as successful work.

The integration uses **Tools**, not native agent chat or native workflow runs. Those execution routes and private memory, traces and run storage remain closed. Adding a new Studio action requires adding its authenticated gateway tool; enabling Studio never opens all native APIs.

## Balances and receipts

Use `billing-account` before and after execution. `mode` identifies local simulation or Autumn; `authority` identifies provider reservations. Meters show the provider's balance and consumption at `observedAt`, with `pendingOperations` separately identifying unresolved work. `allowance` is `null`; there is no application-owned paid grant ledger.

A suspended report holds its reservation without a confirmed charge. Successful completion confirms that same reservation; cancellation releases it. Unknown finalization stays pending or uncertain until positive matching evidence arrives. Replaying a receipt never creates another financial operation. Metered local policies use the separate outbox and may reflect consumption after background delivery.

Studio custom headers and tool testing are described in the [Mastra Studio documentation](https://mastra.ai/docs/studio/overview).
