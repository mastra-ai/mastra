---
'@mastra/platform-workspace': minor
'@mastra/factory': minor
---

Added `getPortUrl()` to `PlatformSandbox`, which returns links for a server running on a port inside the sandbox. `url` only opens for people signed in with access to the sandbox and doesn't expire. `signInUrl` works once, within a minute, for browsers that can't sign in, like an agent's browser tool.

```ts
const { url, signInUrl } = await sandbox.getPortUrl(3000);
```

Factory session agents can now get these links with the `factory_sandbox_port_url` tool, so they can share a dev server or preview they started in their sandbox.
