---
'@mastra/server': patch
'@mastra/client-js': patch
---

Hardened v1 ToolProvider connection routes and SDK forwarding.

**Fail closed on unknown `connectionId`**

`DELETE /tool-providers/:providerId/connections/:connectionId` and
`GET …/usage` now return `403` when storage is configured but no persisted
row matches the supplied `connectionId` and the caller isn't an admin.
Previously these routes fell through to the caller's own `authorId`, which
let non-admin callers probe (and trigger provider-side `revokeConnection`
for) IDs that didn't belong to them.

**Aligned authorize label validation with stored label rules**

`POST /tool-providers/:providerId/authorize` now enforces the same label
rules the stored `toolProviders` config uses (`min(1)`, `max(32)`,
`/^[A-Za-z0-9 _-]+$/`). Labels that pass `authorize` are now guaranteed to
pass downstream stored-agent validation.

**SDK forwards `toolkit` on connection-scoped operations**

`@mastra/client-js`:

```ts
await client.toolProviders.get('composio').disconnectConnection('ca_xxx', {
  toolkit: 'gmail',
  force: true,
});

const usage = await client.toolProviders
  .get('composio')
  .getConnectionUsage('ca_xxx', { toolkit: 'gmail' });
```

`disconnectConnection` now forwards `params.toolkit` (previously dropped)
and `getConnectionUsage` accepts an optional `{ toolkit }` parameter so
toolkit-scoped connection lookups disambiguate correctly server-side.
