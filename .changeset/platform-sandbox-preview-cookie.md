---
'@mastra/platform-workspace': minor
---

Added `getPreviewCookie()` to `PlatformSandbox`. It returns a cookie that signs a browser you control, such as an agent's browser, in to a port for an hour, so it opens the port's URL from `sandbox.networking.getPortUrl()` without signing in.

```ts
const url = await sandbox.networking?.getPortUrl(3000);
const cookie = await sandbox.getPreviewCookie(3000);
```
