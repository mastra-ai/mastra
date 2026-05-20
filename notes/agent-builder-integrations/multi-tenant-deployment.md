# Multi-tenant deployment with `caller-supplied` connections

Use this guide when your end users — not the agent author — own the Composio
connection. Common shape: a SaaS app where each customer signs into Gmail/Slack
with their own account, and a single agent runs on behalf of any of them.

## TL;DR

- Add `scope: 'caller-supplied'` to your pinned connection.
- The host app sets `MASTRA_RESOURCE_ID_KEY` on every request before the agent
  runs.
- The runtime buckets the connection under that key; no shared/author fallback.
- If the key is missing at runtime, Mastra throws
  `CALLER_SUPPLIED_USER_ID_MISSING` (structured `MastraError`).
- If the key is missing during `POST /authorize`, the server returns `400`.

## Scope cheat sheet

| Scope | Buckets connection under | Use when |
|---|---|---|
| `per-author` (builder default) | agent `authorId` | The agent author owns the credentials |
| `shared` | `SHARED_BUCKET_ID` (constant) | A team of editors share one OAuth account |
| `caller-supplied` (CMS default) | `ctx[MASTRA_RESOURCE_ID_KEY]` | End user owns their own credentials; host app injects the ID |

Mixed scopes per agent are first-class — e.g. Gmail can be `caller-supplied`
while Slack is `shared` on the same agent.

## 1. Pin the connection in the editor

In the CMS, the connection picker defaults to **Caller-supplied** because
that matches the legacy `ComposioToolProvider` behaviour out of the box. Select
the tools you want, hit *Mark caller-supplied*. The picker:

- Hides the "Pin an existing connection" section (per-user connections aren't
  enumerable from the author's seat).
- Hides the label input (labels are ignored for this scope).
- Stores a sentinel pin (`scope: 'caller-supplied'`, no `connectionId`). The
  real `connectionId` is created at runtime under the end user's bucket.

## 2. Set the resource ID per request in your host app

```ts
import { Mastra, RequestContext, MASTRA_RESOURCE_ID_KEY } from '@mastra/core';

// In your HTTP handler / queue worker / job runner:
const requestContext = new RequestContext();
requestContext.set(MASTRA_RESOURCE_ID_KEY, currentUser.id);

await mastra.getAgent('support').generate(prompt, { requestContext });
```

The same `requestContext` is plumbed through to the integration runtime, so
every Composio call resolves under `currentUser.id`.

## 3. Drive the end user through OAuth

When `currentUser.id` doesn't have a Composio account yet, kick off OAuth from
your host app (same shape as the picker would use, just with the end user's ID
in `requestContext`):

```ts
const { redirectUrl } = await client.toolIntegration('composio').authorize({
  toolService: 'gmail',
  scope: 'caller-supplied',
  // Mastra reads ctx[MASTRA_RESOURCE_ID_KEY] from the request that proxied this call.
});
```

Send the user to `redirectUrl`; Composio handles the OAuth round-trip and
stores the connection under that user's bucket.

If you forget to set `MASTRA_RESOURCE_ID_KEY` before calling `authorize`, the
server returns `400 Bad Request` with a `CALLER_SUPPLIED_USER_ID_MISSING`
payload.

## 4. Runtime resolution

When the agent runs:

1. Runtime sees `scope: 'caller-supplied'` on the pin.
2. Reads `ctx[MASTRA_RESOURCE_ID_KEY]` from the active `RequestContext`.
3. Passes that ID as Composio's `userId` for every tool call.
4. If the key is missing → throws `MastraError({ id: 'CALLER_SUPPLIED_USER_ID_MISSING' })`.

There is no fallback to the agent author or a shared bucket. The error is
structured so your host app can recognize it and route the user back through
OAuth or surface a friendly "connect your Gmail" message.

## 5. Admin visibility

End-user connections aren't listed in the picker for normal authors (the
filter would leak other tenants' identities). Admins (`tool-integrations:admin`
permission) can list connections for a specific end user via the `userIds[]`
query parameter on `GET /tool-integrations/:id/connections`:

```ts
await client.toolIntegration('composio').listConnections({
  scope: 'caller-supplied',
  userIds: ['user_abc123'],
});
```

`disconnect` and `usage` apply the same admin gate — admins can act on any
row, authors can only act on their own.

## 6. Migrating from legacy `ComposioToolProvider`

Legacy `ComposioToolProvider` resolved tools under the caller's `userId`
implicitly. The new equivalent is a single pinned connection with
`scope: 'caller-supplied'`. After migration:

- Same runtime semantics (`MASTRA_RESOURCE_ID_KEY` from request context).
- Plus: per-service allowlist, multi-account labels (for other scopes),
  dynamic auth fields, and admin tooling.
- Storage lives in `tool_connections` instead of the legacy `integrationTools`
  field on the agent.
