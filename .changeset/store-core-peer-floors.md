---
'@mastra/cloudflare': patch
'@mastra/convex': patch
'@mastra/dsql': patch
'@mastra/dynamodb': patch
'@mastra/lance': patch
'@mastra/mongodb': patch
'@mastra/pg': patch
'@mastra/redis': patch
'@mastra/upstash': patch
---

Fixed nine storage adapters declaring a `@mastra/core` peer range that permitted core versions too old to load them. Each adapter imports `storageMessageMatchesMetadataFilter` from `@mastra/core/storage`, which core only exports from 1.53.0, but every one of them still advertised a floor below that — as low as `>=1.0.0-0`. Package managers accepted the incompatible pair without a warning and the install then failed at import time:

```
SyntaxError: The requested module '@mastra/core/storage' does not provide an export named 'storageMessageMatchesMetadataFilter'
```

All nine now declare `>=1.53.0-0 <2.0.0-0`, so npm and pnpm surface a peer conflict at install time instead of letting the project break on first import.

Fixes [#20586](https://github.com/mastra-ai/mastra/issues/20586).
