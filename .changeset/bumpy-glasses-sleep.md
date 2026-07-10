---
'@mastra/core': patch
---

Added an optional `scope` field to `ResolveToolsOpts` so tool providers can see a connection's identity bucketing (`per-author`, `shared`, or `caller-supplied`) when resolving tools. Providers can use this to let the backend auto-resolve an account within a caller's bucket instead of pinning a specific one. The field is optional and defaults to previous behavior when absent.

Also added an optional `defaultScope` to `BaseToolProviderOptions` (surfaced on the `ToolProvider` interface as `defaultScope`). This lets an app author set a tool provider's connection scope at config time — for example `defaultScope: 'caller-supplied'` for multi-tenant OAuth — so every connection authorized against the provider is bucketed correctly without any per-connection UI control. Defaults to `'per-author'` when absent.
