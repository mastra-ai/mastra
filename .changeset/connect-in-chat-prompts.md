---
'@mastra/connect': minor
---

In-chat connect prompts for end-user connections. Resource-scoped `tools({ resourceId })` resolutions now include a built-in `request_connection` tool: when a task needs a provider the user hasn't connected, the agent calls it and gets a structured `connect-prompt` payload listing connectable providers with their current connection state, which chat UIs render as a connect card. The connectable set follows the `providers` allowlist when one is set, otherwise the full catalog. The tool is never added to global-only resolutions.

```ts
import { tools } from '@mastra/connect';

export const agent = new Agent({
  // ...
  tools: ctx => tools({ resourceId: ctx.requestContext.get('mastra__resourceId') }),
});

// Opt out of the built-in tool:
tools({ resourceId: userId, connectPrompt: false });
```

`userConnectRoutes()` `providers` is now optional: omit it to expose the full platform catalog on the end-user connect surface. An explicit empty array is still rejected, and configuring an allowlist behaves exactly as before.

```ts
// All catalog providers are connectable:
userConnectRoutes();

// Or restrict to an allowlist, as before:
userConnectRoutes({ providers: ['linear', 'slack'] });
```
