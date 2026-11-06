---
'@mastra/factory': minor
---

Added MCP servers to Factory. Organization admins can connect remote MCP servers in **Settings → MCP Servers** and choose which of their tools Factory sessions can use.

- Connect a server by its URL with no authentication, a bearer token, custom headers, or OAuth sign-in.
- Selected tools are available in every session in the organization, including the sessions that run work items. They follow the **MCP** permission in **Settings → Behavior**.
- Saved headers and OAuth tokens act for the whole organization. They are encrypted when `secretEncryption` is set and are never sent back to the browser.

MCP servers are on by default. Pass `mcpServers: false` to turn them off, or allow servers on your own network (for example during local development):

```ts
new MastraFactory({
  // ...
  mcpServers: { allowPrivateNetwork: true },
});
```
