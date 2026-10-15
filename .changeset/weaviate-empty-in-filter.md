---
'@mastra/weaviate': patch
---

Fixed `$in` filters with an empty array, which made Weaviate queries fail on text-array metadata. An empty `$in` now matches nothing and an empty `$nin` matches everything, like the other vector stores.
