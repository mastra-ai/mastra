---
'mastracode': patch
---

Fixed provider name quoting in gateway sync to properly quote digit-leading provider IDs (e.g. `302ai`), preventing repeated "invalid provider-types in global cache" warnings from GatewayRegistry.
