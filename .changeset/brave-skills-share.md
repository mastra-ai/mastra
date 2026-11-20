---
'@mastra/core': patch
---

Fixed skill search failing when two skills share a name. Searching no longer throws "multiple local skills found"; each matching skill is returned with its own path. Getting a skill by an ambiguous name still errors.
