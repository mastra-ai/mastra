---
'@mastra/server': patch
---

Updated the `querySpans()` API contract with context and parent/root entity fields. With the updated core contract, model/provider filters are no longer accepted and responses no longer include `cost`, `inputTruncated`, `outputTruncated` or `errorTruncated`. Model/provider values and previews remain in returned rows. Available query capabilities follow the installed core and storage adapter versions.
