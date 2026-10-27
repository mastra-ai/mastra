---
'@mastra/server': minor
'@mastra/client-js': minor
---

Added read-only Knowledge routes on the Mastra server (`GET /knowledge`, `/knowledge/:knowledgeKey/graph`, `/nodes/:nodeId`, `/search`, `/activity`) and matching `listKnowledge()` / `getKnowledge(key)` methods on the JS client.

The routes are opt-in: they are not part of the default route set, so register them explicitly before they are served.

```ts
import { KNOWLEDGE_ROUTES } from '@mastra/server/server-adapter';

new Mastra({
  server: { apiRoutes: [...KNOWLEDGE_ROUTES] },
});
```

They are gated by a new `knowledge:read` permission, and each read takes the scope tags the viewer holds and returns only what those tags can see. The viewer picks those tags by default; to bound them per caller, set `MASTRA_KNOWLEDGE_SCOPE_KEY` (exported from `@mastra/server/server-adapter`) in `server.auth.authorize`, which runs after authentication, and every request outside that set is rejected with a 403. With an FGA provider configured, `GET /knowledge` lists only the instances the caller can read and the other routes answer 404 for any other instance.
With an RBAC or FGA provider configured, a Knowledge read whose caller has no bound scope is refused with a 403 instead of trusting the requested tags.
