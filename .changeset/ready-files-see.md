---
'@mastra/platform-workspace': patch
---

Skip the workspace-proxy round-trip in `PlatformSandbox.getInfo()` when the sandbox address registry has an entry for the sandbox. Serving `getInfo()` from local state removes a per-poll `GET /sandbox/:id` hit that otherwise triggered a Railway GraphQL call plus a `sandboxExec` inside the sandbox on every workspace status poll. When no registry entry exists (or after an exec transport failure evicts it) `getInfo()` falls through to the proxy exactly as before.
