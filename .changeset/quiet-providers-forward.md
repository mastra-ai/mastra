---
'@mastra/server': patch
'@mastra/client-js': patch
---

Preserve arbitrary provider namespaces in agent execution `providerOptions` instead of silently stripping providers outside the built-in allowlist. Validate provider option values as JSON and update the generated client route types to match the open provider contract.
