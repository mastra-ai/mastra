---
'@mastra/core': patch
---

Fixed custom model gateways being overridden by default gateways. GatewayManager now deduplicates gateways by ID (first-wins) so custom gateways take precedence over defaults. Narrowed the auth-availability check to only swallow expected missing-credential errors instead of all errors, so real gateway failures surface during debugging.
