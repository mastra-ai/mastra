---
'@mastra/observability': patch
---

Fixed pricing model lookup to fall back to dot-to-dash normalization for model names (e.g. `gpt-5.2` → `gpt-5-2`), resolving `no_matching_model` errors for Azure deployments
