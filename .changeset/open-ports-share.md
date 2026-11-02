---
'@mastra/platform-workspace': minor
'@mastra/factory': minor
---

Added `getPreviewCookie()` to `PlatformSandbox`. It returns a cookie that signs a browser you control, such as an agent's browser, in to a port for an hour, so it opens the port's URL from `sandbox.networking.getPortUrl()` without signing in.

```ts
const url = await sandbox.networking.getPortUrl(3000);
const cookie = await sandbox.getPreviewCookie(3000);
```

Factory session agents can now share a dev server or preview they started in their sandbox with the `factory_sandbox_port_url` tool. It returns only the shareable link and signs the session's browser in directly, so the agent can open the preview itself.
