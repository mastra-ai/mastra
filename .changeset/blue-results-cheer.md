---
'@mastra/convex': patch
---

Fixed `@mastra/convex` workflow snapshot persistence when snapshots contain `$`-prefixed JSON Schema keys (for example `$schema` and `$ref`).
Snapshots are now stored safely, preventing Convex validation failures during workflow runs. Fixes `#16110`.
