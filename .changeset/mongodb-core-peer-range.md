---
'@mastra/mongodb': patch
---

Bump the `@mastra/core` peer dependency floor to `>=1.53.0-0`. `@mastra/mongodb` imports `storageMessageMatchesMetadataFilter` from `@mastra/core/storage`, which core only exports from 1.53.0, but the peer range previously allowed `>=1.51.0-0`. Projects resolving core to 1.51.x/1.52.x installed cleanly and then failed at import time. Fixes https://github.com/mastra-ai/mastra/issues/20586
