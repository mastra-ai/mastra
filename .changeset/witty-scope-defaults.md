---
'@mastra/server': patch
---

The tool provider authorize handler now falls back to the provider's `defaultScope` when a request does not specify a connection `scope`. Precedence is: explicit request `scope`, then the provider's `defaultScope`, then `'per-author'`. This lets a provider configured with `defaultScope: 'caller-supplied'` produce per-tenant connections through the Agent Builder connect flow, which does not send a scope.
