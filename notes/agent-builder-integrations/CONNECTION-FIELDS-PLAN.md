# Phase 12 — Per-Connection Custom Fields ("connection fields")

## Problem

Some Composio toolkits (Confluence, Jira, Zendesk, Shopify, Salesforce, …)
require **per-connection custom fields** at OAuth initiation time. For
example, Confluence needs `subdomain` ("`mycorp`" → "`mycorp.atlassian.net`").

Today `ComposioToolIntegration.authorize` calls
`composio.connectedAccounts.initiate(userId, authConfigId, { allowMultiple: true })`
with no `config`, so Composio responds:

```
400 ConnectedAccount_MissingRequiredFields
"Missing required fields: Your Subdomain"
```

The toolkit is unusable from our UI — the author has to create the
connection out-of-band on the Composio dashboard and then pin it via the
existing-connections picker. That's a dead-end for the v1 promise.

## Goal

Connect any Composio toolkit (including those with custom fields)
end-to-end from the agent builder, with no Composio-specific UI code in
the playground.

## Non-goals

- Editing custom fields on an existing connection (re-auth flow).
  Re-auth keeps the existing bucket; if the bucket already has fields,
  Composio reuses them. If those fields change in real life, the user
  deletes the connection and re-pins.
- Per-pin field overrides on the **agent** record (the fields belong to
  the **Composio connection**, not the pin).
- Other providers' equivalents (Arcade has no analogue today). The
  interface is shaped generically so future adapters can opt in.

## Scope

One self-contained phase. ~7 files, ~200 LOC including tests.

| Layer | File | Change |
|---|---|---|
| Core interface | `packages/core/src/tool-integration/tool-integration.ts` | Add `ConnectionField` type, `listConnectionFields` method, extend `AuthorizeOpts.config` |
| Core base | `packages/core/src/tool-integration/base.ts` | Add default `listConnectionFields` returning `[]` |
| Composio adapter | `packages/editor/src/providers/composio-integration.ts` | Implement `listConnectionFields` via `toolkits.getConnectedAccountInitiationFields`; thread `config` into `initiate` |
| Server schema | `packages/server/src/server/schemas/tool-integrations.ts` | Add `listConnectionFieldsResponseSchema`; extend `authorizeToolIntegrationBodySchema` with optional `config` |
| Server route | `packages/server/src/server/handlers/tool-integrations.ts` | Add `GET /tool-integrations/:id/tool-services/:slug/connection-fields`; thread `config` through `authorize` handler |
| Client SDK | `client-sdks/client-js/src/resources/tool-integration.ts` + `types.ts` | Add `listConnectionFields` method; extend `authorize` payload |
| Hook | `packages/playground/src/domains/tool-integrations/hooks/use-connection-fields.ts` (new) + `use-authorize.ts` | New query hook; `useAuthorize` accepts optional `config` |
| Picker UI | `packages/playground/src/domains/tool-integrations/components/connection-picker.tsx` | If `listConnectionFields().length > 0` → render inline `<ConnectionFieldsForm>` before "Connect" button; submit collects values and passes them to `authorize` |
| Tests | colocated `.test.ts(x)` files | New tests for the field-prompt flow, schema validation, server route, adapter SDK call |

## API additions

```ts
// core
export interface ConnectionField {
  name: string;           // 'subdomain'
  displayName: string;    // 'Your Subdomain'
  description?: string;   // 'example: mycorp for mycorp.atlassian.net'
  type: 'string' | 'number' | 'boolean';
  required: boolean;
  default?: string | null;
}

export interface AuthorizeOpts {
  toolService: string;
  connectionId: string;
  toolName?: string;
  /** Toolkit-specific custom fields (e.g. { subdomain: 'mycorp' }). */
  config?: Record<string, unknown>;   // NEW
}

export interface ToolIntegration {
  // ...existing...
  /**
   * Custom fields the user must supply when starting an OAuth flow for
   * this tool service. Default base implementation returns `[]`.
   */
  listConnectionFields(opts: { toolService: string }): Promise<ConnectionField[]>;
}
```

