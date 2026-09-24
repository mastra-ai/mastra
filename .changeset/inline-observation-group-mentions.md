---
'@mastra/memory': patch
---

Fixed observational memory attributing a later observation group to an earlier truncated group when the truncated group quoted an `<observation-group>` tag inline. The later group now keeps its own ID and range during parsing, stripping, and reflection rendering.
