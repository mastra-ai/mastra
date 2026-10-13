---
'@mastra/observability': minor
---

Added cost estimates for models that models.dev doesn't price, such as private deployments, using the `pricing` a custom gateway returns from `fetchProviders()`. Prices load on the first call that has no price, and also when Mastra starts under `mastra dev` or with `MASTRA_AUTO_REFRESH_PRICING=true`. A gateway that fails to load is logged and retried about once an hour. Set `MASTRA_OFFLINE=true` to skip loading them.