```ts
// composio adapter
async listConnectionFields({ toolService }: { toolService: string }) {
  const composio = this.getRawClient();
  const authConfigId = await this.resolveAuthConfigId(toolService);
  const cfg = await composio.authConfigs.get(authConfigId);  // for authScheme
  const fields = await composio.toolkits.getConnectedAccountInitiationFields(
    toolService,
    cfg.authScheme,
    { requiredOnly: false },
  );
  return fields.map(f => ({
    name: f.name,
    displayName: f.displayName,
    description: f.description,
    type: f.type as 'string' | 'number' | 'boolean',
    required: f.required ?? false,
    default: f.default ?? undefined,
  }));
}

// `authorize` — thread `opts.config` straight through:
await composio.connectedAccounts.initiate(internalUserId, authConfigId, {
  allowMultiple: true,
  ...(opts.config ? { config: opts.config } : {}),
});
```

## Server route

```
GET  /tool-integrations/:integrationId/tool-services/:toolService/connection-fields
     → { fields: ConnectionField[] }

POST /tool-integrations/:integrationId/authorize
     body: { toolService, connectionId, toolName?, config? }   // config NEW
```

Auth: same as existing `authorize` (RBAC `INTEGRATIONS_AUTHORIZE`).
No user-bucket resolution change.

## UI flow

`ConnectionPicker` (per tool service, in `ConnectionsDetail`):

1. On mount, fire `useConnectionFields({ integrationId, toolService })`.
2. While loading → existing "Connect" button stays disabled.
3. If `fields.length === 0` → keep current one-click "Connect" UX (no
   regression for Gmail, Slack, GitHub, etc.).
4. If `fields.length > 0` → render an inline form above "Connect":
   - One `<Input>` per field (string), `<Switch>` for boolean, type=number for number.
   - Labels: `displayName`. Helper text: `description`.
   - Required fields get a `*` and block submit while empty.
   - "Connect" button disabled until all required fields filled.
5. On click → `authorize.mutateAsync({ integrationId, toolService, config: collectedValues })`.
6. Existing redirect / poll flow continues unchanged.

No new dialog, no new route component — the form is inline in the existing
picker.

## Edge cases

- **`getConnectedAccountInitiationFields` failure**: fall back to
  zero-field flow with a console warning. User sees the current
  Composio 400 if fields are actually required — acceptable degraded
  mode (matches today's behavior).
- **`authConfigs.get` requires elevated scope**: if so, cache the
  `authScheme` per `authConfigId` in the adapter instance.
- **Booleans / numbers**: minimal coerce (`"true"`/`"false"`, `Number()`).
  Composio's API takes strings for most fields anyway.
- **Re-authorize with existing `connectionId`**: skip the fields prompt —
  Composio reuses the existing connection's config. Picker's re-auth path
  already calls `authorize` with `connectionId`; just don't gather
  `config` in that case.

## Acceptance criteria

- [ ] Pinning a Confluence connection from the agent builder works end-to-end
- [ ] Gmail / GitHub / Slack flows are unchanged (no field prompt rendered)
- [ ] No Composio-specific code in `packages/playground` — UI only reads
      generic `ConnectionField[]`
- [ ] New unit tests:
  - `composio-integration.test.ts`: `listConnectionFields` calls SDK with
    right args; `authorize` forwards `config` to `initiate`
  - `tool-integrations.test.ts` (server): new route returns fields; `authorize` route accepts `config`
  - `connection-picker.test.tsx`: renders form when fields > 0; required
    fields block submit; values passed to `authorize.mutateAsync`
- [ ] Type-check + targeted tests green for `core`, `editor`, `server`,
      `client-js`, `playground`

## Out of scope (follow-ups)

- **Editing fields on existing connections** — would need a Composio
  `connectedAccounts.update` flow (separate phase).
- **Validation rules** — Composio's field schema includes regex/enum
  hints we'd surface as a follow-up if users hit them.
- **Localization** of `displayName` / `description` (Composio returns
  English only today).

## Sizing

~1 working session. Self-contained, parallelizable with editor-mode plan.
