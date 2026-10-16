---
'@mastra/server': patch
---

Updated the `querySpans()` API contract with context and parent/root entity fields. Model/provider filters are no longer accepted; responses no longer include `cost`, `inputTruncated`, `outputTruncated` or `errorTruncated`. Model/provider values and previews remain in returned rows. Use matching core and storage adapter versions.
