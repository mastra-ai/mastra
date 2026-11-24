---
'@mastra/platform': minor
'@mastra/platform-workspace': minor
---

`accessToken` on `PlatformMemory`, `PlatformKnowledge`, `PlatformSandbox` and `PlatformClient` now also accepts a function. It's called before every request, so long-lived clients can mint a fresh token each time instead of failing once the one they were built with expires.

```ts
const memory = new PlatformMemory({ instanceId, accessToken: () => mintProjectToken() });
```
