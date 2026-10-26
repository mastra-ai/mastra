---
'@mastra/platform-workspace': minor
'@mastra/factory': minor
---

Added `getPortUrl()` to `PlatformSandbox`, which returns the public URL for a server running on a port inside the sandbox. Anyone with the URL can reach that port.

```ts
const url = await sandbox.getPortUrl(3000);
// https://3000-<sandbox>.e2b.app
```

Factory session agents can now get that URL with the `factory_sandbox_port_url` tool, so they can share a dev server or preview they started in their sandbox.
