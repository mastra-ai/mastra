---
'@mastra/observability': minor
---

Cost estimates now use the `pricing` a custom gateway returns from `fetchProviders()` for models that models.dev doesn't price, such as private deployments. Prices load when Mastra starts and on the first unpriced call, and a gateway that fails to load is logged and retried about once an hour. Set `MASTRA_OFFLINE=true` to skip loading them.
