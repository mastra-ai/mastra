---
'@mastra/memory': patch
---

Fixed schema-based working memory so that `null` consistently deletes a field. Previously, a `null` only removed a field that already existed: on the very first write, or inside a nested object created for the first time, the `null` was stored literally. This mattered because strict-mode model providers pad every field they are not updating with `null`, so a first write could be saved as `{ "role": null }`. Working memory updates are also no longer stored by reference to the object passed in.
