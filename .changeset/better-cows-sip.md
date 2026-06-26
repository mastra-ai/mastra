---
'@mastra/observability': patch
---

Fixed pricing lookup when a provider-reported response model does not match a known pricing entry but the configured model does. Cost estimation now falls back to the configured model before reporting `no_matching_model`.
