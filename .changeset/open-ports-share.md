---
'@mastra/platform-workspace': minor
'@mastra/factory': minor
---

Added `getPortUrl()` to `PlatformSandbox`, which returns links for a server running on a port inside the sandbox. `url` only opens for people signed in with access to the sandbox and doesn't expire. `signInUrl` works once, within a minute, for browsers that can't sign in. `cookie` is what that link would set, for putting straight into a browser you control.

```ts
const { url, signInUrl, cookie } = await sandbox.getPortUrl(3000);
```

Factory session agents can now share a dev server or preview they started in their sandbox with the `factory_sandbox_port_url` tool. It returns only the shareable link and signs the session's browser in directly, so the agent can open the preview itself.
