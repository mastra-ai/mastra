---
'@mastra/acp': minor
---

Added a `createClient` option to `createACPTool()` and `AcpAgent` for customizing the ACP client, and fixed a crash when the ACP agent command fails to start.

**Custom ACP client (`createClient`)**

Some ACP agents call custom extension methods (`extMethod` / `extNotification`) on the client. The built-in client rejected these with a "Method not found" error and could not be replaced, so those agents were unusable without reimplementing the whole connection. The new `createClient` option receives the default client and returns the client used for the connection:

```ts
import { createACPTool } from '@mastra/acp';

const tool = createACPTool({
  id: 'grok',
  description: 'Dispatch tasks to Grok',
  command: 'grok',
  createClient: defaultClient =>
    Object.assign(defaultClient, {
      extMethod: async (method, params) => ({}),
      extNotification: async (method, params) => {},
    }),
});
```

The `Client` type is now re-exported from `@mastra/acp` for fully custom implementations.

**Spawn failure handling**

If the configured `command` could not be started (for example the executable does not exist), the child process 'error' event was unhandled and crashed the host process. Tool execution now rejects with the spawn error instead.

Fixes #19109
