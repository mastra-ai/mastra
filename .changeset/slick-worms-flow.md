---
'@mastra/editor': minor
---

Added authenticated-user execution and deterministic connected-account routing to ComposioToolProvider. Invoker-bound connections execute as the authenticated Composio user against the exact stored connected account, including accounts shared through Composio ACLs.

Use userIdResolver when application user IDs need mapping to Composio user IDs:

```typescript
import { MASTRA_USER_KEY } from '@mastra/server/auth';
import { ComposioToolProvider } from '@mastra/editor/composio';

const composio = new ComposioToolProvider({
  apiKey: process.env.COMPOSIO_API_KEY!,
  userIdResolver: ({ requestContext }) => {
    const user = requestContext?.getRaw(MASTRA_USER_KEY);
    if (!user || typeof user !== 'object' || !('id' in user) || typeof user.id !== 'string') return undefined;
    return user.id;
  },
});
```

Pinned caller-supplied connections now route to their exact account instead of allowing Composio to auto-select one.
