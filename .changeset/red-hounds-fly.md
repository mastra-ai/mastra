---
'@mastra/client-js': patch
---

`getSystemPackages()` now returns `liveKitConnectionRouteEnabled`, true when the default `@mastra/livekit` connection route is mounted on the server.

```ts
const { liveKitConnectionRouteEnabled } = await client.getSystemPackages();
```
