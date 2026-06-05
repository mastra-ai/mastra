---
'@mastra/server': minor
'@mastra/client-js': minor
---

Add server endpoints so Studio can resolve agent-builder model availability and auth permission patterns without importing server-only EE code in the browser:

- `GET /editor/builder/models/available` returns the provider/model list already filtered by the active builder model policy (`requiresAuth: true`, `stored-agents:read`).
- `GET /auth/permission-patterns` returns the valid permission-pattern strings. It is gated by `requiresAuth: true` with no finer-grained permission: the response is the non-sensitive route-permission vocabulary that every authenticated user needs to gate their own sidebar/redirects, and there is no narrower permission that fits.

`@mastra/client-js` gains `getBuilderAvailableModels()` and `getPermissionPatterns()` to consume these endpoints.

```ts
import { MastraClient } from '@mastra/client-js';

const client = new MastraClient({ baseUrl: 'http://localhost:4111' });

const { providers } = await client.getBuilderAvailableModels();
const { patterns } = await client.getPermissionPatterns();
```
