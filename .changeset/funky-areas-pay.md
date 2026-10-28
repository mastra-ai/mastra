---
'@mastra/observability': patch
---

Kept Vercel AI Gateway routing details (`providerMetadata.gateway.routing`) on model step spans. Exporters can now see which provider served each step and which provider attempts failed before a fallback.
