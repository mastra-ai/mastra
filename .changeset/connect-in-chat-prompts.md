---
'@mastra/connect': minor
'@mastra/playground-ui': minor
---

In-chat connect prompts for end-user connections. Resource-scoped `tools({ resourceId })` resolutions now include a built-in `request_connection` tool: when a task needs a provider the user hasn't connected, the agent calls it and gets a structured list of connectable providers with current connection state. Studio's chat renders the result as a connect card that drives the mounted `userConnectRoutes()` flow (session → launch gate → status polling), so users can connect an account without leaving the conversation. The connectable set follows the `providers` allowlist when one is set, otherwise the full catalog; opt out with `connectPrompt: false`. The tool is never added to global-only resolutions.

`userConnectRoutes()` `providers` is now optional: omit it to expose the full platform catalog on the end-user connect surface. An explicit empty array is still rejected, and configuring an allowlist behaves exactly as before.
