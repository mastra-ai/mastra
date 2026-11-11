# Billing in Studio

Set `BILLING_STUDIO_ENABLED=true` in `.env`, then run `npm run dev` and open <http://127.0.0.1:4111/tools>. Local setup and the authenticated CLI remain available. `npm run build` includes Studio when this flag is set; `npm start` serves the built Studio. Rebuild after changing the flag.

## Authentication

Open **Settings → Headers**, add `Authorization` with value `Bearer <credential>`, and save. For local mode use the owner credential from the private `data/local-profiles.json`. For Autumn use a JWT from your configured issuer. The token must have a valid signature, issuer, audience, subject and expiration and match a previously provisioned, active local principal. Expired tokens must be replaced in Settings.

The Studio shell and authentication capabilities are public so Settings remains reachable. Tool and agent definitions require authentication. The browser stores custom headers; use a dedicated demonstration profile and keep the token and Settings screen out of recordings. API keys, signing keys and Autumn credentials stay on the server. Studio request context cannot select a different identity.

Autumn mode requires `BILLING_MODE=production`, `BILLING_PROVIDER=autumn`, `BILLING_JWT_CONFIGURATION`, `BILLING_CONFIGURATION`, `AUTUMN_SECRET_KEY` and trusted `AUTUMN_BINDINGS`. See the [Autumn guide](autumn.md). Provision trusted JWT principals and personal/shared workspace membership before accepting requests. Customer IDs come from server bindings, never from Studio request context.

Local setup creates John (`profiles.owner`), Mary (`profiles.member`), and Alex (`profiles.outsider`) with separate personal organizations and balances. Use each person's own credential and workspace ID. To share an allowance, explicitly convert the owner's workspace and invite the other person through the organization APIs. Setup never creates shared membership automatically.

## Run billed actions

Open a tool and choose **Playground**. The Form and JSON views use the same schemas. Every tool takes `workspaceId`, which is checked against the authenticated user's current membership.

| Tool                        | Input beyond workspaceId                                        | Result                                                          |
| --------------------------- | --------------------------------------------------------------- | --------------------------------------------------------------- |
| `billing-account`           | None                                                            | Owner-only provider balance, consumption and pending operations |
| `billing-image-generate`    | `idempotencyKey`, `brief`                                       | Private image reference and billing receipt                     |
| `billing-image-kit-start`   | `idempotencyKey`, `brief`                                       | Saved prompts with `executionId`; reservation held              |
| `billing-image-kit-status`  | `executionId`                                                   | Private kit status and receipt                                  |
| `billing-image-kit-approve` | `executionId`, `idempotencyKey`, `approval: {"approved": true}` | Completed kit and one capture                                   |
| `billing-image-kit-cancel`  | `executionId`, `idempotencyKey`                                 | Cancellation and reservation release                            |

For example, submit this to `billing-image-generate` with your provisioned workspace ID:

```json
{
  "workspaceId": "northstar",
  "idempotencyKey": "image-001",
  "brief": "A small blue bird in a quiet forest"
}
```

The image agent costs one credit. The kit saves three prompts for the same subject as book and website illustrations, in order: Notion-inspired, 3D, and vector illustration. Review `result.pending.approval.prompts` before approving. The kit costs three credits only after all images persist. Copy its `executionId` into status, approval or cancellation. The creator alone can access the private result after a restart. Nested image calls have no separate charge.

Artifact references are metadata. A browser image URL does not inherit Studio's saved authorization header. Use the authenticated download described in the [image guide](images.md). Inline Studio image presentation requires separate verification.

Repeat the exact input and idempotency key to replay its saved result. The receipt keeps its original `billedUnits` and sets `replayed: true`; it does not represent a new charge. Use a new key for new work. Schema errors are rejected before execution. Tool failures return a safe `error` object; they must not be interpreted as successful work.

The integration uses **Tools**, not native agent chat or native workflow runs. Those execution routes and private memory, traces and run storage remain closed. Adding a new Studio action requires adding its authenticated gateway tool; enabling Studio never opens all native APIs.

## Balances and receipts

Use `billing-account` before and after execution. `mode` identifies local simulation or Autumn; `authority` identifies provider reservations. Meters show the provider's balance and consumption at `observedAt`, with `pendingOperations` separately identifying unresolved work. `allowance` is `null`; there is no application-owned paid grant ledger.

A suspended kit holds its reservation without a confirmed charge. Successful completion confirms that same reservation; cancellation releases it. Unknown finalization stays pending or uncertain until positive matching evidence arrives. Replaying a receipt never creates another financial operation. Metered local policies use the separate outbox and may reflect consumption after background delivery.

Studio custom headers and tool testing are described in the [Mastra Studio documentation](https://mastra.ai/docs/studio/overview).
