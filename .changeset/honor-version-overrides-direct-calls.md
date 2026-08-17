---
'@mastra/core': patch
---

Honor stored agent version overrides on direct programmatic agent calls. Version overrides supplied via `MASTRA_VERSIONS_KEY` on the requestContext, the `versions` call option, or Mastra-level `versions` defaults now resolve the called agent itself to its stored version (previously they only applied to sub-agent delegation and HTTP routes), fixing the inconsistency where published overrides were served over HTTP but silently ignored in programmatic paths.
