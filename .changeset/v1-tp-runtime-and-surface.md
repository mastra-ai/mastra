---
'@mastra/core': minor
'@mastra/server': minor
'@mastra/client-js': minor
'@mastra/editor': minor
---

Added the v1 ToolProvider runtime, server routes, client SDK methods, and editor wiring that power OAuth-backed integrations on stored agents.

**Stored agents can now pin OAuth connections per toolkit**

A stored agent's config accepts a new `toolProviders` shape that tells the runtime which connection to bind for each toolkit at execution time. Connections can be scoped per-author, shared across an org, or supplied by the caller.

```ts
{
  toolProviders: {
    composio: {
      connections: {
        gmail: [{ kind: 'author', toolkit: 'gmail', connectionId: 'auth_abc', scope: 'per-author' }],
      },
      tools: {
        GMAIL_FETCH_EMAILS: { toolkit: 'gmail' },
      },
    },
  },
}
```

**New client SDK surface for managing connections**

```ts
import { MastraClient } from '@mastra/client-js';

const client = new MastraClient({ baseUrl: '…' });
const composio = client.toolProvider('composio');

const { items } = await composio.listConnections({ toolkit: 'gmail' });
await composio.disconnectConnection('auth_abc');
```

**New `ToolProvider` interface for custom providers**

Providers implement a VNext surface (`listToolkitsVNext`, `listToolsVNext`, `resolveToolsVNext`) plus the auth round-trip (`authorize`, `getAuthStatus`, `listConnections`, `disconnectConnection`, `listConnectionFields`, `health`). The Composio provider has been rewritten on this surface; the older catalog methods remain as `@deprecated` shims for back-compat.

Connections list responses use `page`/`perPage` pagination, matching the rest of the server surface.

Stored agents that don't set `toolProviders` continue to work unchanged. The Studio/Builder UI ships separately.
