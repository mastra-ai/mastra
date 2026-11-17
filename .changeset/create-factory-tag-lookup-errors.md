---
'create-factory': patch
---

`create-factory --tag` now stops before installing when the npm registry lookup for a Mastra package fails, instead of keeping that package's template version and producing a project that mixes release channels. A package that simply has no release under the tag still keeps its template version with a warning.
