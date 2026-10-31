---
'@mastra/server': minor
'@mastra/client-js': minor
---

Added read-only Knowledge routes on the Mastra server (`GET /knowledge`, `/knowledge/:knowledgeKey/tree`, `/pages/:pageId`, `/graph`, `/search`, `/activity`) and matching `listKnowledge()` / `getKnowledge(key)` methods on the JS client.

`GET /knowledge/:knowledgeKey/events` is a Server-Sent Events stream of the writes the caller can read, as `{ kind, op, pageId?, scopeId?, at }`; ids the caller can't read are left out. The server ends each stream after five minutes so a reconnect re-checks the caller's access; reconnect when it ends. Follow it from the client with `getKnowledge(key).events({ signal })`.

The routes are opt-in: they are not part of the default route set, so register them explicitly before they are served.

```ts
import { KNOWLEDGE_ROUTES } from '@mastra/server/server-adapter';

new Mastra({
  server: { apiRoutes: [...KNOWLEDGE_ROUTES] },
});
```

What they return depends on whether the app configures auth. Without auth they read every scope, page and note in the instance. With auth they return only what the signed-in caller can read: set `MASTRA_KNOWLEDGE_PRINCIPALS_KEY` on the request context in `authorize` to the caller's Knowledge principals (or `'all'` for an admin), and a caller with no mapping is refused with 403.

```ts
import { MASTRA_KNOWLEDGE_PRINCIPALS_KEY } from '@mastra/server/server-adapter';

authorize: async (path, method, user, context) => {
  if (path.startsWith('/api/knowledge')) {
    context.get('requestContext').set(MASTRA_KNOWLEDGE_PRINCIPALS_KEY, [`team:${user.orgId}:${user.teamId}`]);
    return true;
  }
  return appAuthorize(path, method, user, context); // keep your existing decision for other routes
};
```

The routes are gated by a new `knowledge:read` permission. With an FGA provider configured, `GET /knowledge` lists only the instances the caller can read and the other routes answer 404 for any other instance.

Scope pages in tree, page, graph and search responses carry their declaration's `displayLabel` when the declaration sets one, with the address's `$params` filled in (`"$orgId policy"` on `policy:$orgId` shows as `"acme policy"` for `policy:acme`), so the explorer can caption a scope by its kind.

The graph response also lists `grants`: the declared access grants onto the scopes it shows (principal scope address, its page id when it has one, its `principalLabel`, the target scope's page id and the role), so the explorer can draw who reaches what. Only principal scopes the caller can read are included; an owner view (`'all'`) also gets declared principals nothing was written to yet. Servers on a core without grant support leave the field out.
