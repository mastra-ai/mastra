---
'@mastra/core': minor
---

Added route groups for API route factories that register multiple HTTP methods or paths.

```ts
const postRoute = registerApiRoute('/chat', {
  method: 'POST',
  handler: handleChat,
});

const reconnectRoute = registerApiRoute('/chat/runs/:runId', {
  method: 'GET',
  handler: reconnectToChat,
});

return registerApiRouteGroup(postRoute, [reconnectRoute]);
```

Registering the group adds both `POST /chat` and `GET /chat/runs/:runId`, while direct consumers can continue using the returned value as the primary POST route.
