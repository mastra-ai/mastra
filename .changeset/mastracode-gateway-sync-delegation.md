---
'mastracode': patch
---

Delegate gateway sync to `@mastra/core`'s `GatewayRegistry.syncGateways`, removing duplicated provider-fetch, type-generation, and atomic-write logic so mastracode stays in sync with core registry behavior.
