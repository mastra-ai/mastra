---
'@mastra/core': patch
---

Fixed experiment comparisons when item, scorer, or experiment IDs match built-in object property names such as `constructor`, `toString`, or `__proto__`. Comparisons previously threw or dropped those entries; they now group and report them like any other ID.
