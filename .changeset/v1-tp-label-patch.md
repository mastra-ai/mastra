---
'@mastra/server': minor
'@mastra/client-js': minor
---

Added a `PATCH /tool-providers/:providerId/connections/:connectionId` endpoint and matching client SDK method so authors can rename a connection's display label after creation.

**Rename a connection from the client SDK**

```ts
import { MastraClient } from '@mastra/client-js';

const client = new MastraClient({ baseUrl: '…' });

await client.toolProvider('composio').updateConnection('auth_abc', {
  label: 'Work inbox',
});
```

Pass `label: null` to clear the existing label. Labels are 1–32 characters.

**Ownership enforced server-side**

Non-owners get a 403 unless they hold `tool-providers:admin`. Shared connections are reachable by every author. The label is stored on the connection row itself, so the rename flows to every agent that pins the connection — no per-agent edit needed.
