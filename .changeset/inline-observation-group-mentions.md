---
'@mastra/memory': patch
---

Fixed observational memory merging a later observation group into an earlier truncated group when the truncated group quoted an `<observation-group>` tag inline. The later group is now parsed and shown in reflections with its own ID and range, and stripping group tags keeps both the quoted text and the later observations.
