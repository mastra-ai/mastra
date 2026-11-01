---
'@mastra/core': patch
---

Fixed metadata filters in the in-memory store returning records whose nested metadata had different keys from the filter when one side contained an `undefined` value.
